"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, Download, Loader2, Pencil, RefreshCw, Share2 } from "lucide-react";
import { storyAdmin } from "@/lib/story/api";
import { download, GImg } from "@/components/AdminMedia";

/**
 * The impact report: one PDF for donors and CSR partners, made from every
 * finished story (Impact.gs). It takes a few minutes, so it is made in the
 * background and this card checks back.
 */

interface ImpactJob {
  state: "queued" | "writing" | "done" | "failed";
  lang: string;
  note?: string;
  error?: string;
  at: string;
}

interface ImpactReport {
  at: string;
  players: number;
  names: boolean;
  needsCheck: string[];
  deckUrl: string;
  pdf: { name: string; size: number };
  pages: string[];
}

interface ImpactStatus {
  job: ImpactJob | null;
  stories: number;
  report: ImpactReport | null;
}

const busy = (j: ImpactJob | null) => !!j && (j.state === "queued" || j.state === "writing");

async function reportPdf(adminKey: string) {
  const r = await storyAdmin<{ name: string; mime: string; data: string }>("impactPdf", adminKey, {}, 120000);
  const bytes = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
  return new File([bytes], r.name, { type: "application/pdf" });
}

export function ImpactCard({ adminKey, toast }: { adminKey: string; toast: (t: string) => void }) {
  const [status, setStatus] = useState<ImpactStatus | null>(null);
  const [error, setError] = useState("");
  const [names, setNames] = useState(true);
  const [starting, setStarting] = useState(false);
  const [reading, setReading] = useState(false);
  const wasBusy = useRef(false);
  // The parent's toast changes on every render; keep the latest without reloading.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const load = useCallback(async () => {
    try {
      const s = await storyAdmin<ImpactStatus>("impactStatus", adminKey, { pages: "first" }, 90000);
      setStatus(s);
      setError("");
      if (s.report) setNames(s.report.names !== false);
      if (wasBusy.current && !busy(s.job) && s.job?.state === "done") toastRef.current("Impact report ready");
      wasBusy.current = busy(s.job);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  // While a report is being made, check back every few seconds.
  useEffect(() => {
    if (!busy(status?.job ?? null)) return;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [status?.job, load]);

  const start = async () => {
    setStarting(true);
    try {
      const s = await storyAdmin<ImpactStatus>("impactStart", adminKey, { names }, 60000);
      wasBusy.current = true;
      setStatus((old) => ({ ...s, report: s.report ? { ...s.report, pages: old?.report?.pages || [] } : null }));
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setStarting(false);
    }
  };

  if (!status) {
    return (
      <section className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
        {error ? (
          <>
            <AlertTriangle className="h-5 w-5 flex-none text-[var(--alert)]" /> Couldn&apos;t check the impact report.
            <button onClick={load} className="ml-auto font-semibold text-[var(--teal)]">
              Try again
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Checking the impact report...
          </>
        )}
      </section>
    );
  }

  const { job, report, stories } = status;
  const working = busy(job);
  const newStories = report ? stories - report.players : 0;
  const when = report ? new Date(report.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_40px_-28px_rgba(11,31,68,0.55)]">
      <div className="flex gap-4 p-5">
        <button
          onClick={() => report && setReading(true)}
          disabled={!report}
          aria-label="Read the impact report"
          className="relative aspect-[1/1.414] w-24 flex-none overflow-hidden rounded-md bg-[var(--navy)] ring-1 ring-[var(--line)] sm:w-28"
        >
          {report?.pages[0] ? (
            <GImg src={report.pages[0]} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <BarChart3 className="absolute inset-0 m-auto h-8 w-8 text-[var(--teal-bright)]" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--teal)]">For donors and CSR partners</p>
          <h2 className="mt-0.5 font-heading text-lg font-bold">Impact report</h2>
          {report ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Made from {report.players} stories · {when}
              {newStories > 0 && !working && (
                <span className="mt-1 block font-semibold text-[#7D5A1E]">
                  {newStories} new {newStories === 1 ? "story" : "stories"} since. Update it to include them.
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted)]">
              One PDF from all {stories} stories: what changed for your players, in numbers anyone can check and in their own words.
            </p>
          )}

          {working ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-[var(--teal-soft)] p-3 text-sm" role="status">
              <Loader2 className="mt-0.5 h-4 w-4 flex-none animate-spin text-[var(--teal)]" />
              <span>
                <span className="font-semibold">{job?.note || "Working"}...</span>
                <span className="block text-[var(--muted)]">This takes about 5 minutes. You can leave this page; it carries on.</span>
              </span>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {report && (
                <button onClick={() => setReading(true)} className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white">
                  Read
                </button>
              )}
              <button
                onClick={start}
                disabled={starting || stories < 3}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
                  report ? "border border-[var(--line)] text-[var(--ink)]" : "bg-[var(--navy)] text-white"
                }`}
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : report ? <RefreshCw className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                {report ? "Update" : "Make the impact report"}
              </button>
            </div>
          )}
          {!working && (
            <label className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
              <input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} className="h-4 w-4 accent-[var(--teal)]" />
              Show players&apos; names and photos{report && names !== report.names ? " (tap Update to apply)" : ""}
            </label>
          )}
        </div>
      </div>

      {job?.state === "failed" && !working && (
        <p className="flex gap-2 border-t border-[var(--line)] bg-[var(--alert-soft)] px-5 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-[var(--alert)]" />
          <span>The last try didn&apos;t finish: {job.error || "unknown problem"}. Please try again.</span>
        </p>
      )}
      {report && report.needsCheck.length > 0 && !working && (
        <details className="border-t border-[var(--line)] bg-[var(--gold-soft)] px-5 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-[#7D5A1E]">Check {report.needsCheck.length} {report.needsCheck.length === 1 ? "thing" : "things"} before sharing</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--ink)]">
            {report.needsCheck.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </details>
      )}

      {reading && report && <ImpactReader adminKey={adminKey} report={report} onClose={() => setReading(false)} toast={toast} />}
    </section>
  );
}

function ImpactReader({ adminKey, report, onClose, toast }: { adminKey: string; report: ImpactReport; onClose: () => void; toast: (t: string) => void }) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [work, setWork] = useState("");

  useEffect(() => {
    let alive = true;
    storyAdmin<ImpactStatus>("impactStatus", adminKey, { pages: "all" }, 120000)
      .then((s) => alive && setPages(s.report?.pages || []))
      .catch(() => alive && setPages([]));
    return () => {
      alive = false;
    };
  }, [adminKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const share = async () => {
    setWork("share");
    try {
      const file = await reportPdf(adminKey);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, "") }).catch(() => {});
      } else {
        download(file);
        toast("PDF downloaded");
      }
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setWork("");
    }
  };

  const save = async () => {
    setWork("download");
    try {
      download(await reportPdf(adminKey));
      toast("PDF downloaded");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setWork("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1b2433]" role="dialog" aria-modal="true" aria-label="Impact report">
      <header className="flex items-center gap-3 bg-[var(--navy)] px-3 py-2.5 text-white">
        <button onClick={onClose} aria-label="Close report" className="rounded-full bg-white/10 p-2.5 hover:bg-white/20">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-[16px] font-bold leading-tight">Impact report</p>
          <p className="text-xs text-white/60">Made from {report.players} stories</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <div className="mx-auto max-w-3xl space-y-4">
          {!pages && [0, 1].map((i) => <div key={i} className="aspect-[1/1.414] w-full animate-pulse rounded-md bg-white/10" />)}
          {pages && !pages.length && <p className="py-20 text-center text-white/70">The pages couldn&apos;t be shown. Use Share or Download for the PDF.</p>}
          {pages?.map((src, i) => (
            <GImg key={src} src={src} alt={`Page ${i + 1}`} className="w-full rounded-md bg-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]" />
          ))}
        </div>
      </div>

      <footer className="border-t border-white/10 bg-[var(--navy)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-3xl grid-cols-[1fr_auto_auto] gap-2">
          <button onClick={share} disabled={!!work} className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 font-semibold text-[#073B2A] disabled:opacity-60">
            {work === "share" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />} Share PDF
          </button>
          <button onClick={save} disabled={!!work} aria-label="Download PDF" className="flex items-center justify-center rounded-xl bg-white/10 px-4 text-white disabled:opacity-60">
            {work === "download" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </button>
          <a href={report.deckUrl} target="_blank" rel="noreferrer" aria-label="Edit in Google Slides" className="flex items-center justify-center rounded-xl bg-white/10 px-4 text-white">
            <Pencil className="h-5 w-5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
