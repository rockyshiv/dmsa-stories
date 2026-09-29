"use client";

import { useSyncExternalStore } from "react";
import InterviewApp from "@/components/InterviewApp";

// The player's code comes from the link: .../dmsa-stories/?c=K7M2QX9P
function readCode() {
  return (new URLSearchParams(window.location.search).get("c") || "").trim().toUpperCase();
}

export default function Page() {
  const code = useSyncExternalStore(
    () => () => {},
    readCode,
    () => null,
  );
  if (code === null) return null;
  return <InterviewApp code={code || "MISSING"} />;
}
