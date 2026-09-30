"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronRight, Keyboard, Loader2, Mic, Pencil, Phone, UserPlus } from "lucide-react";
import { flushStoryLog, storyApi, storyLog } from "@/lib/story/api";
import { STRINGS, type Lang } from "@/lib/story/i18n";
import { getCameraAndMic, getMicOnly, unlockAudio } from "@/lib/story/interview";
import {
  CameraBlocked,
  inRealChrome,
  Centered,
  InterviewScreen,
  LangToggle,
  Logo,
  OpenInChrome,
  Page,
  PrimaryButton,
  SecondaryButton,
  SelfView,
  StickyBar,
  inAppBrowser,
} from "@/components/InterviewApp";

/**
 * Open registration link (.../dmsa-stories/?r=KWPL4): the player talks with
 * Maitri instead of typing a form, checks what she wrote down, and submits.
 */

interface Field {
  key: string;
  label: string;
  labelKn: string;
  required: boolean;
  options: string[] | null;
  type: "text" | "phone" | "number";
}

interface Info {
  open: boolean;
  minutes: number;
  campaign: { code: string; name: string; nameKn: string };
  consent: { en: string[]; kn: string[] };
  fields: Field[];
}

type Screen = "loading" | "invalid" | "closed" | "welcome" | "consent" | "camera" | "interview" | "saving" | "review" | "thanks" | "error";
type Answers = Record<string, string>;

const OPTION_KN: Record<string, string> = {
  Yes: "ಹೌದು",
  No: "ಇಲ್ಲ",
  Male: "ಪುರುಷ",
  Female: "ಮಹಿಳೆ",
  Other: "ಇತರೆ",
  "Not sure yet": "ಇನ್ನೂ ಗೊತ್ತಿಲ್ಲ",
};

const R = {
  en: {
    intro: (m: number) =>
      `No form to type. Talk with Maitri, DMSA's AI volunteer, for about ${m} minutes. She asks the questions and writes your answers down. You check everything before it is sent.`,
    readyTitle: "Keep these ready",
    ready: ["Your WhatsApp number", "Your jersey size", "A quiet place, with your face in good light for the registration photo"],
    talk: "Register by talking",
    type: "I'd rather type it",
    consentTitle: "Before we start",
    cameraHelp:
      "Your phone will ask to use the camera and microphone. Choose Allow: Maitri needs to hear you, and the camera takes your registration photo. Only your voice is recorded.",
    formTitle: "Your form",
    heard: (n: number, total: number) => `${n} of ${total} filled`,
    reviewTitle: "Check your details",
    reviewTitleTyped: "Your details",
    reviewHelp: "Maitri filled this in from your conversation. Fix anything that is wrong, then submit.",
    reviewHelpTyped: "Fill in your details and submit.",
    required: "Required",
    optional: "Optional",
    heardAs: (v: string) => `Maitri heard "${v}". Choose the right one.`,
    submit: "Submit registration",
    submitting: "Submitting…",
    missing: (names: string) => `Please fill in: ${names}`,
    badPhone: "The WhatsApp number needs 10 digits.",
    thanksTitle: "You're registered!",
    thanksText: "DMSA will check your details and contact you on WhatsApp.",
    yourId: "Registration ID",
    another: "Register another player",
    edit: "Change my details",
    closed: "Registration for this season is closed. For help, contact DMSA on WhatsApp.",
    badLink: "This registration link is not valid. Please check the link DMSA shared.",
    resumeNote: "You already started. Your answers so far are saved.",
    copy: {
      maitriRole: "DMSA's AI volunteer",
      saving: "Saving your registration…",
      savingHelp: "Please keep this page open. It takes a few seconds.",
      savedFail: "The recording could not be fully saved, but your answers are safe. Tap Retry, or check your internet.",
      endConfirm: "Stop talking and check your form?",
      yesEnd: "Yes, check my form",
      keepOpen: "Please keep this screen open while you talk with Maitri.",
      skip: "Skip question",
    },
  },
  kn: {
    intro: (m: number) =>
      `ಫಾರ್ಮ್ ಟೈಪ್ ಮಾಡಬೇಕಿಲ್ಲ. DMSA ಯ AI ಸ್ವಯಂಸೇವಕಿ ಮೈತ್ರಿ ಜೊತೆ ಸುಮಾರು ${m} ನಿಮಿಷ ಮಾತನಾಡಿ. ಅವರು ಪ್ರಶ್ನೆ ಕೇಳಿ ನಿಮ್ಮ ಉತ್ತರಗಳನ್ನು ಬರೆದುಕೊಳ್ಳುತ್ತಾರೆ. ಕಳುಹಿಸುವ ಮೊದಲು ನೀವು ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸುತ್ತೀರಿ.`,
    readyTitle: "ಇವುಗಳನ್ನು ಸಿದ್ಧವಾಗಿಡಿ",
    ready: ["ನಿಮ್ಮ ವಾಟ್ಸ್‌ಆ್ಯಪ್ ಸಂಖ್ಯೆ", "ನಿಮ್ಮ ಜೆರ್ಸಿ ಅಳತೆ", "ಶಾಂತವಾದ ಸ್ಥಳ; ನೋಂದಣಿ ಫೋಟೋಗಾಗಿ ಮುಖದ ಮೇಲೆ ಉತ್ತಮ ಬೆಳಕು"],
    talk: "ಮಾತನಾಡಿ ನೋಂದಾಯಿಸಿ",
    type: "ನಾನೇ ಟೈಪ್ ಮಾಡುತ್ತೇನೆ",
    consentTitle: "ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು",
    cameraHelp:
      "ನಿಮ್ಮ ಫೋನ್ ಕ್ಯಾಮೆರಾ ಮತ್ತು ಮೈಕ್ ಬಳಸಲು ಅನುಮತಿ ಕೇಳುತ್ತದೆ. Allow ಆಯ್ಕೆ ಮಾಡಿ: ಮೈತ್ರಿ ನಿಮ್ಮ ಮಾತು ಕೇಳಬೇಕು, ಕ್ಯಾಮೆರಾ ನೋಂದಣಿ ಫೋಟೋ ತೆಗೆಯುತ್ತದೆ. ನಿಮ್ಮ ಧ್ವನಿ ಮಾತ್ರ ರೆಕಾರ್ಡ್ ಆಗುತ್ತದೆ.",
    formTitle: "ನಿಮ್ಮ ಫಾರ್ಮ್",
    heard: (n: number, total: number) => `${total} ರಲ್ಲಿ ${n} ತುಂಬಿದೆ`,
    reviewTitle: "ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ",
    reviewTitleTyped: "ನಿಮ್ಮ ವಿವರಗಳು",
    reviewHelp: "ನಿಮ್ಮ ಮಾತುಕತೆಯಿಂದ ಮೈತ್ರಿ ಇದನ್ನು ತುಂಬಿದ್ದಾರೆ. ತಪ್ಪಿದ್ದರೆ ಸರಿಪಡಿಸಿ, ನಂತರ ಸಲ್ಲಿಸಿ.",
    reviewHelpTyped: "ನಿಮ್ಮ ವಿವರಗಳನ್ನು ತುಂಬಿ ಸಲ್ಲಿಸಿ.",
    required: "ಕಡ್ಡಾಯ",
    optional: "ಐಚ್ಛಿಕ",
    heardAs: (v: string) => `ಮೈತ್ರಿ "${v}" ಎಂದು ಕೇಳಿಸಿಕೊಂಡರು. ಸರಿಯಾದುದನ್ನು ಆರಿಸಿ.`,
    submit: "ನೋಂದಣಿ ಸಲ್ಲಿಸಿ",
    submitting: "ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ…",
    missing: (names: string) => `ದಯವಿಟ್ಟು ತುಂಬಿ: ${names}`,
    badPhone: "ವಾಟ್ಸ್‌ಆ್ಯಪ್ ಸಂಖ್ಯೆ 10 ಅಂಕಿಗಳಿರಬೇಕು.",
    thanksTitle: "ನೋಂದಣಿ ಆಯಿತು!",
    thanksText: "DMSA ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ವಾಟ್ಸ್‌ಆ್ಯಪ್‌ನಲ್ಲಿ ಸಂಪರ್ಕಿಸುತ್ತದೆ.",
    yourId: "ನೋಂದಣಿ ಸಂಖ್ಯೆ",
    another: "ಇನ್ನೊಬ್ಬ ಆಟಗಾರರನ್ನು ನೋಂದಾಯಿಸಿ",
    edit: "ನನ್ನ ವಿವರ ಬದಲಿಸಿ",
    closed: "ಈ ಸೀಸನ್‌ನ ನೋಂದಣಿ ಮುಗಿದಿದೆ. ಸಹಾಯಕ್ಕಾಗಿ DMSA ಅನ್ನು ವಾಟ್ಸ್‌ಆ್ಯಪ್‌ನಲ್ಲಿ ಸಂಪರ್ಕಿಸಿ.",
    badLink: "ಈ ನೋಂದಣಿ ಲಿಂಕ್ ಸರಿಯಿಲ್ಲ. DMSA ಹಂಚಿದ ಲಿಂಕ್ ಪರಿಶೀಲಿಸಿ.",
    resumeNote: "ನೀವು ಈಗಾಗಲೇ ಆರಂಭಿಸಿದ್ದೀರಿ. ಇಲ್ಲಿಯವರೆಗಿನ ಉತ್ತರಗಳು ಉಳಿದಿವೆ.",
    copy: {
      maitriRole: "DMSA ಯ AI ಸ್ವಯಂಸೇವಕಿ",
      saving: "ನಿಮ್ಮ ನೋಂದಣಿ ಉಳಿಸಲಾಗುತ್ತಿದೆ…",
      savingHelp: "ದಯವಿಟ್ಟು ಈ ಪುಟ ತೆರೆದಿಡಿ. ಕೆಲವೇ ಸೆಕೆಂಡು.",
      savedFail: "ರೆಕಾರ್ಡಿಂಗ್ ಪೂರ್ತಿ ಉಳಿಯಲಿಲ್ಲ, ಆದರೆ ನಿಮ್ಮ ಉತ್ತರಗಳು ಸುರಕ್ಷಿತ. Retry ಒತ್ತಿ ಅಥವಾ ಇಂಟರ್ನೆಟ್ ಪರಿಶೀಲಿಸಿ.",
      endConfirm: "ಮಾತು ನಿಲ್ಲಿಸಿ ಫಾರ್ಮ್ ಪರಿಶೀಲಿಸುವಿರಾ?",
      yesEnd: "ಹೌದು, ಫಾರ್ಮ್ ನೋಡೋಣ",
      keepOpen: "ಮೈತ್ರಿ ಜೊತೆ ಮಾತನಾಡುವಾಗ ಈ ಪುಟ ತೆರೆದಿಡಿ.",
      skip: "ಪ್ರಶ್ನೆ ಬಿಡಿ",
    },
  },
};

const storeKey = (campaign: string) => `dmsa_reg_${campaign}`;
function readStored(campaign: string) {
  try {
    return localStorage.getItem(storeKey(campaign)) || "";
  } catch {
    return "";
  }
}
function writeStored(campaign: string, code: string) {
  try {
    if (code) localStorage.setItem(storeKey(campaign), code);
    else localStorage.removeItem(storeKey(campaign));
  } catch {
    /* private mode: a reload simply starts a new registration */
  }
}

/** Maps what Maitri recorded onto the field's fixed options, when it clearly matches one. */
function normalise(f: Field, v: string) {
  const value = String(v ?? "").trim();
  if (!f.options || !value) return value;
  const hit = f.options.find((o) => o.toLowerCase() === value.toLowerCase());
  return hit || value;
}

const optionLabel = (o: string, lang: Lang) => (lang === "kn" && OPTION_KN[o]) || o;
const fieldLabel = (f: Field, lang: Lang) => (lang === "kn" ? f.labelKn : f.label);

export default function RegistrationApp({ campaign }: { campaign: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [info, setInfo] = useState<Info | null>(null);
  const [lang, setLang] = useState<Lang>("kn");
  const [code, setCode] = useState("");
  const [regId, setRegId] = useState("");
  const [resumed, setResumed] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [talked, setTalked] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<false | "dismissed" | "blocked">(false);
  const [camSlow, setCamSlow] = useState(false);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastField, setLastField] = useState("");
  const starting = useRef<Promise<string> | null>(null);
  const t = STRINGS[lang];
  const r = R[lang];
  const logId = code || `REG-${campaign}`;

  // Campaign details, and any registration already started on this phone.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const i = await storyApi<Info & { ok: boolean }>("regInfo", { campaign }, 2, 60000);
        if (!alive) return;
        setInfo(i);
        if (!i.open) return setScreen("closed");
        const saved = readStored(campaign);
        if (saved) {
          try {
            const s = await storyApi<{ done: boolean; id: string; language: Lang; answers: Answers }>("session", { code: saved }, 1, 30000);
            if (!alive) return;
            setCode(saved);
            setRegId(s.id);
            setLang(s.language);
            setAnswers(s.answers || {});
            if (Object.keys(s.answers || {}).length) setResumed(true);
            setScreen(s.done ? "thanks" : "welcome");
            return;
          } catch {
            writeStored(campaign, "");
          }
        }
        setScreen("welcome");
      } catch (e) {
        if (!alive) return;
        const m = String((e as Error)?.message || e);
        if (/unknown_campaign/.test(m)) setScreen("invalid");
        else {
          setErrorMsg(m);
          setScreen("error");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [campaign]);

  useEffect(() => {
    document.querySelector("[data-story-root]")?.scrollTo(0, 0);
    if (screen !== "loading") storyLog(logId, `reg screen: ${screen}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  /** Creates the registration row once; later calls reuse it. */
  const ensureCode = () => {
    if (code) return Promise.resolve(code);
    if (!starting.current) {
      // One id per attempt: if Google loses the reply and we retry, the server
      // hands back the same registration instead of making a second one.
      const requestId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      starting.current = storyApi<{ code: string; id: string }>("regStart", { campaign, lang, requestId }, 3, 60000)
        .then((res) => {
          setCode(res.code);
          setRegId(res.id);
          writeStored(campaign, res.code);
          return res.code;
        })
        .catch((e) => {
          starting.current = null;
          throw e;
        });
    }
    return starting.current;
  };

  const askCamera = async () => {
    setCamError(false);
    setCamSlow(false);
    const slowTimer = setTimeout(() => setCamSlow(true), 12000);
    try {
      const s = await getCameraAndMic();
      setStream(s);
    } catch (e) {
      storyLog(logId, `camera failed: ${(e as Error)?.name} ${(e as Error)?.message}`);
      flushStoryLog();
      setCamError(/dismiss/i.test(String((e as Error)?.message)) ? "dismissed" : "blocked");
    } finally {
      clearTimeout(slowTimer);
      setCamSlow(false);
    }
  };

  const useVoiceOnly = async () => {
    try {
      setStream(await getMicOnly());
      setCamError(false);
    } catch {
      setCamError("blocked");
    }
  };

  const giveConsent = () => {
    setScreen("camera");
    askCamera();
    ensureCode()
      .then((c) =>
        storyApi("consent", {
          code: c,
          lang,
          text: (info?.consent[lang] || []).map((x) => "- " + x).join("\n"),
          userAgent: navigator.userAgent,
        }),
      )
      .catch((e) => {
        setErrorMsg(String(e?.message || e));
        setScreen("error");
      });
  };

  const typeInstead = () => {
    ensureCode().catch((e) => {
      setErrorMsg(String(e?.message || e));
      setScreen("error");
    });
    setScreen("review");
  };

  const startNew = () => {
    writeStored(campaign, "");
    location.reload();
  };

  useEffect(() => {
    if (info) document.title = `${info.campaign.name} | DMSA`;
  }, [info]);

  const fields = info?.fields || [];
  const campaignName = info ? (lang === "kn" ? info.campaign.nameKn : info.campaign.name) : "";

  return (
    <div data-story-root className="fixed inset-0 z-[1000] overflow-y-auto bg-navy-950 font-sans text-white" lang={lang === "kn" ? "kn" : "en"}>
      {screen === "loading" && (
        <Centered>
          <Logo />
          <Loader2 className="mt-10 h-9 w-9 animate-spin text-teal-400" aria-label="Loading" />
        </Centered>
      )}

      {(screen === "invalid" || screen === "closed") && (
        <Centered>
          <Logo />
          <p className="mt-8 max-w-sm text-center text-lg">{screen === "invalid" ? R.kn.badLink : R.kn.closed}</p>
          <p className="mt-4 max-w-sm text-center text-navy-200">{screen === "invalid" ? R.en.badLink : R.en.closed}</p>
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

      {screen === "welcome" && info && (
        <Page>
          <div className="flex items-center justify-between">
            <Logo />
            <LangToggle lang={lang} setLang={setLang} />
          </div>
          {inAppBrowser() && <OpenInChrome code={logId} text={t.openInChrome} button={t.openInChromeButton} />}
          <Ticket name={campaignName} />
          <p className="mt-6 text-lg leading-relaxed text-navy-100">{r.intro(info.minutes)}</p>
          {resumed && <p className="mt-5 rounded-lg bg-teal-900/60 p-4 text-teal-100">{r.resumeNote}</p>}
          <h2 className="mt-8 font-heading text-sm font-bold uppercase tracking-widest text-teal-300">{r.readyTitle}</h2>
          <ul className="mt-3 space-y-3">
            {r.ready.map((x, i) => (
              <li key={i} className="flex gap-3 text-base text-navy-50">
                {i === 0 ? <Phone className="mt-0.5 h-5 w-5 flex-none text-teal-400" aria-hidden /> : <Check className="mt-0.5 h-5 w-5 flex-none text-teal-400" aria-hidden />}
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <StickyBar>
            <PrimaryButton onClick={() => setScreen("consent")}>
              <Mic className="h-5 w-5" /> {r.talk}
            </PrimaryButton>
            <SecondaryButton onClick={typeInstead}>
              <Keyboard className="h-5 w-5" /> {r.type}
            </SecondaryButton>
          </StickyBar>
        </Page>
      )}

      {screen === "consent" && info && (
        <Page>
          <Logo />
          <h1 className="mt-8 font-heading text-2xl font-bold">{r.consentTitle}</h1>
          <ul className="mt-5 space-y-4">
            {info.consent[lang].map((c, i) => (
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
              <p className="mt-3 text-base text-navy-100">{r.cameraHelp}</p>
              {camError && <p className="mt-4 rounded-lg bg-red-900/60 p-4 text-red-100">{camError === "dismissed" ? t.cameraDismissed : t.cameraDenied}</p>}
              {camError === "blocked" && <CameraBlocked lang={lang} onRetry={askCamera} onVoiceOnly={useVoiceOnly} />}
              {(camSlow || camError === "blocked") && !inRealChrome() && <OpenInChrome code={logId} text={t.noCameraQuestion} button={t.openInChromeButton} />}
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
              {stream.getVideoTracks().length ? (
                <>
                  <SelfView stream={stream} className="mx-auto mt-5 aspect-[3/4] h-[36vh] rounded-2xl" />
                  <p className="mt-4 text-base text-navy-100">{t.looksGood}</p>
                </>
              ) : (
                <p className="mt-5 rounded-lg bg-teal-900/60 p-4 text-teal-100">{t.voiceOnlyNote}</p>
              )}
              {!code && (
                <p className="mt-4 flex items-center gap-2 text-sm text-navy-200">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.pleaseWait}
                </p>
              )}
              <StickyBar>
                <PrimaryButton
                  disabled={!code}
                  onClick={() => {
                    // Audio must be created inside the tap (Samsung Internet).
                    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                    const ctx = new Ctx();
                    unlockAudio(ctx);
                    setAudioCtx(ctx);
                    setTalked(true);
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

      {(screen === "interview" || screen === "saving") && stream && audioCtx && info && (
        <InterviewScreen
          audioCtx={audioCtx}
          code={code}
          lang={lang}
          session={{ firstName: "", language: lang, minutes: info.minutes, hasEarlier: false, done: false, liveModels: 3 }}
          stream={stream}
          saving={screen === "saving"}
          onEnding={() => setScreen("saving")}
          onSaved={() => {
            stream.getTracks().forEach((tr) => tr.stop());
            setScreen("review");
          }}
          onFatal={(m) => {
            // Whatever Maitri already wrote down is kept: go to the form.
            storyLog(logId, `reg interview fatal: ${m}`);
            flushStoryLog();
            stream.getTracks().forEach((tr) => tr.stop());
            setScreen("review");
          }}
          engineOptions={{ recordVideo: false, endTool: "finish_registration", minEndSeconds: 45, storyTimeNotes: false }}
          onField={(k, v) => {
            const f = fields.find((x) => x.key === k);
            setAnswers((a) => ({ ...a, [k]: f ? normalise(f, v) : v }));
            setLastField(k);
          }}
          copy={r.copy}
          panel={<LiveForm fields={fields} answers={answers} lang={lang} last={lastField} title={r.formTitle} count={r.heard} />}
        />
      )}

      {screen === "review" && info && (
        <ReviewForm
          fields={fields}
          initial={answers}
          lang={lang}
          setLang={setLang}
          talked={talked || resumed}
          code={code}
          waitForCode={ensureCode}
          onDone={(id, a) => {
            setAnswers(a);
            if (id) setRegId(id);
            setScreen("thanks");
          }}
        />
      )}

      {screen === "thanks" && (
        <Centered>
          <Logo />
          <div className="mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500">
            <Check className="h-9 w-9 text-white" />
          </div>
          <h1 className="mt-6 text-center font-display text-5xl tracking-wide">{r.thanksTitle}</h1>
          <p className="mt-4 max-w-md text-center text-lg leading-relaxed text-navy-100">{r.thanksText}</p>
          {regId && (
            <div className="mt-8 rounded-2xl border border-gold-400/40 bg-gold-400/10 px-8 py-4 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-gold-300">{r.yourId}</p>
              <p className="mt-1 font-display text-4xl tracking-widest text-gold-200">{regId}</p>
            </div>
          )}
          <SecondaryButton onClick={() => setScreen("review")}>
            <Pencil className="h-5 w-5" /> {r.edit}
          </SecondaryButton>
          <SecondaryButton onClick={startNew}>
            <UserPlus className="h-5 w-5" /> {r.another}
          </SecondaryButton>
        </Centered>
      )}
    </div>
  );
}

/** The campaign name as a match ticket: the one decorative element on this page. */
function Ticket({ name }: { name: string }) {
  const [title, sub] = name.split(" - ");
  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 p-5 text-navy-950 shadow-xl shadow-black/30">
      <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-navy-950" aria-hidden />
      <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-navy-950" aria-hidden />
      <p className="font-display text-4xl leading-none tracking-wide">{title}</p>
      {sub && <p className="mt-2 border-t border-dashed border-navy-950/30 pt-2 text-sm font-bold uppercase tracking-widest">{sub}</p>}
    </div>
  );
}

/** The form filling itself in while the player talks. */
function LiveForm({
  fields,
  answers,
  lang,
  last,
  title,
  count,
}: {
  fields: Field[];
  answers: Answers;
  lang: Lang;
  last: string;
  title: string;
  count: (n: number, total: number) => string;
}) {
  const filled = fields.filter((f) => String(answers[f.key] || "").trim()).length;
  return (
    <section className="mx-4 mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3" aria-label={title}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-heading text-xs font-bold uppercase tracking-widest text-teal-300">{title}</h2>
        <p className="text-xs text-navy-200">{count(filled, fields.length)}</p>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {fields.map((f) => {
          const v = String(answers[f.key] || "").trim();
          return (
            <li
              key={f.key}
              className={`min-w-0 rounded-lg px-2.5 py-1.5 transition-colors duration-500 ${
                v ? (last === f.key ? "bg-teal-500/30 ring-1 ring-teal-300" : "bg-teal-500/15") : "bg-white/[0.03]"
              }`}
            >
              <p className={`truncate text-[11px] ${v ? "text-teal-200" : "text-navy-300"}`}>{fieldLabel(f, lang)}</p>
              <p className={`truncate text-sm font-semibold ${v ? "text-white" : "text-navy-500"}`}>{v ? optionLabel(v, lang) : "—"}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewForm({
  fields,
  initial,
  lang,
  setLang,
  talked,
  code,
  waitForCode,
  onDone,
}: {
  fields: Field[];
  initial: Answers;
  lang: Lang;
  setLang: (l: Lang) => void;
  talked: boolean;
  code: string;
  waitForCode: () => Promise<string>;
  onDone: (id: string, a: Answers) => void;
}) {
  const r = R[lang];
  const [a, setA] = useState<Answers>(() => {
    const out: Answers = {};
    fields.forEach((f) => (out[f.key] = normalise(f, initial[f.key] || "")));
    return out;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [touched, setTouched] = useState(false);
  const set = (k: string, v: string) => setA((x) => ({ ...x, [k]: v }));

  const missing = fields.filter((f) => f.required && !String(a[f.key] || "").trim());
  const phoneBad = !!a.phone && a.phone.replace(/\D/g, "").slice(-10).length !== 10;

  const submit = async () => {
    setTouched(true);
    setErr("");
    const jump = (key: string) => document.getElementById(`f-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (missing.length) {
      jump(missing[0].key);
      return setErr(r.missing(missing.map((f) => fieldLabel(f, lang)).join(", ")));
    }
    if (phoneBad) {
      jump("phone");
      return setErr(r.badPhone);
    }
    setBusy(true);
    try {
      const c = code || (await waitForCode());
      const res = await storyApi<{ id: string }>("submit", { code: c, answers: a }, 2, 60000);
      onDone(res.id, a);
    } catch (e) {
      setErr(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <div className="flex items-center justify-between">
        <Logo />
        <LangToggle lang={lang} setLang={setLang} />
      </div>
      <h1 className="mt-8 font-heading text-2xl font-bold">{talked ? r.reviewTitle : r.reviewTitleTyped}</h1>
      <p className="mt-2 text-base text-navy-100">{talked ? r.reviewHelp : r.reviewHelpTyped}</p>

      <div className="mt-6 space-y-5">
        {fields.map((f) => {
          const v = a[f.key] || "";
          const empty = touched && f.required && !v.trim();
          const offList = f.options && v && !f.options.includes(v);
          return (
            <div key={f.key}>
              <div className="flex items-baseline justify-between">
                <label htmlFor={`f-${f.key}`} className="text-sm font-semibold text-navy-50">
                  {fieldLabel(f, lang)}
                </label>
                <span className={`text-[11px] uppercase tracking-wider ${f.required ? (empty ? "text-red-300" : "text-navy-300") : "text-navy-400"}`}>
                  {f.required ? r.required : r.optional}
                </span>
              </div>
              {f.options ? (
                <>
                  <div id={`f-${f.key}`} role="radiogroup" aria-label={fieldLabel(f, lang)} className="mt-2 flex flex-wrap gap-2">
                    {f.options.map((o) => {
                      const on = v === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set(f.key, o)}
                          className={`min-h-11 rounded-full border px-4 py-2 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 ${
                            on ? "border-teal-300 bg-teal-500 text-white" : "border-navy-600 bg-navy-900 text-navy-100"
                          } ${empty ? "border-red-400/70" : ""}`}
                        >
                          {on && <Check className="-ml-1 mr-1 inline h-4 w-4" aria-hidden />}
                          {optionLabel(o, lang)}
                        </button>
                      );
                    })}
                  </div>
                  {offList && <p className="mt-1.5 text-sm text-gold-300">{r.heardAs(v)}</p>}
                </>
              ) : (
                <input
                  id={`f-${f.key}`}
                  value={v}
                  onChange={(e) => set(f.key, e.target.value)}
                  inputMode={f.type === "phone" ? "tel" : f.type === "number" ? "numeric" : "text"}
                  type={f.type === "phone" ? "tel" : "text"}
                  autoComplete={f.key === "full_name" ? "name" : f.type === "phone" ? "tel-national" : "off"}
                  className={`mt-2 w-full rounded-xl border bg-navy-900 px-4 py-3 text-lg text-white placeholder:text-navy-500 focus:border-teal-400 focus:outline-none ${
                    empty || (f.key === "phone" && touched && phoneBad) ? "border-red-400" : "border-navy-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <StickyBar>
        {err && (
          <p role="alert" className="rounded-lg bg-red-900/90 p-3 text-sm text-red-50">
            {err}
          </p>
        )}
        <PrimaryButton onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {busy ? r.submitting : r.submit}
        </PrimaryButton>
      </StickyBar>
    </Page>
  );
}
