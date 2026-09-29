/**
 * Runs one interview: microphone -> Maitri (Gemini Live), Maitri's voice ->
 * speaker, camera + both voices -> a video recording streamed to Drive, and a
 * running transcript saved to Drive every 30 seconds.
 */
import { flushStoryLog, storyApi, storyBeacon, storyLog } from "./api";
import { LiveSession } from "./live";
import { StreamUploader, uploadFile } from "./upload";
import type { Lang } from "./i18n";

export interface Line {
  t: number;
  who: "maitri" | "player";
  text: string;
}

export interface InterviewCallbacks {
  onStatus: (s: "connecting" | "live" | "reconnecting" | "closed") => void;
  onMaitriCaption: (text: string) => void;
  onTopic: (id: string) => void;
  onPortrait: () => void;
  onTick: (seconds: number) => void;
  onEnding: () => void;
  onSaveProgress: (sentBytes: number, pendingBytes: number) => void;
  onFatal: (message: string) => void;
}

const RECORDER_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export async function getCameraAndMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}`;
}

export class Interview {
  readonly sessionId = stamp();
  lines: Line[] = [];
  private openLine: Line | null = null;
  private live!: LiveSession;
  private recorder: MediaRecorder | null = null;
  private uploader: StreamUploader | null = null;
  private startedAt = 0;
  private pausedFor = 0;
  private pausedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;
  private lastSave = 0;
  private nudged = { soon: false, over: false };
  private ending = false;
  private finished: Promise<boolean> | null = null;
  private modelIndex = 0;
  private readyOnce = false;
  private attemptsWithoutReady = 0;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private endRequested = false;
  completed = false;

  constructor(
    private code: string,
    private lang: Lang,
    private minutes: number,
    private continuing: boolean,
    private liveModels: number,
    private stream: MediaStream,
    private video: HTMLVideoElement,
    private cb: InterviewCallbacks,
    /** Created (and resumed) inside the player's tap, which some browsers require. */
    private ctx: AudioContext,
  ) {}

  private log(event: string) {
    storyLog(this.code, event);
  }

  get speaking() {
    return this.live?.maitriSpeaking ?? false;
  }

  get elapsed() {
    if (!this.startedAt) return 0;
    const now = this.pausedAt || Date.now();
    return Math.max(0, (now - this.startedAt - this.pausedFor) / 1000);
  }

  async start() {
    this.log(`start: audio ${this.ctx.state} ${this.ctx.sampleRate}Hz, video ${this.stream.getVideoTracks().length}, mic ${this.stream.getAudioTracks().length}`);
    if (this.ctx.state !== "running") {
      // Never wait forever: some browsers leave resume() pending.
      await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 3000))]);
      this.log(`audio after resume: ${this.ctx.state}`);
    }
    if (!this.ctx.audioWorklet) throw new Error("This browser cannot process audio. Please open the link in Google Chrome.");
    await this.ctx.audioWorklet.addModule(`${process.env.NEXT_PUBLIC_BASE_PATH}/pcm-capture-worklet.js`);
    this.log("audio worklet ready");

    const mic = this.ctx.createMediaStreamSource(this.stream);
    const capture = new AudioWorkletNode(this.ctx, "pcm-capture");
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    mic.connect(capture).connect(silent).connect(this.ctx.destination);

    // Maitri's voice goes to the speaker and into the recording; the
    // player's mic goes only into the recording (never back to the speaker).
    const voice = this.ctx.createGain();
    voice.connect(this.ctx.destination);
    const recMix = this.ctx.createMediaStreamDestination();
    mic.connect(recMix);
    voice.connect(recMix);

    this.live = new LiveSession(this.ctx, voice, (needHistory) => this.token(needHistory), {
      onStatus: (s) => this.cb.onStatus(s),
      onReady: (resumed) => {
        this.attemptsWithoutReady = 0;
        if (!this.readyOnce) {
          this.readyOnce = true;
          this.startedAt = Date.now();
          this.timer = setInterval(() => this.tick(), 1000);
        }
        if (!resumed) this.live.sendNote("[START]");
      },
      onMaitriText: (t) => this.addText("maitri", t),
      onPlayerText: (t) => this.addText("player", t),
      onTurnComplete: () => {
        if (this.openLine?.who === "maitri") this.openLine = null;
      },
      onTool: (name, args) => this.tool(name, args),
      onFatal: (m) => {
        this.log(`fatal: ${m}`);
        flushStoryLog();
        this.cb.onFatal(m);
      },
      onLog: (e) => this.log(e),
    });
    capture.port.onmessage = (e) => this.live.sendAudio(e.data as ArrayBuffer);

    this.startRecording(new MediaStream([...this.stream.getVideoTracks(), ...recMix.stream.getAudioTracks()]));
    this.keepAwake();
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);
    await this.live.start();
  }

  private async token(needHistory: boolean) {
    // A connection that never became ready is most likely a model out of
    // free quota: try the next one.
    if (this.attemptsWithoutReady++ > 0) this.modelIndex = Math.min(this.modelIndex + 1, this.liveModels - 1);
    if (needHistory) await this.saveTranscript();
    const t = await storyApi<{ wsUrl: string; model: string }>("liveToken", {
      code: this.code,
      lang: this.lang,
      modelIndex: this.modelIndex,
      withHistory: needHistory || (this.continuing && !this.readyOnce),
      midCall: needHistory,
      sessionId: this.sessionId,
    });
    this.log("token ok");
    return t;
  }

  private startRecording(s: MediaStream) {
    if (typeof MediaRecorder === "undefined") return;
    const mimeType = RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    try {
      this.recorder = new MediaRecorder(s, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 96_000,
      });
    } catch {
      this.recorder = new MediaRecorder(s);
    }
    const type = (this.recorder.mimeType || mimeType || "video/webm").split(";")[0];
    this.log(`recorder ${this.recorder.mimeType || mimeType || "default"}`);
    this.uploader = new StreamUploader(this.code, async () => {
      const r = await storyApi<{ uploadUrl: string }>("uploadStart", {
        code: this.code,
        kind: "interview",
        mimeType: type,
        sessionId: this.sessionId,
        origin: location.origin,
      });
      return r.uploadUrl;
    });
    this.recorder.ondataavailable = (e) => this.uploader?.push(e.data);
    this.recorder.start(3000);
  }

  private addText(who: Line["who"], text: string) {
    if (who === "maitri" && this.openLine?.who === "player") this.openLine = null;
    if (who === "player" && this.openLine?.who === "maitri") this.openLine = null;
    if (!this.openLine) {
      this.openLine = { t: Math.round(this.elapsed), who, text: "" };
      this.lines.push(this.openLine);
    }
    this.openLine.text = (this.openLine.text + text).replace(/\s+/g, " ").trimStart();
    this.dirty = true;
    if (who === "maitri") this.cb.onMaitriCaption(this.openLine.text);
  }

  private async tool(name: string, args: Record<string, unknown>) {
    if (name === "mark_topic") {
      this.cb.onTopic(String(args.topic || ""));
      return { ok: true };
    }
    if (name === "take_portrait") {
      const ok = await this.portrait();
      return { ok, note: ok ? "Photo saved." : "Camera photo failed - just continue." };
    }
    if (name === "end_interview") {
      // Guard against ending by mistake right at the start: only the player
      // (End button / [END]) can finish in the first two minutes.
      if (!this.endRequested && this.elapsed < 120) {
        this.log(`blocked early end_interview at ${Math.round(this.elapsed)}s`);
        return { ok: false, error: "Too early - the interview has only just started. Do not end. Continue with the next question." };
      }
      this.log(`end_interview at ${Math.round(this.elapsed)}s`);
      this.completed = args.completed !== false;
      setTimeout(() => this.finish(), 0);
      return { ok: true };
    }
    return { ok: false, error: "unknown function" };
  }

  private async portrait(): Promise<boolean> {
    const v = this.video;
    if (!v.videoWidth) return false;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    this.cb.onPortrait();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return false;
    uploadFile(this.code, blob, { kind: "portrait", name: "portrait.jpg" }).catch(() => {});
    return true;
  }

  private tick() {
    const s = this.elapsed;
    this.cb.onTick(s);
    const target = this.minutes * 60;
    if (!this.nudged.soon && s > target - 180) {
      this.nudged.soon = true;
      this.live.sendNote("[TIME] About 3 minutes left. If dreams and the message to donors are not covered yet, move to them soon.");
    }
    if (!this.nudged.over && s > target + 180) {
      this.nudged.over = true;
      this.live.sendNote("[TIME] Time is up. Ask for the message to donors now if not done, then thank the player and end.");
    }
    if (s > 30 * 60 && !this.ending) this.finish();
    if (this.dirty && Date.now() - this.lastSave > 30000) this.saveTranscript();
  }

  async saveTranscript() {
    if (!this.lines.length) return;
    this.dirty = false;
    this.lastSave = Date.now();
    try {
      await storyApi("transcript", this.transcriptBody());
    } catch {
      this.dirty = true;
    }
  }

  private transcriptBody() {
    return {
      code: this.code,
      sessionId: this.sessionId,
      lang: this.lang,
      minutes: Math.round(this.elapsed / 60),
      lines: this.lines.filter((l) => l.text.trim()),
    };
  }

  skip() {
    this.live.stopPlayback();
    this.live.sendNote("[SKIP]");
  }

  pause() {
    this.pausedAt = Date.now();
    this.live.setMicMuted(true);
    this.live.sendNote("[PAUSE]");
    if (this.recorder?.state === "recording") this.recorder.pause();
  }

  resume() {
    if (this.pausedAt) this.pausedFor += Date.now() - this.pausedAt;
    this.pausedAt = 0;
    this.live.setMicMuted(false);
    if (this.recorder?.state === "paused") this.recorder.resume();
    this.live.sendNote("[RESUME]");
  }

  /** The player tapped End: let Maitri say goodbye, but never wait long. */
  requestEnd() {
    this.endRequested = true;
    this.log(`player tapped End at ${Math.round(this.elapsed)}s`);
    if (this.pausedAt) this.resume();
    this.live.stopPlayback();
    this.live.sendNote("[END]");
    setTimeout(() => this.finish(), 25000);
  }

  /** Ends the interview. Resolves false if part of the video could not be sent (see retryUpload). */
  finish(): Promise<boolean> {
    if (this.finished) return this.finished;
    this.ending = true;
    this.finished = (async () => {
      this.cb.onEnding();
      if (this.timer) clearInterval(this.timer);
      await this.live.drain(12000);
      this.live.close();
      const rec = this.recorder;
      if (rec && rec.state !== "inactive") {
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.stop();
        });
      }
      this.cleanup();
      await this.saveTranscript();
      storyApi("finish", { code: this.code, completed: this.completed, minutes: this.elapsed / 60 }).catch(() => {});
      return this.sendVideo(false);
    })();
    return this.finished;
  }

  retryUpload(): Promise<boolean> {
    return this.sendVideo(true);
  }

  private async sendVideo(retry: boolean): Promise<boolean> {
    const up = this.uploader;
    if (!up) return true;
    const t = setInterval(() => this.cb.onSaveProgress(up.uploaded, up.pendingBytes()), 500);
    try {
      const file = retry ? await up.retry() : await up.finish();
      this.log(`video saved ${Math.round(up.uploaded / 1e6)} MB`);
      flushStoryLog();
      storyApi("uploadDone", { code: this.code, kind: "interview", fileId: file?.id }).catch(() => {});
      return true;
    } catch (e) {
      this.log(`video save failed: ${String((e as Error)?.message || e)}`);
      flushStoryLog();
      return false;
    } finally {
      clearInterval(t);
      this.cb.onSaveProgress(up.uploaded, up.pendingBytes());
    }
  }

  private async keepAwake() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      this.wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      /* not supported */
    }
  }

  private onVisibility = () => {
    if (document.visibilityState === "visible" && !this.ending) this.keepAwake();
    this.log(`page ${document.visibilityState}`);
    if (document.visibilityState === "hidden") {
      if (this.lines.length) storyBeacon("transcript", this.transcriptBody());
      flushStoryLog(true);
    }
  };

  private onPageHide = () => {
    this.log("page closed");
    flushStoryLog(true);
    if (this.lines.length) storyBeacon("transcript", this.transcriptBody());
  };

  private cleanup() {
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
    this.wakeLock?.release().catch(() => {});
    this.stream.getTracks().forEach((t) => t.stop());
    this.ctx.close().catch(() => {});
  }
}
