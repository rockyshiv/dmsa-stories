"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BatteryCharging, Camera, Check, ChevronRight, Clock, ImagePlus, Loader2, Mic, Pause, Play, SkipForward, Smartphone, Square, Sun, Volume2, Wifi } from "lucide-react";
import { flushStoryLog, storyApi, StoryApiError, storyLog } from "@/lib/story/api";
import { STRINGS, type Lang } from "@/lib/story/i18n";
import { getCameraAndMic, getMicOnly, Interview, unlockAudio, type InterviewOptions } from "@/lib/story/interview";
import { uploadFile } from "@/lib/story/upload";
import MyithriAvatar from "@/components/MyithriAvatar";

type Screen = "loading" | "invalid" | "welcome" | "consent" | "camera" | "interview" | "saving" | "upload" | "thanks" | "error";

export interface Session {
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

// Used if the first backend reply is slow: the interview itself does not need it.
export function fallbackSession(lang: Lang): Session {
  return { firstName: "", language: lang, minutes: 18, hasEarlier: false, done: false, liveModels: 3 };
}

/** A button that reopens this same page in Chrome (Android), or a hint to use Safari (iPhone). */
export function OpenInChrome({ code, text, button }: { code: string; text: string; button: string }) {
  const android = typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
  return (
    <div className="mt-4 rounded-xl bg-gold-600/80 p-4">
      <p className="text-base font-semibold">{text}</p>
      {android && (
        <a
          className="mt-3 flex items-center justify-center rounded-lg bg-white px-4 py-3 font-bold text-navy-950"
          href={`intent://${location.host + location.pathname + location.search}#Intent;scheme=https;package=com.android.chrome;end`}
          onClick={() => storyLog(code, "tapped Open in Chrome")}
        >
          {button}
        </a>
      )}
    </div>
  );
}

/** Already in Google Chrome itself: "Open in Chrome" would only reload this page. */
export function inRealChrome() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome\/\d+/.test(ua) && !/; wv\)|SamsungBrowser|EdgA|OPR|FBAN|FBAV|Instagram|MiuiBrowser|HeyTap|UCBrowser|YaBrowser|Line\//.test(ua);
}

/** Camera blocked for this site: how to switch it back on, plus a voice-only way forward. */
export function CameraBlocked({ lang, onRetry, onVoiceOnly }: { lang: Lang; onRetry: () => void; onVoiceOnly: () => void }) {
  const t = STRINGS[lang];
  return (
    <div className="mt-4 rounded-xl bg-white/5 p-4">
      <ol className="list-decimal space-y-2 pl-5 text-base text-navy-50">
        {t.cameraBlockedSteps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <SecondaryButton onClick={onRetry}>
        <Camera className="h-5 w-5" /> {t.tryAgainCamera}
      </SecondaryButton>
      <SecondaryButton onClick={onVoiceOnly}>
        <Mic className="h-5 w-5" /> {t.voiceOnly}
      </SecondaryButton>
      <p className="mt-2 text-center text-sm text-navy-200">{t.voiceOnlyNote}</p>
    </div>
  );
}

/** Android in-app browsers (inside WhatsApp, Facebook...) often cannot use the camera. */
export function inAppBrowser() {
  if (typeof navigator === "undefined") return false;
  return /; wv\)|FBAN|FBAV|Instagram|Line\//.test(navigator.userAgent) && /Android/.test(navigator.userAgent);
}

const TIP_ICONS = [Clock, Sun, Smartphone, BatteryCharging, Wifi];

export default function InterviewApp({ code }: { code: string }) {
  // The welcome screen shows at once; the player's name fills in when the backend answers.
  const [screen, setScreen] = useState<Screen>("welcome");
  const [session, setSession] = useState<Session | null>(null);
  const [lang, setLang] = useState<Lang>("kn");
  const [agreed, setAgreed] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<false | "dismissed" | "blocked">(false);
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

  const [sessionError, setSessionError] = useState("");
  const langTouched = useRef(false);
  const chooseLang = (l: Lang) => {
    langTouched.current = true;
    setLang(l);
  };
  useEffect(() => {
    const t0 = Date.now();
    storyApi<Session & { ok: boolean }>("session", { code }, 2, 60000)
      .then((s) => {
        storyLog(code, `session ok in ${Math.round((Date.now() - t0) / 100) / 10}s`);
        setSession(s);
        if (!langTouched.current) setLang(s.language);
      })
      .catch((e) => {
        storyLog(code, `session failed: ${String(e?.message || e)}`);
        flushStoryLog();
        if (e instanceof StoryApiError && e.code === "unknown_code") setScreen("invalid");
        else setSessionError(String(e?.message || e));
      });
  }, [code]);

  const [camSlow, setCamSlow] = useState(false);
  const askCamera = async () => {
    setCamError(false);
    setCamSlow(false);
    storyLog(code, "asking for camera");
    // Some phone browsers never show the permission question; after a while,
    // offer to open the link in Chrome instead.
    const slowTimer = setTimeout(() => {
      setCamSlow(true);
      storyLog(code, "camera question unanswered after 12s");
      flushStoryLog();
    }, 12000);
    try {
      const s = await getCameraAndMic();
      clearTimeout(slowTimer);
      setCamSlow(false);
      storyLog(code, `camera ok: ${s.getVideoTracks()[0]?.label || "?"} / ${s.getAudioTracks()[0]?.label || "?"}`);
      setStream(s);
    } catch (e) {
      clearTimeout(slowTimer);
      setCamSlow(false);
      storyLog(code, `camera failed: ${(e as Error)?.name} ${(e as Error)?.message}`);
      flushStoryLog();
      // "Dismissed" just means the pop-up was closed: asking again works.
      setCamError(/dismiss/i.test(String((e as Error)?.message)) ? "dismissed" : "blocked");
    }
  };

  const [voiceOnly, setVoiceOnly] = useState(false);
  const useVoiceOnly = async () => {
    storyLog(code, "trying voice only");
    try {
      const s = await getMicOnly();
      storyLog(code, `voice only ok: ${s.getAudioTracks()[0]?.label || "?"}`);
      setVoiceOnly(true);
      setCamError(false);
      setStream(s);
    } catch (e) {
      storyLog(code, `voice only failed: ${(e as Error)?.name}`);
      flushStoryLog();
      setCamError("blocked");
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

      {screen === "welcome" && (
        <Page>
          <div className="flex items-center justify-between">
            <Logo />
            <LangToggle lang={lang} setLang={chooseLang} />
          </div>
          {inAppBrowser() && (
            <div className="mt-6 rounded-xl bg-gold-600/80 p-4">
              <p className="text-base font-semibold">{t.openInChrome}</p>
              <a
                className="mt-3 flex items-center justify-center rounded-lg bg-white px-4 py-3 font-bold text-navy-950"
                href={`intent://${typeof location !== "undefined" ? location.host + location.pathname + location.search : ""}#Intent;scheme=https;package=com.android.chrome;end`}
                onClick={() => storyLog(code, "tapped Open in Chrome")}
              >
                {t.openInChromeButton}
              </a>
            </div>
          )}
          <h1 className="mt-10 font-display text-5xl leading-none tracking-wide text-white">{t.hello(session?.firstName || "")}</h1>
          <div className="mt-6 flex items-center gap-3">
            <MyithriAvatar className="h-16 w-16 flex-none rounded-full ring-2 ring-white/20" />
            <div>
              <p className="font-heading text-lg font-bold leading-tight">{lang === "kn" ? "ಮೈತ್ರಿ" : "Myithri"}</p>
              <p className="text-sm text-teal-200">{t.maitriRole}</p>
            </div>
          </div>
          <p className="mt-4 text-lg leading-relaxed text-navy-100">{t.intro}</p>
          {session?.done ? (
            <>
              <p className="mt-6 rounded-lg bg-teal-900/60 p-4 text-teal-100">{t.alreadyDone}</p>
              <PrimaryButton onClick={() => setScreen("upload")}>
                <ImagePlus className="h-5 w-5" /> {t.uploadOnly}
              </PrimaryButton>
              <SecondaryButton onClick={() => setScreen("consent")}>{t.again}</SecondaryButton>
            </>
          ) : (
            <>
              {session?.hasEarlier && <p className="mt-6 rounded-lg bg-teal-900/60 p-4 text-teal-100">{t.welcomeBack}</p>}
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
              <StickyBar>
                <PrimaryButton onClick={() => setScreen("consent")}>
                  {t.continue} <ChevronRight className="h-5 w-5" />
                </PrimaryButton>
              </StickyBar>
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
          <StickyBar>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-navy-700 bg-navy-900 p-4 text-lg font-semibold">
              <input type="checkbox" className="h-6 w-6 accent-teal-500" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              {t.agree}
            </label>
            <PrimaryButton disabled={!agreed} onClick={giveConsent}>
              {t.continue} <ChevronRight className="h-5 w-5" />
            </PrimaryButton>
          </StickyBar>
        </Page>
      )}

      {screen === "camera" && (
        <Page>
          <Logo />
          <h1 className="mt-8 font-heading text-2xl font-bold">{t.cameraTitle}</h1>
          {!stream ? (
            <>
              <p className="mt-3 text-base text-navy-100">{t.cameraHelp}</p>
              {camError && <p className="mt-4 rounded-lg bg-red-900/60 p-4 text-red-100">{camError === "dismissed" ? t.cameraDismissed : t.cameraDenied}</p>}
              {camError === "blocked" && <CameraBlocked lang={lang} onRetry={askCamera} onVoiceOnly={useVoiceOnly} />}
              {(camSlow || camError === "blocked") && !inRealChrome() && <OpenInChrome code={code} text={t.noCameraQuestion} button={t.openInChromeButton} />}
              {camError !== "blocked" && (
                <StickyBar>
                  <PrimaryButton onClick={askCamera}>
                    <Camera className="h-5 w-5" /> {t.allow}
                  </PrimaryButton>
                </StickyBar>
              )}
            </>
          ) : (
            <>
              {voiceOnly ? (
                <p className="mt-5 rounded-lg bg-teal-900/60 p-4 text-teal-100">{t.voiceOnlyNote}</p>
              ) : (
                <>
                  <SelfView stream={stream} className="mx-auto mt-5 aspect-[3/4] h-[36vh] rounded-2xl" />
                  <p className="mt-4 text-base text-navy-100">{t.looksGood}</p>
                </>
              )}
              {!session && !sessionError && (
                <p className="mt-4 flex items-center gap-2 text-sm text-navy-200">
                  <Loader2 className="h-4 w-4 animate-spin" /> {STRINGS[lang].pleaseWait}
                </p>
              )}
              {sessionError && (
                <p className="mt-4 rounded-lg bg-red-900/60 p-3 text-sm">
                  {t.error}. <button className="underline" onClick={() => location.reload()}>{t.tryAgain}</button>
                </p>
              )}
              <StickyBar>
                <PrimaryButton
                  onClick={() => {
                    // Create and resume audio inside the tap itself: Samsung Internet
                    // and some other browsers refuse to start audio any later.
                    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                    const ctx = new Ctx();
                    unlockAudio(ctx);
                    storyLog(code, `start tapped, audio ${ctx.state}`);
                    setAudioCtx(ctx);
                    setScreen("interview");
                  }}
                >
                  <Mic className="h-5 w-5" /> {t.start}
                </PrimaryButton>
              </StickyBar>
            </>
          )}
        </Page>
      )}

      {(screen === "interview" || screen === "saving") && stream && audioCtx && (
        <InterviewScreen
          audioCtx={audioCtx}
          code={code}
          lang={lang}
          session={session ?? fallbackSession(lang)}
          stream={stream}
          saving={screen === "saving"}
          onEnding={() => setScreen("saving")}
          onSaved={() => setScreen("upload")}
          onFatal={(m) => {
            setErrorMsg(m);
            setScreen("error");
          }}
          engineOptions={voiceOnly ? { recordVideo: false } : undefined}
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

export function InterviewScreen({
  audioCtx,
  code,
  lang,
  session,
  stream,
  saving,
  onEnding,
  onSaved,
  onFatal,
  engineOptions,
  onField,
  panel,
  copy,
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
  /** Form interviews: audio only, a different end tool, etc. */
  engineOptions?: InterviewOptions;
  onField?: (field: string, value: string) => void;
  /** Extra content under the captions (e.g. the form filling in live). */
  panel?: React.ReactNode;
  /** Wording that differs from the story interview (e.g. "Saving your registration"). */
  copy?: Partial<(typeof STRINGS)[Lang]>;
}) {
  const t = { ...STRINGS[lang], ...copy };
  // With a form panel there is more to show: smaller Myithri, pinned controls.
  const compact = !!panel;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engine = useRef<Interview | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting" | "closed">("connecting");
  const [caption, setCaption] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
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
      onField,
      onCountdown: setCountdown,
      onAudioBlocked: setAudioBlocked,
    }, audioCtx, engineOptions);
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

  // When the engine starts ending (Myithri said goodbye, or End), wait for the video upload.
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

      {/* Myithri */}
      <div className={`relative flex flex-col items-center ${compact ? "mt-2" : "mt-6"}`}>
        <div className={`relative flex items-center justify-center ${compact ? "h-24 w-24" : "h-36 w-36"}`}>
          {speaking && !paused && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-teal-400/25" />
              <span className="absolute -inset-3 animate-pulse rounded-full border-2 border-teal-300/40" />
            </>
          )}
          <MyithriAvatar
            className={`relative rounded-full shadow-2xl shadow-teal-900/50 transition-transform duration-300 ${speaking && !paused ? "scale-[1.03]" : ""} ${compact ? "h-20 w-20" : "h-32 w-32"}`}
          />
        </div>
        <p className="mt-3 font-heading text-xl font-bold">{lang === "kn" ? "ಮೈತ್ರಿ" : "Myithri"}</p>
        <p className="text-sm text-teal-200">{t.maitriRole}</p>
      </div>

      {/* caption */}
      <div className={`mx-4 rounded-2xl bg-white/5 p-4 ${compact ? "mt-3 min-h-[6rem]" : "mt-5 min-h-[7.5rem]"}`}>
        <p className={`text-lg leading-relaxed text-white ${compact ? "line-clamp-4" : "line-clamp-5"}`} aria-live="polite">
          {caption || "…"}
        </p>
      </div>

      {/* self view + topic progress */}
      <div className="mt-4 flex items-end gap-3 px-4">
        <div className="relative">
          <video ref={attach} muted playsInline className={`-scale-x-100 rounded-xl bg-black object-cover ring-2 ring-white/20 ${compact ? "h-24 w-[4.5rem]" : "h-40 w-28"}`} />
          {flash && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 text-xs font-bold text-navy-900">
              {t.photoTaken}
            </div>
          )}
          {countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-navy-950/60 font-display text-6xl text-white" aria-live="assertive">
              {countdown}
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

      {panel}
      {hidden && <p className="mx-4 mt-3 rounded-lg bg-gold-600/80 p-3 text-sm">{t.keepOpen}</p>}

      {/* controls */}
      <div className={`mt-auto grid grid-cols-3 gap-3 px-4 pb-6 pt-6 ${compact ? "sticky bottom-0 bg-gradient-to-t from-navy-950 via-navy-950/95 to-navy-950/0 pt-8" : ""}`}>
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

      {audioBlocked && !saving && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-navy-950/90 p-6 text-center" role="dialog" aria-modal="true">
          <button
            onClick={() => engine.current?.tapToUnlockAudio()}
            className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-teal-500 px-6 py-8 text-2xl font-bold text-white shadow-2xl"
          >
            <Volume2 className="h-12 w-12" aria-hidden />
            {t.tapToHear}
          </button>
          <p className="mt-5 max-w-sm text-base text-navy-100">{t.tapToHearHelp}</p>
        </div>
      )}

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

export function SelfView({ stream, className }: { stream: MediaStream; className?: string }) {
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

export function Logo() {
  return (
    <div className="inline-flex rounded-lg bg-white px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${process.env.NEXT_PUBLIC_BASE_PATH}/dmsa-logo.png`} alt="Divyaang Myithri Sports Academy" width={120} height={50} />
    </div>
  );
}

export function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
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

export function Page({ children }: { children: React.ReactNode }) {
  // Extra bottom space so the fixed action bar never covers the last lines.
  return <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 pb-48 pt-6">{children}</div>;
}

/**
 * Keeps the screen's main action pinned to the bottom of the phone: players
 * on small screens were not scrolling down to find "Continue" or "Start".
 */
export function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-navy-950 via-navy-950 to-navy-950/80 px-5 pb-5 pt-3">
      <div className="mx-auto max-w-lg [&>button]:mt-3">{children}</div>
    </div>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-5 py-10">{children}</div>;
}

export function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
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

export function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
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
