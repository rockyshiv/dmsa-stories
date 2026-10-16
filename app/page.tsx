"use client";

import { useSyncExternalStore } from "react";
import InterviewApp from "@/components/InterviewApp";
import ConversationApp from "@/components/ConversationApp";
import { SafeParticipantPage } from "@/components/SafePage";

// Player story links: https://myithri.auraclusive.com/?c=K7M2QX9P
// Conversation links (feedback, interviews...): https://myithri.auraclusive.com/?u=U1AB2CD3
function readLink() {
  const q = new URLSearchParams(window.location.search);
  const u = (q.get("u") || "").trim().toUpperCase();
  if (u) return `u:${u}`;
  return `c:${(q.get("c") || "").trim().toUpperCase()}`;
}

export default function Page() {
  const link = useSyncExternalStore(
    () => () => {},
    readLink,
    () => null,
  );
  // Shown at once (it is in the page itself), while the page's code is still downloading on slow phones.
  if (link === null)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#081733] px-6 text-center text-white" aria-busy="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/myithri-small.webp`} alt="" width={96} height={96} className="h-24 w-24 rounded-full bg-[#f3ece4] object-cover" />
        <p className="text-lg font-semibold">Myithri is getting ready…</p>
        <p className="text-sm text-white/70">ಮೈತ್ರಿ ಸಿದ್ಧವಾಗುತ್ತಿದ್ದಾರೆ… · मैत्री तैयार हो रही हैं…</p>
      </main>
    );
  const value = link.slice(2);
  if (link.startsWith("u:"))
    return (
      <SafeParticipantPage code="">
        <ConversationApp code={value} />
      </SafeParticipantPage>
    );
  return (
    <SafeParticipantPage code={value || "MISSING"}>
      <InterviewApp code={value || "MISSING"} />
    </SafeParticipantPage>
  );
}
