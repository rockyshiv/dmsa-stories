"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronRight, Loader2, Mic, RotateCcw } from "lucide-react";
import { flushStoryLog, storyApi, storyLog } from "@/lib/story/api";
import { MYITHRI_NAME, STRINGS, type Lang } from "@/lib/story/i18n";
import { getCameraAndMic, getMicOnly, unlockAudio } from "@/lib/story/interview";
import MyithriFace from "@/components/MyithriFace";
import {
  CameraBlocked,
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
  inRealChrome,
} from "@/components/InterviewApp";

/**
 * A conversation link (.../dmsa-stories/?u=CODE): feedback, a first-round
 * interview, or anything Shiva set up. The person gives their name, agrees,
 * and talks with Myithri; the summary is written after the call.
 */

interface Info {
  open: boolean;
  name: string;
  type: string;
  intro: string;
  minutes: number;
  language: "kn" | "en" | "hi" | "choose";
  recording: "voice" | "video";
  askPhone: boolean;
  consent: Record<Lang, string[]>;
  liveModels: number;
  /** The organisation's short name (Settings). */
  org?: string;
}

type Screen = "loading" | "invalid" | "closed" | "welcome" | "consent" | "device" | "interview" | "saving" | "thanks" | "done" | "error";

const T = {
  en: {
    nameLabel: "Your name",
    namePlaceholder: "Write your full name",
    phoneLabel: "Your phone number",
    phoneOptional: "(optional)",
    phonePlaceholder: "10-digit mobile number",
    minutes: (m: number) => `About ${m} minutes`,
    voiceOnly: "Voice only - no video",
    withVideo: "On video",
    start: "Continue",
    welcomeBack: (n: string) => `Welcome back, ${n}! You can continue where you left off.`,
    consentTitle: "Before we start",
    micTitle: "Microphone",
    micHelp: "Your phone will ask to use the microphone. Choose Allow so Myithri can hear you.",
    allowMic: "Allow microphone",
    micBlocked: "Your phone has blocked the microphone for this page. To switch it back on:",
    micBlockedSteps: [
      "Tap the small icon at the left of the web address (a lock or ⓘ).",
      "Tap \"Permissions\" or \"Site settings\".",
      "Turn on Microphone (choose Allow).",
      "Come back here and tap \"Try again\".",
    ],
    micDismissed: "The microphone question was closed. Tap the button below and choose \"Allow\".",
    cameraHelp: "Your phone will ask to use the camera and microphone. Choose Allow so Myithri can hear you and the conversation can be recorded.",
    ready: "All set. Find a quiet place, then start.",
    talk: "Start talking with Myithri",
    thanksTitle: (n: string) => `Thank you${n ? ", " + n : ""}!`,
    thanks: "Your answers have been saved. We really appreciate your time.",
    doneBefore: "You have already taken part. Thank you!",
    again: "Take part again",
    closed: "This conversation is closed. Thank you for your interest.",
    badLink: "This link is not valid. Please check the link you were sent.",
    needName: "Please write your name.",
    needPhone: "Please write your 10-digit phone number.",
    role: (type: string, org: string) => (type === "interview" ? `${org}'s AI interviewer` : `${org}'s AI volunteer`),
    copy: {
      saving: "Saving your conversation…",
      savingHelp: "Please keep this page open. It takes a few seconds.",
      savedFail: "Some of the recording could not be saved, but your answers are safe. Please check your internet and tap Retry.",
      endConfirm: "Finish the conversation now?",
      yesEnd: "Yes, finish",
      keepOpen: "Please keep this screen open while you talk with Myithri.",
    },
  },
  kn: {
    nameLabel: "ನಿಮ್ಮ ಹೆಸರು",
    namePlaceholder: "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಬರೆಯಿರಿ",
    phoneLabel: "ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆ",
    phoneOptional: "(ಐಚ್ಛಿಕ)",
    phonePlaceholder: "10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
    minutes: (m: number) => `ಸುಮಾರು ${m} ನಿಮಿಷ`,
    voiceOnly: "ಧ್ವನಿ ಮಾತ್ರ - ವೀಡಿಯೊ ಇಲ್ಲ",
    withVideo: "ವೀಡಿಯೊದಲ್ಲಿ",
    start: "ಮುಂದುವರಿಸಿ",
    welcomeBack: (n: string) => `ಮತ್ತೆ ಸ್ವಾಗತ, ${n}! ನಿಲ್ಲಿಸಿದಲ್ಲಿಂದಲೇ ಮುಂದುವರಿಸಬಹುದು.`,
    consentTitle: "ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು",
    micTitle: "ಮೈಕ್",
    micHelp: "ನಿಮ್ಮ ಫೋನ್ ಮೈಕ್ ಬಳಸಲು ಅನುಮತಿ ಕೇಳುತ್ತದೆ. ಮೈತ್ರಿ ನಿಮ್ಮ ಮಾತು ಕೇಳಲು Allow ಆಯ್ಕೆ ಮಾಡಿ.",
    allowMic: "ಮೈಕ್‌ಗೆ ಅನುಮತಿ ನೀಡಿ",
    micBlocked: "ನಿಮ್ಮ ಫೋನ್ ಈ ಪುಟಕ್ಕೆ ಮೈಕ್ ಬ್ಲಾಕ್ ಮಾಡಿದೆ. ಮತ್ತೆ ಆನ್ ಮಾಡಲು:",
    micBlockedSteps: [
      "ವೆಬ್ ವಿಳಾಸದ ಎಡಭಾಗದಲ್ಲಿರುವ ಸಣ್ಣ ಚಿಹ್ನೆ (ಬೀಗ ಅಥವಾ ⓘ) ಒತ್ತಿ.",
      "\"Permissions\" ಅಥವಾ \"Site settings\" ಒತ್ತಿ.",
      "Microphone ಆನ್ ಮಾಡಿ (Allow ಆಯ್ಕೆ ಮಾಡಿ).",
      "ಇಲ್ಲಿಗೆ ಹಿಂದಿರುಗಿ \"ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ\" ಒತ್ತಿ.",
    ],
    micDismissed: "ಮೈಕ್ ಅನುಮತಿ ಪ್ರಶ್ನೆ ಮುಚ್ಚಲಾಯಿತು. ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿ \"Allow\" ಆಯ್ಕೆ ಮಾಡಿ.",
    cameraHelp: "ನಿಮ್ಮ ಫೋನ್ ಕ್ಯಾಮೆರಾ ಮತ್ತು ಮೈಕ್ ಬಳಸಲು ಅನುಮತಿ ಕೇಳುತ್ತದೆ. Allow ಆಯ್ಕೆ ಮಾಡಿ.",
    ready: "ಎಲ್ಲಾ ಸಿದ್ಧ. ಶಾಂತವಾದ ಸ್ಥಳದಲ್ಲಿ ಕುಳಿತು ಆರಂಭಿಸಿ.",
    talk: "ಮೈತ್ರಿ ಜೊತೆ ಮಾತು ಆರಂಭಿಸಿ",
    thanksTitle: (n: string) => `ಧನ್ಯವಾದಗಳು${n ? ", " + n : ""}!`,
    thanks: "ನಿಮ್ಮ ಉತ್ತರಗಳು ಉಳಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ಸಮಯಕ್ಕೆ ಧನ್ಯವಾದ.",
    doneBefore: "ನೀವು ಈಗಾಗಲೇ ಭಾಗವಹಿಸಿದ್ದೀರಿ. ಧನ್ಯವಾದಗಳು!",
    again: "ಮತ್ತೆ ಭಾಗವಹಿಸಿ",
    closed: "ಈ ಮಾತುಕತೆ ಮುಕ್ತಾಯವಾಗಿದೆ. ನಿಮ್ಮ ಆಸಕ್ತಿಗೆ ಧನ್ಯವಾದ.",
    badLink: "ಈ ಲಿಂಕ್ ಸರಿಯಿಲ್ಲ. ನಿಮಗೆ ಕಳುಹಿಸಿದ ಲಿಂಕ್ ಪರಿಶೀಲಿಸಿ.",
    needName: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರು ಬರೆಯಿರಿ.",
    needPhone: "ದಯವಿಟ್ಟು 10 ಅಂಕಿಯ ಫೋನ್ ಸಂಖ್ಯೆ ಬರೆಯಿರಿ.",
    role: (type: string, org: string) => (type === "interview" ? `${org} ಯ AI ಸಂದರ್ಶಕಿ` : `${org} ಯ AI ಸ್ವಯಂಸೇವಕಿ`),
    copy: {
      saving: "ನಿಮ್ಮ ಮಾತುಕತೆ ಉಳಿಸಲಾಗುತ್ತಿದೆ…",
      savingHelp: "ದಯವಿಟ್ಟು ಈ ಪುಟ ತೆರೆದಿಡಿ. ಕೆಲವೇ ಸೆಕೆಂಡು.",
      savedFail: "ರೆಕಾರ್ಡಿಂಗ್ ಪೂರ್ತಿ ಉಳಿಯಲಿಲ್ಲ, ಆದರೆ ನಿಮ್ಮ ಉತ್ತರಗಳು ಸುರಕ್ಷಿತ. ಇಂಟರ್ನೆಟ್ ಪರಿಶೀಲಿಸಿ Retry ಒತ್ತಿ.",
      endConfirm: "ಈಗ ಮಾತುಕತೆ ಮುಗಿಸುವಿರಾ?",
      yesEnd: "ಹೌದು, ಮುಗಿಸಿ",
      keepOpen: "ಮೈತ್ರಿ ಜೊತೆ ಮಾತನಾಡುವಾಗ ಈ ಪರದೆ ತೆರೆದಿಡಿ.",
    },
  },
  hi: {
    nameLabel: "आपका नाम",
    namePlaceholder: "अपना पूरा नाम लिखें",
    phoneLabel: "आपका फ़ोन नंबर",
    phoneOptional: "(ज़रूरी नहीं)",
    phonePlaceholder: "10 अंकों का मोबाइल नंबर",
    minutes: (m: number) => `लगभग ${m} मिनट`,
    voiceOnly: "सिर्फ़ आवाज़ - वीडियो नहीं",
    withVideo: "वीडियो पर",
    start: "आगे बढ़ें",
    welcomeBack: (n: string) => `फिर से स्वागत है, ${n}! जहाँ रुके थे, वहीं से आगे बढ़ सकते हैं।`,
    consentTitle: "शुरू करने से पहले",
    micTitle: "माइक",
    micHelp: "आपका फ़ोन माइक की अनुमति माँगेगा। Allow चुनें ताकि मैत्री आपको सुन सकें।",
    allowMic: "माइक की अनुमति दें",
    micBlocked: "आपके फ़ोन ने इस पेज के लिए माइक बंद कर दिया है। फिर से चालू करने के लिए:",
    micBlockedSteps: [
      "वेब पते के बाईं ओर छोटे निशान (ताला या ⓘ) को दबाएँ।",
      "\"Permissions\" या \"Site settings\" दबाएँ।",
      "Microphone चालू करें (Allow चुनें)।",
      "यहाँ वापस आकर \"फिर कोशिश करें\" दबाएँ।",
    ],
    micDismissed: "माइक की अनुमति वाला सवाल बंद हो गया। नीचे का बटन दबाएँ और \"Allow\" चुनें।",
    cameraHelp: "आपका फ़ोन कैमरा और माइक की अनुमति माँगेगा। Allow चुनें ताकि मैत्री आपको सुन सकें और बातचीत रिकॉर्ड हो सके।",
    ready: "सब तैयार है। किसी शांत जगह बैठकर शुरू करें।",
    talk: "मैत्री से बात शुरू करें",
    thanksTitle: (n: string) => `धन्यवाद${n ? ", " + n : ""}!`,
    thanks: "आपके जवाब सेव हो गए हैं। आपके समय के लिए बहुत धन्यवाद।",
    doneBefore: "आप पहले ही हिस्सा ले चुके हैं। धन्यवाद!",
    again: "फिर से हिस्सा लें",
    closed: "यह बातचीत अब बंद है। आपकी रुचि के लिए धन्यवाद।",
    badLink: "यह लिंक सही नहीं है। कृपया आपको भेजा गया लिंक देखें।",
    needName: "कृपया अपना नाम लिखें।",
    needPhone: "कृपया 10 अंकों का फ़ोन नंबर लिखें।",
    role: (type: string, org: string) => (type === "interview" ? `${org} की AI इंटरव्यूअर` : `${org} की AI स्वयंसेवक`),
    copy: {
      saving: "आपकी बातचीत सेव हो रही है…",
      savingHelp: "कृपया यह पेज खुला रखें। कुछ ही सेकंड लगेंगे।",
      savedFail: "रिकॉर्डिंग का कुछ हिस्सा सेव नहीं हो सका, पर आपके जवाब सुरक्षित हैं। इंटरनेट देखें और Retry दबाएँ।",
      endConfirm: "क्या अभी बातचीत ख़त्म करनी है?",
      yesEnd: "हाँ, ख़त्म करें",
      keepOpen: "मैत्री से बात करते समय यह स्क्रीन खुली रखें।",
    },
  },
};

const storeKey = (code: string) => `dmsa_conv_${code}`;
function readSaved(code: string): { code: string; name: string } | null {
  try {
    return JSON.parse(localStorage.getItem(storeKey(code)) || "null");
  } catch {
    return null;
  }
}
function writeSaved(code: string, v: { code: string; name: string } | null) {
  try {
    if (v) localStorage.setItem(storeKey(code), JSON.stringify(v));
    else localStorage.removeItem(storeKey(code));
  } catch {
    /* private mode: a reload starts afresh */
  }
}

export default function ConversationApp({ code }: { code: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [info, setInfo] = useState<Info | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [resp, setResp] = useState<{ code: string; name: string } | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<false | "dismissed" | "blocked">(false);
  const [voiceOnly, setVoiceOnly] = useState(false);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const t = STRINGS[lang];
  const c = T[lang];
  const logId = resp?.code || `CONV-${code}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const i = await storyApi<Info & { ok: boolean }>("convInfo", { code }, 4, 60000);
        if (!alive) return;
        // Older replies have no Hindi consent: show English rather than nothing.
        i.consent = { ...i.consent, hi: i.consent.hi || i.consent.en };
        setInfo(i);
        document.title = `${i.name} | ${i.org || "Myithri"}`;
        if (i.language === "kn" || i.language === "en" || i.language === "hi") setLang(i.language);
        if (!i.open) return setScreen("closed");
        const saved = readSaved(code);
        if (saved) {
          try {
            const s = await storyApi<{ done: boolean; name: string; language: Lang }>("session", { code: saved.code }, 3, 45000);
            if (!alive) return;
            setResp(saved);
            setName(saved.name);
            if (i.language === "choose") setLang(s.language);
            if (s.done) return setScreen("done");
            setContinuing(true);
          } catch {
            writeSaved(code, null);
          }
        }
        setScreen("welcome");
      } catch (e) {
        if (!alive) return;
        const m = String((e as Error)?.message || e);
        if (/unknown_conversation/.test(m)) setScreen("invalid");
        else {
          setErrorMsg(m);
          setScreen("error");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [code]);

  useEffect(() => {
    document.querySelector("[data-story-root]")?.scrollTo(0, 0);
    if (screen !== "loading") storyLog(logId, `conv screen: ${screen}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const begin = async () => {
    setFormError("");
    if (resp) return setScreen("consent");
    if (!name.trim()) return setFormError(c.needName);
    if (info?.askPhone && phone.replace(/\D/g, "").length !== 10) return setFormError(c.needPhone);
    setBusy(true);
    try {
      const r = await storyApi<{ code: string; id: string }>("convStart", { code, name: name.trim(), phone, lang, requestId: requestId.current }, 4, 60000);
      const saved = { code: r.code, name: name.trim() };
      writeSaved(code, saved);
      setResp(saved);
      setScreen("consent");
    } catch (e) {
      setFormError(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const askDevice = async () => {
    setCamError(false);
    const wantVideo = info?.recording === "video" && !voiceOnly;
    try {
      const s = wantVideo ? await getCameraAndMic() : await getMicOnly();
      storyLog(logId, `device ok: video ${s.getVideoTracks().length}, mic ${s.getAudioTracks().length}`);
      setStream(s);
    } catch (e) {
      storyLog(logId, `device failed: ${(e as Error)?.name}`);
      flushStoryLog();
      setCamError(/dismiss/i.test(String((e as Error)?.message)) ? "dismissed" : "blocked");
    }
  };

  const giveConsent = () => {
    if (!resp || !info) return;
    storyApi("consent", { code: resp.code, lang, text: info.consent[lang].map((x) => "- " + x).join("\n"), userAgent: navigator.userAgent }).catch(() => {});
    setScreen("device");
    askDevice();
  };

  const takePartAgain = () => {
    writeSaved(code, null);
    location.reload();
  };

  const firstName = (resp?.name || name).split(" ")[0];

  return (
    <div data-story-root className="fixed inset-0 z-[1000] overflow-y-auto bg-navy-950 font-sans text-white" lang={lang}>
      {screen === "loading" && (
        <Centered>
          <Logo />
          <Loader2 className="mt-10 h-9 w-9 animate-spin text-teal-400" aria-label="Loading" />
        </Centered>
      )}

      {(screen === "invalid" || screen === "closed") && (
        <Centered>
          <Logo />
          <p className="mt-8 max-w-sm text-center text-lg">{screen === "invalid" ? T.en.badLink : T.en.closed}</p>
          <p className="mt-4 max-w-sm text-center text-navy-200">{screen === "invalid" ? T.kn.badLink : T.kn.closed}</p>
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
            {info.language === "choose" && <LangToggle lang={lang} setLang={setLang} langs={["en", "hi", "kn"]} />}
          </div>
          {inAppBrowser() && <OpenInChrome code={logId} text={t.openInChrome} button={t.openInChromeButton} />}
          <h1 className="mt-8 font-display text-5xl leading-none tracking-wide text-white">{info.name}</h1>
          <div className="mt-6 flex items-center gap-3">
            <MyithriFace className="h-16 w-16 flex-none rounded-full bg-[#f3ece4] ring-2 ring-white/20" />
            <div>
              <p className="font-heading text-lg font-bold leading-tight">{MYITHRI_NAME[lang]}</p>
              <p className="text-sm text-teal-200">{c.role(info.type, info.org || "DMSA")}</p>
            </div>
          </div>
          <p className="mt-5 text-lg leading-relaxed text-navy-100">{info.intro}</p>
          <p className="mt-3 text-sm text-teal-200">
            {c.minutes(info.minutes)} · {info.recording === "video" ? c.withVideo : c.voiceOnly}
          </p>

          {continuing && resp ? (
            <p className="mt-6 rounded-lg bg-teal-900/60 p-4 text-teal-100">{c.welcomeBack(firstName)}</p>
          ) : (
            <div className="mt-7 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-navy-50">{c.nameLabel}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={c.namePlaceholder}
                  autoComplete="name"
                  className="mt-2 w-full rounded-xl border border-navy-700 bg-navy-900 px-4 py-3 text-lg text-white placeholder:text-navy-400 focus:border-teal-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-navy-50">
                  {c.phoneLabel} {!info.askPhone && <span className="font-normal text-navy-300">{c.phoneOptional}</span>}
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={c.phonePlaceholder}
                  inputMode="tel"
                  type="tel"
                  autoComplete="tel-national"
                  className="mt-2 w-full rounded-xl border border-navy-700 bg-navy-900 px-4 py-3 text-lg text-white placeholder:text-navy-400 focus:border-teal-400 focus:outline-none"
                />
              </label>
            </div>
          )}
          <StickyBar>
            {formError && (
              <p role="alert" className="rounded-lg bg-red-900/90 p-3 text-sm text-red-50">
                {formError}
              </p>
            )}
            <PrimaryButton onClick={begin} disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null} {c.start} <ChevronRight className="h-5 w-5" />
            </PrimaryButton>
          </StickyBar>
        </Page>
      )}

      {screen === "consent" && info && (
        <Page>
          <Logo />
          <h1 className="mt-8 font-heading text-2xl font-bold">{c.consentTitle}</h1>
          <ul className="mt-5 space-y-4">
            {info.consent[lang].map((x, i) => (
              <li key={i} className="flex gap-3 text-base leading-relaxed text-navy-50">
                <Check className="mt-1 h-5 w-5 flex-none text-teal-400" aria-hidden />
                <span>{x}</span>
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

      {screen === "device" && info && (
        <Page>
          <Logo />
          <h1 className="mt-8 font-heading text-2xl font-bold">{info.recording === "video" && !voiceOnly ? t.cameraTitle : c.micTitle}</h1>
          {!stream ? (
            <>
              <p className="mt-3 text-base text-navy-100">{info.recording === "video" && !voiceOnly ? c.cameraHelp : c.micHelp}</p>
              {camError && (
                <p className="mt-4 rounded-lg bg-red-900/60 p-4 text-red-100">
                  {info.recording === "video" && !voiceOnly ? (camError === "dismissed" ? t.cameraDismissed : t.cameraDenied) : camError === "dismissed" ? c.micDismissed : c.micBlocked}
                </p>
              )}
              {/* Voice briefs: without these steps a blocked microphone was a dead end. */}
              {camError === "blocked" && !(info.recording === "video" && !voiceOnly) && (
                <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-relaxed text-navy-50">
                  {c.micBlockedSteps.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
              )}
              {camError === "blocked" && info.recording === "video" && !voiceOnly && (
                <CameraBlocked
                  lang={lang}
                  onRetry={askDevice}
                  onVoiceOnly={async () => {
                    setVoiceOnly(true);
                    try {
                      setStream(await getMicOnly());
                      setCamError(false);
                    } catch {
                      setCamError("blocked");
                    }
                  }}
                />
              )}
              {camError === "blocked" && !inRealChrome() && <OpenInChrome code={logId} text={t.noCameraQuestion} button={t.openInChromeButton} />}
              {(camError !== "blocked" || !(info.recording === "video" && !voiceOnly)) && (
                <StickyBar>
                  <PrimaryButton onClick={askDevice}>
                    {info.recording === "video" ? <Camera className="h-5 w-5" /> : <Mic className="h-5 w-5" />}{" "}
                    {camError === "blocked" ? t.tryAgainCamera : info.recording === "video" ? t.allow : c.allowMic}
                  </PrimaryButton>
                </StickyBar>
              )}
            </>
          ) : (
            <>
              {stream.getVideoTracks().length ? (
                <SelfView stream={stream} className="mx-auto mt-5 aspect-[3/4] h-[36vh] rounded-2xl" />
              ) : (
                <div className="mt-8 flex justify-center">
                  <MyithriFace className="h-40 w-40 rounded-full bg-[#f3ece4] ring-4 ring-teal-400/30" />
                </div>
              )}
              <p className="mt-5 text-center text-base text-navy-100">{c.ready}</p>
              <StickyBar>
                <PrimaryButton
                  onClick={() => {
                    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                    const ctx = new Ctx();
                    unlockAudio(ctx);
                    setAudioCtx(ctx);
                    setScreen("interview");
                  }}
                >
                  <Mic className="h-5 w-5" /> {c.talk}
                </PrimaryButton>
              </StickyBar>
            </>
          )}
        </Page>
      )}

      {(screen === "interview" || screen === "saving") && stream && audioCtx && info && resp && (
        <InterviewScreen
          audioCtx={audioCtx}
          code={resp.code}
          lang={lang}
          session={{ firstName, language: lang, minutes: info.minutes, hasEarlier: continuing, done: false, liveModels: info.liveModels || 3 }}
          stream={stream}
          saving={screen === "saving"}
          onEnding={() => setScreen("saving")}
          onSaved={() => {
            stream.getTracks().forEach((tr) => tr.stop());
            setScreen("thanks");
          }}
          onFatal={(m) => {
            setErrorMsg(m);
            setScreen("error");
          }}
          engineOptions={{
            recordVideo: info.recording === "video" && stream.getVideoTracks().length > 0,
            endTool: "end_interview",
            minEndSeconds: 60,
            storyTimeNotes: false,
            timeNotes: {
              soon: "[TIME] About 2 minutes left. Cover the remaining questions briefly, ask if there is anything else, then thank them and end.",
              over: "[TIME] Time is up. Thank them warmly, say goodbye and end the conversation.",
            },
          }}
          copy={{ ...c.copy, maitriRole: c.role(info.type, info.org || "DMSA") }}
        />
      )}

      {screen === "thanks" && (
        <Centered>
          <Logo />
          <div className="mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500">
            <Check className="h-9 w-9 text-white" />
          </div>
          <h1 className="mt-6 text-center font-display text-5xl tracking-wide">{c.thanksTitle(firstName)}</h1>
          <p className="mt-4 max-w-md text-center text-lg leading-relaxed text-navy-100">{c.thanks}</p>
        </Centered>
      )}

      {screen === "done" && (
        <Centered>
          <Logo />
          <div className="mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500">
            <Check className="h-9 w-9 text-white" />
          </div>
          <p className="mt-6 max-w-md text-center text-lg leading-relaxed text-navy-100">{c.doneBefore}</p>
          <SecondaryButton onClick={takePartAgain}>
            <RotateCcw className="h-5 w-5" /> {c.again}
          </SecondaryButton>
        </Centered>
      )}
    </div>
  );
}
