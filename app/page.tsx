"use client";

import { useSyncExternalStore } from "react";
import InterviewApp from "@/components/InterviewApp";
import ConversationApp from "@/components/ConversationApp";

// Player story links: .../dmsa-stories/?c=K7M2QX9P
// Conversation links (feedback, interviews...): .../dmsa-stories/?u=U1AB2CD3
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
  if (link === null) return null;
  const value = link.slice(2);
  if (link.startsWith("u:")) return <ConversationApp code={value} />;
  return <InterviewApp code={value || "MISSING"} />;
}
