"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Download, ImageIcon, Loader2, Pencil, Play, Share2, Sparkles, X } from "lucide-react";
import { storyAdmin } from "@/lib/story/api";
import type { Player } from "@/components/AdminApp";

/**
 * Everything the tool keeps in Google Drive, shown inside the app: story
 * pages, photos, the interview video and the conversation.
 */

export interface MediaFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  created: string;
  url: string;
  thumb: string;
  seconds: number;
}

export interface Media {
  folderUrl: string;
  files: { interview: MediaFile[]; uploads: MediaFile[]; dmsa: MediaFile[]; story: MediaFile[] };
  storyVideo: string;
  /** What the story writer asked Shiva to check before sharing. */
  needsCheck?: string[];
}

interface StoryPages {
  lang: "en" | "kn";
  pages: string[];
  deckUrl?: string;
  pdf: { id: string; name: string; size: number } | null;
  hasKn?: boolean;
}

/** Drive thumbnails end in "=s220"; ask for a bigger one. */
export const sized = (thumb: string, px: number) => (thumb ? thumb.replace(/=s\d+(-[a-z0-9-]+)?$/i, "") + `=s${px}` : "");

/**
 * A Google-hosted image (Drive thumbnail, story page). Google sometimes
 * refuses these when the request carries our page as referrer, so send none,
 * and retry once in the lighter WebP form if loading still fails.
 */
export function GImg({ src, ...rest }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const [attempt, setAttempt] = useState(0);
  const url = attempt === 0 ? src : `${src}-rw${attempt > 1 ? "#" + attempt : ""}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...rest}
      src={url}
      referrerPolicy="no-referrer"
      onError={(e) => {
        if (attempt < 2) setTimeout(() => setAttempt((a) => a + 1), 800);
        else rest.onError?.(e);
      }}
    />
  );
}

const isPhoto = (f: MediaFile) => f.mime.startsWith("image/");
const isVideo = (f: MediaFile) => f.mime.startsWith("video/");

export function useMedia(adminKey: string, id: string) {
  const [media, setMedia] = useState<Media | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    storyAdmin<Media>("media", adminKey, { id }, 90000)
      .then((m) => alive && setMedia(m))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [adminKey, id]);
  return { media, failed };
}

/** Sorted interview pieces for a player page. */
export function interviewParts(media: Media | null) {
  const files = media?.files.interview || [];
  const videos = files.filter((f) => isVideo(f) && / - interview /.test(f.name)).sort((a, b) => b.size - a.size);
  const conversation = files.find((f) => /careful transcript.*\.txt$/.test(f.name)) || files.find((f) => / - transcript .*\.txt$/.test(f.name)) || null;
  const portraits = files.filter((f) => isPhoto(f));
  const photos = [...portraits, ...(media?.files.uploads || []), ...(media?.files.dmsa || [])].filter((f) => isPhoto(f) || isVideo(f));
  return { video: videos[0] || null, conversation, photos };
}

// ---------- video ----------

/** The interview video: a poster with a play button, then Drive's own player. */
export function VideoBox({ file }: { file: MediaFile }) {
  const [playing, setPlaying] = useState(false);
  const mins = file.seconds ? `${Math.floor(file.seconds / 60)}:${String(file.seconds % 60).padStart(2, "0")}` : "";
  if (playing)
    return (
      <div>
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe src={`https://drive.google.com/file/d/${file.id}/preview`} allow="autoplay; fullscreen" allowFullScreen className="h-full w-full" title="Interview video" />
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          If the video asks you to sign in, use the Google account that holds the Players Impact Stories folder.
        </p>
      </div>
    );
  return (
    <button
      onClick={() => setPlaying(true)}
      className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-[var(--navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
      aria-label="Play the interview video"
    >
      {file.thumb && (
        <GImg src={sized(file.thumb, 900)} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl transition group-hover:scale-105">
          <Play className="ml-1 h-7 w-7 fill-[var(--navy)] text-[var(--navy)]" />
        </span>
      </span>
      {mins && <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">{mins}</span>}
    </button>
  );
}

// ---------- conversation ----------

export interface Line {
  who: "maitri" | "player";
  at: string;
  text: string;
}

export function parseConversation(text: string): Line[] {
  const out: Line[] = [];
  text.split(/\r?\n/).forEach((raw) => {
    const m = raw.match(/^\s*(?:\[(\d+:\d{2})\]\s*)?([^:\[\]]{2,40}):\s+(.*)$/);
    if (m) {
      out.push({ who: /maitri|myithri/i.test(m[2]) ? "maitri" : "player", at: m[1] || "", text: m[3].trim() });
    } else if (raw.trim() && out.length && !/^---|^\S.* - interview /.test(raw.trim())) {
      out[out.length - 1].text += " " + raw.trim();
    }
  });
  return out;
}

/** The interview as a chat, loaded when opened. */
export function Conversation({ adminKey, playerId, file, name }: { adminKey: string; playerId: string; file: MediaFile; name: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!open || lines) return;
    storyAdmin<{ text: string }>("text", adminKey, { id: playerId, fileId: file.id }, 60000)
      .then((r) => setLines(parseConversation(r.text)))
      .catch(() => setLines([]));
  }, [open, lines, adminKey, playerId, file.id]);
  const shown = all ? lines || [] : (lines || []).slice(0, 12);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3 text-left text-[15px] font-semibold transition hover:border-[var(--teal)]"
        aria-expanded={open}
      >
        Read the conversation
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2.5">
          {!lines && <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--teal)]" />}
          {lines && !lines.length && <p className="text-sm text-[var(--muted)]">The conversation text is not available.</p>}
          {shown.map((l, i) => (
            <div key={i} className={`flex ${l.who === "maitri" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                  l.who === "maitri" ? "rounded-tl-sm bg-[var(--teal-soft)]" : "rounded-tr-sm bg-[var(--navy)] text-white"
                }`}
              >
                <p className={`mb-0.5 text-[11px] font-bold ${l.who === "maitri" ? "text-[var(--teal)]" : "text-white/60"}`}>
                  {l.who === "maitri" ? "Myithri" : name} {l.at && <span className="font-normal opacity-70">· {l.at}</span>}
                </p>
                {l.text}
              </div>
            </div>
          ))}
          {lines && lines.length > 12 && (
            <button onClick={() => setAll((v) => !v)} className="w-full py-2 text-sm font-semibold text-[var(--teal)]">
              {all ? "Show less" : `Show all ${lines.length} messages`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- photos ----------

export function PhotoGrid({ files, emptyText }: { files: MediaFile[]; emptyText: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!files.length) return <p className="text-sm text-[var(--muted)]">{emptyText}</p>;
  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {files.map((f, i) => (
          <li key={f.id}>
            <button
              onClick={() => setOpen(i)}
              className="relative block aspect-square w-full overflow-hidden rounded-lg bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
              aria-label={`Open ${f.name}`}
            >
              {f.thumb ? (
                <GImg src={sized(f.thumb, 400)} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="m-auto h-6 w-6 text-[var(--muted)]" />
              )}
              {isVideo(f) && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="h-7 w-7 fill-white text-white" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox files={files} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ files, index, onIndex, onClose }: { files: MediaFile[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const f = files[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < files.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, files.length, onIndex, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm tabular-nums text-white/70">
          {index + 1} / {files.length}
        </span>
        <button onClick={onClose} aria-label="Close" className="rounded-full bg-white/10 p-2.5">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
        {isVideo(f) ? (
          <iframe key={f.id} src={`https://drive.google.com/file/d/${f.id}/preview`} allow="autoplay; fullscreen" allowFullScreen className="aspect-video w-full max-w-4xl rounded-lg" title={f.name} />
        ) : (
          <GImg key={f.id} src={sized(f.thumb, 1600)} alt={f.name} className="max-h-full max-w-full rounded-lg object-contain" />
        )}
        {index > 0 && (
          <button onClick={() => onIndex(index - 1)} aria-label="Previous" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-2xl leading-none text-white">
            ‹
          </button>
        )}
        {index < files.length - 1 && (
          <button onClick={() => onIndex(index + 1)} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-2xl leading-none text-white">
            ›
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- stories ----------

async function pdfFile(adminKey: string, playerId: string, fileId: string) {
  const r = await storyAdmin<{ name: string; mime: string; data: string }>("blob", adminKey, { id: playerId, fileId }, 120000);
  const bytes = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
  return new File([bytes], r.name, { type: r.mime || "application/pdf" });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** The story's first page, loaded on its own so the gallery appears at once. */
export function StoryCover({ adminKey, playerId, className }: { adminKey: string; playerId: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    storyAdmin<StoryPages>("storyPages", adminKey, { id: playerId, lang: "en", first: 1 }, 90000)
      .then((r) => alive && setSrc(r.pages[0] || ""))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [adminKey, playerId]);
  return (
    <div className={`relative overflow-hidden bg-[var(--line)] ${className || ""}`}>
      {src === null && <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-[var(--line)] to-[var(--bg)]" />}
      {src && (
        <GImg src={src} alt="" className="h-full w-full object-cover object-top" />
      )}
      {src === "" && <BookOpen className="absolute inset-0 m-auto h-8 w-8 text-[var(--muted)]" />}
    </div>
  );
}

/** Full-screen reader: every page of the story, with share and download. */
export function StoryReader({
  adminKey,
  player,
  onClose,
  toast,
}: {
  adminKey: string;
  player: Player;
  onClose: () => void;
  toast: (t: string) => void;
}) {
  const [lang, setLang] = useState<"en" | "kn">("en");
  const [data, setData] = useState<Record<string, StoryPages>>({});
  const [busy, setBusy] = useState("");
  const current = data[lang];

  useEffect(() => {
    if (data[lang]) return;
    let alive = true;
    storyAdmin<StoryPages>("storyPages", adminKey, { id: player.id, lang }, 120000)
      .then((r) => alive && setData((d) => ({ ...d, [lang]: r })))
      .catch(() => alive && setData((d) => ({ ...d, [lang]: { lang, pages: [], pdf: null } })));
    return () => {
      alive = false;
    };
  }, [lang, data, adminKey, player.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasKn = !!player.pdfKnUrl || !!data.en?.hasKn;

  const share = async () => {
    if (!current?.pdf) return;
    setBusy("share");
    try {
      const file = await pdfFile(adminKey, player.id, current.pdf.id);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, "") }).catch(() => {});
      } else {
        download(file);
        toast("PDF downloaded");
      }
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    if (!current?.pdf) return;
    setBusy("download");
    try {
      download(await pdfFile(adminKey, player.id, current.pdf.id));
      toast("PDF downloaded");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1b2433]" role="dialog" aria-modal="true" aria-label={`${player.name}'s story`}>
      <header className="flex items-center gap-3 bg-[var(--navy)] px-3 py-2.5 text-white">
        <button onClick={onClose} aria-label="Close story" className="rounded-full bg-white/10 p-2.5 hover:bg-white/20">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-[16px] font-bold leading-tight">{player.name}</p>
          <p className="text-xs text-white/60">{player.approved ? "Approved by the player" : "Draft · waiting for the player's OK"}</p>
        </div>
        {hasKn && (
          <div className="flex rounded-full bg-black/25 p-1 text-[13px] font-semibold" role="tablist" aria-label="Language">
            {(["en", "kn"] as const).map((l) => (
              <button
                key={l}
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={`rounded-full px-3 py-1.5 transition ${lang === l ? "bg-white text-[var(--navy)]" : "text-white/70"}`}
              >
                {l === "en" ? "English" : "ಕನ್ನಡ"}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <div className="mx-auto max-w-3xl space-y-4">
          {!current &&
            [0, 1].map((i) => (
              <div key={i} className="aspect-[1/1.414] w-full animate-pulse rounded-md bg-white/10" />
            ))}
          {current && !current.pages.length && (
            <p className="py-20 text-center text-white/70">This story isn&apos;t ready in {lang === "en" ? "English" : "Kannada"} yet.</p>
          )}
          {current?.pages.map((src, i) => (
            <GImg key={src} src={src} alt={`Page ${i + 1}`} className="w-full rounded-md bg-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]" />
          ))}
        </div>
      </div>

      {current?.pdf && (
        <footer className="border-t border-white/10 bg-[var(--navy)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto grid max-w-3xl grid-cols-[1fr_auto_auto] gap-2">
            <button onClick={share} disabled={!!busy} className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 font-semibold text-[#073B2A] disabled:opacity-60">
              {busy === "share" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />} Share PDF
            </button>
            <button onClick={save} disabled={!!busy} aria-label="Download PDF" className="flex items-center justify-center rounded-xl bg-white/10 px-4 text-white disabled:opacity-60">
              {busy === "download" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            </button>
            {current.deckUrl && (
              <a href={current.deckUrl} target="_blank" rel="noreferrer" aria-label="Edit in Google Slides" className="flex items-center justify-center rounded-xl bg-white/10 px-4 text-white">
                <Pencil className="h-5 w-5" />
              </a>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

/** The Stories tab: every finished story as a cover, plus interviews still waiting for one. */
export function StoriesView({
  adminKey,
  players,
  onRead,
  onOpenPlayer,
}: {
  adminKey: string;
  players: Player[];
  onRead: (p: Player) => void;
  onOpenPlayer: (p: Player) => void;
}) {
  const withStory = useMemo(
    () => players.filter((p) => p.pdfEnUrl).sort((a, b) => Number(!!a.approved) - Number(!!b.approved) || String(b.updated).localeCompare(String(a.updated))),
    [players],
  );
  const waiting = useMemo(() => players.filter((p) => !p.pdfEnUrl && /^Interview done|incomplete/i.test(p.status)), [players]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
      <h1 className="font-heading text-2xl font-bold">Stories</h1>
      <p className="mt-1 text-[15px] text-[var(--muted)]">
        {withStory.length ? `${withStory.length} ${withStory.length === 1 ? "story" : "stories"} written. Tap one to read or share it.` : "No stories yet. They appear here once an interview is done."}
      </p>

      {withStory.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {withStory.map((p) => (
            <li key={p.id}>
              <button onClick={() => onRead(p)} className="group block w-full text-left focus-visible:outline-none">
                <StoryCover
                  adminKey={adminKey}
                  playerId={p.id}
                  className="aspect-[1/1.414] rounded-lg shadow-[0_14px_30px_-18px_rgba(11,31,68,0.7)] ring-1 ring-[var(--line)] transition group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-[var(--teal)]"
                />
                <p className="mt-2.5 truncate font-semibold">{p.name}</p>
                <p className="truncate text-xs text-[var(--muted)]">{p.hometown || "—"}</p>
                <span
                  className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    p.approved ? "bg-[var(--gold-soft)] text-[#7D5A1E]" : "bg-[var(--teal-soft)] text-[var(--teal)]"
                  }`}
                >
                  {p.approved ? "Approved" : "Waiting for player's OK"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {waiting.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading text-lg font-bold">Interviews waiting for a story</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Stories are usually written automatically right after an interview of 8+ minutes. Open a player to write one now - it takes about a minute.</p>
          <ul className="mt-3 space-y-2">
            {waiting.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onOpenPlayer(p)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[var(--teal)]"
                >
                  <Sparkles className="h-5 w-5 flex-none text-[var(--gold)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block text-xs text-[var(--muted)]">{p.minutes ? `${p.minutes} min interview` : "Interview done"}</span>
                  </span>
                  <span className="text-sm font-semibold text-[var(--teal)]">Open</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
