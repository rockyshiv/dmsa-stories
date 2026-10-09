"use client";

import { useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { storyAdmin } from "@/lib/story/api";

/**
 * "Report a problem" on anything Myithri's AI wrote (stories, summaries,
 * insights, reports). Google Play asks apps that make AI content to let people
 * flag it from inside the app; reports go to the control Sheet for Auraclusive.
 */

const REASONS = [
  "Wrong or made-up facts",
  "Offensive or harmful",
  "Shows private details it shouldn't",
  "Something else",
];

export function ReportContent({
  adminKey,
  what,
  id,
  toast,
  className = "",
  dark,
}: {
  adminKey: string;
  /** What is being reported, in words: "Story", "Conversation summary", ... */
  what: string;
  /** The player, conversation or brief it belongs to. */
  id: string;
  toast: (t: string) => void;
  className?: string;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await storyAdmin("report", adminKey, { what, id, reason, note: note.trim().slice(0, 1000) }, 60000);
      setOpen(false);
      setNote("");
      toast("Thanks - reported. Auraclusive will look at it.");
    } catch (err) {
      alert(String((err as Error)?.message || err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[13px] font-semibold underline-offset-4 hover:underline ${dark ? "text-white/80" : "text-[var(--muted)]"} ${className}`}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden /> Report a problem
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => !sending && setOpen(false)}>
          <form
            onSubmit={send}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-5 text-left text-[var(--ink)] shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 id="report-title" className="font-heading text-lg font-bold">
                  Report a problem
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{what} written by Myithri&apos;s AI. Tell us what&apos;s wrong and we&apos;ll check it.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--bg)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">What&apos;s wrong</legend>
              {REASONS.map((r) => (
                <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-[15px] ${reason === r ? "border-[var(--teal)] bg-[var(--teal-soft)]/50" : "border-[var(--line)]"}`}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--teal)]" />
                  {r}
                </label>
              ))}
            </fieldset>
            <label className="mt-4 block">
              <span className="text-[13px] font-semibold">Details (optional)</span>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base outline-none focus:border-[var(--teal)]"
              />
            </label>
            <button type="submit" disabled={sending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-3 font-semibold text-white disabled:opacity-60">
              {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send report
            </button>
          </form>
        </div>
      )}
    </>
  );
}
