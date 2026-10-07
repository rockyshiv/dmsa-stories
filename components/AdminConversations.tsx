"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowLeft,
  BookText,
  Briefcase,
  FileText,
  HeartHandshake,
  Upload,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { ImpactCard } from "@/components/AdminImpact";
import { storyAdmin } from "@/lib/story/api";
import { parseConversation, type Line } from "@/components/AdminMedia";

/**
 * Conversations in the admin app: set up Myithri for any purpose (volunteer
 * feedback, viewer feedback, first-round interviews...), share the link, and
 * read what people said - one by one, or as insights across everyone.
 */

interface Cfg {
  type: string;
  name: string;
  org: string;
  audience: string;
  role: string;
  objective: string;
  purpose: string;
  intro: string;
  questions: string[];
  criteria: string[];
  notes: string;
  minutes: number;
  language: "kn" | "en" | "hi" | "choose";
  recording: "voice" | "video";
  askPhone: boolean;
  style: "warm" | "professional";
  evaluate: boolean;
  knowledge: string;
  docs: { name: string; fileId: string; chars: number }[];
}

interface Template extends Partial<Cfg> {
  type: string;
  label: string;
}

interface Analysis {
  summary: string;
  sentiment: string;
  answers: { question: string; answer: string; quote: string }[];
  themes: string[];
  suggestions: string[];
  concerns: string[];
  follow_up: string;
  unanswered?: string[];
  criteria?: { criterion: string; score: number; evidence: string }[];
  strengths?: string[];
  gaps?: string[];
  recommendation?: string;
  candidate_questions?: string[];
  average?: number;
}

interface Resp {
  id: string;
  conv: string;
  name: string;
  phone: string;
  status: string;
  started: string;
  finished: string;
  minutes: number | string;
  language: string;
  summary: string;
  result: string;
  folder: string;
  analysis: Analysis | null;
}

export interface Conv {
  id: string;
  name: string;
  type: string;
  status: string;
  code: string;
  created: string;
  cfg: Cfg;
  link: string;
  counts: { total: number; done: number; analysed: number };
  responses?: Resp[];
}

interface Insights {
  overview: string;
  themes: { theme: string; count: number; detail: string }[];
  praise: string[];
  concerns: string[];
  suggestions: string[];
  quotes: { quote: string; person: string }[];
  actions: string[];
  at: string;
  people: number;
}

export type BriefView = View;
type View = { kind: "list" } | { kind: "new" } | { kind: "edit"; conv: Conv } | { kind: "conv"; id: string } | { kind: "resp"; convId: string; respId: string };

const TYPE_ICON: Record<string, typeof Users> = { beneficiary: HeartHandshake, volunteer: Users, viewer: Eye, interview: Briefcase, custom: MessagesSquare };

/** Text that looks like a written form rather than spoken questions. */
function looksLikeForm(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    lines.length > 14 ||
    lines.some((l) => /^(section|part)\b/i.test(l) || /^rate each\b|^name\b|\(\d+\s*min\)|:$/i.test(l)) ||
    (lines[0] || "").length > 160
  );
}

function when(iso: string) {
  const d = new Date(iso);
  return isNaN(+d) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function ConversationsView({ adminKey, toast, start }: { adminKey: string; toast: (t: string) => void; start?: View }) {
  // `start` opens a brief, a person or the builder straight away (links from Home and People).
  const [view, setView] = useState<View>(start || { kind: "list" });
  const go = (v: View) => {
    setView(v);
    document.querySelector("[data-admin-main]")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  };
  if (view.kind === "new") return <Builder adminKey={adminKey} onBack={() => go({ kind: "list" })} onSaved={(c) => go({ kind: "conv", id: c.id })} />;
  if (view.kind === "edit")
    return <Builder adminKey={adminKey} existing={view.conv} onBack={() => go({ kind: "conv", id: view.conv.id })} onSaved={(c) => go({ kind: "conv", id: c.id })} />;
  if (view.kind === "conv")
    return (
      <ConvDetail
        adminKey={adminKey}
        id={view.id}
        toast={toast}
        onBack={() => go({ kind: "list" })}
        onEdit={(c) => go({ kind: "edit", conv: c })}
        onOpen={(r) => go({ kind: "resp", convId: view.id, respId: r.id })}
      />
    );
  if (view.kind === "resp") return <RespDetail adminKey={adminKey} id={view.respId} onBack={() => go({ kind: "conv", id: view.convId })} toast={toast} />;
  return <ConvList adminKey={adminKey} onNew={() => go({ kind: "new" })} onOpen={(c) => go({ kind: "conv", id: c.id })} />;
}

// ---------- list ----------

function ConvList({ adminKey, onNew, onOpen }: { adminKey: string; onNew: () => void; onOpen: (c: Conv) => void }) {
  const [list, setList] = useState<Conv[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    storyAdmin<{ conversations: Conv[] }>("convList", adminKey, {}, 90000)
      .then((r) => {
        setList(r.conversations);
        setError("");
      })
      .catch(() => setError("Couldn't load conversations. Check your internet and try again."));
  }, [adminKey]);
  useEffect(() => load(), [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Briefs</h1>
          <p className="mt-1 text-[15px] text-[var(--muted)]">Tell Myithri what to ask and what she should know. She talks to people, answers their questions and reports back.</p>
        </div>
        <button
          onClick={onNew}
          className="flex flex-none items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--navy2)]"
        >
          <Plus className="h-5 w-5" /> New
        </button>
      </div>
      {!list && !error && <Loader2 className="mx-auto mt-16 h-7 w-7 animate-spin text-[var(--teal)]" />}
      {error && <p className="mt-10 text-center">{error}</p>}
      {list && !list.length && (
        <button onClick={onNew} className="mt-8 w-full rounded-2xl border-2 border-dashed border-[var(--line)] p-10 text-center transition hover:border-[var(--teal)]">
          <MessagesSquare className="mx-auto h-8 w-8 text-[var(--teal)]" />
          <p className="mt-3 font-semibold">Write your first brief</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Beneficiary feedback, volunteer feedback, event feedback, a first-round interview, or your own.</p>
        </button>
      )}
      {list && list.length > 0 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {list.map((c) => {
            const Icon = TYPE_ICON[c.type] || MessagesSquare;
            return (
              <li key={c.id}>
                <button
                  onClick={() => onOpen(c)}
                  className="flex h-full w-full flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--teal)]"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--teal-soft)] text-[var(--teal)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.name}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {c.cfg.questions.length} questions · {c.cfg.minutes} min · {c.cfg.recording === "video" ? "video" : "voice"}
                      </span>
                    </span>
                    <StatusChip status={c.status} />
                  </span>
                  <span className="mt-4 flex items-baseline gap-4 text-sm">
                    <span>
                      <b className="font-heading text-xl tabular-nums">{c.counts.done}</b> <span className="text-[var(--muted)]">completed</span>
                    </span>
                    <span className="text-[var(--muted)]">{c.counts.total - c.counts.done} started</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const open = status === "Open";
  return (
    <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${open ? "bg-[var(--teal-soft)] text-[var(--teal)]" : "bg-[var(--bg)] text-[var(--muted)]"}`}>
      {open ? "Open" : "Closed"}
    </span>
  );
}

// ---------- create / edit ----------

function Builder({ adminKey, existing, onBack, onSaved }: { adminKey: string; existing?: Conv; onBack: () => void; onSaved: (c: Conv) => void }) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [f, setF] = useState<Partial<Cfg> & { questionsText?: string; criteriaText?: string } | null>(
    existing ? { ...existing.cfg, questionsText: existing.cfg.questions.join("\n"), criteriaText: existing.cfg.criteria.join("\n") } : null,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [more, setMore] = useState(false);
  const [tidyNote, setTidyNote] = useState("");
  const [tidied, setTidied] = useState(false);
  const requestId = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  useEffect(() => {
    if (existing) return;
    storyAdmin<{ templates: Template[] }>("convTemplates", adminKey, {}, 60000)
      .then((r) => setTemplates(r.templates))
      .catch(() => setErr("Couldn't load the starting points. Check your internet."));
  }, [adminKey, existing]);

  const pick = (t: Template) =>
    setF({
      ...t,
      name: t.name || "",
      questionsText: (t.questions || []).join("\n"),
      criteriaText: (t.criteria || []).join("\n"),
      language: "choose",
      recording: "voice",
      askPhone: t.type === "interview",
    });

  const set = (k: string, v: unknown) => setF((x) => ({ ...(x || {}), [k]: v }));

  const tidy = async () => {
    if (!f) return;
    setBusy(true);
    setErr("");
    try {
      const r = await storyAdmin<{ questions: string[]; changes: string }>(
        "convTidy",
        adminKey,
        { questions: f.questionsText || "", minutes: f.minutes || 10, audience: f.audience || "", objective: f.objective || "" },
        120000,
      );
      setF((x) => ({ ...(x || {}), questionsText: r.questions.join("\n") }));
      setTidyNote(`${r.changes} Check the ${r.questions.length} questions below, then save.`);
      setTidied(true);
    } catch (e) {
      setErr(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!f) return;
    // A pasted written form is first turned into spoken questions, for Shiva to check.
    if (!tidied && looksLikeForm(f.questionsText || "")) return tidy();
    setBusy(true);
    setErr("");
    try {
      const fields = { ...f, questions: f.questionsText || "", criteria: f.criteriaText || "" };
      const r = await storyAdmin<{ conversation: Conv }>("convSave", adminKey, { id: existing?.id, fields, requestId: requestId.current }, 90000);
      onSaved(r.conversation);
    } catch (e) {
      setErr(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const input = "mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[15px] outline-none transition focus:border-[var(--teal)] focus:bg-[var(--surface)]";

  return (
    <div className="pb-28 lg:pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <button aria-label="Back" onClick={f && !existing ? () => setF(null) : onBack} className="rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="font-heading text-xl font-bold">{existing ? "Edit brief" : "New brief"}</p>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {!f && (
          <>
            <p className="text-[15px] text-[var(--muted)]">Pick a starting point. You can change everything on the next screen.</p>
            {!templates && !err && <Loader2 className="mx-auto mt-10 h-7 w-7 animate-spin text-[var(--teal)]" />}
            <ul className="grid gap-3 sm:grid-cols-2">
              {(templates || []).map((t) => {
                const Icon = TYPE_ICON[t.type] || MessagesSquare;
                return (
                  <li key={t.type}>
                    <button
                      onClick={() => pick(t)}
                      className="flex h-full w-full items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--teal)]"
                    >
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--teal-soft)] text-[var(--teal)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-semibold">{t.label}</span>
                        <span className="mt-0.5 block text-sm text-[var(--muted)]">
                          {t.type === "custom" ? "Start from a blank page." : `${(t.questions || []).length} questions · about ${t.minutes} min`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {f && (
          <>
            <Section title="What is it?">
              <label className="block">
                <span className="text-[13px] font-semibold">Name</span>
                <input className={input} value={f.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. KWPL 4 volunteer feedback" />
              </label>
              {f.type === "interview" && (
                <label className="mt-4 block">
                  <span className="text-[13px] font-semibold">Role you are hiring for</span>
                  <input className={input} value={f.role || ""} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Programme Coordinator" />
                </label>
              )}
              <label className="mt-4 block">
                <span className="text-[13px] font-semibold">Objective</span>
                <span className="block text-xs text-[var(--muted)]">What you want to learn. Myithri uses this to decide her follow-up questions.</span>
                <textarea className={input} rows={4} value={f.objective || ""} onChange={(e) => set("objective", e.target.value)} />
              </label>
              <label className="mt-4 block">
                <span className="text-[13px] font-semibold">Who she is talking to</span>
                <input className={input} value={f.audience || ""} onChange={(e) => set("audience", e.target.value)} placeholder="e.g. a volunteer who helped at KWPL Season 4" />
              </label>
            </Section>

            <Section
              title="Questions"
              subtitle="One per line, in order. Myithri asks each in her own words and adds follow-ups when an answer matters for the objective. You can also paste a written form - it is turned into spoken questions for you to check."
            >
              {tidyNote && <p className="mb-3 rounded-lg bg-[var(--teal-soft)] p-3 text-sm">{tidyNote}</p>}
              <textarea
                className={input}
                rows={Math.min(24, Math.max(6, (f.questionsText || "").split("\n").length + 1))}
                value={f.questionsText || ""}
                onChange={(e) => set("questionsText", e.target.value)}
              />
              <button onClick={tidy} disabled={busy || !(f.questionsText || "").trim()} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--teal)] disabled:opacity-50">
                <Sparkles className="h-4 w-4" /> Tidy up for a spoken conversation
              </button>
            </Section>

            {f.type === "interview" && (
              <Section title="Assess against" subtitle="One criterion per line. Each gets a score from 1 to 5 with the evidence, and a suggested recommendation. The decision stays yours.">
                <textarea className={input} rows={5} value={f.criteriaText || ""} onChange={(e) => set("criteriaText", e.target.value)} />
              </Section>
            )}

            <Section
              title="What Myithri knows"
              subtitle="Facts about your organisation and programme. She uses them to understand the context and to answer people's questions; anything not here, she promises to pass on."
            >
              <textarea
                className={input}
                rows={6}
                value={f.knowledge || ""}
                onChange={(e) => set("knowledge", e.target.value)}
                placeholder={"e.g. DMSA runs wheelchair cricket for players across Karnataka.\nKWPL Season 4: 10-14 December, VET Ground, Bengaluru.\nTravel and food are covered for selected players.\nQuestions about selection go to the coach, Ravi (98450 12345)."}
              />
              {existing ? (
                <KnowledgeDocs adminKey={adminKey} conv={existing} />
              ) : (
                <p className="mt-2 text-xs text-[var(--muted)]">After saving, you can also add documents (PDF, Word or text) for her to read.</p>
              )}
            </Section>

            <Section title="How it runs">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[13px] font-semibold">Length</span>
                  <select className={input} value={f.minutes || 10} onChange={(e) => set("minutes", Number(e.target.value))}>
                    {[5, 6, 8, 10, 12, 15, 20, 25].map((m) => (
                      <option key={m} value={m}>
                        About {m} minutes
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold">Language</span>
                  <select className={input} value={f.language || "choose"} onChange={(e) => set("language", e.target.value)}>
                    <option value="choose">They choose English, Hindi or Kannada</option>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="kn">Kannada</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold">Recording</span>
                  <select className={input} value={f.recording || "voice"} onChange={(e) => set("recording", e.target.value)}>
                    <option value="voice">Voice only</option>
                    <option value="video">Video</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 self-end rounded-lg border border-[var(--line)] px-3 py-3 text-[15px]">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--teal)]" checked={!!f.askPhone} onChange={(e) => set("askPhone", e.target.checked)} />
                  Phone number required
                </label>
              </div>
            </Section>

            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              <button onClick={() => setMore((v) => !v)} className="flex w-full items-center justify-between p-4 text-left" aria-expanded={more}>
                <span className="font-heading text-[15px] font-bold">More options</span>
                <ChevronDown className={`h-5 w-5 transition ${more ? "rotate-180" : ""}`} />
              </button>
              {more && (
                <div className="space-y-4 border-t border-[var(--line)] p-4">
                  <label className="block">
                    <span className="text-[13px] font-semibold">Welcome line people see</span>
                    <input className={input} value={f.intro || ""} onChange={(e) => set("intro", e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold">What you will use the answers for</span>
                    <span className="block text-xs text-[var(--muted)]">Shown in the consent: “DMSA will use what I share to …”</span>
                    <input className={input} value={f.purpose || ""} onChange={(e) => set("purpose", e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold">Organisation name</span>
                    <input className={input} value={f.org || "Divyaang Myithri Sports Academy (DMSA)"} onChange={(e) => set("org", e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold">Tone</span>
                    <select className={input} value={f.style || "warm"} onChange={(e) => set("style", e.target.value)}>
                      <option value="warm">Warm and friendly</option>
                      <option value="professional">Professional</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold">Private notes for Myithri</span>
                    <span className="block text-xs text-[var(--muted)]">Anything she should know or avoid. People never see this.</span>
                    <textarea className={input} rows={3} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} />
                  </label>
                </div>
              )}
            </section>

            {err && (
              <p role="alert" className="rounded-lg bg-[var(--alert-soft)] p-3 text-sm text-[var(--alert)]">
                {err}
              </p>
            )}
            <button
              onClick={save}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--navy)] py-3.5 font-semibold text-white transition hover:bg-[var(--navy2)] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {busy ? "Working..." : existing ? "Save changes" : "Create and get the link"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

/** Documents Myithri reads (their text is extracted when uploaded). */
function KnowledgeDocs({ adminKey, conv }: { adminKey: string; conv: Conv }) {
  const [docs, setDocs] = useState(conv.cfg.docs || []);
  const [busy, setBusy] = useState("");
  const add = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) return alert("Please use a file under 8 MB.");
    setBusy(`Reading ${file.name}...`);
    try {
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] || "");
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const out = await storyAdmin<{ conversation: Conv }>("convDoc", adminKey, { id: conv.id, name: file.name, mime: file.type || "application/octet-stream", data }, 180000);
      setDocs(out.conversation.cfg.docs || []);
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setBusy("");
    }
  };
  const remove = async (fileId: string) => {
    if (!confirm("Remove this document from what Myithri knows?")) return;
    try {
      const out = await storyAdmin<{ conversation: Conv }>("convDocRemove", adminKey, { id: conv.id, fileId }, 60000);
      setDocs(out.conversation.cfg.docs || []);
    } catch (e) {
      alert(String((e as Error)?.message || e));
    }
  };
  return (
    <div className="mt-3 space-y-2">
      {docs.map((d) => (
        <div key={d.fileId} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm">
          <FileText className="h-4 w-4 flex-none text-[var(--teal)]" />
          <span className="min-w-0 flex-1 truncate">{d.name}</span>
          <span className="flex-none text-xs text-[var(--muted)]">{Math.max(1, Math.round(d.chars / 1000))}k characters</span>
          <button aria-label={`Remove ${d.name}`} onClick={() => remove(d.fileId)} className="rounded p-1 text-[var(--muted)] hover:text-[var(--alert)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <label className={`flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--teal)] ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy || "Add a document (PDF, Word or text)"}
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.txt,.md,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) add(file);
          }}
        />
      </label>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-heading text-[15px] font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-[var(--muted)]">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ---------- one conversation ----------

function ConvDetail({
  adminKey,
  id,
  toast,
  onBack,
  onEdit,
  onOpen,
}: {
  adminKey: string;
  id: string;
  toast: (t: string) => void;
  onBack: () => void;
  onEdit: (c: Conv) => void;
  onOpen: (r: Resp) => void;
}) {
  const [c, setC] = useState<Conv | null>(null);
  const [tab, setTab] = useState<"people" | "insights">("people");
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(() => {
    setRefreshing(true);
    storyAdmin<{ conversation: Conv }>("convGet", adminKey, { id }, 90000)
      .then((r) => setC(r.conversation))
      .catch(() => toast("Couldn't load. Try again."))
      .finally(() => setRefreshing(false));
  }, [adminKey, id, toast]);
  useEffect(() => load(), [load]);

  const setStatus = async (open: boolean, archive = false) => {
    if (archive && !confirm("Archive this brief? It disappears from the app; everything stays saved in the Sheet and Drive.")) return;
    try {
      const r = await storyAdmin<{ conversation: Conv }>("convStatus", adminKey, { id, open, archive }, 60000);
      if (archive) return onBack();
      setC(r.conversation);
      toast(open ? "Link is open" : "Link is closed");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    }
  };

  return (
    <div className="pb-28 lg:pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <button aria-label="Back" onClick={onBack} className="rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xl font-bold leading-tight">{c?.name || "…"}</p>
          {c && (
            <p className="text-xs text-[var(--muted)]">
              {c.counts.done} completed · {c.counts.total} started
            </p>
          )}
        </div>
        <button aria-label="Refresh" onClick={load} className="rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </header>

      {!c && <Loader2 className="mx-auto mt-16 h-7 w-7 animate-spin text-[var(--teal)]" />}
      {c && (
        <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
          <ShareCard conv={c} toast={toast} onToggle={() => setStatus(c.status !== "Open")} />

          <div role="tablist" className="grid grid-cols-2 rounded-xl bg-[var(--line)]/60 p-1">
            {(["people", "insights"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${tab === k ? "bg-[var(--surface)] shadow" : "text-[var(--muted)]"}`}
              >
                {k === "people" ? `People (${c.counts.total})` : "Insights"}
              </button>
            ))}
          </div>

          {tab === "people" && <PeopleList conv={c} onOpen={onOpen} />}
          {tab === "insights" && !c.cfg.evaluate && (
            <ImpactCard adminKey={adminKey} toast={toast} conv={c.id} forFunders={c.cfg.type === "beneficiary"} className="" />
          )}
          {tab === "insights" && <InsightsPanel adminKey={adminKey} conv={c} toast={toast} />}

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-[15px] font-bold">Questions</h2>
              <button onClick={() => onEdit(c)} className="flex items-center gap-1.5 text-sm font-semibold text-[var(--teal)]">
                <Pencil className="h-4 w-4" /> Edit
              </button>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{c.cfg.objective}</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
              {c.cfg.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
            {(c.cfg.knowledge || (c.cfg.docs || []).length > 0) && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--muted)]">
                <BookText className="h-4 w-4" /> Knows: {[c.cfg.knowledge ? "your notes" : "", ...(c.cfg.docs || []).map((d) => d.name)].filter(Boolean).join(", ")}
              </p>
            )}
            {c.cfg.evaluate && (
              <p className="mt-3 text-sm">
                <b>Assessed on:</b> {c.cfg.criteria.join(", ")}
              </p>
            )}
            <button onClick={() => setStatus(false, true)} className="mt-4 text-sm text-[var(--muted)] underline-offset-4 hover:underline">
              Archive this brief
            </button>
          </section>
        </main>
      )}
    </div>
  );
}

function ShareCard({ conv, toast, onToggle }: { conv: Conv; toast: (t: string) => void; onToggle: () => void }) {
  const [qr, setQr] = useState("");
  const [showQr, setShowQr] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(conv.link, { margin: 1, width: 640, color: { dark: "#0B1F44", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [conv.link]);
  const open = conv.status === "Open";
  const message = `${conv.name}\n\n${conv.cfg.intro}\n${conv.link}`;
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold">Link to share</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <span className={open ? "font-semibold text-[var(--teal)]" : "text-[var(--muted)]"}>{open ? "Open" : "Closed"}</span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--teal)]" checked={open} onChange={onToggle} aria-label="Link open" />
        </label>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]">{conv.link}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => navigator.clipboard?.writeText(conv.link).then(() => toast("Link copied"))}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] px-2 py-2.5 text-sm font-semibold transition hover:border-[var(--teal)]"
        >
          <Copy className="h-4 w-4" /> Copy
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-2 py-2.5 text-sm font-semibold text-[#073B2A]"
        >
          <MessageCircle className="h-4 w-4" /> Share
        </a>
        <button
          onClick={() => setShowQr((v) => !v)}
          aria-expanded={showQr}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] px-2 py-2.5 text-sm font-semibold transition hover:border-[var(--teal)]"
        >
          QR code
        </button>
      </div>
      {showQr && qr && (
        <div className="mt-3 flex flex-col items-center rounded-xl bg-[var(--bg)] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code for ${conv.name}`} className="h-44 w-44 rounded-lg bg-white p-2" />
          <a href={qr} download={`${conv.name} QR.png`} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--teal)]">
            <Download className="h-4 w-4" /> Download for posters
          </a>
        </div>
      )}
    </section>
  );
}

function resultChip(r: Resp) {
  const a = r.analysis;
  if (a?.recommendation) {
    const tone = /Strong yes|^Yes/.test(a.recommendation) ? "bg-[var(--teal-soft)] text-[var(--teal)]" : a.recommendation === "Maybe" ? "bg-[var(--gold-soft)] text-[#7D5A1E]" : "bg-[var(--alert-soft)] text-[var(--alert)]";
    return { text: `${a.recommendation}${a.average ? " · " + a.average + "/5" : ""}`, tone };
  }
  if (a?.sentiment) {
    const tone = a.sentiment === "positive" ? "bg-[var(--teal-soft)] text-[var(--teal)]" : a.sentiment === "negative" ? "bg-[var(--alert-soft)] text-[var(--alert)]" : "bg-[var(--gold-soft)] text-[#7D5A1E]";
    return { text: a.sentiment[0].toUpperCase() + a.sentiment.slice(1), tone };
  }
  if (/^Completed|^Stopped/.test(r.status)) return { text: "Summary coming", tone: "bg-[var(--bg)] text-[var(--muted)]" };
  return { text: r.status === "Started" || r.status === "Consent given" ? "Not started talking" : r.status, tone: "bg-[var(--bg)] text-[var(--muted)]" };
}

function PeopleList({ conv, onOpen }: { conv: Conv; onOpen: (r: Resp) => void }) {
  const list = conv.responses || [];
  const sorted = useMemo(() => {
    if (!conv.cfg.evaluate) return list;
    return list.slice().sort((a, b) => (b.analysis?.average || 0) - (a.analysis?.average || 0));
  }, [list, conv.cfg.evaluate]);
  if (!list.length)
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
        Nobody has taken part yet. Share the link above.
      </p>
    );
  return (
    <ul className="space-y-2">
      {sorted.map((r) => {
        const chip = resultChip(r);
        return (
          <li key={r.id}>
            <button
              onClick={() => onOpen(r)}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[var(--teal)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="block truncate text-xs text-[var(--muted)]">{r.summary || [when(r.started), r.minutes ? `${r.minutes} min` : ""].filter(Boolean).join(" · ")}</span>
              </span>
              <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.tone}`}>{chip.text}</span>
              <ChevronRight className="h-4 w-4 flex-none text-[var(--muted)]" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function InsightsPanel({ adminKey, conv, toast }: { adminKey: string; conv: Conv; toast: (t: string) => void }) {
  const [ins, setIns] = useState<Insights | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    storyAdmin<{ insights: Insights | null }>("convInsights", adminKey, { id: conv.id }, 60000)
      .then((r) => setIns(r.insights))
      .catch(() => setIns(null));
  }, [adminKey, conv.id]);

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await storyAdmin<{ insights: Insights }>("convInsights", adminKey, { id: conv.id, refresh: true }, 150000);
      setIns(r.insights);
      toast("Insights updated");
    } catch (e) {
      // Google sometimes loses the reply although the work finished: read what was saved.
      try {
        const r = await storyAdmin<{ insights: Insights | null }>("convInsights", adminKey, { id: conv.id }, 60000);
        if (r.insights && ins && r.insights.at !== ins.at) setIns(r.insights);
        else alert(String((e as Error)?.message || e));
      } catch {
        alert(String((e as Error)?.message || e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--muted)]">
          {ins ? `Based on ${ins.people} ${ins.people === 1 ? "person" : "people"} · ${when(ins.at)}` : conv.counts.analysed ? "Patterns across everyone who took part." : "Insights appear once conversations are summarised."}
        </p>
        <button
          onClick={refresh}
          disabled={busy || !conv.counts.analysed}
          className="flex flex-none items-center gap-2 rounded-lg bg-[var(--navy)] px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {ins ? "Update" : "Create insights"}
        </button>
      </div>
      {ins === undefined && <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--teal)]" />}
      {ins && (
        <>
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="font-heading text-[15px] font-bold">Overview</h3>
            <p className="mt-2 text-[15px] leading-relaxed">{ins.overview}</p>
          </section>
          {ins.themes.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <h3 className="font-heading text-[15px] font-bold">Themes</h3>
              <ul className="mt-3 space-y-3">
                {ins.themes
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((t, i) => (
                    <li key={i}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">{t.theme}</span>
                        <span className="flex-none text-xs tabular-nums text-[var(--muted)]">
                          {t.count} of {ins.people}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg)]">
                        <div className="h-full rounded-full bg-[var(--teal)]" style={{ width: `${Math.min(100, (t.count / Math.max(1, ins.people)) * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">{t.detail}</p>
                    </li>
                  ))}
              </ul>
            </section>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <ListCard title="What people liked" items={ins.praise} />
            <ListCard title="Concerns" items={ins.concerns} />
            <ListCard title="Suggestions" items={ins.suggestions} />
            <ListCard title="Suggested next steps" items={ins.actions} />
          </div>
          {ins.quotes.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <h3 className="font-heading text-[15px] font-bold">In their words</h3>
              <ul className="mt-3 space-y-3">
                {ins.quotes.map((q, i) => (
                  <li key={i} className="border-l-4 border-[var(--gold)] pl-3 text-[15px] italic">
                    “{q.quote}” <span className="not-italic text-[var(--muted)]">— {q.person}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="font-heading text-[15px] font-bold">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </section>
  );
}

// ---------- one person ----------

interface RespFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  created: string;
}

function RespDetail({ adminKey, id, onBack, toast }: { adminKey: string; id: string; onBack: () => void; toast: (t: string) => void }) {
  const [r, setR] = useState<Resp | null>(null);
  const [files, setFiles] = useState<RespFile[]>([]);
  const [work, setWork] = useState("");
  const load = useCallback(() => {
    storyAdmin<{ response: Resp; files: RespFile[] }>("convResponse", adminKey, { id }, 90000)
      .then((x) => {
        setR(x.response);
        setFiles(x.files);
      })
      .catch(() => toast("Couldn't load. Try again."));
  }, [adminKey, id, toast]);
  useEffect(() => load(), [load]);

  const summarise = async () => {
    setWork("Writing the summary… about a minute.");
    try {
      await storyAdmin("convAnalyse", adminKey, { id });
      const until = Date.now() + 10 * 60 * 1000;
      while (Date.now() < until) {
        await new Promise((res) => setTimeout(res, 8000));
        let j: { job: { state: string; error?: string } | null };
        try {
          j = await storyAdmin("storyJob", adminKey, { id });
        } catch {
          continue;
        }
        if (j.job?.state === "done") {
          load();
          toast("Summary ready");
          return;
        }
        if (j.job?.state === "failed") {
          alert("Could not write the summary: " + (j.job.error || "unknown problem"));
          return;
        }
      }
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setWork("");
    }
  };

  const a = r?.analysis;
  const transcript = files.find((f) => / - careful transcript /.test(f.name)) || files.find((f) => / - transcript .*\.txt$/.test(f.name));
  const recording = files.find((f) => / - video /.test(f.name) && f.mime.startsWith("video/")) || files.find((f) => / - audio /.test(f.name));

  return (
    <div className="pb-28 lg:pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <button aria-label="Back" onClick={onBack} className="rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xl font-bold leading-tight">{r?.name || "…"}</p>
          {r && (
            <p className="truncate text-xs text-[var(--muted)]">
              {[when(r.started), r.minutes ? `${r.minutes} min` : "", r.language, r.phone].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </header>
      {!r && <Loader2 className="mx-auto mt-16 h-7 w-7 animate-spin text-[var(--teal)]" />}
      {r && (
        <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
          {!a && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[15px]">
                {/^Completed|^Stopped/.test(r.status) ? "The summary is written automatically after the conversation." : `Status: ${r.status}.`}
              </p>
              {/^Completed|^Stopped/.test(r.status) && (
                <button onClick={summarise} disabled={!!work} className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {work ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {work || "Write the summary now"}
                </button>
              )}
            </section>
          )}

          {a && (
            <>
              <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="flex-1 font-heading text-[15px] font-bold">Summary</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${resultChip(r).tone}`}>{resultChip(r).text}</span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed">{a.summary}</p>
                {a.follow_up && <p className="mt-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm text-[#7D5A1E]">Follow up: {a.follow_up}</p>}
              </section>

              {a.criteria && a.criteria.length > 0 && (
                <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                  <h2 className="font-heading text-[15px] font-bold">Assessment</h2>
                  <p className="text-xs text-[var(--muted)]">An AI suggestion from what the candidate said. The decision is yours.</p>
                  <ul className="mt-3 space-y-3">
                    {a.criteria.map((c, i) => (
                      <li key={i}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{c.criterion}</span>
                          <span className="flex gap-1" aria-label={`${c.score} out of 5`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className={`h-2.5 w-5 rounded-full ${n <= c.score ? "bg-[var(--teal)]" : "bg-[var(--line)]"}`} />
                            ))}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--muted)]">{c.evidence}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <ListCard title="Strengths" items={a.strengths || []} />
                    <ListCard title="To probe next round" items={a.gaps || []} />
                  </div>
                  {a.candidate_questions && a.candidate_questions.length > 0 && <div className="mt-4"><ListCard title="Their questions for you" items={a.candidate_questions} /></div>}
                </section>
              )}

              <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <h2 className="font-heading text-[15px] font-bold">Answers</h2>
                <ol className="mt-3 space-y-4">
                  {a.answers.map((x, i) => (
                    <li key={i}>
                      <p className="text-[13px] font-semibold text-[var(--muted)]">
                        {i + 1}. {x.question}
                      </p>
                      <p className="mt-1 text-[15px]">{x.answer}</p>
                      {x.quote && <p className="mt-1.5 border-l-4 border-[var(--gold)] pl-3 text-sm italic">“{x.quote}”</p>}
                    </li>
                  ))}
                </ol>
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <ListCard title="Suggestions" items={a.suggestions} />
                <ListCard title="Concerns" items={a.concerns} />
                <ListCard title="Questions to answer" items={a.unanswered || []} />
              </div>
            </>
          )}

          {recording && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <h2 className="font-heading text-[15px] font-bold">Recording</h2>
              <iframe
                src={`https://drive.google.com/file/d/${recording.id}/preview`}
                allow="autoplay"
                title="Recording"
                className={`mt-3 w-full rounded-lg bg-black ${recording.mime.startsWith("video/") ? "aspect-video" : "h-24"}`}
              />
              <p className="mt-2 text-xs text-[var(--muted)]">If it asks you to sign in, use the Google account that holds the Players Impact Stories folder.</p>
            </section>
          )}
          {transcript && <Transcript adminKey={adminKey} respId={r.id} fileId={transcript.id} name={r.name} />}
          <TechLog adminKey={adminKey} respId={r.id} />
          {a && (
            <button onClick={summarise} disabled={!!work} className="w-full py-2 text-sm font-semibold text-[var(--teal)] disabled:opacity-60">
              {work || "Write the summary again"}
            </button>
          )}
        </main>
      )}
    </div>
  );
}

/** What the person's phone reported (microphone, connection), for conversations that stopped early. */
function TechLog({ adminKey, respId }: { adminKey: string; respId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!open || text !== null) return;
    storyAdmin<{ text: string }>("convLog", adminKey, { id: respId }, 60000)
      .then((r) => setText(r.text || ""))
      .catch(() => setText(""));
  }, [open, text, adminKey, respId]);
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between p-4 text-left" aria-expanded={open}>
        <span>
          <span className="block font-heading text-[15px] font-bold">Technical log</span>
          <span className="block text-xs text-[var(--muted)]">What their phone reported, such as the microphone or connection. Useful when someone got stuck.</span>
        </span>
        <ChevronDown className={`h-5 w-5 flex-none transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--line)] p-4">
          {text === null ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--teal)]" />
          ) : text ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--muted)]">{text}</pre>
          ) : (
            <p className="text-sm text-[var(--muted)]">Nothing was reported.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Transcript({ adminKey, respId, fileId, name }: { adminKey: string; respId: string; fileId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);
  useEffect(() => {
    if (!open || lines) return;
    storyAdmin<{ text: string }>("convText", adminKey, { id: respId, fileId }, 60000)
      .then((r) => setLines(parseConversation(r.text)))
      .catch(() => setLines([]));
  }, [open, lines, adminKey, respId, fileId]);
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between p-4 text-left" aria-expanded={open}>
        <span className="font-heading text-[15px] font-bold">The whole conversation</span>
        <ChevronDown className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-[var(--line)] p-4">
          {!lines && <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--teal)]" />}
          {lines && !lines.length && <p className="text-sm text-[var(--muted)]">Not available.</p>}
          {lines?.map((l, i) => (
            <div key={i} className={`flex ${l.who === "maitri" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                  l.who === "maitri" ? "rounded-tl-sm bg-[var(--teal-soft)]" : "rounded-tr-sm bg-[var(--navy)] text-white"
                }`}
              >
                <p className={`mb-0.5 text-[11px] font-bold ${l.who === "maitri" ? "text-[var(--teal)]" : "text-white/60"}`}>{l.who === "maitri" ? "Myithri" : name}</p>
                {l.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
