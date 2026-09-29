/**
 * Uploads to Google Drive through resumable-upload sessions opened by the
 * backend. Bytes go straight from the phone to Drive; if the browser blocks
 * that, chunks are relayed through the backend instead.
 */
import { storyApi } from "./api";

const QUANTUM = 256 * 1024; // Drive requires non-final chunks in multiples of this
const CHUNK = 32 * QUANTUM; // 8 MB

export interface DriveFile {
  id: string;
  name: string;
}

let relayMode = false;

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

interface PutResult {
  done: boolean;
  file?: DriveFile;
  committed?: number; // bytes Drive has stored so far
}

function parseRange(r: string | null | undefined): number {
  const m = r && r.match(/bytes=0-(\d+)/);
  return m ? Number(m[1]) + 1 : 0;
}

/** One PUT of `chunk` at byte `start`; `total` is null until the final chunk. */
async function putChunk(
  code: string,
  url: string,
  chunk: Blob,
  start: number,
  total: number | null,
): Promise<PutResult> {
  const range = chunk.size
    ? `bytes ${start}-${start + chunk.size - 1}/${total ?? "*"}`
    : `bytes */${total ?? "*"}`;
  if (!relayMode) {
    try {
      const res = await fetch(url, { method: "PUT", headers: { "Content-Range": range }, body: chunk });
      if (res.status === 200 || res.status === 201) return { done: true, file: await res.json() };
      if (res.status === 308) return { done: false, committed: parseRange(res.headers.get("Range")) || start + chunk.size };
      throw new Error(`Drive upload failed (${res.status})`);
    } catch (e) {
      // A TypeError here is either a network drop or the browser refusing the
      // cross-origin PUT. Try the relay; if it works, keep using it.
      if (!(e instanceof TypeError)) throw e;
      relayMode = true;
    }
  }
  const r = await storyApi<{ status: number; file?: DriveFile; range?: string }>("uploadChunk", {
    code,
    uploadUrl: url,
    start,
    total,
    data: chunk.size ? await blobToBase64(chunk) : "",
  });
  if (r.file) return { done: true, file: r.file };
  return { done: false, committed: parseRange(r.range) || start + chunk.size };
}

async function queryCommitted(code: string, url: string): Promise<number> {
  try {
    const r = await putChunk(code, url, new Blob([]), 0, null);
    return r.committed ?? 0;
  } catch {
    return -1;
  }
}

/** Sends one chunk, retrying from wherever Drive actually stopped. */
async function sendWithRetry(
  code: string,
  url: string,
  chunk: Blob,
  start: number,
  total: number | null,
): Promise<PutResult> {
  let lastErr: unknown;
  let s = start;
  let c = chunk;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await putChunk(code, url, c, s, total);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      const committed = await queryCommitted(code, url);
      if (committed > s && committed <= start + chunk.size) {
        c = chunk.slice(committed - start);
        s = committed;
        if (!c.size && total === null) return { done: false, committed };
      }
    }
  }
  throw lastErr;
}

/**
 * Streams a growing recording (MediaRecorder output) to Drive while the
 * interview is still going, so almost nothing is lost if the phone dies.
 * Chunks that fail stay queued, so retry() can pick up where it stopped.
 */
export class StreamUploader {
  private parts: Blob[] = [];
  private buffered = 0;
  private offset = 0;
  private queue: { chunk: Blob; start: number; total: number | null }[] = [];
  private running: Promise<void> | null = null;
  private finalQueued = false;
  private url: Promise<string>;
  private file: DriveFile | undefined;
  uploaded = 0;
  failed: unknown = null;

  constructor(
    private code: string,
    private openSession: () => Promise<string>,
  ) {
    this.url = openSession();
    this.url.catch(() => {});
  }

  push(b: Blob) {
    if (!b.size || this.finalQueued) return;
    this.parts.push(b);
    this.buffered += b.size;
    if (this.buffered >= CHUNK) this.enqueue(false);
  }

  private enqueue(final: boolean) {
    const all = new Blob(this.parts);
    const sendLen = final ? all.size : Math.floor(all.size / QUANTUM) * QUANTUM;
    const rest = all.slice(sendLen);
    this.parts = rest.size ? [rest] : [];
    this.buffered = rest.size;
    const start = this.offset;
    this.offset += sendLen;
    this.queue.push({ chunk: all.slice(0, sendLen), start, total: final ? this.offset : null });
    if (final) this.finalQueued = true;
    this.pump();
  }

  private pump(): Promise<void> {
    if (this.running) return this.running;
    this.running = (async () => {
      while (this.queue.length && !this.failed) {
        const q = this.queue[0];
        try {
          const url = await this.url;
          const r = await sendWithRetry(this.code, url, q.chunk, q.start, q.total);
          this.uploaded = q.start + q.chunk.size;
          if (r.file) this.file = r.file;
          this.queue.shift();
        } catch (e) {
          this.failed = e;
        }
      }
      this.running = null;
    })();
    return this.running;
  }

  pendingBytes() {
    return this.offset + this.buffered - this.uploaded;
  }

  /** Sends whatever is left and returns the finished Drive file. */
  async finish(): Promise<DriveFile | undefined> {
    if (!this.finalQueued) this.enqueue(true);
    await this.pump();
    if (this.failed) throw this.failed;
    return this.file;
  }

  /** After a failure (e.g. network gone): try the remaining chunks again. */
  async retry(): Promise<DriveFile | undefined> {
    this.failed = null;
    this.url = this.url.catch(() => this.openSession());
    return this.finish();
  }
}

/** Uploads a whole file (photo or video the player picked), reporting progress 0..1. */
export async function uploadFile(
  code: string,
  file: Blob,
  opts: { kind: "upload" | "portrait"; name: string; caption?: string },
  onProgress?: (p: number) => void,
): Promise<DriveFile | undefined> {
  const mimeType = file.type || "application/octet-stream";
  const s = await storyApi<{ uploadUrl: string }>("uploadStart", {
    code,
    kind: opts.kind,
    name: opts.name,
    mimeType,
    size: file.size,
    caption: opts.caption,
    origin: location.origin,
  });
  let start = 0;
  let result: DriveFile | undefined;
  while (start < file.size || file.size === 0) {
    const end = Math.min(file.size, start + CHUNK);
    const r = await sendWithRetry(code, s.uploadUrl, file.slice(start, end), start, file.size);
    start = r.committed ?? end;
    onProgress?.(file.size ? start / file.size : 1);
    if (r.done) {
      result = r.file;
      break;
    }
  }
  storyApi("uploadDone", { code, kind: opts.kind, fileId: result?.id }).catch(() => {});
  return result;
}
