"use client";

import { useSyncExternalStore } from "react";
import InterviewApp from "@/components/InterviewApp";
import RegistrationApp from "@/components/RegistrationApp";

// Player story links: .../dmsa-stories/?c=K7M2QX9P
// Open registration links: .../dmsa-stories/?r=KWPL4
function readLink() {
  const q = new URLSearchParams(window.location.search);
  const r = (q.get("r") || "").trim().toUpperCase();
  if (r) return `r:${r}`;
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
  if (link.startsWith("r:")) return <RegistrationApp campaign={value} />;
  return <InterviewApp code={value || "MISSING"} />;
}
