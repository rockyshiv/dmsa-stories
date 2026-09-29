"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BatteryCharging, Camera, Check, ChevronRight, Clock, ImagePlus, Loader2, Mic, Pause, Play, SkipForward, Smartphone, Square, Sun, Wifi } from "lucide-react";
import { flushStoryLog, storyApi, StoryApiError, storyLog } from "@/lib/story/api";
import { STRINGS, type Lang } from "@/lib/story/i18n";
import { getCameraAndMic, Interview } from "@/lib/story/interview";
import { uploadFile } from "@/lib/story/upload";

type Screen = "loading" | "invalid" | "welcome" | "consent" | "camera" | "interview" | "saving" | "upload" | "thanks" | "error";

interface Session {
  firstName: string;
  language: Lang;
  minutes: number;
  hasEarlier: boolean;
  done: boolean;
  liveModels: number;
}

interface UploadItem {
  key: string;
  file: File;
  preview?: string;
  progress: number;
  state: "waiting" | "uploading" | "done" | "failed";
}

const TIP_ICONS = [Clock, Sun, Smartphone, BatteryCharging, Wifi];

export default function InterviewApp({ code }: { code: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [lang, setLang] = useState<Lang>("kn");
  const [agreed, setAgreed] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState(false);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const t = STRINGS[lang];

  // Diagnostics from the very first moment, so a stuck player can be traced.
  useEffect(() => {
    storyLog(code, `page opened: ${window.innerWidth}x${window.innerHeight}, online ${navigator.onLine}`);
    const onError = (e: ErrorEvent) => {
      storyLog(code, `page error: ${e.message} @ ${e.filename?.split("/").pop()}:${e.lineno}`);
      flushStoryLog();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      storyLog(code, `unhandled: ${String((e.reason as Error)?.message || e.reason)}`);
      flushStoryLog();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushStoryLog(true);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [code]);

  // Each screen starts at the top (the page scrolls inside one container).
  useEffect(() => {
    document.querySelector("[data-story-root]")?.scrollTo(0, 0);
    storyLog(code, `screen: ${screen}`);
  }, [screen, code]);

  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    const t0 = Date.now();
    storyApi<Session & { ok: boolean }>("session", { code })
      .then((s) => {
        clearTimeout(t);
        storyLog(code, `session ok in ${Math.round((Date.now() - t0) / 100) / 10}s`);
        setSession(s);
        setLang(s.language);
        setScreen("welcome");
      })
      .catch((e) => {
        clearTimeout(t);
        storyLog(code, `session failed: ${String(e?.message || e)}`);
        flushStoryLog();
        if (e instanceof StoryApiError && e.code === "unknown_code") setScreen("invalid");
        else {
          setErrorMsg(String(e?.message || e));
          setScreen("error");
        }
      });
  }, [code]);

  const askCamera = async () => {
    setCamError(false);
    storyLog(code, "asking for camera");
    try {
      const s = await getCameraAndMic();
      storyLog(code, `camera ok: ${s.getVideoTracks()[0]?.label || "?"} / ${s.getAudioTracks()[0]?.label || "?"}`);
      setStream(s);
    } catch (e) {
      storyLog(code, `camera failed: ${(e as Error)?.name} ${(e as Error)?.message}`);
      flushStoryLog();
      setCamError(true);
    }
  };

  const giveConsent = async () => {
    setScreen("camera");
    storyApi("consent", {
      code,
      lang,
      text: t.consentItems.map((x) => "- " + x).join("\n"),
      userAgent: navigator.userAgent,
    }).catch(() => {});
    // Ask for the camera straight away, inside this tap: players were
    // stopping at a separate "Allow camera" button. It stays as a fallback.
    askCamera();
  };

  return (
    <div data-story-root className="fixed inset-0 z-[1000] overflow-y-auto bg-navy-950 font-sans text-white" lang={lang === "kn" ? "kn" : "en"}>
      {screen === "loading" && (
        <Centered>
          <Loader2 className="h-10 w-10 animate-spin text-teal-400" aria-label="Loading" />
          {slow && (
            <>
              <p className="mt-6 max-w-xs text-center text-lg">{STRINGS.kn.pleaseWait}</p>
              <p className="mt-2 max-w-xs text-center text-navy-200">{STRINGS.en.pleaseWait}</p>
            </>
          )}
        </Centered>
      )}

      {screen === "invalid" && (
        <Centered>
          <Logo />
          <p className="mt-8 max-w-sm text-center text-lg">{STRINGS.kn.badLink}</p>
          <p className="mt-4 max-w-sm text-center text-navy-200">{STRINGS.en.badLink}</p>
        </Centered>
      )}

      {screen === "error" && (
        <Centered>
          <Logo />
          <h1 className="mt-8 font-heading text-2xl font-bold">{t.error}</h1>
          <p className="mt-3 max-w-sm text-center text-sm text-navy-200">{errorMsg}</p>
          <PrimaryButton onClick={() => location.reload()}>{t.tryAgain}</PrimaryButton>
        </Centered>
      )}

      {screen === "welcome" && session && (
        <Page>
          <div className="flex items-center justify-between">
            <Logo />
            <LangToggle lang={lang} setLang={setLang} />
          </div>
          <h1 className="mt-10 font-display text-5xl leading-none tracking-wide text-white">{t.hello(session.firstName)}</h1>
          <p className="mt-4 text-lg leading-relaxed text-navy-100">{t.intro}</p>
          {session.done ? (
            <>
              <p className="mt-6 rounded-lg bg-teal-900/60 p-4 text-teal-100">{t.alreadyDone}</p>
              <PrimaryButton onClick={() => setScreen("upload")}>
                <ImagePlus className="h-5 w-5" /> {t.uploadOnly}
              </PrimaryButton>
              <SecondaryButton onClick={() => setScreen("consent")}>{t.again}</SecondaryButton>
            </>
          ) : (
            <>
              {session.hasEarlier && <p className="mt-6 rounded-lg bg-teal-900/60 p-4 text-teal-100">{t.welcomeBack}</p>}
              <h2 className="mt-8 font-heading text-sm font-bold uppercase tracking-widest text-teal-300">{t.howTitle}</h2>
              <ul className="mt-3 space-y-3">
                {t.tips.map((tip, i) => {
                  const Icon = TIP_ICONS[i] || Check;
                  return (
                    <li key={i} className="flex gap-3 text-base text-navy-50">
                      <Icon className="mt-0.5 h-5 w-5 flex-none text-teal-400" aria-hidden />
                      <span>{tip}</span>
                    </li>
                  );
                })}
              </ul>
              <PrimaryButton onClick={() => setScreen("consent")}>
                {t.continue} <ChevronRight className="h-5 w-5" />
              </PrimaryButton>
            </>
          )}
        </Page>
      )}

      {screen === "consent" && (
        <Page>
          <Logo />
          <h1 className="mt-8 font-heading text-2xl font-bold">{t.consentTitle}</h1>
          <ul className="mt-5 space-y-4">
            {t.consentItems.map((c, i) => (
              <li key={i} className="flex gap-3 text-base leading-relaxed text-navy-50">
                <Check className="mt-1 h-5 w-5 flex-none text-teal-400" aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <label className="mt-8 flex cursor-pointer items-center gap-3 rounded-lg border border-navy-700 bg-navy-900 p-4 text-lg font-semibold">
            <input type="checkbox" className="h-6 w-6 accent-teal-500" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            {t.agree}
          </label>
          <PrimaryButton disabled={!agreed} onClick={giveConsent}>
            {t.continue} <ChevronRight className="h-5 w-5" />
          </PrimaryButton>
        </Page>
      )}

      {screen === "camera" && (
        <Page>
          <Logo />
          <h1 className="mt-8 font-heading text-2xl font-bold">{t.cameraTitle}</h1>
          {!stream ? (
            <>
              <p className="mt-3 text-base text-navy-100">{t.cameraHelp}</p>
              {camError && <p className="mt-4 rounded-lg bg-red-900/60 p-4 text-red-100">{t.cameraDenied}</p>}
              <PrimaryButton onClick={askCamera}>
                <Camera className="h-5 w-5" /> {t.allow}
              </PrimaryButton>
            </>
          ) : (
            <>
              <SelfView stream={stream} className="mt-5 aspect-[3/4] w-full rounded-2xl" />
              <p className="mt-4 text-base text-navy-100">{t.looksGood}</p>
              <PrimaryButton
                onClick={() => {
                  // Create and resume audio inside the tap itself: Samsung Internet
                  // and some other browsers refuse to start audio any later.
                  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                  const ctx = new Ctx();
                  ctx.resume().catch(() => {});
                  storyLog(code, `start tapped, audio ${ctx.state}`);
                  setAudioCtx(ctx);
                  setScreen("interview");
                }}
              >
                <Mic className="h-5 w-5" /> {t.start}
              </PrimaryButton>
            </>
          )}
        </Page>
      )}

      {(screen === "interview" || screen === "saving") && session && stream && audioCtx && (
        <InterviewScreen
          audioCtx={audioCtx}
          code={code}
          lang={lang}
          session={session}
          stream={stream}
          saving={screen === "saving"}
          onEnding={() => setScreen("saving")}
          onSaved={() => setScreen("upload")}
          onFatal={(m) => {
            setErrorMsg(m);
            setScreen("error");
          }}
        />
      )}

      {screen === "upload" && <UploadScreen code={code} lang={lang} onDone={() => setScreen("thanks")} />}

      {screen === "thanks" && session && (
        <Centered>
          <Logo />
          <div className="mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500">
            <Check className="h-9 w-9 text-white" />
          </div>
          <h1 className="mt-6 text-center font-display text-5xl tracking-wide">{t.thanksTitle(session.firstName)}</h1>
          <p className="mt-4 max-w-md text-center text-lg leading-relaxed text-navy-100">{t.thanks}</p>
          <SecondaryButton onClick={() => setScreen("upload")}>
            <ImagePlus className="h-5 w-5" /> {t.addMore}
          </SecondaryButton>
        </Centered>
      )}
    </div>
  );
}

function InterviewScreen({
  audioCtx,
  code,
  lang,
  session,
  stream,
  saving,
  onEnding,
  onSaved,
  onFatal,
}: {
  audioCtx: AudioContext;
  code: string;
  lang: Lang;
  session: Session;
  stream: MediaStream;
  saving: boolean;
  onEnding: () => void;
  onSaved: () => void;
  onFatal: (m: string) => void;
}) {
  const t = STRINGS[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engine = useRef<Interview | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting" | "closed">("connecting");
  const [caption, setCaption] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [flash, setFlash] = useState(false);
  const [save, setSave] = useState({ sent: 0, pending: 0 });
  const [saveFailed, setSaveFailed] = useState(false);
  const [hidden, setHidden] = useState(false);

  const attach = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    },
    [stream],
  );

  useEffect(() => {
    if (engine.current || !videoRef.current) return;
    const it = new Interview(code, lang, session.minutes, session.hasEarlier, session.liveModels, stream, videoRef.current, {
      onStatus: setStatus,
      onMaitriCaption: setCaption,
      onPortrait: () => {
        setFlash(true);
        setTimeout(() => setFlash(false), 1600);
      },
      onTick: setSeconds,
      onEnding,
      onSaveProgress: (sent, pending) => setSave({ sent, pending }),
      onFatal,
    }, audioCtx);
    engine.current = it;
    it.start().catch((e) => {
      it.abort();
      storyLog(code, `start failed: ${String(e?.message || e)}`);
      flushStoryLog();
      onFatal(String(e?.message || e));
    });
    const poll = setInterval(() => setSpeaking(it.speaking), 150);
    const vis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", vis);
    };
    // The interview runs once for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the engine starts ending (Maitri said goodbye, or End), wait for the video upload.
  useEffect(() => {
    if (!saving || !engine.current) return;
    let cancelled = false;
    engine.current.finish().then((ok) => {
      if (cancelled) return;
      if (ok) onSaved();
      else setSaveFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [saving, onSaved]);

  const retry = async () => {
    setSaveFailed(false);
    const ok = await engine.current?.retryUpload();
    if (ok) onSaved();
    else setSaveFailed(true);
  };

  const mm = Math.floor(seconds / 60);
  const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
  const statusText =
    status === "connecting" ? t.connecting : status === "reconnecting" ? t.reconnecting : paused ? t.paused : speaking ? t.speaking : t.listening;

  if (saving) {
    const total = save.sent + save.pending;
    const pct = total ? Math.round((save.sent / total) * 100) : 0;
    return (
      <Centered>
        <Logo />
        {saveFailed ? (
          <>
            <p className="mt-10 max-w-sm text-center text-lg">{t.savedFail}</p>
            <PrimaryButton onClick={retry}>{t.retry}</PrimaryButton>
          </>
        ) : (
          <>
            <Loader2 className="mt-10 h-10 w-10 animate-spin text-teal-400" aria-hidden />
            <h1 className="mt-6 text-center font-heading text-2xl font-bold">{t.saving}</h1>
            {total > 0 && (
              <>
                <div className="mt-6 h-3 w-64 overflow-hidden rounded-full bg-navy-800">
                  <div className="h-full bg-teal-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-sm text-navy-200">
                  {pct}% · {(save.sent / 1e6).toFixed(0)} / {Math.max(1, Math.round(total / 1e6))} MB
                </p>
              </>
            )}
            <p className="mt-6 max-w-sm text-center text-navy-200">{t.savingHelp}</p>
          </>
        )}
      </Centered>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950">
      {/* top bar */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-sm font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${paused ? "bg-gold-400" : "animate-pulse bg-red-500"}`} />
          REC {mm}:{ss}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-navy-200">
          {status !== "live" && <Wifi className="h-4 w-4 animate-pulse" />}
          {statusText}
        </div>
      </div>

      {/* Maitri */}
      <div className="relative mt-6 flex flex-col items-center">
        <div className="relative flex h-36 w-36 items-center justify-center">
          {speaking && !paused && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-teal-400/25" />
              <span className="absolute -inset-3 animate-pulse rounded-full border-2 border-teal-300/40" />
            </>
          )}
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-navy-600 shadow-2xl shadow-teal-900/50">
            <span className="font-display text-6xl tracking-wide text-white">{lang === "kn" ? "ಮೈ" : "M"}</span>
          </div>
        </div>
        <p className="mt-3 font-heading text-xl font-bold">{lang === "kn" ? "ಮೈತ್ರಿ" : "Maitri"}</p>
        <p className="text-sm text-teal-200">{t.maitriRole}</p>
      </div>

      {/* caption */}
      <div className="mx-4 mt-5 min-h-[7.5rem] rounded-2xl bg-white/5 p-4">
        <p className="line-clamp-5 text-lg leading-relaxed text-white" aria-live="polite">
          {caption || "…"}
        </p>
      </div>

      {/* self view + topic progress */}
      <div className="mt-4 flex items-end gap-3 px-4">
        <div className="relative">
          <video ref={attach} muted playsInline className="h-40 w-28 -scale-x-100 rounded-xl bg-black object-cover ring-2 ring-white/20" />
          {flash && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 text-xs font-bold text-navy-900">
              {t.photoTaken}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-teal-300">{t.minutesLeft(Math.max(1, Math.ceil(session.minutes - seconds / 60)))}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-teal-400 transition-all duration-1000" style={{ width: `${Math.min(100, (seconds / (session.minutes * 60)) * 100)}%` }} />
          </div>
        </div>
      </div>

      {hidden && <p className="mx-4 mt-3 rounded-lg bg-gold-600/80 p-3 text-sm">{t.keepOpen}</p>}

      {/* controls */}
      <div className="mt-auto grid grid-cols-3 gap-3 px-4 pb-6 pt-6">
        <ControlButton
          onClick={() => engine.current?.skip()}
          disabled={status !== "live" || paused}
          icon={<SkipForward className="h-6 w-6" />}
          label={t.skip}
        />
        <ControlButton
          onClick={() => {
            if (paused) engine.current?.resume();
            else engine.current?.pause();
            setPaused(!paused);
          }}
          disabled={status !== "live"}
          icon={paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
          label={paused ? t.resume : t.pause}
        />
        <ControlButton onClick={() => setConfirmEnd(true)} icon={<Square className="h-6 w-6" />} label={t.end} danger />
      </div>

      {confirmEnd && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full rounded-2xl bg-navy-900 p-6">
            <p className="text-center font-heading text-xl font-bold">{t.endConfirm}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="rounded-xl bg-white/10 py-4 font-semibold" onClick={() => setConfirmEnd(false)}>
                {t.noContinue}
              </button>
              <button
                className="rounded-xl bg-red-600 py-4 font-semibold"
                onClick={() => {
                  setConfirmEnd(false);
                  engine.current?.requestEnd();
                }}
              >
                {t.yesEnd}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadScreen({ code, lang, onDone }: { code: string; lang: Lang; onDone: () => void }) {
  const t = STRINGS[lang];
  const [items, setItems] = useState<UploadItem[]>([]);
  const busy = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<UploadItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const pending = useRef<UploadItem[]>([]);
  const counter = useRef(0);

  // Upload one at a time so a weak connection is not split across many files.
  const pump = async () => {
    if (busy.current) return;
    busy.current = true;
    for (let next = pending.current.shift(); next; next = pending.current.shift()) {
      const item = next;
      update(item.key, { state: "uploading", progress: 0 });
      try {
        await uploadFile(code, item.file, { kind: "upload", name: item.file.name }, (p) => update(item.key, { progress: p }));
        update(item.key, { state: "done", progress: 1 });
      } catch {
        update(item.key, { state: "failed" });
      }
    }
    busy.current = false;
  };

  const retryItem = (x: UploadItem) => {
    update(x.key, { state: "waiting" });
    pending.current.push(x);
    pump();
  };

  useEffect(() => () => items.forEach((x) => x.preview && URL.revokeObjectURL(x.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (files: FileList | null) => {
    if (!files) return;
    const fresh = Array.from(files).map((f) => ({
      key: `${++counter.current}-${f.name}`,
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      progress: 0,
      state: "waiting" as const,
    }));
    setItems((xs) => [...xs, ...fresh]);
    pending.current.push(...fresh);
    pump();
  };

  const uploading = items.some((x) => x.state === "waiting" || x.state === "uploading");

  return (
    <Page>
      <Logo />
      <h1 className="mt-8 font-heading text-2xl font-bold">{t.uploadTitle}</h1>
      <p className="mt-3 text-base leading-relaxed text-navy-100">{t.uploadHelp}</p>
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      <PrimaryButton onClick={() => inputRef.current?.click()}>
        <ImagePlus className="h-5 w-5" /> {t.choose}
      </PrimaryButton>

      <ul className="mt-6 space-y-3">
        {items.map((x) => (
          <li key={x.key}>
            <button
              className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-2 text-left"
              onClick={() => x.state === "failed" && retryItem(x)}
            >
              <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg bg-navy-800">
                {x.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Play className="m-auto mt-4 h-6 w-6 text-teal-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{x.file.name}</p>
                <p className={`text-xs ${x.state === "failed" ? "text-red-300" : "text-navy-200"}`}>
                  {x.state === "done" ? t.uploaded : x.state === "failed" ? t.failed : `${t.uploading} ${Math.round(x.progress * 100)}%`}
                  {" · "}
                  {(x.file.size / 1e6).toFixed(1)} MB
                </p>
                {x.state === "uploading" && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-800">
                    <div className="h-full bg-teal-400" style={{ width: `${Math.round(x.progress * 100)}%` }} />
                  </div>
                )}
              </div>
              {x.state === "done" && <Check className="h-5 w-5 flex-none text-teal-300" />}
            </button>
          </li>
        ))}
      </ul>

      {items.length > 0 ? (
        <PrimaryButton disabled={uploading} onClick={onDone}>
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {t.done}
        </PrimaryButton>
      ) : (
        <SecondaryButton onClick={onDone}>{t.skipUploads}</SecondaryButton>
      )}
    </Page>
  );
}

function SelfView({ stream, className }: { stream: MediaStream; className?: string }) {
  const ref = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    },
    [stream],
  );
  return <video ref={ref} muted playsInline className={`-scale-x-100 bg-black object-cover ${className ?? ""}`} />;
}

function Logo() {
  return (
    <div className="inline-flex rounded-lg bg-white px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${process.env.NEXT_PUBLIC_BASE_PATH}/dmsa-logo.png`} alt="Divyaang Myithri Sports Academy" width={120} height={50} />
    </div>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex rounded-full bg-white/10 p-1 text-sm font-semibold" role="group" aria-label="Language">
      {(["kn", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-4 py-2 ${lang === l ? "bg-teal-500 text-white" : "text-navy-100"}`}
        >
          {STRINGS[l].langName}
        </button>
      ))}
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 pb-10 pt-6">{children}</div>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-5 py-10">{children}</div>;
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-teal-900/40 transition active:scale-[0.98] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-4 text-base font-semibold text-white">
      {children}
    </button>
  );
}

function ControlButton({
  onClick,
  icon,
  label,
  disabled,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-semibold transition active:scale-95 disabled:opacity-40 ${
        danger ? "bg-red-600/90" : "bg-white/10"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
