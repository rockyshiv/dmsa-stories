"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  BellRing,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderOpen,
  HeartPulse,
  Home,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { storyAdmin, StoryApiError } from "@/lib/story/api";
import { Conversation, interviewParts, PhotoGrid, StoriesView, StoryCover, StoryReader, useMedia, VideoBox } from "@/components/AdminMedia";

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

// ---------- the six stages of a player's journey, shown as the six balls of an over ----------

const STAGES = ["Invited", "Opened", "Agreed", "Interviewed", "Story", "Approved"] as const;

/** Where a player is, in words. */
const STATUS_WORDS = ["Not invited yet", "Invited", "Opened the link", "Started the interview", "Interview done", "Story ready", "Story approved"];

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

type Filter = "all" | "notSent" | "waiting" | "started" | "finished" | "stuck" | "details";

/** A story was written but the details only Shiva knows are still empty. */
function missingDetails(p: Player): string[] {
  if (!p.pdfEnUrl) return [];
  const out: string[] = [];
  if (!String(p.pronoun || "").trim()) out.push("He/She");
  if (!String(p.support || "").trim()) out.push("DMSA support received");
  return out;
}

const FILTERS: { id: Filter; label: string; test: (p: Player) => boolean }[] = [
  { id: "all", label: "Everyone", test: () => true },
  { id: "stuck", label: "Needs a reminder", test: isStuck },
  { id: "details", label: "Missing details", test: (p) => missingDetails(p).length > 0 },
  { id: "notSent", label: "Not invited", test: (p) => stageOf(p) === 0 },
  { id: "waiting", label: "Invited", test: (p) => stageOf(p) === 1 || stageOf(p) === 2 },
  { id: "started", label: "Started", test: (p) => stageOf(p) === 3 },
  { id: "finished", label: "Interview done", test: (p) => stageOf(p) >= 4 },
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

type Section = "home" | "stories" | "players";

const NAV: { id: Section; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "stories", label: "Stories", icon: BookOpen },
  { id: "players", label: "Players", icon: Users },
];

function Dashboard({ adminKey }: { adminKey: string }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reading, setReading] = useState<Player | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const [section, setSection] = useState<Section>(() => {
    try {
      const s = localStorage.getItem("dmsaAdminSection") as Section;
      return NAV.some((n) => n.id === s) ? s : "home";
    } catch {
      return "home";
    }
  });
  const go = (s: Section, f?: Filter) => {
    setSection(s);
    if (f) setFilter(f);
    setOpenId(null);
    setAdding(false);
    document.querySelector("[data-admin-main]")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    try {
      localStorage.setItem("dmsaAdminSection", s);
    } catch {
      /* remembered for this visit only */
    }
  };

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
  const refresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <Shell>
      <div className="lg:grid lg:h-dvh lg:grid-cols-[232px_1fr]">
        {/* ---- navigation: side rail on computers, bottom bar on phones ---- */}
        <nav className="hidden bg-[var(--navy)] px-3 py-5 text-white lg:flex lg:flex-col" aria-label="Main">
          <div className="flex items-center gap-3 px-2">
            <Logo small />
            <div>
              <p className="font-heading text-[15px] font-bold leading-tight">DMSA</p>
              <p className="text-xs text-white/60">Players &amp; stories</p>
            </div>
          </div>
          <ul className="mt-8 space-y-1">
            {NAV.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => go(n.id)}
                  aria-current={section === n.id ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold transition ${
                    section === n.id ? "bg-white text-[var(--navy)]" : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <n.icon className="h-5 w-5" /> {n.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div data-admin-main className="min-w-0 pb-20 lg:h-dvh lg:overflow-y-auto lg:pb-0">
          {!players && !error && (
            <Center>
              <Loader2 className="h-7 w-7 animate-spin text-[var(--teal)]" />
              <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
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

          {players && section === "home" && (
            <HomeView players={players} counts={counts} adminKey={adminKey} go={go} onRead={setReading} refreshing={refreshing} onRefresh={refresh} />
          )}

          {players && section === "stories" && (
            <StoriesView
              adminKey={adminKey}
              players={players}
              onRead={setReading}
              onOpenPlayer={(p) => {
                go("players");
                setOpenId(p.id);
              }}
            />
          )}

          {players && section === "players" && (
            <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(340px,420px)_1fr]">
              <div className="lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden lg:border-r lg:border-[var(--line)]">
                <header className="px-4 pb-1 pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="font-heading text-2xl font-bold">Players</h1>
                      <p className="text-sm text-[var(--muted)]">
                        {players.length} players · {counts.finished} interviewed
                      </p>
                    </div>
                    <RefreshButton spinning={refreshing} onClick={refresh} />
                  </div>
                </header>
                <div className="space-y-3 px-4 pt-3">
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 focus-within:border-[var(--teal)]">
                    <Search className="h-4 w-4 text-[var(--muted)]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name, place or phone"
                      className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]"
                    />
                  </label>
                  <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
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
                <ul className="mt-2 flex-1 space-y-2 px-4 pb-28 pt-1 lg:overflow-y-auto lg:pb-24">
                  {shown.map((p) => (
                    <li key={p.id}>
                      <PlayerRow player={p} active={p.id === openId} onOpen={() => setOpenId(p.id)} adminKey={adminKey} onSent={replace} />
                    </li>
                  ))}
                  {!shown.length && (
                    <li className="rounded-xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                      {filter === "stuck" ? "Nobody needs a reminder right now." : "No players match."}
                    </li>
                  )}
                </ul>
              </div>

              <div className={`${open || adding ? "fixed inset-0 z-30 overflow-y-auto" : "hidden"} bg-[var(--bg)] lg:static lg:block lg:h-dvh lg:overflow-y-auto`}>
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
                  <PlayerPage key={open.id} adminKey={adminKey} player={open} onBack={() => setOpenId(null)} onChange={replace} toast={showToast} onRead={() => setReading(open)} />
                ) : (
                  <div className="hidden h-full flex-col items-center justify-center px-10 text-center lg:flex">
                    <Users className="h-10 w-10 text-[var(--line)]" />
                    <p className="mt-4 font-heading text-lg font-bold">Choose a player</p>
                    <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">You&apos;ll see their interview, photos and story here.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* bottom bar on phones */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
        <ul className="grid grid-cols-3">
          {NAV.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => go(n.id)}
                aria-current={section === n.id ? "page" : undefined}
                className={`relative flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${section === n.id ? "text-[var(--navy)]" : "text-[var(--muted)]"}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${section === n.id ? "bg-[var(--teal-soft)]" : ""}`}>
                  <n.icon className="h-5 w-5" />
                </span>
                {n.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {section === "players" && !adding && !open && (
        <button
          onClick={() => {
            setOpenId(null);
            setAdding(true);
          }}
          className="fixed bottom-20 right-4 z-20 flex items-center gap-2 rounded-full bg-[var(--navy)] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_30px_-10px_rgba(11,31,68,0.6)] transition hover:bg-[var(--navy2)] lg:bottom-6 lg:right-6"
        >
          <Plus className="h-5 w-5" /> Add player
        </button>
      )}

      {reading && <StoryReader adminKey={adminKey} player={reading} onClose={() => setReading(null)} toast={showToast} />}

      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-[60] mx-auto w-fit rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </Shell>
  );
}

function RefreshButton({ spinning, onClick, dark }: { spinning: boolean; onClick: () => void; dark?: boolean }) {
  return (
    <button
      aria-label="Refresh"
      onClick={onClick}
      className={`rounded-full p-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--teal)] ${
        dark ? "bg-white/10 text-white hover:bg-white/20" : "border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--teal)]"
      }`}
    >
      <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
}

// ---------- system check ----------

interface Health {
  status: "ok" | "warn" | "bad";
  checks: { level: "ok" | "warn" | "bad"; text: string }[];
  log: string[];
}

/** One line saying whether the automatic parts are working; tap for details. */
function SystemCheck({ adminKey }: { adminKey: string }) {
  const [h, setH] = useState<Health | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    storyAdmin<Health>("health", adminKey, {}, 90000)
      .then(setH)
      .catch(() => setH(null));
  }, [adminKey]);
  if (!h) return null;
  const tone = {
    ok: { dot: "bg-[var(--teal)]", text: "Everything is working" },
    warn: { dot: "bg-[var(--gold)]", text: "Working, with a note" },
    bad: { dot: "bg-[var(--alert)]", text: "Something needs you" },
  }[h.status];
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left" aria-expanded={open}>
        <HeartPulse className="h-5 w-5 flex-none text-[var(--muted)]" aria-hidden />
        <span className="flex-1">
          <span className="block text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">System check</span>
          <span className="flex items-center gap-2 font-semibold">
            <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} aria-hidden />
            {tone.text}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 text-[var(--muted)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--line)] px-4 pb-4 pt-3">
          <ul className="space-y-2.5">
            {h.checks.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span
                  className={`mt-1.5 h-2 w-2 flex-none rounded-full ${c.level === "ok" ? "bg-[var(--teal)]" : c.level === "warn" ? "bg-[var(--gold)]" : "bg-[var(--alert)]"}`}
                  aria-label={c.level === "ok" ? "fine" : c.level === "warn" ? "note" : "problem"}
                />
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
          {h.log.length > 0 && (
            <>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Recent automatic work</p>
              <ul className="mt-1.5 space-y-1 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
                {h.log
                  .slice()
                  .reverse()
                  .map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ---------- home ----------

function HomeView({
  players,
  counts,
  adminKey,
  go,
  onRead,
  refreshing,
  onRefresh,
}: {
  players: Player[];
  counts: Record<Filter, number>;
  adminKey: string;
  go: (s: Section, f?: Filter) => void;
  onRead: (p: Player) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const told = counts.finished;
  const toRead = players.filter((p) => stageOf(p) === 5);
  const needStory = players.filter((p) => stageOf(p) === 4);
  const latest = players
    .filter((p) => p.pdfEnUrl)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
    .slice(0, 4);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const todo: { tone: "gold" | "teal" | "alert" | "navy"; icon: React.ReactNode; title: string; text: string; onClick: () => void }[] = [];
  if (toRead.length)
    todo.push({
      tone: "gold",
      icon: <BookOpen className="h-5 w-5" />,
      title: `${toRead.length} ${toRead.length === 1 ? "story is" : "stories are"} ready to read`,
      text: `Read ${toRead.length === 1 ? "it" : "them"}, then send the Kannada version to the player for their OK.`,
      onClick: () => go("stories"),
    });
  if (needStory.length)
    todo.push({
      tone: "teal",
      icon: <Sparkles className="h-5 w-5" />,
      title: `${needStory.length} ${needStory.length === 1 ? "interview is" : "interviews are"} waiting for a story`,
      text: "Usually written automatically right after the interview. Tap to write one now (about a minute).",
      onClick: () => go("stories"),
    });
  if (counts.stuck)
    todo.push({
      tone: "alert",
      icon: <BellRing className="h-5 w-5" />,
      title: `${counts.stuck} ${counts.stuck === 1 ? "player needs" : "players need"} a reminder`,
      text: "They opened the link but haven't finished for a day or more.",
      onClick: () => go("players", "stuck"),
    });
  if (counts.details)
    todo.push({
      tone: "gold",
      icon: <Pencil className="h-5 w-5" />,
      title: `${counts.details} ${counts.details === 1 ? "story is" : "stories are"} missing details only you know`,
      text: "Add He/She and \"DMSA support received\", then update the story - it gets much better.",
      onClick: () => go("players", "details"),
    });
  if (counts.notSent)
    todo.push({
      tone: "navy",
      icon: <MessageCircle className="h-5 w-5" />,
      title: `${counts.notSent} ${counts.notSent === 1 ? "player hasn't" : "players haven't"} been invited`,
      text: "Send their interview link on WhatsApp.",
      onClick: () => go("players", "notSent"),
    });

  const toneCls = {
    gold: "bg-[var(--gold-soft)] text-[#7D5A1E]",
    teal: "bg-[var(--teal-soft)] text-[var(--teal)]",
    alert: "bg-[var(--alert-soft)] text-[var(--alert)]",
    navy: "bg-[var(--bg)] text-[var(--navy)]",
  };

  return (
    <div>
      <header className="bg-[var(--navy)] px-4 pb-16 pt-5 text-white lg:px-8">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="lg:hidden">
              <Logo small />
            </span>
            <div>
              <p className="text-sm text-white/60">{hello}, Shiva</p>
              <h1 className="font-heading text-2xl font-bold leading-tight">Players&apos; stories</h1>
            </div>
          </div>
          <RefreshButton spinning={refreshing} onClick={onRefresh} dark />
        </div>
      </header>

      <main className="mx-auto -mt-12 max-w-5xl space-y-6 px-4 pb-10 lg:px-8">
        {/* progress, in words */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_18px_40px_-28px_rgba(11,31,68,0.55)]">
          <p className="text-[15px]">
            <span className="font-display text-5xl leading-none tabular-nums text-[var(--navy)]">{told}</span>
            <span className="text-[var(--muted)]"> of {players.length} players have told their story</span>
          </p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--bg)]" aria-hidden>
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--teal)] to-[var(--gold)] transition-[width] duration-700"
              style={{ width: `${players.length ? (told / players.length) * 100 : 0}%` }}
            />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { n: counts.waiting + counts.started, l: "on the way" },
              { n: players.filter((p) => p.pdfEnUrl).length, l: "stories written" },
              { n: players.filter((p) => stageOf(p) === 6).length, l: "approved" },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-[var(--bg)] px-2 py-2.5">
                <dt className="sr-only">{x.l}</dt>
                <dd className="font-heading text-xl font-bold tabular-nums">{x.n}</dd>
                <dd className="text-xs text-[var(--muted)]">{x.l}</dd>
              </div>
            ))}
          </dl>
        </section>

        <SystemCheck adminKey={adminKey} />

        {/* what needs Shiva */}
        <section>
          <h2 className="font-heading text-lg font-bold">What needs you</h2>
          {todo.length ? (
            <ul className="mt-3 grid gap-2.5 lg:grid-cols-2">
              {todo.map((t) => (
                <li key={t.title}>
                  <button
                    onClick={t.onClick}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--teal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
                  >
                    <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${toneCls[t.tone]}`}>{t.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.title}</span>
                      <span className="block text-sm text-[var(--muted)]">{t.text}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 flex-none text-[var(--muted)]" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-[var(--muted)]">All caught up. Nothing needs you right now.</p>
          )}
        </section>

        {/* latest stories */}
        {latest.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="font-heading text-lg font-bold">Latest stories</h2>
              <button onClick={() => go("stories")} className="text-sm font-semibold text-[var(--teal)]">
                See all
              </button>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {latest.map((p) => (
                <li key={p.id}>
                  <button onClick={() => onRead(p)} className="group block w-full text-left">
                    <StoryCover adminKey={adminKey} playerId={p.id} className="aspect-[1/1.414] rounded-lg ring-1 ring-[var(--line)] transition group-hover:-translate-y-0.5" />
                    <p className="mt-2 truncate text-sm font-semibold">{p.name}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
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
              {stuck ? `Needs a reminder · ${ago(player.updated)}` : [STATUS_WORDS[st], player.hometown].filter(Boolean).join(" · ")}
            </span>
          </span>
        </span>
      </button>
      {st === 0 && player.canWhatsApp ? (
        <SendButton adminKey={adminKey} player={player} onSent={onSent} compact />
      ) : st >= 4 ? (
        <span className="flex-none rounded-full bg-[var(--gold-soft)] px-2.5 py-1 text-[11px] font-bold text-[#7D5A1E]">
          {st >= 6 ? "Approved" : st === 5 ? "Story ready" : "Interview done"}
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
  { key: "notes", label: "Notes for Myithri", kind: "area", hint: "Myithri reads this before the interview. The player never sees it." },
  { key: "qr", label: "QR video link (optional)", hint: "Blank = the interview video." },
];

function PlayerPage({
  adminKey,
  player,
  onBack,
  onChange,
  toast,
  onRead,
}: {
  adminKey: string;
  player: Player;
  onBack: () => void;
  onChange: (p: Player) => void;
  toast: (t: string) => void;
  onRead: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, String(player[f.key] ?? "")])),
  );
  const [saving, setSaving] = useState(false);
  const { media, failed: mediaFailed } = useMedia(adminKey, player.id);
  const [showDetails, setShowDetails] = useState(false);
  const [work, setWork] = useState("");

  const st = stageOf(player);
  const stuck = isStuck(player);
  const dirty = EDIT_FIELDS.some((f) => (draft[f.key] ?? "") !== String(player[f.key] ?? ""));

  // Details the story uses: after changing them, offer to update the story.
  const STORY_FIELDS = ["pronoun", "support", "achievements", "role", "joined", "hometown", "work", "disability", "name", "callname"];
  const [storyStale, setStoryStale] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const touchesStory = STORY_FIELDS.some((k) => (draft[k] ?? "") !== String(player[k as keyof Player] ?? ""));
      const r = await storyAdmin<{ player: Player }>("update", adminKey, { id: player.id, fields: draft });
      onChange(r.player);
      toast("Changes saved");
      if (touchesStory && player.pdfEnUrl) setStoryStale(true);
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const story = async (lang: "en" | "kn", thenKn = false) => {
    if (
      lang === "en" &&
      !thenKn &&
      !confirm(
        `Create ${player.name}'s story? It takes about a minute.\n\nThe story's QR code links to their interview video, so that one video becomes viewable by anyone with the link (it is not listed or searchable).`,
      )
    )
      return;
    setWork(lang === "en" ? "Writing the story… about a minute. You can leave this page - it keeps going." : "Translating into Kannada… about a minute.");
    try {
      // Google writes it in the background; check back every few seconds.
      await storyAdmin("storyStart", adminKey, { id: player.id, lang, thenKn });
      setStoryStale(false);
      type Job = { state: string; needsCheck?: string[]; error?: string; note?: string };
      const until = Date.now() + 12 * 60 * 1000;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 8000));
        let r: { job: Job | null; player: Player | null };
        try {
          r = await storyAdmin<{ job: Job | null; player: Player | null }>("storyJob", adminKey, { id: player.id });
        } catch {
          continue;
        }
        if (r.job?.note) setWork(`${lang === "en" ? "Writing the story" : "Translating"}… ${r.job.note.toLowerCase()}.`);
        if (r.job?.state === "done") {
          if (r.player) onChange(r.player);
          toast(lang === "en" ? "Story created" : "Kannada version created");
          if (r.job.needsCheck?.length) alert("Check these before sharing:\n\n- " + r.job.needsCheck.join("\n- "));
          return;
        }
        if (r.job?.state === "failed") {
          if (r.player) onChange(r.player);
          alert("The story could not be written: " + (r.job.error || "unknown problem") + "\n\nThe hourly automatic run will try again.");
          return;
        }
      }
      alert("This is taking longer than usual. Google keeps working on it - check the Stories tab in a few minutes.");
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

  const parts = interviewParts(media);
  const hasInterview = st >= 4 || /incomplete/.test(player.status) || !!parts.video;
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
        action: player.pdfKnUrl ? (
          <PrimaryAction onClick={onRead} icon={<BookOpen className="h-4 w-4" />} label="Open the story to share it" />
        ) : (
          <PrimaryAction onClick={() => story("kn")} icon={<Sparkles className="h-4 w-4" />} label="Create Kannada version" />
        ),
      };
    return {
      text: `${player.greet} approved the story. It's ready to share with donors.`,
      action: <PrimaryAction onClick={onRead} icon={<BookOpen className="h-4 w-4" />} label="Read & share" />,
    };
  })();

  return (
    <div className="min-h-full">
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
              {player.id} · {player.hometown || "—"} · Myithri calls them &ldquo;{player.greet}&rdquo;
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-8 pt-4">
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

        {/* story */}
        {hasStory && (
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex gap-4 p-4">
              <button onClick={onRead} className="flex-none" aria-label="Read the story">
                <StoryCover adminKey={adminKey} playerId={player.id} className="aspect-[1/1.414] w-24 rounded-md ring-1 ring-[var(--line)]" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-[17px] font-bold">Impact story</h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {player.approved ? `${player.greet} approved it.` : player.pdfKnUrl ? "English and Kannada ready." : "English ready."}
                </p>
                <button onClick={onRead} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--navy2)]">
                  <BookOpen className="h-4 w-4" /> Read &amp; share
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--teal)]" checked={!!player.approved} onChange={(e) => approve(e.target.checked)} />
              {player.greet} has read and approved the story
            </label>
            {media?.needsCheck && media.needsCheck.length > 0 && (
              <div className="border-t border-[var(--line)] bg-[var(--gold-soft)] px-4 py-3 text-sm">
                <p className="font-semibold text-[#7D5A1E]">Check before sharing</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {media.needsCheck.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {(storyStale || missingDetails(player).length > 0) && !work && (
              <div className="border-t border-[var(--line)] bg-[var(--teal-soft)] px-4 py-3 text-sm">
                {storyStale ? (
                  <p>You changed details the story uses.</p>
                ) : (
                  <p>
                    Written without: <b>{missingDetails(player).join(" and ")}</b>. Add them in Player details below, then update the story.
                  </p>
                )}
                {storyStale && (
                  <button
                    onClick={() => story("en", !!player.pdfKnUrl)}
                    className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--navy)] px-3.5 py-2.5 font-semibold text-white"
                  >
                    <Sparkles className="h-4 w-4" /> Update the story with these details
                  </button>
                )}
              </div>
            )}
            {!work && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--line)] px-4 py-3 text-sm">
                <TextButton onClick={() => story("en")} label="Rewrite story" />
                <TextButton onClick={() => story("kn")} label={player.pdfKnUrl ? "Redo Kannada version" : "Create Kannada version"} />
                <TextButton onClick={refreshPdf} label="Update after editing in Slides" />
              </div>
            )}
          </section>
        )}

        {/* interview */}
        <Card title="Interview" subtitle={parts.video?.seconds ? `${Math.max(1, Math.round(parts.video.seconds / 60))} minutes with Myithri` : undefined}>
          {!media && !mediaFailed && <Loader2 className="h-5 w-5 animate-spin text-[var(--teal)]" />}
          {mediaFailed && <p className="text-sm text-[var(--alert)]">Couldn&apos;t load the files. Pull down to refresh or try again later.</p>}
          {media && !hasInterview && <p className="text-sm text-[var(--muted)]">No interview yet.</p>}
          {media && (
            <div className="space-y-3">
              {parts.video && <VideoBox file={parts.video} />}
              {parts.conversation && <Conversation adminKey={adminKey} playerId={player.id} file={parts.conversation} name={player.greet || player.name} />}
            </div>
          )}
        </Card>

        {/* photos */}
        <Card title="Photos & videos" subtitle={media ? `${parts.photos.length} from ${player.greet} and DMSA` : undefined}>
          {!media && !mediaFailed && <Loader2 className="h-5 w-5 animate-spin text-[var(--teal)]" />}
          {media && <PhotoGrid files={parts.photos} emptyText={`No photos yet. ${player.greet} can add them after the interview.`} />}
        </Card>

        {/* invitation */}
        <Card title="Interview link">
          <div className="grid grid-cols-2 gap-2">
            <QuietButton
              onClick={() => navigator.clipboard?.writeText(player.link).then(() => toast("Link copied"))}
              icon={<Copy className="h-4 w-4" />}
              label="Copy link"
            />
            <SendButton adminKey={adminKey} player={player} onSent={onChange} compact label="Send" />
          </div>
          {!player.canWhatsApp && <p className="mt-3 text-sm text-[var(--alert)]">Add a 10-digit WhatsApp number in the details below to send the link.</p>}
          {player.consent && <p className="mt-3 text-xs text-[var(--muted)]">Consent given: {player.consent.replace(/^Yes - /, "")}</p>}
        </Card>

        {/* details */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          <button onClick={() => setShowDetails((v) => !v)} className="flex w-full items-center justify-between p-4 text-left" aria-expanded={showDetails}>
            <span>
              <span className="block font-heading text-[15px] font-bold">Player details</span>
              <span className={`block text-xs ${missingDetails(player).length ? "font-semibold text-[var(--alert)]" : "text-[var(--muted)]"}`}>
                {missingDetails(player).length ? `Missing: ${missingDetails(player).join(", ")}` : "Myithri and the story use these."}
              </span>
            </span>
            <ChevronDown className={`h-5 w-5 transition ${showDetails ? "rotate-180" : ""}`} />
          </button>
          {showDetails && (
            <div className="space-y-4 border-t border-[var(--line)] p-4">
              {EDIT_FIELDS.map((f) => (
                <Field key={f.key} def={f} value={draft[f.key] ?? ""} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
              ))}
            </div>
          )}
        </section>

        {media?.folderUrl && (
          <a href={media.folderUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
            <FolderOpen className="h-4 w-4" /> Everything is saved in Google Drive · open folder
          </a>
        )}
      </main>

      {dirty && (
        <div className="sticky bottom-0 z-20 border-t border-[var(--line)] bg-[var(--surface)]/95 p-3 backdrop-blur">
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

function PrimaryAction({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--navy)] px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--navy2)]">
      {icon} {label}
    </button>
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
