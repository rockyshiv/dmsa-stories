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
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      // Apps Script can hang on a bad mobile connection; never wait forever.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(STORY_API_URL, {
        method: "POST",
        body: JSON.stringify({ action, ...body }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      const data = await res.json();
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
  if (!logTimer) logTimer = setTimeout(() => flushStoryLog(), 1500);
}

export function flushStoryLog(beacon = false) {
  if (logTimer) clearTimeout(logTimer);
  logTimer = null;
  if (!pendingLog.length || !logCode) return;
  const body = { code: logCode, events: pendingLog.splice(0), userAgent: navigator.userAgent };
  if (beacon) storyBeacon("log", body);
  else storyApi("log", body, 2).catch(() => storyBeacon("log", body));
}
