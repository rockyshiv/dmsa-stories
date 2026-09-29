"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { storyAdmin, StoryApiError } from "@/lib/story/api";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const KEY_STORE = "dmsaAdminKey";

export interface Player {
  id: string;
  name: string;
  callname: string;
  greet: string;
  phone: string;
  pronoun: string;
  hometown: string;
  language: string;
  joined: string;
  role: string;
  disability: string;
  achievements: string;
  support: string;
  work: string;
  notes: string;
  qr: string;
  code: string;
  link: string;
  status: string;
  consent: string;
  minutes: string | number;
  uploads: string;
  approved: boolean;
  updated: string;
  canWhatsApp: boolean;
  folderUrl: string;
  slidesUrl: string;
  pdfEnUrl: string;
  pdfKnUrl: string;
}

interface DriveFile {
  name: string;
  url: string;
  mime: string;
  size: number;
  created: string;
}

type Group = "all" | "toSend" | "sent" | "started" | "done" | "story";

const GROUPS: { id: Group; label: string }[] = [
  { id: "all", label: "All" },
  { id: "toSend", label: "To send" },
  { id: "sent", label: "Sent" },
  { id: "started", label: "Started" },
  { id: "done", label: "Done" },
  { id: "story", label: "Stories" },
];

function groupOf(status: string): Exclude<Group, "all"> {
  const s = String(status || "");
  if (/^Story|^Kannada|^Approved/.test(s)) return "story";
  if (/^Interview done/.test(s)) return "done";
  if (/^Consent|in progress|incomplete/i.test(s)) return "started";
  if (/^Link sent|^Opened/.test(s)) return "sent";
  return "toSend";
}

const GROUP_STYLE: Record<Exclude<Group, "all">, string> = {
  toSend: "bg-white/10 text-navy-100",
  sent: "bg-navy-500/40 text-navy-50",
  started: "bg-gold-500/30 text-gold-100",
  done: "bg-teal-500/30 text-teal-100",
  story: "bg-teal-400 text-navy-950",
};

// ---------- private key from the app link ----------

function readKey(): string | null {
  const m = window.location.hash.match(/k=([\w-]+)/);
  if (m) return m[1];
  try {
    return localStorage.getItem(KEY_STORE);
  } catch {
    return null;
  }
}

export default function AdminApp() {
  const key = useSyncExternalStore(
    () => () => {},
    readKey,
    () => undefined,
  );

  // Remember the key from the link, then drop it from the address bar.
  useEffect(() => {
    const m = window.location.hash.match(/k=([\w-]+)/);
    if (m) {
      try {
        localStorage.setItem(KEY_STORE, m[1]);
      } catch {
        /* private mode: the link keeps working */
      }
      history.replaceState(null, "", window.location.pathname);
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${BASE}/admin-sw.js`, { scope: `${BASE}/admin/` }).catch(() => {});
  }, []);

  if (key === undefined) return <Shell />;
  if (!key) {
    return (
      <Shell>
        <Center>
          <Logo />
          <p className="mt-8 max-w-sm text-center text-lg">Open the app with your private DMSA Player Stories link.</p>
          <p className="mt-2 max-w-sm text-center text-sm text-navy-200">It is the link Claude gave you (it ends with #k=…).</p>
        </Center>
      </Shell>
    );
  }
  return <Dashboard adminKey={key} />;
}

// ---------- dashboard ----------

function Dashboard({ adminKey }: { adminKey: string }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<Group>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    return storyAdmin<{ players: Player[] }>("list", adminKey)
      .then((r) => {
        setPlayers(r.players.filter((p) => !/\(test\)/i.test(p.name)));
        setError("");
      })
      .catch((e) => setError(e instanceof StoryApiError && e.code === "not_admin" ? "This app link is not valid any more." : String(e?.message || e)))
      .finally(() => setRefreshing(false));
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 3500);
  };

  const replace = (p: Player) => setPlayers((xs) => (xs ? xs.map((x) => (x.id === p.id ? p : x)) : xs));

  const counts = useMemo(() => {
    const c: Record<Group, number> = { all: 0, toSend: 0, sent: 0, started: 0, done: 0, story: 0 };
    (players || []).forEach((p) => {
      c.all++;
      c[groupOf(p.status)]++;
    });
    return c;
  }, [players]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (players || []).filter(
      (p) =>
        (group === "all" || groupOf(p.status) === group) &&
        (!q || `${p.name} ${p.callname} ${p.hometown} ${p.id} ${p.phone}`.toLowerCase().includes(q)),
    );
  }, [players, group, query]);

  const open = players?.find((p) => p.id === openId) || null;

  if (open) {
    return (
      <PlayerPage
        adminKey={adminKey}
        player={open}
        onBack={() => setOpenId(null)}
        onChange={replace}
        toast={showToast}
        toastText={toast}
      />
    );
  }
  if (adding) {
    return (
      <AddPlayer
        adminKey={adminKey}
        onBack={() => setAdding(false)}
        onAdded={(p) => {
          setPlayers((xs) => [...(xs || []), p]);
          setAdding(false);
          setOpenId(p.id);
        }}
      />
    );
  }

  return (
    <Shell>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-navy-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Logo small />
          <div>
            <p className="font-heading text-base font-bold leading-tight">Player Stories</p>
            <p className="text-xs text-navy-200">Maitri interviews</p>
          </div>
        </div>
        <button
          aria-label="Refresh"
          onClick={() => {
            setRefreshing(true);
            load();
          }}
          className="rounded-full bg-white/10 p-2.5"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </header>

      {!players && !error && (
        <Center>
          <Loader2 className="h-9 w-9 animate-spin text-teal-400" />
          <p className="mt-4 text-sm text-navy-200">Loading players…</p>
        </Center>
      )}
      {error && (
        <Center>
          <p className="max-w-sm text-center">{error}</p>
          <button className="mt-5 rounded-xl bg-teal-500 px-5 py-3 font-semibold" onClick={() => load()}>
            Try again
          </button>
        </Center>
      )}

      {players && (
        <main className="px-4 pb-28">
          {/* progress overview */}
          <section className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroup(g.id)}
                className={`rounded-2xl p-3 text-left transition ${group === g.id ? "bg-teal-500 text-white" : "bg-white/5"}`}
              >
                <p className="font-display text-3xl leading-none">{counts[g.id]}</p>
                <p className="mt-1 text-xs font-semibold opacity-80">{g.label}</p>
              </button>
            ))}
          </section>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" aria-label="Interviews done">
            <div
              className="h-full bg-teal-400"
              style={{ width: `${counts.all ? ((counts.done + counts.story) / counts.all) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-navy-200">
            {counts.done + counts.story} of {counts.all} interviews finished
          </p>

          <label className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5">
            <Search className="h-4 w-4 text-navy-200" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, district or ID"
              className="w-full bg-transparent text-base outline-none placeholder:text-navy-300"
            />
          </label>

          <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/5">
            {shown.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-3">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpenId(p.id)}>
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-navy-700 font-heading text-sm font-bold">
                    {(p.greet || p.name).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-navy-200">
                      {p.id} · {p.hometown || "—"}
                    </span>
                  </span>
                </button>
                <StatusChip status={p.status} />
                {groupOf(p.status) === "toSend" && p.canWhatsApp ? (
                  <SendButton adminKey={adminKey} player={p} onSent={replace} compact />
                ) : (
                  <ChevronRight className="h-5 w-5 flex-none text-navy-300" onClick={() => setOpenId(p.id)} />
                )}
              </li>
            ))}
            {!shown.length && <li className="px-4 py-8 text-center text-sm text-navy-200">No players here.</li>}
          </ul>
        </main>
      )}

      <button
        onClick={() => setAdding(true)}
        className="fixed bottom-6 right-5 flex items-center gap-2 rounded-full bg-teal-500 px-5 py-4 font-semibold shadow-xl shadow-black/40"
      >
        <Plus className="h-5 w-5" /> Add player
      </button>
    </Shell>
  );
}

// ---------- sending ----------

function SendButton({
  adminKey,
  player,
  onSent,
  compact,
}: {
  adminKey: string;
  player: Player;
  onSent: (p: Player) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    // Open the window inside the tap (browsers block pop-ups opened later),
    // then point it at WhatsApp once the personal message is ready.
    const w = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const r = await storyAdmin<{ url: string; player: Player }>("send", adminKey, { id: player.id });
      if (w) w.location.href = r.url;
      else window.location.href = r.url;
      onSent(r.player);
    } catch (e) {
      w?.close();
      alert(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };
  if (!player.canWhatsApp) return null;
  return (
    <button
      onClick={send}
      disabled={busy}
      className={`flex flex-none items-center justify-center gap-1.5 rounded-xl bg-[#25D366] font-semibold text-navy-950 disabled:opacity-60 ${
        compact ? "px-3 py-2 text-sm" : "w-full px-4 py-3.5 text-base"
      }`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
      {compact ? "Send" : groupOf(player.status) === "toSend" ? "Send on WhatsApp" : "Send again on WhatsApp"}
    </button>
  );
}

// ---------- one player ----------

const EDIT_FIELDS: { key: keyof Player; label: string; kind?: "text" | "area" | "pronoun" | "language"; hint?: string }[] = [
  { key: "callname", label: "Name to call them", hint: "Blank = first name. E.g. Praveen." },
  { key: "phone", label: "WhatsApp number" },
  { key: "pronoun", label: "He / She", kind: "pronoun" },
  { key: "language", label: "Interview language", kind: "language" },
  { key: "hometown", label: "Hometown / District" },
  { key: "joined", label: "Year joined DMSA" },
  { key: "role", label: "Playing role" },
  { key: "disability", label: "Disability (in their words)" },
  { key: "achievements", label: "Key achievements", kind: "area" },
  { key: "support", label: "DMSA support received", kind: "area", hint: "The ONLY source the story uses for what DMSA gave them." },
  { key: "work", label: "Job / education" },
  { key: "notes", label: "Notes for Maitri", kind: "area", hint: "Maitri reads this before the interview. The player never sees it." },
  { key: "qr", label: "QR video link (optional)", hint: "Blank = the interview video." },
];

function PlayerPage({
  adminKey,
  player,
  onBack,
  onChange,
  toast,
  toastText,
}: {
  adminKey: string;
  player: Player;
  onBack: () => void;
  onChange: (p: Player) => void;
  toast: (t: string) => void;
  toastText: string;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, String(player[f.key] ?? "")])),
  );
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<Record<string, DriveFile[]> | null>(null);
  const [work, setWork] = useState("");

  const dirty = EDIT_FIELDS.some((f) => (draft[f.key] ?? "") !== String(player[f.key] ?? ""));

  useEffect(() => {
    storyAdmin<{ files: Record<string, DriveFile[]> }>("files", adminKey, { id: player.id })
      .then((r) => setFiles(r.files))
      .catch(() => setFiles({}));
  }, [adminKey, player.id]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await storyAdmin<{ player: Player }>("update", adminKey, { id: player.id, fields: draft });
      onChange(r.player);
      toast("Saved");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const story = async (lang: "en" | "kn") => {
    if (
      lang === "en" &&
      !confirm(
        "Create " +
          player.name +
          "'s story? It takes 1-3 minutes.\n\nThe story's QR code links to their interview video, so that one video becomes viewable by anyone with the link (it is not listed or searchable).",
      )
    )
      return;
    setWork(lang === "en" ? "Writing the story… 1-3 minutes" : "Translating to Kannada… about a minute");
    try {
      const r = await storyAdmin<{ player: Player; needsCheck: string[] }>("story", adminKey, { id: player.id, lang }, 6.5 * 60 * 1000);
      onChange(r.player);
      toast(lang === "en" ? "Story ready" : "Kannada version ready");
      if (r.needsCheck?.length) alert("Please check these before sharing:\n\n- " + r.needsCheck.join("\n- "));
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setWork("");
    }
  };

  const refreshPdf = async () => {
    setWork("Updating PDFs from your edited Slides…");
    try {
      const r = await storyAdmin<{ player: Player; updated: string[] }>("refreshPdf", adminKey, { id: player.id }, 3 * 60 * 1000);
      onChange(r.player);
      toast(r.updated.length ? "Updated " + r.updated.join(", ") : "No story yet");
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setWork("");
    }
  };

  const approve = async (value: boolean) => {
    try {
      const r = await storyAdmin<{ player: Player }>("approve", adminKey, { id: player.id, value });
      onChange(r.player);
    } catch (e) {
      alert(String((e as Error)?.message || e));
    }
  };

  const interviewFiles = (files?.interview || []).filter((f) => !/^Consent/.test(f.name));
  const videos = interviewFiles.filter((f) => f.mime.startsWith("video/"));
  const texts = interviewFiles.filter((f) => /transcript.*\.txt$|careful transcript/.test(f.name));
  const photos = [...(files?.uploads || []), ...(files?.dmsa || [])];
  const hasInterview = /Interview done|incomplete|^Story|^Kannada|^Approved/.test(player.status) || videos.length > 0;
  const hasStory = !!player.pdfEnUrl;

  return (
    <Shell>
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-navy-950/95 px-3 py-3 backdrop-blur">
        <button aria-label="Back" onClick={onBack} className="rounded-full bg-white/10 p-2.5">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-bold">{player.name}</p>
          <p className="truncate text-xs text-navy-200">
            {player.id} · {player.hometown || "—"} · greeted as {player.greet}
          </p>
        </div>
        <StatusChip status={player.status} />
      </header>

      <main className="space-y-4 px-4 pb-32 pt-2">
        {/* invite */}
        <Card title="Invitation">
          <SendButton adminKey={adminKey} player={player} onSent={onChange} />
          {!player.canWhatsApp && <p className="text-sm text-gold-200">Add a 10-digit WhatsApp number below to send.</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SmallButton
              onClick={() => {
                navigator.clipboard?.writeText(player.link).then(() => toast("Link copied"));
              }}
              icon={<Copy className="h-4 w-4" />}
              label="Copy link"
            />
            <SmallLink href={player.folderUrl} icon={<FolderOpen className="h-4 w-4" />} label="Drive folder" />
          </div>
          {player.consent && <p className="mt-3 text-xs text-navy-200">Consent: {player.consent}</p>}
        </Card>

        {/* interview */}
        <Card title="Interview">
          {!files && <Loader2 className="h-5 w-5 animate-spin text-teal-400" />}
          {files && !hasInterview && <p className="text-sm text-navy-200">No interview yet.</p>}
          {files && hasInterview && (
            <>
              <p className="text-sm text-navy-100">
                {player.minutes ? `${player.minutes} min recorded` : "Recorded"} · {player.uploads || "no uploads yet"}
              </p>
              <div className="mt-3 space-y-2">
                {videos.map((f) => (
                  <FileRow key={f.url} file={f} icon={<Video className="h-4 w-4 text-teal-300" />} />
                ))}
                {texts.map((f) => (
                  <FileRow key={f.url} file={f} icon={<FileText className="h-4 w-4 text-teal-300" />} />
                ))}
              </div>
            </>
          )}
          {files && photos.length > 0 && (
            <p className="mt-3 text-sm text-navy-100">
              {photos.length} photo/video file{photos.length === 1 ? "" : "s"} in their folder{" "}
              <a className="text-teal-300 underline" href={player.folderUrl} target="_blank" rel="noreferrer">
                (open)
              </a>
            </p>
          )}
        </Card>

        {/* story */}
        <Card title="Impact story">
          {work ? (
            <div className="flex items-center gap-3 text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-teal-400" /> {work}
            </div>
          ) : (
            <>
              {!hasInterview && <p className="text-sm text-navy-200">Available after the interview.</p>}
              {hasInterview && !player.support && (
                <p className="mb-3 rounded-lg bg-gold-600/30 p-3 text-sm">
                  Tip: fill in &quot;DMSA support received&quot; below first, so the story can describe what DMSA gave {player.greet}.
                </p>
              )}
              {hasStory && (
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <SmallLink href={player.pdfEnUrl} icon={<FileText className="h-4 w-4" />} label="English PDF" />
                  {player.pdfKnUrl && <SmallLink href={player.pdfKnUrl} icon={<FileText className="h-4 w-4" />} label="Kannada PDF" />}
                  <SmallLink href={player.slidesUrl} icon={<ExternalLink className="h-4 w-4" />} label="Edit in Slides" />
                </div>
              )}
              {hasInterview && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <ActionButton onClick={() => story("en")} icon={<Sparkles className="h-4 w-4" />} label={hasStory ? "Rewrite story" : "Create story"} />
                  {hasStory && <ActionButton onClick={() => story("kn")} icon={<Sparkles className="h-4 w-4" />} label="Kannada version" />}
                  {hasStory && <ActionButton onClick={refreshPdf} icon={<RefreshCw className="h-4 w-4" />} label="Update PDFs after edits" />}
                </div>
              )}
              {hasStory && (
                <label className="mt-4 flex items-center gap-3 text-sm">
                  <input type="checkbox" className="h-5 w-5 accent-teal-500" checked={!!player.approved} onChange={(e) => approve(e.target.checked)} />
                  {player.greet} has read and approved the story
                </label>
              )}
            </>
          )}
        </Card>

        {/* details */}
        <Card title="Details (Maitri and the story use these)">
          <div className="space-y-3">
            {EDIT_FIELDS.map((f) => (
              <Field key={f.key} def={f} value={draft[f.key] ?? ""} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
            ))}
          </div>
        </Card>
      </main>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-navy-900/95 p-4 backdrop-blur">
          <button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-3.5 font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Save changes
          </button>
        </div>
      )}
      {toastText && (
        <div className="fixed inset-x-0 bottom-24 z-30 mx-auto w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy-950 shadow-lg">{toastText}</div>
      )}
    </Shell>
  );
}

// ---------- add a player ----------

function AddPlayer({ adminKey, onBack, onAdded }: { adminKey: string; onBack: () => void; onAdded: (p: Player) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({ language: "Kannada" });
  const [busy, setBusy] = useState(false);
  const fields = [{ key: "name" as keyof Player, label: "Full name" }, ...EDIT_FIELDS.filter((f) => ["callname", "phone", "pronoun", "language", "hometown", "support"].includes(f.key))];
  const add = async () => {
    setBusy(true);
    try {
      const r = await storyAdmin<{ player: Player }>("add", adminKey, { fields: draft }, 120000);
      if (r.player) onAdded(r.player);
      else onBack();
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell>
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-navy-950/95 px-3 py-3">
        <button aria-label="Back" onClick={onBack} className="rounded-full bg-white/10 p-2.5">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="font-heading text-base font-bold">Add a player</p>
      </header>
      <main className="space-y-3 px-4 pb-10 pt-2">
        {fields.map((f) => (
          <Field key={f.key} def={f} value={draft[f.key] ?? ""} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
        ))}
        <button
          onClick={add}
          disabled={busy || !String(draft.name || "").trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-3.5 font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} Add and create their link
        </button>
      </main>
    </Shell>
  );
}

// ---------- small pieces ----------

function Field({ def, value, onChange }: { def: { key: keyof Player; label: string; kind?: string; hint?: string }; value: string; onChange: (v: string) => void }) {
  const cls = "mt-1 w-full rounded-xl bg-navy-900 px-3 py-2.5 text-base outline-none ring-1 ring-white/10 focus:ring-teal-400";
  return (
    <label className="block">
      <span className="text-sm font-semibold text-navy-100">{def.label}</span>
      {def.kind === "area" ? (
        <textarea className={cls} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : def.kind === "pronoun" || def.kind === "language" ? (
        <select className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
          {(def.kind === "pronoun" ? ["", "He", "She"] : ["Kannada", "English"]).map((o) => (
            <option key={o} value={o}>
              {o || "—"}
            </option>
          ))}
        </select>
      ) : (
        <input className={cls} value={value} inputMode={def.key === "phone" ? "tel" : undefined} onChange={(e) => onChange(e.target.value)} />
      )}
      {def.hint && <span className="mt-1 block text-xs text-navy-300">{def.hint}</span>}
    </label>
  );
}

function StatusChip({ status }: { status: string }) {
  const g = groupOf(status);
  const label = status ? status.replace(/ - .*$/, "").replace(/^Link ready.*/, "Not sent") : "Not sent";
  return <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${GROUP_STYLE[g]}`}>{label}</span>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/5 p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-teal-300">{title}</h2>
      {children}
    </section>
  );
}

function FileRow({ file, icon }: { file: DriveFile; icon: React.ReactNode }) {
  return (
    <a href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-sm">
      {icon}
      <span className="min-w-0 flex-1 truncate">{file.name.replace(/^.* - /, "")}</span>
      <span className="text-xs text-navy-300">{file.size > 1e6 ? `${Math.round(file.size / 1e6)} MB` : ""}</span>
    </a>
  );
}

function SmallLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold">
      {icon} {label}
    </a>
  );
}

function SmallButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold">
      {icon} {label}
    </button>
  );
}

function ActionButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 py-3 text-sm font-semibold">
      {icon} {label}
    </button>
  );
}

function Logo({ small }: { small?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={small ? `${BASE}/admin-icons/icon-192.png` : `${BASE}/dmsa-logo.png`}
      alt="DMSA"
      className={small ? "h-10 w-10 rounded-xl" : "h-12 rounded-lg bg-white px-3 py-2"}
    />
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return <div className="min-h-dvh bg-navy-950 font-sans text-white">{children}</div>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6">{children}</div>;
}
