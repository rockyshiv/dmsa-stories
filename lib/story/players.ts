/**
 * Where a story player is in their journey, shared by the screens that list
 * players (Stories, People, Home).
 */

export interface PlayerLike {
  status: string;
  approved: boolean;
  updated: string;
  pdfEnUrl?: string;
  pronoun?: string;
  support?: string;
}

/** Where a player is, in words. */
export const STATUS_WORDS = ["Not invited yet", "Invited", "Opened the link", "Started the interview", "Interview done", "Story ready", "Story approved"];

/** How many of the six stages this player has completed (0-6). */
export function stageOf(p: Pick<PlayerLike, "status" | "approved">): number {
  const s = String(p.status || "");
  if (p.approved || /^Approved/.test(s)) return 6;
  if (/^Story|^Kannada/.test(s)) return 5;
  if (/^Interview done/.test(s)) return 4;
  if (/^Consent|in progress|incomplete/i.test(s)) return 3;
  if (/^Opened/.test(s)) return 2;
  if (/^Link sent/.test(s)) return 1;
  return 0;
}

/** Started but not finished, and nothing has happened for a day: worth a nudge. */
export function isStuck(p: PlayerLike): boolean {
  const st = stageOf(p);
  if (st < 1 || st > 3) return false;
  const t = Date.parse(p.updated);
  return !isNaN(t) && Date.now() - t > 20 * 3600 * 1000;
}

/** A story was written but the details only the organisation knows are still empty. */
export function missingDetails(p: PlayerLike): string[] {
  if (!p.pdfEnUrl) return [];
  const out: string[] = [];
  if (!String(p.pronoun || "").trim()) out.push("He/She");
  if (!String(p.support || "").trim()) out.push("Support received");
  return out;
}

export function ago(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function initials(name: string): string {
  const w = String(name || "").replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || "") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase() || "?";
}
