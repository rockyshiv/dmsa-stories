"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Mail, X } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/story/brand";
import type { Go, Section } from "@/components/AdminHome";

/**
 * A one-minute guided tour of the demo, told by Myithri herself, so an organisation
 * that opens the demo from auraclusive.com understands what the app does without help.
 * Each step opens a section and outlines the part it talks about (elements marked
 * data-tour="..."). The page stays usable underneath: nothing is dimmed or blocked.
 */

const SEEN = "myithriDemoTourSeen";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface Step {
  section: Section;
  target?: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    section: "home",
    title: "Hi, I'm Myithri",
    text: "I'm an AI voice assistant. I talk with the people your organisation serves, in Kannada, Hindi or English, and bring what they say back to this app. Let me show you around. It takes a minute.",
  },
  {
    section: "home",
    target: "stats",
    title: "Everything I heard, counted",
    text: "How many people I've talked with, for how long, and how many stories are written. Tap any number to see the people behind it.",
  },
  {
    section: "home",
    target: "needs",
    title: "What needs your team",
    text: "When someone asks a question I can't answer, or a story is ready for your OK, it lands here, so no one is forgotten.",
  },
  {
    section: "briefs",
    title: "Briefs: what I ask",
    text: "A brief is a short set of questions, like volunteer feedback or a check-in with families. You share one link on WhatsApp; people tap it and talk with me. Nothing to install.",
  },
  {
    section: "stories",
    title: "Stories from players",
    text: "Players tell me their journey in their own language. Each talk becomes an impact story in English and Kannada, with their photos. Tap a cover to read one.",
  },
  {
    section: "people",
    title: "Everyone, in one list",
    text: "A short summary of each talk, how the person felt, and who needs a call back. Call or WhatsApp them in one tap.",
  },
  {
    section: "reports",
    title: "Reports for funders",
    text: "Turn what people told me into a PDF for CSR partners and donors. Every number can be checked and every quote is in their own words. Try downloading the sample.",
  },
  {
    section: "home",
    title: "Your turn",
    text: "Look around as much as you like. The people here are made up, and nothing you change is saved. To set me up for your organisation, write to Auraclusive.",
  },
];

/** Whether this device has already finished or skipped the tour. */
export function demoTourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return false;
  }
}

export default function DemoTour({ go, onClose }: { go: Go; onClose: () => void }) {
  const [i, setI] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const close = () => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* shown again next visit, which is harmless */
    }
    onClose();
  };

  // Open the step's section, then outline and scroll to the part it talks about.
  useEffect(() => {
    go(step.section);
    headingRef.current?.focus();
    if (!step.target) return;
    let el: Element | null = null;
    const t = setTimeout(() => {
      el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) return;
      el.setAttribute("data-tour-on", "");
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
    }, 120);
    return () => {
      clearTimeout(t);
      el?.removeAttribute("data-tour-on");
    };
    // go changes every render of the dashboard; the step alone decides what to show
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      role="dialog"
      aria-labelledby="demo-tour-title"
      aria-describedby="demo-tour-text"
      className="fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--ink)] shadow-[0_22px_50px_-18px_rgba(11,31,68,0.55)] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[400px]"
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE}/myithri-small.webp`} alt="" className="h-10 w-10 flex-none rounded-full bg-[var(--teal-soft)] object-cover" />
        <p className="min-w-0 flex-1 text-[13px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">Myithri</span> · Tour {i + 1} of {STEPS.length}
        </p>
        <button onClick={close} aria-label="Close the tour" className="-mr-1.5 flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--bg)]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <h2 id="demo-tour-title" ref={headingRef} tabIndex={-1} className="mt-3 font-heading text-lg font-bold leading-snug outline-none">
        {step.title}
      </h2>
      <p id="demo-tour-text" className="mt-1.5 text-[15px] leading-relaxed text-[var(--ink)]/85">
        {step.text}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {STEPS.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-[var(--teal)]" : "w-1.5 bg-[var(--line)]"}`} />
          ))}
        </div>
        {last ? (
          <>
            <button onClick={close} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]">
              Explore on my own
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Myithri for our organisation")}`}
              onClick={close}
              className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy2)]"
            >
              <Mail className="h-4 w-4" /> Email us
            </a>
          </>
        ) : (
          <>
            {i > 0 && (
              <button onClick={() => setI(i - 1)} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] transition hover:border-[var(--teal)]">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setI(i + 1)} className="flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy2)]">
              {i === 0 ? "Show me" : "Next"} <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
