"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Circle,
  ExternalLink,
  FileText,
  HeartPulse,
  ImageUp,
  Loader2,
  MessageCircle,
  MessageCircleQuestion,
  MessagesSquare,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { storyAdmin } from "@/lib/story/api";
import { initials, isStuck, missingDetails, stageOf, STATUS_WORDS } from "@/lib/story/players";
import type { Player } from "@/components/AdminApp";
import type { BriefView, Conv } from "@/components/AdminConversations";
import { ImpactCard } from "@/components/AdminImpact";
import { StoryCover } from "@/components/AdminMedia";

/**
 * The organisation-level screens of the admin app: Home (what needs you),
 * People (everyone heard, across stories and briefs), Reports (every PDF) and
 * Settings (the organisation's name, logo and lines printed on reports).
 */

export type Section = "home" | "briefs" | "stories" | "people" | "reports" | "settings";
export type PlayerFilter = "all" | "notSent" | "waiting" | "started" | "finished" | "stuck" | "details";

export interface GoOpts {
  storiesTab?: "stories" | "players";
  playerFilter?: PlayerFilter;
  playerId?: string;
  brief?: BriefView;
  peopleFilter?: PeopleFilter;
}
export type Go = (s: Section, o?: GoOpts) => void;

export interface Org {
  name: string;
  short: string;
  website: string;
  donate: string;
  credentials: string;
  contact: string;
  donationEn: string;
  donationKn: string;
  voice: string;
}
export interface OrgInfo {
  org: Org;
  logo: string;
  voices: string[];
  links: { drive?: string; sheet?: string };
}

export interface Person {
  id: string;
  conv: string;
  convName: string;
  convType: string;
  name: string;
  phone: string;
  status: string;
  started: string;
  finished: string;
  minutes: number | string;
  language: string;
  sentiment: string;
  summary: string;
  followUp: string;
  unanswered: string[];
  followedUp: string;
}

/** Someone who asked something or should hear back, and it hasn't been handled yet. */
export const needsFollowUp = (p: Person) => !p.followedUp && (p.unanswered.length > 0 || !!p.followUp.trim());

const card = "rounded-2xl border border-[var(--line)] bg-[var(--surface)]";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-[var(--muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
    </header>
  );
}

// ---------- "+ New" ----------

export function NewMenu({ go, align = "right", full }: { go: Go; align?: "left" | "right"; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const items: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }[] = [
    { icon: <MessagesSquare className="h-4 w-4" />, label: "New brief", hint: "Feedback or interviews, with a link to share", onClick: () => go("briefs", { brief: { kind: "new" } }) },
    { icon: <UserPlus className="h-4 w-4" />, label: "Add a story player", hint: "Invite someone to tell their story", onClick: () => go("stories", { storiesTab: "players", playerId: "new" }) },
    { icon: <FileText className="h-4 w-4" />, label: "Make a report", hint: "A PDF for funders or your team", onClick: () => go("reports") },
  ];
  return (
    <div ref={ref} className={`relative ${full ? "w-full" : ""}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center justify-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-[var(--navy2)] ${full ? "w-full" : ""}`}
      >
        <Plus className="h-4 w-4" /> New
      </button>
      {open && (
        <div role="menu" className={`absolute z-40 mt-2 w-72 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_18px_40px_-20px_rgba(11,31,68,0.45)] ${align === "right" ? "right-0" : "left-0"}`}>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--bg)]"
            >
              <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]">{it.icon}</span>
              <span>
                <span className="block text-sm font-semibold">{it.label}</span>
                <span className="block text-xs text-[var(--muted)]">{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- home ----------

export function HomeView({
  adminKey,
  players,
  convs,
  people,
  orgInfo,
  go,
  onRead,
  refreshing,
  onRefresh,
}: {
  adminKey: string;
  players: Player[];
  convs: Conv[] | null;
  people: Person[] | null;
  orgInfo: OrgInfo | null;
  go: Go;
  onRead: (p: Player) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const short = orgInfo?.org.short || "";

  const heard = players.filter((p) => stageOf(p) >= 4).length + (people || []).filter((p) => /Completed|Stopped/.test(p.status)).length;
  const minutes = players.reduce((a, p) => a + (Number(p.minutes) || 0), 0) + (people || []).reduce((a, p) => a + (Number(p.minutes) || 0), 0);
  const stories = players.filter((p) => p.pdfEnUrl).length;
  const openBriefs = (convs || []).filter((c) => c.status === "Open");

  const follow = (people || []).filter(needsFollowUp);
  const questions = follow.reduce((a, p) => a + p.unanswered.length, 0);
  const toRead = players.filter((p) => stageOf(p) === 5).length;
  const needStory = players.filter((p) => stageOf(p) === 4).length;
  const stuck = players.filter(isStuck).length;
  const details = players.filter((p) => missingDetails(p).length > 0).length;
  const notSent = players.filter((p) => stageOf(p) === 0).length;

  const todo: { tone: "gold" | "teal" | "alert" | "navy"; icon: React.ReactNode; title: string; text: string; action: string; onClick: () => void }[] = [];
  if (follow.length)
    todo.push({
      tone: "alert",
      icon: <MessageCircleQuestion className="h-5 w-5" />,
      title: questions
        ? `${questions} ${questions === 1 ? "question is" : "questions are"} waiting for an answer`
        : `${follow.length} ${follow.length === 1 ? "person should" : "people should"} hear back from you`,
      text: "Myithri promised the team would get back to them.",
      action: "Reply",
      onClick: () => go("people", { peopleFilter: "follow" }),
    });
  if (toRead)
    todo.push({
      tone: "gold",
      icon: <BookOpen className="h-5 w-5" />,
      title: `${toRead} ${toRead === 1 ? "story is" : "stories are"} ready to read`,
      text: "Read, then send the Kannada version to the player for their OK.",
      action: "Read",
      onClick: () => go("stories", { storiesTab: "stories" }),
    });
  if (needStory)
    todo.push({
      tone: "teal",
      icon: <Sparkles className="h-5 w-5" />,
      title: `${needStory} ${needStory === 1 ? "interview is" : "interviews are"} waiting for a story`,
      text: "Usually written automatically. Open one to write it now.",
      action: "Open",
      onClick: () => go("stories", { storiesTab: "stories" }),
    });
  if (stuck)
    todo.push({
      tone: "alert",
      icon: <BellRing className="h-5 w-5" />,
      title: `${stuck} ${stuck === 1 ? "player needs" : "players need"} a reminder`,
      text: "They got the link but haven't finished for a day or more.",
      action: "Remind",
      onClick: () => go("stories", { storiesTab: "players", playerFilter: "stuck" }),
    });
  if (details)
    todo.push({
      tone: "gold",
      icon: <Pencil className="h-5 w-5" />,
      title: `${details} ${details === 1 ? "story is" : "stories are"} missing details only you know`,
      text: "Add He/She and the support they received, then update the story.",
      action: "Review",
      onClick: () => go("stories", { storiesTab: "players", playerFilter: "details" }),
    });
  if (notSent)
    todo.push({
      tone: "navy",
      icon: <MessageCircle className="h-5 w-5" />,
      title: `${notSent} ${notSent === 1 ? "player hasn't" : "players haven't"} been invited`,
      text: "Send their story link on WhatsApp.",
      action: "Invite",
      onClick: () => go("stories", { storiesTab: "players", playerFilter: "notSent" }),
    });
  const toneCls = {
    gold: "bg-[var(--gold-soft)] text-[#7D5A1E]",
    teal: "bg-[var(--teal-soft)] text-[var(--teal)]",
    alert: "bg-[var(--alert-soft)] text-[var(--alert)]",
    navy: "bg-[var(--bg)] text-[var(--navy)]",
  };

  const latest = players
    .filter((p) => p.pdfEnUrl)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
      <PageHeader
        title={hello}
        subtitle={short ? `Here's what's happening at ${short}.` : "Here's what's happening."}
        actions={
          <>
            <button aria-label="Refresh" onClick={onRefresh} className="rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5 transition hover:border-[var(--teal)]">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button aria-label="Settings" onClick={() => go("settings")} className="rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5 transition hover:border-[var(--teal)] lg:hidden">
              <Settings className="h-4 w-4" />
            </button>
            <NewMenu go={go} />
          </>
        }
      />

      <GettingStarted adminKey={adminKey} convs={convs} people={people} orgInfo={orgInfo} go={go} />

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { n: heard, l: "People heard", go: () => go("people") },
          { n: Math.round(minutes / 6) / 10, l: "Hours of conversation", go: () => go("people") },
          { n: stories, l: "Stories written", go: () => go("stories", { storiesTab: "stories" }) },
          { n: openBriefs.length, l: "Briefs open", go: () => go("briefs") },
        ].map((x) => (
          <button key={x.l} onClick={x.go} className={`${card} px-4 py-3.5 text-left transition hover:border-[var(--teal)]`}>
            <dt className="text-[13px] text-[var(--muted)]">{x.l}</dt>
            <dd className="mt-0.5 font-heading text-[28px] font-bold leading-tight tabular-nums">{x.n}</dd>
          </button>
        ))}
      </dl>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-bold">Needs you</h2>
        {todo.length ? (
          <ul className={`${card} mt-3 divide-y divide-[var(--line)] overflow-hidden`}>
            {todo.map((t) => (
              <li key={t.title}>
                <button onClick={t.onClick} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-[var(--bg)]">
                  <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${toneCls[t.tone]}`}>{t.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t.title}</span>
                    <span className="block text-sm text-[var(--muted)]">{t.text}</span>
                  </span>
                  <span className="hidden flex-none text-sm font-semibold text-[var(--teal)] sm:block">{t.action}</span>
                  <ChevronRight className="h-5 w-5 flex-none text-[var(--muted)] sm:hidden" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-[var(--muted)]">You&apos;re all caught up.</p>
        )}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-lg font-bold">Open briefs</h2>
            <button onClick={() => go("briefs")} className="text-sm font-semibold text-[var(--teal)]">
              See all
            </button>
          </div>
          {!convs ? (
            <Loader2 className="mt-6 h-5 w-5 animate-spin text-[var(--teal)]" />
          ) : openBriefs.length ? (
            <ul className={`${card} mt-3 divide-y divide-[var(--line)] overflow-hidden`}>
              {openBriefs.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <button onClick={() => go("briefs", { brief: { kind: "conv", id: c.id } })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--bg)]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.name}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {c.counts.done} finished · {c.counts.total} started
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 flex-none text-[var(--muted)]" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <button onClick={() => go("briefs", { brief: { kind: "new" } })} className="mt-3 w-full rounded-2xl border-2 border-dashed border-[var(--line)] p-6 text-center transition hover:border-[var(--teal)]">
              <p className="font-semibold">Start your first brief</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Tell Myithri what to ask, then share the link.</p>
            </button>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-lg font-bold">Latest stories</h2>
            <button onClick={() => go("stories", { storiesTab: "stories" })} className="text-sm font-semibold text-[var(--teal)]">
              See all
            </button>
          </div>
          {latest.length ? (
            <ul className="mt-3 grid grid-cols-4 gap-3">
              {latest.map((p) => (
                <li key={p.id}>
                  <button onClick={() => onRead(p)} className="group block w-full text-left">
                    <StoryCover adminKey={adminKey} playerId={p.id} className="aspect-[1/1.414] rounded-lg ring-1 ring-[var(--line)] transition group-hover:-translate-y-0.5" />
                    <p className="mt-1.5 truncate text-xs font-semibold">{p.name}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">Stories appear here once players have talked with Myithri.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/** First steps for a new organisation; disappears once everything is done. */
function GettingStarted({ adminKey, convs, people, orgInfo, go }: { adminKey: string; convs: Conv[] | null; people: Person[] | null; orgInfo: OrgInfo | null; go: Go }) {
  const [hasReport, setHasReport] = useState<boolean | null>(null);
  useEffect(() => {
    storyAdmin<{ report: unknown }>("impactStatus", adminKey, {}, 60000)
      .then((r) => setHasReport(!!r.report))
      .catch(() => setHasReport(null));
  }, [adminKey]);
  if (!convs || !people || !orgInfo || hasReport === null) return null;
  const steps = [
    { done: !!orgInfo.logo && !!orgInfo.org.name, label: "Add your organisation's name and logo", onClick: () => go("settings") },
    { done: convs.length > 0, label: "Create your first brief", onClick: () => go("briefs", { brief: { kind: "new" } }) },
    { done: people.length > 0, label: "Share the link and hear from your first person", onClick: () => go("briefs") },
    { done: !!hasReport, label: "Make your first report", onClick: () => go("reports") },
  ];
  const n = steps.filter((s) => s.done).length;
  if (n === steps.length) return null;
  return (
    <section className={`${card} mt-6 p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold">Get started</h2>
        <span className="text-sm text-[var(--muted)]">
          {n} of {steps.length} done
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg)]" aria-hidden>
        <div className="h-full rounded-full bg-[var(--teal)]" style={{ width: `${(n / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-1">
        {steps.map((s) => (
          <li key={s.label}>
            <button onClick={s.onClick} disabled={!!s.done} className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition enabled:hover:bg-[var(--bg)]">
              {s.done ? <CircleCheck className="h-5 w-5 flex-none text-[var(--teal)]" /> : <Circle className="h-5 w-5 flex-none text-[var(--line)]" />}
              <span className={s.done ? "text-[var(--muted)] line-through" : "font-semibold"}>{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- people ----------

export type PeopleFilter = "all" | "players" | "briefs" | "follow";

type Row =
  | { kind: "player"; key: string; name: string; sub: string; when: string; p: Player }
  | { kind: "person"; key: string; name: string; sub: string; when: string; p: Person };

export function PeopleView({
  adminKey,
  players,
  people,
  setPeople,
  go,
  initialFilter,
  toast,
}: {
  adminKey: string;
  players: Player[];
  people: Person[] | null;
  setPeople: (f: (xs: Person[] | null) => Person[] | null) => void;
  go: Go;
  initialFilter?: PeopleFilter;
  toast: (t: string) => void;
}) {
  const [filter, setFilter] = useState<PeopleFilter>(initialFilter || "all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const a: Row[] = players.map((p) => ({
      kind: "player",
      key: p.id,
      name: p.name,
      sub: ["Story", STATUS_WORDS[stageOf(p)], p.hometown].filter(Boolean).join(" · "),
      when: p.updated,
      p,
    }));
    const b: Row[] = (people || []).map((p) => ({
      kind: "person",
      key: p.id,
      name: p.name,
      sub: [p.convName, p.status, p.language].filter(Boolean).join(" · "),
      when: p.started,
      p,
    }));
    return [...b, ...a].sort((x, y) => String(y.when).localeCompare(String(x.when)));
  }, [players, people]);

  const counts = {
    all: rows.length,
    players: players.length,
    briefs: (people || []).length,
    follow: (people || []).filter(needsFollowUp).length,
  };
  const shown = rows.filter((r) => {
    if (filter === "players" && r.kind !== "player") return false;
    if (filter === "briefs" && r.kind !== "person") return false;
    if (filter === "follow" && !(r.kind === "person" && needsFollowUp(r.p))) return false;
    const s = q.trim().toLowerCase();
    return !s || `${r.name} ${r.sub} ${r.p.phone}`.toLowerCase().includes(s);
  });

  const markDone = async (p: Person, undo = false) => {
    try {
      await storyAdmin("followDone", adminKey, { id: p.id, undo }, 30000);
      setPeople((xs) => (xs ? xs.map((x) => (x.id === p.id ? { ...x, followedUp: undo ? "" : new Date().toISOString() } : x)) : xs));
      toast(undo ? "Moved back to follow-up" : "Marked as done");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    }
  };

  const tabs: { id: PeopleFilter; label: string }[] = [
    { id: "all", label: "Everyone" },
    { id: "follow", label: "Needs follow-up" },
    { id: "briefs", label: "From briefs" },
    { id: "players", label: "Story players" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
      <PageHeader title="People" subtitle="Everyone who talked with Myithri, from your briefs and your stories, in one list." />
      <label className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 focus-within:border-[var(--teal)]">
        <Search className="h-4 w-4 text-[var(--muted)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, brief, place or phone" className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]" />
      </label>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
              filter === t.id ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-[var(--surface)]"
            }`}
          >
            {t.label} <span className="tabular-nums opacity-70">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {!people && <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-[var(--teal)]" />}
      <ul className={`${card} mt-4 divide-y divide-[var(--line)] overflow-hidden`}>
        {shown.map((r) => {
          const person = r.kind === "person" ? r.p : null;
          const follow = person && needsFollowUp(person);
          const expanded = open === r.key;
          return (
            <li key={r.kind + r.key}>
              <button
                onClick={() => (r.kind === "player" ? go("stories", { storiesTab: "players", playerId: r.p.id }) : setOpen(expanded ? null : r.key))}
                aria-expanded={r.kind === "person" ? expanded : undefined}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--bg)]"
              >
                <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold ${r.kind === "player" ? "bg-[var(--gold-soft)] text-[#7D5A1E]" : "bg-[var(--teal-soft)] text-[var(--teal)]"}`}>
                  {initials(r.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{r.sub}</span>
                </span>
                {follow && <span className="flex-none rounded-full bg-[var(--alert-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--alert)]">Follow up</span>}
                {person?.sentiment && !follow && <Sentiment s={person.sentiment} />}
                {r.kind === "player" ? <ChevronRight className="h-4 w-4 flex-none text-[var(--muted)]" /> : <ChevronDown className={`h-4 w-4 flex-none text-[var(--muted)] transition ${expanded ? "rotate-180" : ""}`} />}
              </button>
              {person && expanded && (
                <div className="space-y-3 bg-[var(--bg)]/60 px-4 pb-4 pt-1 text-sm">
                  {person.summary && <p className="text-[var(--ink)]">{person.summary}</p>}
                  {person.unanswered.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Questions to answer</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {person.unanswered.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {person.followUp && (
                    <p>
                      <span className="font-semibold">Follow up: </span>
                      {person.followUp}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {person.phone && (
                      <>
                        <a href={`tel:+91${person.phone}`} className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-semibold">
                          <Phone className="h-4 w-4" /> Call
                        </a>
                        <a href={`https://wa.me/91${person.phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 font-semibold text-[#073B2A]">
                          <MessageCircle className="h-4 w-4" /> WhatsApp
                        </a>
                      </>
                    )}
                    <button onClick={() => go("briefs", { brief: { kind: "resp", convId: person.conv, respId: person.id } })} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-semibold">
                      Open conversation
                    </button>
                    {(person.unanswered.length > 0 || person.followUp) &&
                      (person.followedUp ? (
                        <button onClick={() => markDone(person, true)} className="flex items-center gap-1.5 px-2 py-2 font-semibold text-[var(--muted)]">
                          <Check className="h-4 w-4" /> Done · undo
                        </button>
                      ) : (
                        <button onClick={() => markDone(person)} className="flex items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 py-2 font-semibold text-white">
                          <Check className="h-4 w-4" /> Mark done
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {people && !shown.length && (
          <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">{filter === "follow" ? "Nobody is waiting to hear back from you." : "No one matches."}</li>
        )}
      </ul>
    </div>
  );
}

function Sentiment({ s }: { s: string }) {
  const cls =
    s === "positive"
      ? "bg-[var(--teal-soft)] text-[var(--teal)]"
      : s === "negative"
        ? "bg-[var(--alert-soft)] text-[var(--alert)]"
        : s === "mixed"
          ? "bg-[var(--gold-soft)] text-[#7D5A1E]"
          : "bg-[var(--bg)] text-[var(--muted)]";
  return <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${cls}`}>{s}</span>;
}

// ---------- reports ----------

export function ReportsView({ adminKey, convs, toast }: { adminKey: string; convs: Conv[] | null; toast: (t: string) => void }) {
  const briefs = (convs || []).filter((c) => !c.cfg.evaluate);
  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
      <PageHeader title="Reports" subtitle="Share-ready PDFs made from what people told Myithri. Every number can be checked, and every quote is their own words." />
      <h2 className="mt-8 text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">From your stories</h2>
      <ImpactCard adminKey={adminKey} toast={toast} className="mt-3" />
      <h2 className="mt-10 text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">From your briefs</h2>
      {!convs && <Loader2 className="mt-6 h-5 w-5 animate-spin text-[var(--teal)]" />}
      {convs && !briefs.length && <p className="mt-3 text-sm text-[var(--muted)]">Create a brief to get a report from its conversations.</p>}
      {briefs.map((c) => (
        <div key={c.id} className="mt-5">
          <p className="font-semibold">{c.name}</p>
          <ImpactCard adminKey={adminKey} toast={toast} conv={c.id} forFunders={c.cfg.type === "beneficiary"} className="mt-2" />
        </div>
      ))}
    </div>
  );
}

// ---------- settings ----------

const ORG_FIELDS: { key: keyof Org; label: string; hint: string; area?: boolean; placeholder?: string }[] = [
  { key: "name", label: "Organisation name", hint: "Printed on reports and shown to people who talk with Myithri.", placeholder: "Asha Foundation" },
  { key: "short", label: "Short name", hint: "Used in sentences, like \"DMSA will use what I share\".", placeholder: "Asha" },
  { key: "website", label: "Website", hint: "Printed on reports and stories.", placeholder: "www.ashafoundation.org" },
  { key: "donate", label: "Donate link", hint: "Printed under the donation line.", placeholder: "www.ashafoundation.org/donate" },
  { key: "donationEn", label: "Donation line", hint: "The ask at the end of reports and stories. Use only amounts you can stand behind.", area: true },
  { key: "donationKn", label: "Donation line in Kannada", hint: "Used on Kannada stories.", area: true },
  { key: "credentials", label: "Credentials", hint: "Registrations funders look for: CSR-1, 80G, 12A, NGO Darpan. Printed word for word.", area: true },
  { key: "contact", label: "Contact line", hint: "Name, phone, email and website, printed in report footers.", area: true },
];

export function SettingsView({ adminKey, orgInfo, setOrgInfo, toast }: { adminKey: string; orgInfo: OrgInfo | null; setOrgInfo: (o: OrgInfo) => void; toast: (t: string) => void }) {
  const [f, setF] = useState<Org | null>(orgInfo?.org || null);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  useEffect(() => {
    if (orgInfo && !f) setF(orgInfo.org);
  }, [orgInfo, f]);

  if (!orgInfo || !f) return <Loader2 className="mx-auto mt-16 h-7 w-7 animate-spin text-[var(--teal)]" />;
  const dirty = JSON.stringify(f) !== JSON.stringify(orgInfo.org);
  const input = "mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[15px] outline-none focus:border-[var(--teal)]";

  const save = async () => {
    setSaving(true);
    try {
      const r = await storyAdmin<OrgInfo>("orgSave", adminKey, { org: f }, 60000);
      setOrgInfo(r);
      setF(r.org);
      toast("Settings saved");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    if (!/^image\/(png|jpeg)$/.test(file.type)) return alert("Please use a PNG or JPEG image.");
    if (file.size > 2 * 1024 * 1024) return alert("Please use an image under 2 MB.");
    setLogoBusy(true);
    try {
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] || "");
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const r = await storyAdmin<OrgInfo>("orgLogo", adminKey, { data, mime: file.type }, 120000);
      setOrgInfo(r);
      toast("Logo updated");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-36 pt-5 lg:px-8 lg:pb-28 lg:pt-8">
      <PageHeader title="Settings" subtitle="Your organisation's details appear on every report, story and page people see." />

      <section className={`${card} mt-6 p-5`}>
        <h2 className="font-heading text-lg font-bold">Organisation</h2>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-28 flex-none items-center justify-center overflow-hidden rounded-xl border border-[var(--line)] bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {orgInfo.logo ? <img src={orgInfo.logo} alt={`${orgInfo.org.short} logo`} className="max-h-full max-w-full object-contain" /> : <ImageUp className="h-6 w-6 text-[var(--muted)]" />}
          </div>
          <div>
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--teal)] ${logoBusy ? "pointer-events-none opacity-60" : ""}`}>
              {logoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
              {logoBusy ? "Uploading..." : "Change logo"}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) upload(file);
                }}
              />
            </label>
            <p className="mt-1 text-xs text-[var(--muted)]">PNG or JPEG, under 2 MB. A wide logo on a white or clear background works best.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {ORG_FIELDS.map((d) => (
            <label key={d.key} className={`block ${d.area ? "sm:col-span-2" : ""}`}>
              <span className="text-[13px] font-semibold">{d.label}</span>
              {d.area ? (
                <textarea rows={2} className={input} value={f[d.key]} placeholder={d.placeholder} onChange={(e) => setF({ ...f, [d.key]: e.target.value })} />
              ) : (
                <input className={input} value={f[d.key]} placeholder={d.placeholder} onChange={(e) => setF({ ...f, [d.key]: e.target.value })} />
              )}
              <span className="mt-1 block text-xs text-[var(--muted)]">{d.hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={`${card} mt-5 p-5`}>
        <h2 className="font-heading text-lg font-bold">Myithri</h2>
        <label className="mt-4 block max-w-sm">
          <span className="text-[13px] font-semibold">Voice</span>
          <select className={input} value={f.voice} onChange={(e) => setF({ ...f, voice: e.target.value })}>
            {orgInfo.voices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-[var(--muted)]">Used for every conversation from the next call on.</span>
        </label>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Myithri speaks English, Hindi and Kannada. Choose the language for each brief in its setup. Summaries and reports are always in English.
        </p>
      </section>

      <section className={`${card} mt-5 p-5`}>
        <h2 className="font-heading text-lg font-bold">Your data</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Recordings, transcripts, stories and reports are stored in your own Google Drive. Nothing is kept anywhere else.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {orgInfo.links.drive && (
            <a href={orgInfo.links.drive} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--teal)]">
              <ExternalLink className="h-4 w-4" /> Open Drive folder
            </a>
          )}
          {orgInfo.links.sheet && (
            <a href={orgInfo.links.sheet} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--teal)]">
              <ExternalLink className="h-4 w-4" /> Open control Sheet
            </a>
          )}
        </div>
      </section>

      <div className="mt-5">
        <SystemCheck adminKey={adminKey} />
      </div>

      <p className="mt-8 text-center text-xs text-[var(--muted)]">Myithri by Auraclusive</p>

      {dirty && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[var(--line)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-[248px]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm text-[var(--muted)]">You have unsaved changes.</span>
            <div className="flex gap-2">
              <button onClick={() => setF(orgInfo.org)} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--muted)]">
                Discard
              </button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- system check ----------

interface Health {
  status: "ok" | "warn" | "bad";
  checks: { level: "ok" | "warn" | "bad"; text: string }[];
  log: string[];
  errors?: string[];
}

/** Whether the automatic parts are working; tap for details. */
export function SystemCheck({ adminKey }: { adminKey: string }) {
  const [h, setH] = useState<Health | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    storyAdmin<Health>("health", adminKey, {}, 90000)
      .then(setH)
      .catch(() => setH(null));
  }, [adminKey]);
  const tone = h
    ? {
        ok: { dot: "bg-[var(--teal)]", text: "Everything is working" },
        warn: { dot: "bg-[var(--gold)]", text: "Working, with a note" },
        bad: { dot: "bg-[var(--alert)]", text: "Something needs you" },
      }[h.status]
    : null;
  return (
    <section className={card}>
      <button onClick={() => h && setOpen((v) => !v)} className="flex w-full items-center gap-3 px-5 py-4 text-left" aria-expanded={open}>
        <HeartPulse className="h-5 w-5 flex-none text-[var(--muted)]" aria-hidden />
        <span className="flex-1">
          <span className="block font-heading text-lg font-bold">System health</span>
          <span className="flex items-center gap-2 text-sm">
            {h === undefined ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking...
              </>
            ) : tone ? (
              <>
                <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} aria-hidden /> {tone.text}
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-[var(--alert)]" /> Couldn&apos;t check right now
              </>
            )}
          </span>
        </span>
        {h && <ChevronDown className={`h-5 w-5 text-[var(--muted)] transition ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && h && (
        <div className="border-t border-[var(--line)] px-5 pb-5 pt-3">
          <ul className="space-y-2.5">
            {h.checks.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${c.level === "ok" ? "bg-[var(--teal)]" : c.level === "warn" ? "bg-[var(--gold)]" : "bg-[var(--alert)]"}`} />
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
          {h.errors && h.errors.length > 0 && (
            <>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--alert)]">Recent problems</p>
              <ul className="mt-1.5 space-y-1 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
                {h.errors.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </>
          )}
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

