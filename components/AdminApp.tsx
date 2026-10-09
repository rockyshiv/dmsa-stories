"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  FileText,
  FolderOpen,
  Home,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { storyAdmin, StoryApiError } from "@/lib/story/api";
import { clearSaved, readSaved, writeSaved } from "@/lib/story/saved";
import { DEMO_KEY, isDemo } from "@/lib/story/demo";
import { SUPPORT_EMAIL } from "@/lib/story/brand";
import { isStuck, missingDetails, stageOf, STATUS_WORDS, ago } from "@/lib/story/players";
import { ConversationsView, type BriefView, type Conv } from "@/components/AdminConversations";
import { HomeView, NewMenu, PageHeader, PeopleView, ReportsView, SettingsView, needsFollowUp } from "@/components/AdminHome";
import type { Go, OrgInfo, PeopleFilter, Person, PlayerFilter, Section } from "@/components/AdminHome";
import { ImpactCard } from "@/components/AdminImpact";
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

type Filter = PlayerFilter;

const FILTERS: { id: Filter; label: string; test: (p: Player) => boolean }[] = [
  { id: "all", label: "Everyone", test: () => true },
  { id: "stuck", label: "Needs a reminder", test: isStuck },
  { id: "details", label: "Missing details", test: (p) => missingDetails(p).length > 0 },
  { id: "notSent", label: "Not invited", test: (p) => stageOf(p) === 0 },
  { id: "waiting", label: "Invited", test: (p) => stageOf(p) === 1 || stageOf(p) === 2 },
  { id: "started", label: "Started", test: (p) => stageOf(p) === 3 },
  { id: "finished", label: "Interview done", test: (p) => stageOf(p) >= 4 },
];

// ---------- private key from the app link ----------

const KEY_EVENT = "myithri-key";

function readKey(): string | null {
  // "#demo" opens the sample-data demo without touching a saved key.
  if (/^#demo\b/.test(window.location.hash)) return DEMO_KEY;
  const m = window.location.hash.match(/k=([\w-]+)/);
  if (m) return m[1];
  try {
    return localStorage.getItem(KEY_STORE);
  } catch {
    return null;
  }
}

function subscribeKey(changed: () => void) {
  window.addEventListener("hashchange", changed);
  window.addEventListener(KEY_EVENT, changed);
  return () => {
    window.removeEventListener("hashchange", changed);
    window.removeEventListener(KEY_EVENT, changed);
  };
}

/** Signs this device in (a key), into the demo (DEMO_KEY) or out (null). */
export function signIn(key: string | null) {
  try {
    if (key && !isDemo(key)) localStorage.setItem(KEY_STORE, key);
    if (!key) {
      localStorage.removeItem(KEY_STORE);
      clearSaved();
    }
  } catch {
    /* private mode: the key lasts for this visit */
  }
  history.replaceState(null, "", window.location.pathname + (isDemo(key) ? "#demo" : ""));
  window.dispatchEvent(new Event(KEY_EVENT));
  window.scrollTo(0, 0);
}

/** An access link (…/admin/#k=…) or the key on its own, as pasted. */
function keyFromText(text: string): string | null {
  const t = text.trim();
  const m = t.match(/[#&]k=([\w-]+)/) || t.match(/^([\w-]{16,})$/);
  return m ? m[1] : null;
}

export default function AdminApp() {
  const key = useSyncExternalStore(subscribeKey, readKey, () => undefined);

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
  if (!key) return <Welcome />;
  return <Dashboard key={key} adminKey={key} />;
}

// ---------- first screen for someone who isn't signed in ----------

function Welcome() {
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const open = (e: React.FormEvent) => {
    e.preventDefault();
    const k = keyFromText(text);
    if (!k) return setBad(true);
    signIn(k);
  };
  return (
    <Shell>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE}/myithri-small.webp`} alt="" className="h-12 w-12 rounded-full bg-[var(--teal-soft)] object-cover" />
          <div>
            <p className="font-heading text-xl font-bold leading-tight">Myithri</p>
            <p className="text-xs text-[var(--muted)]">by Auraclusive</p>
          </div>
        </div>

        <h1 className="mt-10 font-heading text-[28px] font-bold leading-[1.15]">Hear everyone. Report what changed.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
          Myithri, an AI voice assistant, talks with the people your organisation serves in English, Hindi or Kannada. Their stories, summaries and impact reports
          come back to you here.
        </p>

        <form onSubmit={open} className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <label htmlFor="access" className="block font-semibold">
            Open your organisation
          </label>
          <p className="mt-1 text-sm text-[var(--muted)]">Paste the access link Auraclusive sent you.</p>
          <input
            id="access"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setBad(false);
            }}
            placeholder="https://…/admin/#k=…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={bad}
            aria-describedby={bad ? "access-error" : undefined}
            className="mt-3 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-base outline-none focus:border-[var(--teal)]"
          />
          {bad && (
            <p id="access-error" className="mt-2 text-sm text-[var(--alert)]">
              That doesn&apos;t look like an access link. It ends with #k= and a long code.
            </p>
          )}
          <button type="submit" className="mt-3 w-full rounded-xl bg-[var(--navy)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--navy2)]">
            Open
          </button>
        </form>

        <button
          onClick={() => signIn(DEMO_KEY)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 font-semibold transition hover:border-[var(--teal)]"
        >
          <Sparkles className="h-4 w-4 text-[var(--teal)]" /> See a demo with sample data
        </button>

        <div className="flex-1" />
        <p className="mt-10 text-center text-sm text-[var(--muted)]">
          New to Myithri? Write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[var(--teal)] underline-offset-4 hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="mt-2 text-center text-xs">
          <a href={`${BASE}/privacy/`} className="text-[var(--muted)] underline underline-offset-4">
            Privacy policy
          </a>
        </p>
      </main>
    </Shell>
  );
}

// ---------- dashboard ----------

const NAV: { id: Section; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "briefs", label: "Briefs", icon: MessagesSquare },
  { id: "stories", label: "Stories", icon: BookOpen },
  { id: "people", label: "People", icon: Users },
  { id: "reports", label: "Reports", icon: FileText },
];
const ALL_SECTIONS: Section[] = ["home", "briefs", "stories", "people", "reports", "settings"];
/** Sections were renamed in the October 2026 redesign; remembered old names still open the right place. */
const OLD_SECTIONS: Record<string, Section> = { talks: "briefs", players: "stories" };

function Dashboard({ adminKey }: { adminKey: string }) {
  // The demo never mixes with the organisation's own data kept on this device.
  const demo = isDemo(adminKey);
  const saved = <T,>(name: string) => (demo ? null : readSaved<T>(name));
  const save = (name: string, value: unknown) => {
    if (!demo) writeSaved(name, value);
  };
  // What this device loaded last time shows straight away; the server refreshes it in the background.
  const [players, setPlayers] = useState<Player[] | null>(() => saved<Player[]>("players"));
  const [convs, setConvs] = useState<Conv[] | null>(() => saved<Conv[]>("convs"));
  const [people, setPeople] = useState<Person[] | null>(() => saved<Person[]>("people"));
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(() => saved<OrgInfo>("org"));
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reading, setReading] = useState<Player | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const [storiesTab, setStoriesTab] = useState<"stories" | "players">("stories");
  const [briefStart, setBriefStart] = useState<{ view?: BriefView; n: number }>({ n: 0 });
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter | undefined>(undefined);
  const [section, setSection] = useState<Section>(() => {
    try {
      const raw = localStorage.getItem("dmsaAdminSection") || "";
      const s = (OLD_SECTIONS[raw] || raw) as Section;
      if (raw === "players") return "stories";
      return ALL_SECTIONS.includes(s) ? s : "home";
    } catch {
      return "home";
    }
  });

  const go: Go = (s, o = {}) => {
    setSection(s);
    setOpenId(null);
    setAdding(false);
    if (o.storiesTab) setStoriesTab(o.storiesTab);
    if (o.playerFilter) setFilter(o.playerFilter);
    if (o.playerId === "new") setAdding(true);
    else if (o.playerId) {
      setFilter("all");
      setOpenId(o.playerId);
    }
    // Opening Briefs always starts fresh (a new key remounts it), at the asked view if any.
    if (s === "briefs") setBriefStart((b) => ({ view: o.brief, n: b.n + 1 }));
    setPeopleFilter(o.peopleFilter);
    document.querySelector("[data-admin-main]")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    try {
      localStorage.setItem("dmsaAdminSection", s);
    } catch {
      /* remembered for this visit only */
    }
  };

  const gotPlayers = (list: Player[]) => {
    const real = list.filter((p) => !/\(test\)/i.test(p.name));
    setPlayers(real);
    save("players", real);
  };
  const gotConvs = (c: Conv[]) => { setConvs(c); save("convs", c); };
  const gotPeople = (p: Person[]) => { setPeople(p); save("people", p); };
  const gotOrg = (o: OrgInfo) => { setOrgInfo(o); save("org", o); };
  const loadFailed = (e: unknown) => {
    if (e instanceof StoryApiError && e.code === "not_admin") return setError("This access link is no longer valid. Ask Auraclusive for a new one, or sign out.");
    // With saved data on screen, say so quietly instead of blocking the app.
    if (saved("players")) return showToast("Couldn't refresh - showing what was loaded before");
    setError("Couldn't load your data. Check your internet and try again.");
  };

  const load = useCallback(() => {
    // One request for everything the app needs to open (each request costs Google 2-3 s).
    return storyAdmin<{ list: { players: Player[] } | null; convList: { conversations: Conv[] } | null; people: { people: Person[] } | null; org: OrgInfo | null }>(
      "boot", adminKey, {}, 120000)
      .then((r) => {
        if (r.list) gotPlayers(r.list.players);
        if (r.convList) gotConvs(r.convList.conversations);
        if (r.people) gotPeople(r.people.people);
        if (r.org) gotOrg(r.org);
        if (!r.list) throw new Error("players did not load");
        setError("");
      })
      .catch((e) => {
        if (e instanceof StoryApiError && e.code === "not_admin") return loadFailed(e);
        return loadSeparately();
      })
      .finally(() => setRefreshing(false));
  }, [adminKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The older way, one request per list: used if the combined request fails. */
  const loadSeparately = () => {
    storyAdmin<{ conversations: Conv[] }>("convList", adminKey, {}, 90000)
      .then((r) => gotConvs(r.conversations))
      .catch(() => setConvs((c) => c || []));
    storyAdmin<{ people: Person[] }>("people", adminKey, {}, 90000)
      .then((r) => gotPeople(r.people))
      .catch(() => setPeople((p) => p || []));
    storyAdmin<OrgInfo>("orgGet", adminKey, {}, 90000)
      .then(gotOrg)
      .catch(() => {});
    return storyAdmin<{ players: Player[] }>("list", adminKey, {}, 90000)
      .then((r) => {
        gotPlayers(r.players);
        setError("");
      })
      .catch(loadFailed);
  };

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
  const followCount = (people || []).filter(needsFollowUp).length;
  const short = orgInfo?.org.short || "";

  return (
    <Shell>
      <div className="lg:grid lg:h-dvh lg:grid-cols-[248px_1fr]">
        {/* ---- navigation: side rail on computers, bottom bar on phones ---- */}
        <nav className="hidden border-r border-[var(--line)] bg-[var(--surface)] px-3 py-4 lg:flex lg:flex-col" aria-label="Main">
          <div className="flex items-center gap-2.5 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/myithri-small.webp`} alt="" className="h-9 w-9 rounded-full bg-[var(--teal-soft)] object-cover" />
            <div>
              <p className="font-heading text-[16px] font-bold leading-tight">Myithri</p>
              <p className="text-[11px] text-[var(--muted)]">by Auraclusive</p>
            </div>
          </div>
          <button
            onClick={() => go("settings")}
            className="mt-5 flex items-center gap-2.5 rounded-xl border border-[var(--line)] px-2.5 py-2 text-left transition hover:border-[var(--teal)]"
            title="Organisation settings"
          >
            <span className="flex h-8 w-12 flex-none items-center justify-center overflow-hidden rounded-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {orgInfo?.logo ? <img src={orgInfo.logo} alt="" className="max-h-full max-w-full object-contain" /> : <Building2 className="h-4 w-4 text-[var(--muted)]" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-[var(--muted)]">Organisation</span>
              <span className="block truncate text-sm font-semibold">{short || "…"}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 flex-none text-[var(--muted)]" />
          </button>
          <div className="mt-4">
            <NewMenu go={go} align="left" full />
          </div>
          <ul className="mt-4 space-y-0.5">
            {NAV.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => go(n.id)}
                  aria-current={section === n.id ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition ${
                    section === n.id ? "bg-[var(--teal-soft)] text-[var(--navy)]" : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                  }`}
                >
                  <n.icon className="h-5 w-5" /> <span className="flex-1 text-left">{n.label}</span>
                  {n.id === "people" && followCount > 0 && (
                    <span className="rounded-full bg-[var(--alert)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">{followCount}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex-1" />
          <button
            onClick={() => go("settings")}
            aria-current={section === "settings" ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition ${
              section === "settings" ? "bg-[var(--teal-soft)] text-[var(--navy)]" : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
            }`}
          >
            <Settings className="h-5 w-5" /> Settings
          </button>
        </nav>

        <div data-admin-main className="min-w-0 pb-20 lg:h-dvh lg:overflow-y-auto lg:pb-0">
          {!players && !error && (
            <Center>
              <Loader2 className="h-7 w-7 animate-spin text-[var(--teal)]" />
              <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
            </Center>
          )}
          {demo && (
            <div className="flex items-center gap-3 border-b border-[var(--gold)]/40 bg-[var(--gold-soft)] px-4 py-2.5 text-sm lg:px-8">
              <Sparkles className="h-4 w-4 flex-none text-[var(--ink)]" aria-hidden />
              <p className="min-w-0 flex-1">
                <span className="font-semibold">Demo with sample data.</span> The people and stories here are made up.
              </p>
              <button onClick={() => signIn(null)} className="flex-none rounded-lg border border-[var(--ink)]/20 bg-[var(--surface)] px-3 py-1.5 text-[13px] font-semibold">
                Leave demo
              </button>
            </div>
          )}
          {error && !players && (
            <Center>
              <p className="max-w-sm text-center">{error}</p>
              <button className="mt-5 rounded-xl bg-[var(--teal)] px-5 py-3 font-semibold text-white" onClick={() => load()}>
                Try again
              </button>
              <button className="mt-3 text-sm font-semibold text-[var(--muted)] underline underline-offset-4" onClick={() => signIn(null)}>
                Sign out
              </button>
            </Center>
          )}

          {players && section === "home" && (
            <HomeView adminKey={adminKey} players={players} convs={convs} people={people} orgInfo={orgInfo} go={go} onRead={setReading} refreshing={refreshing} onRefresh={refresh} />
          )}

          {section === "briefs" && (
            <ConversationsView key={briefStart.n} start={briefStart.view} adminKey={adminKey} toast={showToast} convs={convs} onConvs={gotConvs} />
          )}

          {players && section === "people" && (
            <PeopleView key={peopleFilter || "all"} adminKey={adminKey} players={players} people={people} setPeople={setPeople} go={go} initialFilter={peopleFilter} toast={showToast} />
          )}

          {section === "reports" && <ReportsView adminKey={adminKey} convs={convs} toast={showToast} />}

          {section === "settings" && <SettingsView adminKey={adminKey} orgInfo={orgInfo} setOrgInfo={setOrgInfo} toast={showToast} onSignOut={() => signIn(null)} demo={demo} />}

          {players && section === "stories" && (
            <>
              <div className={storiesTab === "players" ? "border-b border-[var(--line)] bg-[var(--bg)] lg:sticky lg:top-0 lg:z-10" : ""}>
                <div className={`mx-auto px-4 pt-5 lg:px-8 lg:pt-8 ${storiesTab === "players" ? "" : "max-w-5xl"}`}>
                  <PageHeader
                    title="Stories"
                    subtitle="Players tell their story to Myithri; each interview becomes a two-language impact story you can share."
                    actions={
                      storiesTab === "players" ? (
                        <button
                          onClick={() => {
                            setOpenId(null);
                            setAdding(true);
                          }}
                          className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-[var(--navy2)]"
                        >
                          <Plus className="h-4 w-4" /> Add player
                        </button>
                      ) : undefined
                    }
                  />
                  <div role="tablist" className="mt-4 flex gap-6 border-b border-[var(--line)]">
                    {(["stories", "players"] as const).map((t) => (
                      <button
                        key={t}
                        role="tab"
                        aria-selected={storiesTab === t}
                        onClick={() => {
                          setStoriesTab(t);
                          setOpenId(null);
                          setAdding(false);
                        }}
                        className={`-mb-px border-b-2 pb-2.5 text-[15px] font-semibold transition ${storiesTab === t ? "border-[var(--navy)] text-[var(--ink)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}
                      >
                        {t === "stories" ? `Stories (${players.filter((p) => p.pdfEnUrl).length})` : `Players (${players.length})`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {storiesTab === "stories" && (
                <StoriesView
                  adminKey={adminKey}
                  players={players}
                  onRead={setReading}
                  hideHeader
                  top={<ImpactCard adminKey={adminKey} toast={showToast} />}
                  onOpenPlayer={(p) => {
                    setStoriesTab("players");
                    setOpenId(p.id);
                  }}
                />
              )}

              {storiesTab === "players" && (
                <div className="lg:grid lg:grid-cols-[minmax(340px,420px)_1fr]">
                  <div className="lg:border-r lg:border-[var(--line)]">
                    <div className="space-y-3 px-4 pt-4">
                      <div className="flex items-center gap-2">
                        <label className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 focus-within:border-[var(--teal)]">
                          <Search className="h-4 w-4 text-[var(--muted)]" />
                          <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name, place or phone"
                            className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]"
                          />
                        </label>
                        <RefreshButton spinning={refreshing} onClick={refresh} />
                      </div>
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
                    <ul className="mt-2 space-y-2 px-4 pb-28 pt-1 lg:pb-12">
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

                  <div className={`${open || adding ? "fixed inset-0 z-30 overflow-y-auto" : "hidden"} bg-[var(--bg)] lg:static lg:block`}>
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
                      <div className="hidden flex-col items-center justify-center px-10 py-24 text-center lg:flex">
                        <Users className="h-10 w-10 text-[var(--line)]" />
                        <p className="mt-4 font-heading text-lg font-bold">Choose a player</p>
                        <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">You&apos;ll see their interview, photos and story here.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* bottom bar on phones */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => go(n.id)}
                aria-current={section === n.id ? "page" : undefined}
                className={`relative flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${section === n.id ? "text-[var(--navy)]" : "text-[var(--muted)]"}`}
              >
                <span className={`relative flex h-8 w-12 items-center justify-center rounded-full transition ${section === n.id ? "bg-[var(--teal-soft)]" : ""}`}>
                  <n.icon className="h-5 w-5" />
                  {n.id === "people" && followCount > 0 && <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-[var(--alert)]" aria-label={`${followCount} to follow up`} />}
                </span>
                {n.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

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
      className={`flex-none rounded-full p-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--teal)] ${
        dark ? "bg-white/10 text-white hover:bg-white/20" : "border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--teal)]"
      }`}
    >
      <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
    </button>
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
  // #178C8C failed contrast on white and on teal-soft; this passes (5:1 or better) everywhere it is used.
  "--teal": "#11706F",
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
