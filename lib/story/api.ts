/**
 * Client for the DMSA Player Stories backend (a Google Apps Script web app that
 * runs in Shiva's Google account and stores everything in his Drive).
 *
 * Requests are sent as text/plain so the browser treats them as "simple" CORS
 * requests; Apps Script cannot answer a CORS preflight.
 */

export const STORY_API_URL =
  "https://script.google.com/macros/s/AKfycbxr3rMvC4RcSpfFYnPYYQnFPCjNb-bzSxyc4pS4ZRBnI44Zc6LP_hu8GiQAMg2Ept_y/exec";

export class StoryApiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export async function storyApi<T = Record<string, unknown>>(
  action: string,
  body: Record<string, unknown>,
  tries = 3,
  timeoutMs = 25000,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      // Apps Script can hang on a bad mobile connection; never wait forever.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(STORY_API_URL, {
        method: "POST",
        body: JSON.stringify({ action, ...body }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      let data;
      try {
        data = await res.json();
      } catch {
        // Google sometimes sends an error page instead of our answer.
        throw new Error("Google didn't answer properly. Please try again in a moment.");
      }
      // Google occasionally answers a POST with the web app's GET reply
      // ({ service: ... }); that is not our answer, so try again.
      if (data && data.service && !("error" in data) && action !== "ping") throw new Error("wrong reply from Google, retrying");
      if (!data.ok) throw new StoryApiError(String(data.error || "error"));
      return data as T;
    } catch (e) {
      lastErr = e;
      // Server-side answers ("unknown_code", quota...) will not change on retry.
      if (e instanceof StoryApiError) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Fire-and-forget save that survives the page closing (used on tab hide). */
export function storyBeacon(action: string, body: Record<string, unknown>) {
  try {
    const blob = new Blob([JSON.stringify({ action, ...body })], { type: "text/plain" });
    navigator.sendBeacon?.(STORY_API_URL, blob);
  } catch {
    // best effort only
  }
}

/**
 * Technical diagnostics (camera, audio, connection steps) saved to the player's
 * Drive folder, so problems on a player's phone can be traced afterwards.
 */
const pendingLog: string[] = [];
let logCode = "";
let logTimer: ReturnType<typeof setTimeout> | null = null;

export function storyLog(code: string, event: string) {
  logCode = code;
  const t = new Date().toTimeString().slice(0, 8);
  pendingLog.push(`${t} ${event}`);
  // Batched every 8 seconds to keep traffic to the backend low; errors and
  // page hides flush immediately (see flushStoryLog callers).
  if (!logTimer) logTimer = setTimeout(() => flushStoryLog(), 8000);
}

export function flushStoryLog(beacon = false) {
  if (logTimer) clearTimeout(logTimer);
  logTimer = null;
  if (!pendingLog.length || !logCode) return;
  const body = { code: logCode, events: pendingLog.splice(0), userAgent: navigator.userAgent };
  if (beacon) storyBeacon("log", body);
  // One try with a long wait: retrying a slow-but-successful save only duplicates it.
  else storyApi("log", body, 1, 45000).catch(() => storyBeacon("log", body));
}

/** Calls the admin API with the private key from Shiva's app link. */
// Admin calls that only read (or are safe to repeat) are retried when
// Google's reply goes missing; changes are sent once.
const SAFE_TO_REPEAT = new Set(["list", "files", "media", "text", "blob", "storyPages", "registrations", "autoStories", "diagnostics", "fileData", "storyStart", "storyJob", "health", "convList", "convGet", "convTemplates", "convResponse", "convText", "convAnalyse", "convStatus", "convSave", "convTidy", "convDocRemove", "update", "approve", "markSent"]);

export function storyAdmin<T = Record<string, unknown>>(op: string, key: string, body: Record<string, unknown> = {}, timeoutMs = 60000) {
  return storyApi<T>("admin", { op, key, ...body }, SAFE_TO_REPEAT.has(op) ? 3 : 1, timeoutMs);
}
