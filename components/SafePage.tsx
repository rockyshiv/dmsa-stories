"use client";

import type { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { flushStoryLog, storyLog } from "@/lib/story/api";

/** The page people open from a link: if a screen breaks, a reload button in their languages, and a line in the technical log. */
export function SafeParticipantPage({ code, children }: { code: string; children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(e) => {
        if (!code || code === "MISSING") return;
        storyLog(code, "page error (screen): " + String(e?.message || e).slice(0, 200));
        flushStoryLog(true);
      }}
      fallback={() => (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#081733] px-6 text-center text-white">
          <p className="text-xl font-semibold">Something went wrong on this page.</p>
          <p className="text-white/80">ಪುಟದಲ್ಲಿ ಸಮಸ್ಯೆಯಾಗಿದೆ. · इस पेज में कुछ गड़बड़ हुई।</p>
          <button onClick={() => window.location.reload()} className="mt-2 rounded-xl bg-[#3CCDCD] px-6 py-3 text-lg font-semibold text-[#081733]">
            Reload · ಮರುಲೋಡ್ · फिर से खोलें
          </button>
        </main>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/** The organisation app: a broken screen offers Reload or a fresh start at Home instead of a blank page. */
export function SafeAdminPage({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={() => (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#EEF2F7] px-6 text-center text-[#0B1F44]">
          <p className="text-xl font-bold">Something went wrong on this screen.</p>
          <p className="max-w-sm text-[#5B6B85]">Your data is safe. Reload to try again, or go back to Home.</p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => window.location.reload()} className="rounded-xl bg-[#0B1F44] px-5 py-3 font-semibold text-white">
              Reload
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.setItem("dmsaAdminSection", "home");
                } catch {
                  /* reload still helps */
                }
                window.location.reload();
              }}
              className="rounded-xl border border-[#DCE3EE] bg-white px-5 py-3 font-semibold"
            >
              Go to Home
            </button>
          </div>
        </main>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
