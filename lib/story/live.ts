/**
 * A live voice conversation with Gemini (Maitri) over WebSocket.
 *
 * Microphone audio goes up as 16 kHz PCM; Maitri's voice comes back as 24 kHz
 * PCM and is played through `output` (which the page also mixes into the
 * video recording). Connections drop every ~10 minutes by design and on bad
 * networks, so the session transparently reconnects using Gemini's session
 * resumption handle.
 */

export interface LiveToken {
  wsUrl: string;
  model: string;
}

export interface LiveHandlers {
  /** resumed = the conversation continued with its memory intact */
  onReady?: (resumed: boolean) => void;
  onMaitriText?: (text: string) => void;
  onPlayerText?: (text: string) => void;
  onTurnComplete?: () => void;
  onTool?: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
  onStatus?: (s: "connecting" | "live" | "reconnecting" | "closed") => void;
  onFatal?: (message: string) => void;
  onLog?: (event: string) => void;
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function b64FromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private handle: string | null = null;
  private ready = false;
  private resuming = false;
  private closedByUs = false;
  private retries = 0;
  private playHead = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private decoder = new TextDecoder();
  private micMuted = false;
  // Echo guard: if Maitri keeps getting "interrupted" without the player
  // saying anything, her own voice is leaking into the mic. Then we stop
  // sending mic audio while she speaks (half-duplex).
  private halfDuplex = false;
  private heardPlayerThisTurn = false;
  private selfInterrupts = 0;

  constructor(
    private ctx: AudioContext,
    private output: AudioNode,
    /** needHistory: a fresh session is needed after a drop, so Maitri must be told what was already said */
    private getToken: (needHistory: boolean) => Promise<LiveToken>,
    private h: LiveHandlers,
  ) {}

  get maitriSpeaking() {
    return this.playHead > this.ctx.currentTime + 0.05;
  }

  async start() {
    await this.open(false);
  }

  private async open(reconnect: boolean) {
    this.h.onStatus?.(reconnect ? "reconnecting" : "connecting");
    const resuming = !!this.handle;
    const tok = await this.getToken(reconnect && !resuming);
    this.resuming = resuming;
    this.h.onLog?.(`connecting ${tok.model}${resuming ? " (resume)" : ""}`);
    const ws = new WebSocket(tok.wsUrl);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    this.ready = false;
    ws.onopen = () => {
      ws.send(JSON.stringify({ setup: { model: tok.model, sessionResumption: this.handle ? { handle: this.handle } : {} } }));
    };
    ws.onmessage = (ev) => {
      const text = typeof ev.data === "string" ? ev.data : this.decoder.decode(ev.data as ArrayBuffer);
      let msg: Json;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      this.onMessage(msg);
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ready = false;
      this.h.onLog?.(`socket closed ${ev.code} ${ev.reason || ""}`.trim());
      if (this.closedByUs) {
        this.h.onStatus?.("closed");
        return;
      }
      // 1008/1007 = the server rejected our request (bad token, quota); retrying
      // with the same token will not help, so ask for a fresh one.
      this.reconnect(ev.code, ev.reason);
    };
  }

  private reconnect(code?: number, reason?: string) {
    if (this.closedByUs) return;
    if (this.retries >= 6) {
      this.h.onFatal?.(`Connection lost (${code ?? ""} ${reason ?? ""})`.trim());
      return;
    }
    // A handle that keeps failing may have expired; start fresh (with history) instead.
    if (this.retries >= 2) this.handle = null;
    const wait = Math.min(8000, 800 * 2 ** this.retries);
    this.retries++;
    this.h.onStatus?.("reconnecting");
    setTimeout(() => {
      this.open(true).catch((e) => this.h.onFatal?.(String(e?.message || e)));
    }, wait);
  }

  private async onMessage(m: Json) {
    if (m.setupComplete) {
      this.ready = true;
      this.retries = 0;
      this.h.onLog?.("live");
      this.h.onStatus?.("live");
      this.h.onReady?.(this.resuming);
      return;
    }
    if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) {
      this.handle = m.sessionResumptionUpdate.newHandle;
    }
    if (m.goAway) {
      this.h.onLog?.("goAway - switching connection");
      // The server will close soon; move to a new connection now.
      const old = this.ws;
      this.ws = null;
      old?.close();
      this.open(true).catch(() => this.reconnect());
      return;
    }
    const sc = m.serverContent;
    if (sc) {
      if (sc.interrupted) {
        this.stopPlayback();
        if (!this.heardPlayerThisTurn && ++this.selfInterrupts >= 2) this.halfDuplex = true;
      }
      for (const part of sc.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) this.play(part.inlineData.data);
      }
      if (sc.outputTranscription?.text) this.h.onMaitriText?.(sc.outputTranscription.text);
      if (sc.inputTranscription?.text) {
        this.heardPlayerThisTurn = true;
        this.h.onPlayerText?.(sc.inputTranscription.text);
      }
      if (sc.turnComplete) {
        this.heardPlayerThisTurn = false;
        this.h.onTurnComplete?.();
      }
    }
    if (m.toolCall?.functionCalls) {
      const responses = [];
      for (const fc of m.toolCall.functionCalls) {
        let response: Record<string, unknown> = { ok: true };
        try {
          response = (await this.h.onTool?.(fc.name, fc.args ?? {})) ?? { ok: true };
        } catch (e) {
          response = { ok: false, error: String(e) };
        }
        responses.push({ id: fc.id, name: fc.name, response });
      }
      this.send({ toolResponse: { functionResponses: responses } });
    }
  }

  private send(o: Json) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(o));
  }

  /** 100 ms of 16 kHz PCM from the capture worklet. */
  sendAudio(buf: ArrayBuffer) {
    if (!this.ready || this.micMuted) return;
    if (this.halfDuplex && this.maitriSpeaking) return;
    this.send({ realtimeInput: { audio: { data: b64FromBuffer(buf), mimeType: "audio/pcm;rate=16000" } } });
  }

  /** A note from the app, e.g. "[START]" or "[TIME] ...". */
  sendNote(text: string) {
    this.send({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } });
  }

  setMicMuted(m: boolean) {
    this.micMuted = m;
  }

  private play(b64: string) {
    const bin = atob(b64);
    const n = bin.length >> 1;
    if (!n) return;
    const buf = this.ctx.createBuffer(1, n, 24000);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      data[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.output);
    const at = Math.max(this.ctx.currentTime + 0.03, this.playHead);
    src.start(at);
    this.playHead = at + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  stopPlayback() {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.sources.clear();
    this.playHead = this.ctx.currentTime;
  }

  /** Resolves once Maitri has finished saying what is queued. */
  async drain(maxMs = 15000) {
    const until = Date.now() + maxMs;
    while (this.maitriSpeaking && Date.now() < until) await new Promise((r) => setTimeout(r, 200));
  }

  close() {
    this.closedByUs = true;
    this.stopPlayback();
    this.ws?.close();
  }
}
