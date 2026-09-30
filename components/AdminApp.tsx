"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { storyAdmin, StoryApiError } from "@/lib/story/api";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const KEY_STORE = "dmsaAdminKey";

export interface Player {
  id: string;
  name: string;
  callname: string;
  greet: string;
  phone: string;
  pronoun: string;
  hometown: string;
  language: string;
  joined: string;
  role: string;
  disability: string;
  achievements: string;
  support: string;
  work: string;
  notes: string;
  qr: string;
  code: string;
  link: string;
  status: string;
  consent: string;
  minutes: string | number;
  uploads: string;
  approved: boolean;
  updated: string;
  canWhatsApp: boolean;
  folderUrl: string;
  slidesUrl: string;
  pdfEnUrl: string;
  pdfKnUrl: string;
}

interface DriveFile {
  name: string;
  url: string;
  mime: string;
  size: number;
  created: string;
}

// ---------- the six stages of a player's journey, shown as the six balls of an over ----------

const STAGES = ["Sent", "Opened", "Agreed", "Interviewed", "Story", "Approved"] as const;

/** How many of the six stages this player has completed (0-6). */
function stageOf(p: Pick<Player, "status" | "approved">): number {
  const s = String(p.status || "");
  if (p.approved || /^Approved/.test(s)) return 6;
  if (/^Story|^Kannada/.test(s)) return 5;
  if (/^Interview done/.test(s)) return 4;
  if (/^Consent|in progress|incomplete/i.test(s)) return 3;
  if (/^Opened/.test(s)) return 2;
  if (/^Link sent/.test(s)) return 1;
  return 0;
}

/** Started but not finished, and nothing has happened for a day: worth a nudge. */
function isStuck(p: Player): boolean {
  const st = stageOf(p);
  if (st < 1 || st > 3) return false;
  const t = Date.parse(p.updated);
  return !isNaN(t) && Date.now() - t > 20 * 3600 * 1000;
}

type Filter = "all" | "notSent" | "waiting" | "started" | "finished" | "stuck";

const FILTERS: { id: Filter; label: string; test: (p: Player) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "notSent", label: "Not sent", test: (p) => stageOf(p) === 0 },
  { id: "waiting", label: "Waiting", test: (p) => stageOf(p) === 1 || stageOf(p) === 2 },
  { id: "started", label: "In progress", test: (p) => stageOf(p) === 3 },
  { id: "finished", label: "Interviewed", test: (p) => stageOf(p) >= 4 },
  { id: "stuck", label: "Needs a nudge", test: isStuck },
];

function ago(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

// ---------- private key from the app link ----------

function readKey(): string | null {
  const m = window.location.hash.match(/k=([\w-]+)/);
  if (m) return m[1];
  try {
    return localStorage.getItem(KEY_STORE);
  } catch {
    return null;
  }
}

export default function AdminApp() {
  const key = useSyncExternalStore(
    () => () => {},
    readKey,
    () => undefined,
  );

  // Remember the key from the link, then drop it from the address bar.
  useEffect(() => {
    const m = window.location.hash.match(/k=([\w-]+)/);
    if (m) {
      try {
        localStorage.setItem(KEY_STORE, m[1]);
      } catch {
        /* private mode: the link keeps working */
      }
      history.replaceState(null, "", window.location.pathname);
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${BASE}/admin-sw.js`, { scope: `${BASE}/admin/` }).catch(() => {});
  }, []);

  if (key === undefined) return <Shell />;
  if (!key) {
    return (
      <Shell>
        <Center>
          <Logo />
          <p className="mt-8 max-w-sm text-center text-lg font-semibold">Open the app with your private Player Stories link.</p>
          <p className="mt-2 max-w-sm text-center text-sm text-[var(--muted)]">It is the link that ends with #k=…</p>
        </Center>
      </Shell>
    );
  }
  return <Dashboard adminKey={key} />;
}

// ---------- dashboard ----------

function Dashboard({ adminKey }: { adminKey: string }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    return storyAdmin<{ players: Player[] }>("list", adminKey, {}, 90000)
      .then((r) => {
        setPlayers(r.players.filter((p) => !/\(test\)/i.test(p.name)));
        setError("");
      })
      .catch((e) => setError(e instanceof StoryApiError && e.code === "not_admin" ? "This app link is no longer valid." : "Couldn't load players. Check your internet and try again."))
      .finally(() => setRefreshing(false));
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 3000);
  };

  const replace = (p: Player) => setPlayers((xs) => (xs ? xs.map((x) => (x.id === p.id ? p : x)) : xs));

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    FILTERS.forEach((f) => (c[f.id] = (players || []).filter(f.test).length));
    return c;
  }, [players]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.id === filter)!.test;
    return (players || [])
      .filter((p) => test(p) && (!q || `${p.name} ${p.callname} ${p.hometown} ${p.id} ${p.phone}`.toLowerCase().includes(q)))
      .sort((a, b) => stageOf(b) - stageOf(a) || a.id.localeCompare(b.id));
  }, [players, filter, query]);

  const open = players?.find((p) => p.id === openId) || null;
  const finished = (players || []).filter((p) => stageOf(p) >= 4).length;
  const stories = (players || []).filter((p) => stageOf(p) >= 5).length;

  return (
    <Shell>
      <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(380px,460px)_1fr]">
        {/* ---- left: scoreboard + list ---- */}
        <div className="lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden lg:border-r lg:border-[var(--line)]">
          <header className="bg-[var(--navy)] px-4 pb-4 pt-3 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Logo small />
                <div>
                  <p className="font-heading text-[15px] font-bold leading-tight">Player Stories</p>
                  <p className="text-xs text-white/60">Interviews with Maitri</p>
                </div>
              </div>
              <button
                aria-label="Refresh"
                onClick={() => {
                  setRefreshing(true);
                  load();
                }}
                className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* scoreboard */}
            <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <ScoreCell value={players ? finished : "–"} label="Interviewed" tone="gold" />
              <ScoreCell value={players ? stories : "–"} label="Stories" tone="teal" />
              <ScoreCell value={players ? counts.started + counts.waiting : "–"} label="Pending" />
              <ScoreCell value={players ? counts.notSent : "–"} label="Not sent" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div
                  className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-700"
                  style={{ width: `${players?.length ? (finished / players.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-white/70">
                {finished}/{players?.length ?? 0}
              </span>
            </div>
          </header>

          {!players && !error && (
            <Center>
              <Loader2 className="h-7 w-7 animate-spin text-[var(--teal)]" />
              <p className="mt-3 text-sm text-[var(--muted)]">Loading players…</p>
            </Center>
          )}
          {error && (
            <Center>
              <p className="max-w-sm text-center">{error}</p>
              <button className="mt-5 rounded-xl bg-[var(--teal)] px-5 py-3 font-semibold text-white" onClick={() => load()}>
                Try again
              </button>
            </Center>
          )}

          {players && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-3 px-4 pt-4">
                <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 focus-within:border-[var(--teal)]">
                  <Search className="h-4 w-4 text-[var(--muted)]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, district or ID"
                    className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]"
                  />
                </label>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                        filter === f.id
                          ? f.id === "stuck"
                            ? "border-[var(--alert)] bg-[var(--alert)] text-white"
                            : "border-[var(--navy)] bg-[var(--navy)] text-white"
                          : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                      }`}
                    >
                      {f.label}
                      <span className="tabular-nums opacity-70">{counts[f.id]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <ul className="mt-2 flex-1 space-y-2 overflow-y-auto px-4 pb-28 pt-1 lg:pb-6">
                {shown.map((p) => (
                  <li key={p.id}>
                    <PlayerRow player={p} active={p.id === openId} onOpen={() => setOpenId(p.id)} adminKey={adminKey} onSent={replace} />
                  </li>
                ))}
                {!shown.length && (
                  <li className="rounded-xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                    {filter === "stuck" ? "Nobody is stuck right now." : "No players match."}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* ---- right: player (full screen on phones) ---- */}
        <div
          className={`${open || adding ? "fixed inset-0 z-30 overflow-y-auto" : "hidden"} bg-[var(--bg)] lg:static lg:block lg:h-dvh lg:overflow-y-auto`}
        >
          {adding ? (
            <AddPlayer
              adminKey={adminKey}
              onBack={() => setAdding(false)}
              onAdded={(p) => {
                setPlayers((xs) => [...(xs || []), p]);
                setAdding(false);
                setOpenId(p.id);
              }}
            />
          ) : open ? (
            <PlayerPage key={open.id} adminKey={adminKey} player={open} onBack={() => setOpenId(null)} onChange={replace} toast={showToast} />
          ) : (
            <div className="hidden h-full flex-col items-center justify-center px-10 text-center lg:flex">
              <Over stage={0} large />
              <p className="mt-6 font-heading text-lg font-bold">Choose a player</p>
              <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">
                The six balls show each player&apos;s journey: sent, opened, agreed, interviewed, story, approved.
              </p>
            </div>
          )}
        </div>
      </div>

      {!adding && (
        <button
          onClick={() => {
            setOpenId(null);
            setAdding(true);
          }}
          className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-full bg-[var(--navy)] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_30px_-10px_rgba(11,31,68,0.6)] transition hover:bg-[var(--navy2)] lg:bottom-6 lg:left-6 lg:right-auto"
        >
          <Plus className="h-5 w-5" /> Add player
        </button>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </Shell>
  );
}

function ScoreCell({ value, label, tone }: { value: number | string; label: string; tone?: "gold" | "teal" }) {
  const color = tone === "gold" ? "text-[var(--gold)]" : tone === "teal" ? "text-[var(--teal-bright)]" : "text-white";
  return (
    <div className="border-r border-white/10 px-2 py-2.5 text-center last:border-r-0">
      <p className={`font-display text-[34px] leading-none tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">{label}</p>
    </div>
  );
}

/** Six balls, one per stage. Filled = done; a ring marks where they are now (red if stuck). */
function Over({ stage, stuck, large }: { stage: number; stuck?: boolean; large?: boolean }) {
  const size = large ? "h-4 w-4" : "h-2.5 w-2.5";
  return (
    <span className={`flex items-center ${large ? "gap-2.5" : "gap-1"}`} aria-label={`${stage} of 6 stages done`}>
      {STAGES.map((s, i) => {
        const done = i < stage;
        const current = i === stage && stage < 6;
        const cls = done
          ? i >= 4
            ? "bg-[var(--gold)]"
            : "bg-[var(--teal)]"
          : current
            ? stuck
              ? "border-2 border-[var(--alert)]"
              : "border-2 border-[var(--teal)]"
            : "bg-[var(--line)]";
        return <span key={s} title={s} className={`${size} rounded-full ${cls}`} />;
      })}
    </span>
  );
}

function PlayerRow({
  player,
  active,
  onOpen,
  adminKey,
  onSent,
}: {
  player: Player;
  active: boolean;
  onOpen: () => void;
  adminKey: string;
  onSent: (p: Player) => void;
}) {
  const st = stageOf(player);
  const stuck = isStuck(player);
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-[var(--surface)] px-3 py-2.5 transition ${
        active ? "border-[var(--teal)] shadow-[0_0_0_3px_var(--teal-soft)]" : "border-[var(--line)] hover:border-[var(--muted)]/40"
      }`}
    >
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none" onClick={onOpen}>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[15px] font-semibold">{player.name}</span>
            <span className="flex-none text-[11px] tabular-nums text-[var(--muted)]">{player.id}</span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            <Over stage={st} stuck={stuck} />
            <span className={`truncate text-xs ${stuck ? "font-semibold text-[var(--alert)]" : "text-[var(--muted)]"}`}>
              {stuck ? `Stuck at "${STAGES[st - 1] || "Sent"}" · ${ago(player.updated)}` : player.hometown || "—"}
            </span>
          </span>
        </span>
      </button>
      {st === 0 && player.canWhatsApp ? (
        <SendButton adminKey={adminKey} player={player} onSent={onSent} compact />
      ) : st >= 4 ? (
        <span className="flex-none rounded-full bg-[var(--gold-soft)] px-2.5 py-1 text-[11px] font-bold text-[#7D5A1E]">
          {st >= 6 ? "Approved" : st === 5 ? "Story ready" : "Interviewed"}
        </span>
      ) : null}
    </div>
  );
}

// ---------- sending ----------

function SendButton({
  adminKey,
  player,
  onSent,
  compact,
  label,
}: {
  adminKey: string;
  player: Player;
  onSent: (p: Player) => void;
  compact?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    // Open the window inside the tap (browsers block pop-ups opened later),
    // then point it at WhatsApp once the personal message is ready.
    const w = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const r = await storyAdmin<{ url: string; player: Player }>("send", adminKey, { id: player.id });
      if (w) w.location.href = r.url;
      else window.location.href = r.url;
      onSent(r.player);
    } catch (e) {
      w?.close();
      alert(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };
  if (!player.canWhatsApp) return null;
  return (
    <button
      onClick={send}
      disabled={busy}
      className={`flex flex-none items-center justify-center gap-1.5 rounded-lg bg-[#25D366] font-semibold text-[#073B2A] transition hover:brightness-95 disabled:opacity-60 ${
        compact ? "px-3 py-2 text-[13px]" : "w-full px-4 py-3 text-[15px]"
      }`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
      {compact ? "Send" : label || "Send on WhatsApp"}
    </button>
  );
}

// ---------- one player ----------

const EDIT_FIELDS: { key: keyof Player; label: string; kind?: "text" | "area" | "pronoun" | "language"; hint?: string }[] = [
  { key: "callname", label: "Name to call them", hint: "Blank = first name. E.g. Praveen." },
  { key: "phone", label: "WhatsApp number" },
  { key: "pronoun", label: "He / She", kind: "pronoun" },
  { key: "language", label: "Interview language", kind: "language" },
  { key: "hometown", label: "Hometown / district" },
  { key: "joined", label: "Year joined DMSA" },
  { key: "role", label: "Playing role" },
  { key: "disability", label: "Disability (in their words)" },
  { key: "achievements", label: "Key achievements", kind: "area" },
  { key: "support", label: "DMSA support received", kind: "area", hint: "The only source the story uses for what DMSA gave them." },
  { key: "work", label: "Job / education" },
  { key: "notes", label: "Notes for Maitri", kind: "area", hint: "Maitri reads this before the interview. The player never sees it." },
  { key: "qr", label: "QR video link (optional)", hint: "Blank = the interview video." },
];

function PlayerPage({
  adminKey,
  player,
  onBack,
  onChange,
  toast,
}: {
  adminKey: string;
  player: Player;
  onBack: () => void;
  onChange: (p: Player) => void;
  toast: (t: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, String(player[f.key] ?? "")])),
  );
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<Record<string, DriveFile[]> | null>(null);
  const [work, setWork] = useState("");

  const st = stageOf(player);
  const stuck = isStuck(player);
  const dirty = EDIT_FIELDS.some((f) => (draft[f.key] ?? "") !== String(player[f.key] ?? ""));

  useEffect(() => {
    storyAdmin<{ files: Record<string, DriveFile[]> }>("files", adminKey, { id: player.id }, 90000)
      .then((r) => setFiles(r.files))
      .catch(() => setFiles({}));
  }, [adminKey, player.id]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await storyAdmin<{ player: Player }>("update", adminKey, { id: player.id, fields: draft });
      onChange(r.player);
      toast("Changes saved");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const story = async (lang: "en" | "kn") => {
    if (
      lang === "en" &&
      !confirm(
        `Create ${player.name}'s story? It takes 1–3 minutes.\n\nThe story's QR code links to their interview video, so that one video becomes viewable by anyone with the link (it is not listed or searchable).`,
      )
    )
      return;
    setWork(lang === "en" ? "Writing the story… 1–3 minutes" : "Translating into Kannada… about a minute");
    try {
      const r = await storyAdmin<{ player: Player; needsCheck: string[] }>("story", adminKey, { id: player.id, lang }, 6.5 * 60 * 1000);
      onChange(r.player);
      toast(lang === "en" ? "Story created" : "Kannada version created");
      if (r.needsCheck?.length) alert("Check these before sharing:\n\n- " + r.needsCheck.join("\n- "));
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setWork("");
    }
  };

  const refreshPdf = async () => {
    setWork("Updating the PDFs from your edited Slides…");
    try {
      const r = await storyAdmin<{ player: Player; updated: string[] }>("refreshPdf", adminKey, { id: player.id }, 3 * 60 * 1000);
      onChange(r.player);
      toast(r.updated.length ? "PDFs updated" : "No story yet");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setWork("");
    }
  };

  const approve = async (value: boolean) => {
    try {
      const r = await storyAdmin<{ player: Player }>("approve", adminKey, { id: player.id, value });
      onChange(r.player);
    } catch (e) {
      alert(String((e as Error)?.message || e));
    }
  };

  const interviewFiles = (files?.interview || []).filter((f) => !/^Consent|^Diagnostics/.test(f.name));
  const videos = interviewFiles.filter((f) => f.mime.startsWith("video/"));
  const texts = interviewFiles.filter((f) => /transcript.*\.txt$|careful transcript/.test(f.name));
  const photos = [...(files?.uploads || []), ...(files?.dmsa || [])];
  const hasInterview = st >= 4 || /incomplete/.test(player.status) || videos.length > 0;
  const hasStory = !!player.pdfEnUrl;

  // What Shiva should do next, in one sentence and one button.
  const next = (() => {
    if (st === 0) return { text: `Send ${player.greet} their personal interview link.`, action: <SendButton adminKey={adminKey} player={player} onSent={onChange} /> };
    if (st <= 3)
      return {
        text: stuck
          ? `${player.greet} stopped at "${STAGES[st - 1]}" ${ago(player.updated)}. A friendly reminder usually helps.`
          : `Waiting for ${player.greet} to finish the interview.`,
        action: <SendButton adminKey={adminKey} player={player} onSent={onChange} label="Send a reminder on WhatsApp" />,
      };
    if (st === 4)
      return {
        text: player.support ? `Interview done. Create ${player.greet}'s story.` : `Interview done. Add "DMSA support received" below, then create the story.`,
        action: <PrimaryAction onClick={() => story("en")} icon={<Sparkles className="h-4 w-4" />} label="Create story" />,
      };
    if (st === 5)
      return {
        text: player.pdfKnUrl
          ? `Send ${player.greet} the Kannada story to read, then mark it approved.`
          : `Story ready. Make the Kannada version so ${player.greet} can read and approve it.`,
        action: player.pdfKnUrl ? null : <PrimaryAction onClick={() => story("kn")} icon={<Sparkles className="h-4 w-4" />} label="Create Kannada version" />,
      };
    return { text: `${player.greet} approved the story. It's ready to share with donors.`, action: null };
  })();

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            aria-label="Back"
            onClick={onBack}
            className="rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-xl font-bold leading-tight">{player.name}</p>
            <p className="truncate text-xs text-[var(--muted)]">
              {player.id} · {player.hometown || "—"} · Maitri calls them &ldquo;{player.greet}&rdquo;
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {/* the over, with labels */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="grid grid-cols-6 gap-1">
            {STAGES.map((s, i) => {
              const done = i < st;
              const current = i === st && st < 6;
              return (
                <div key={s} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`h-5 w-5 rounded-full ${
                      done ? (i >= 4 ? "bg-[var(--gold)]" : "bg-[var(--teal)]") : current ? (stuck ? "border-[3px] border-[var(--alert)]" : "border-[3px] border-[var(--teal)]") : "bg-[var(--line)]"
                    }`}
                  />
                  <span className={`text-[11px] ${done || current ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}`}>{s}</span>
                </div>
              );
            })}
          </div>
          <div className={`mt-4 rounded-xl p-3.5 ${stuck ? "bg-[var(--alert-soft)]" : "bg-[var(--teal-soft)]"}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Next step</p>
            <p className="mt-1 text-[15px] font-semibold">{work || next.text}</p>
            {work ? (
              <Loader2 className="mt-3 h-5 w-5 animate-spin text-[var(--teal)]" />
            ) : (
              next.action && <div className="mt-3">{next.action}</div>
            )}
          </div>
        </section>

        {/* invitation */}
        <Card title="Invitation">
          <div className="grid grid-cols-2 gap-2">
            <QuietButton
              onClick={() => navigator.clipboard?.writeText(player.link).then(() => toast("Link copied"))}
              icon={<Copy className="h-4 w-4" />}
              label="Copy link"
            />
            <QuietLink href={player.folderUrl} icon={<FolderOpen className="h-4 w-4" />} label="Drive folder" />
          </div>
          {!player.canWhatsApp && <p className="mt-3 text-sm text-[var(--alert)]">Add a 10-digit WhatsApp number in Details to send the link.</p>}
          {player.consent && <p className="mt-3 text-xs text-[var(--muted)]">Consent: {player.consent}</p>}
        </Card>

        {/* interview */}
        <Card title="Interview">
          {!files && <Loader2 className="h-5 w-5 animate-spin text-[var(--teal)]" />}
          {files && !hasInterview && <p className="text-sm text-[var(--muted)]">No interview yet.</p>}
          {files && hasInterview && (
            <>
              <p className="text-sm">
                <span className="font-display text-2xl tabular-nums">{player.minutes || "–"}</span>
                <span className="text-[var(--muted)]"> min recorded · {player.uploads || "no photos uploaded yet"}</span>
              </p>
              <div className="mt-3 space-y-2">
                {videos.map((f) => (
                  <FileRow key={f.url} file={f} icon={<Video className="h-4 w-4 text-[var(--teal)]" />} />
                ))}
                {texts.map((f) => (
                  <FileRow key={f.url} file={f} icon={<FileText className="h-4 w-4 text-[var(--teal)]" />} />
                ))}
              </div>
            </>
          )}
          {files && photos.length > 0 && (
            <a href={player.folderUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--teal)] hover:underline">
              <ImageIcon className="h-4 w-4" /> {photos.length} photo and video file{photos.length === 1 ? "" : "s"} in their folder
            </a>
          )}
        </Card>

        {/* story */}
        <Card title="Impact story">
          {!hasInterview && <p className="text-sm text-[var(--muted)]">Available after the interview.</p>}
          {hasInterview && !hasStory && <p className="text-sm text-[var(--muted)]">No story yet. Use the Next step above.</p>}
          {hasStory && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <QuietLink href={player.pdfEnUrl} icon={<FileText className="h-4 w-4" />} label="English PDF" />
              {player.pdfKnUrl && <QuietLink href={player.pdfKnUrl} icon={<FileText className="h-4 w-4" />} label="Kannada PDF" />}
              <QuietLink href={player.slidesUrl} icon={<ExternalLink className="h-4 w-4" />} label="Edit in Slides" />
            </div>
          )}
          {hasStory && !work && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <TextButton onClick={() => story("en")} label="Rewrite story" />
              <TextButton onClick={() => story("kn")} label={player.pdfKnUrl ? "Redo Kannada version" : "Create Kannada version"} />
              <TextButton onClick={refreshPdf} label="Update PDFs after editing Slides" />
            </div>
          )}
          {hasStory && (
            <label className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--teal)]" checked={!!player.approved} onChange={(e) => approve(e.target.checked)} />
              {player.greet} has read and approved the story
            </label>
          )}
        </Card>

        {/* details */}
        <Card title="Details" subtitle="Maitri and the story use these.">
          <div className="space-y-4">
            {EDIT_FIELDS.map((f) => (
              <Field key={f.key} def={f} value={draft[f.key] ?? ""} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
            ))}
          </div>
        </Card>
      </main>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--surface)]/95 p-3 backdrop-blur lg:left-auto lg:right-0 lg:w-[calc(100%-min(460px,100%))]">
          <button
            onClick={save}
            disabled={saving}
            className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2 rounded-xl bg-[var(--navy)] py-3.5 font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Save changes
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- add a player ----------

function AddPlayer({ adminKey, onBack, onAdded }: { adminKey: string; onBack: () => void; onAdded: (p: Player) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({ language: "Kannada" });
  const [busy, setBusy] = useState(false);
  const fields = [
    { key: "name" as keyof Player, label: "Full name" },
    ...EDIT_FIELDS.filter((f) => ["callname", "phone", "pronoun", "language", "hometown", "support"].includes(f.key)),
  ];
  const add = async () => {
    setBusy(true);
    try {
      const r = await storyAdmin<{ player: Player }>("add", adminKey, { fields: draft }, 120000);
      if (r.player) onAdded(r.player);
      else onBack();
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3">
        <button aria-label="Back" onClick={onBack} className="rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="font-heading text-xl font-bold">Add a player</p>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-10 pt-4">
        <Card title="Player">
          <div className="space-y-4">
            {fields.map((f) => (
              <Field key={f.key} def={f} value={draft[f.key] ?? ""} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
            ))}
          </div>
        </Card>
        <button
          onClick={add}
          disabled={busy || !String(draft.name || "").trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--navy)] py-3.5 font-semibold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Add player and create their link
        </button>
      </main>
    </div>
  );
}

// ---------- small pieces ----------

function Field({ def, value, onChange }: { def: { key: keyof Player; label: string; kind?: string; hint?: string }; value: string; onChange: (v: string) => void }) {
  const cls =
    "mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[15px] outline-none transition focus:border-[var(--teal)] focus:bg-[var(--surface)]";
  return (
    <label className="block">
      <span className="text-[13px] font-semibold">{def.label}</span>
      {def.kind === "area" ? (
        <textarea className={cls} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : def.kind === "pronoun" || def.kind === "language" ? (
        <select className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
          {(def.kind === "pronoun" ? ["", "He", "She"] : ["Kannada", "English"]).map((o) => (
            <option key={o} value={o}>
              {o || "—"}
            </option>
          ))}
        </select>
      ) : (
        <input className={cls} value={value} inputMode={def.key === "phone" ? "tel" : undefined} onChange={(e) => onChange(e.target.value)} />
      )}
      {def.hint && <span className="mt-1 block text-xs text-[var(--muted)]">{def.hint}</span>}
    </label>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-heading text-[15px] font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FileRow({ file, icon }: { file: DriveFile; icon: React.ReactNode }) {
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm transition hover:border-[var(--teal)]"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{file.name.replace(/^.* - /, "")}</span>
      <span className="text-xs tabular-nums text-[var(--muted)]">{file.size > 1e6 ? `${Math.round(file.size / 1e6)} MB` : ""}</span>
    </a>
  );
}

function PrimaryAction({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--navy)] px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--navy2)]">
      {icon} {label}
    </button>
  );
}

function QuietLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm font-semibold transition hover:border-[var(--teal)]"
    >
      {icon} {label}
    </a>
  );
}

function QuietButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm font-semibold transition hover:border-[var(--teal)]">
      {icon} {label}
    </button>
  );
}

function TextButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="font-semibold text-[var(--teal)] underline-offset-4 hover:underline">
      {label}
    </button>
  );
}

function Logo({ small }: { small?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={small ? `${BASE}/admin-icons/icon-192.png` : `${BASE}/dmsa-logo.png`}
      alt="DMSA"
      className={small ? "h-9 w-9 rounded-lg" : "h-12 rounded-lg bg-white px-3 py-2"}
    />
  );
}

/**
 * The app's colours live in these variables so another organisation's brand
 * can be dropped in later without touching the components.
 */
const THEME = {
  "--bg": "#EEF2F7",
  "--surface": "#FFFFFF",
  "--ink": "#0B1F44",
  "--muted": "#5B6B85",
  "--line": "#DCE3EE",
  "--navy": "#0B1F44",
  "--navy2": "#16336B",
  "--teal": "#178C8C",
  "--teal-bright": "#3CCDCD",
  "--teal-soft": "#DDF2F2",
  "--gold": "#D9A441",
  "--gold-soft": "#FBEFD6",
  "--alert": "#C0392B",
  "--alert-soft": "#FBE6E3",
} as React.CSSProperties;

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <div style={THEME} className="min-h-dvh bg-[var(--bg)] font-sans text-[var(--ink)] antialiased">
      {children}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50dvh] flex-col items-center justify-center px-6 py-10">{children}</div>;
}
