"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Check, Copy, Download, FileText, FolderOpen, Loader2, MessageCircle, Mic, PhoneCall, RefreshCw, Search } from "lucide-react";
import { storyAdmin } from "@/lib/story/api";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export type Section = "stories" | "registrations";

/** The two halves of the admin app, switched from the navy header. */
export function SectionTabs({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  const tabs: { id: Section; label: string }[] = [
    { id: "stories", label: "Player stories" },
    { id: "registrations", label: "Registrations" },
  ];
  return (
    <div role="tablist" className="mt-3 grid grid-cols-2 rounded-xl bg-black/25 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={section === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-lg py-2 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--teal-bright)] ${
            section === t.id ? "bg-white text-[var(--navy)] shadow" : "text-white/70 hover:text-white"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface Reg {
  id: string;
  status: string;
  submitted: string;
  started: string;
  language: string;
  photo: string;
  recording: string;
  transcript: string;
  folder: string;
  consent: string;
  review: string;
  [field: string]: string;
}

interface RegData {
  campaign: { code: string; name: string; open: boolean; link: string };
  fields: { key: string; label: string }[];
  registrations: Reg[];
}

type Kind = "review" | "confirmed" | "followup" | "unfinished";

function kindOf(r: Reg): Kind {
  if (/^Confirmed/.test(r.status)) return "confirmed";
  if (/^Needs follow-up/.test(r.status)) return "followup";
  if (/^Submitted/.test(r.status)) return "review";
  return "unfinished";
}

const KIND_STYLE: Record<Kind, { label: string; cls: string }> = {
  review: { label: "Needs review", cls: "bg-[var(--gold-soft)] text-[#7d5a1e]" },
  confirmed: { label: "Confirmed", cls: "bg-[var(--teal-soft)] text-[var(--teal)]" },
  followup: { label: "Call them", cls: "bg-[var(--alert-soft)] text-[var(--alert)]" },
  unfinished: { label: "Not submitted", cls: "bg-[var(--bg)] text-[var(--muted)]" },
};

const FILTERS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "review", label: "Needs review" },
  { id: "followup", label: "Call them" },
  { id: "confirmed", label: "Confirmed" },
  { id: "unfinished", label: "Not submitted" },
];

const isTest = (r: Reg) => /^Test/i.test(r.status) || /\(ignore\)|\btest\b/i.test(String(r.full_name || ""));

function when(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const driveId = (url: string) => (String(url).match(/\/d\/([\w-]+)/) || [])[1] || "";

export function Registrations({ adminKey, section, onSection }: { adminKey: string; section: Section; onSection: (s: Section) => void }) {
  const [data, setData] = useState<RegData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    return storyAdmin<RegData>("registrations", adminKey, { campaign: "KWPL4" }, 90000)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch(() => setError("Couldn't load registrations. Check your internet and try again."))
      .finally(() => setRefreshing(false));
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const regs = useMemo(() => (data?.registrations || []).filter((r) => !isTest(r)), [data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: regs.length };
    regs.forEach((r) => (c[kindOf(r)] = (c[kindOf(r)] || 0) + 1));
    return c;
  }, [regs]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return regs
      .filter((r) => (filter === "all" || kindOf(r) === filter) && (!q || `${r.id} ${r.full_name} ${r.district} ${r.phone}`.toLowerCase().includes(q)))
      .sort((a, b) => String(b.submitted || b.started).localeCompare(String(a.submitted || a.started)));
  }, [regs, filter, query]);
  const open = regs.find((r) => r.id === openId) || null;

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(380px,460px)_1fr]">
      <div className="lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden lg:border-r lg:border-[var(--line)]">
        <header className="bg-[var(--navy)] px-4 pb-4 pt-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BASE}/admin-icons/icon-192.png`} alt="DMSA" className="h-9 w-9 rounded-lg" />
              <div>
                <p className="font-heading text-[15px] font-bold leading-tight">Registrations</p>
                <p className="text-xs text-white/60">{data?.campaign.name.replace(" - player registration", "") || "KWPL Season 4"}</p>
              </div>
            </div>
            <button
              aria-label="Refresh"
              onClick={() => {
                setRefreshing(true);
                load();
              }}
              className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--teal)]"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <SectionTabs section={section} onChange={onSection} />
          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">
            <Score value={data ? counts.all - (counts.unfinished || 0) : "–"} label="Submitted" tone="gold" />
            <Score value={data ? counts.review || 0 : "–"} label="To review" />
            <Score value={data ? counts.confirmed || 0 : "–"} label="Confirmed" tone="teal" />
          </div>
        </header>

        {!data && !error && (
          <div className="flex min-h-[40dvh] flex-col items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--teal)]" />
            <p className="mt-3 text-sm text-[var(--muted)]">Loading registrations…</p>
          </div>
        )}
        {error && (
          <div className="flex min-h-[40dvh] flex-col items-center justify-center px-6 text-center">
            <p>{error}</p>
            <button className="mt-5 rounded-xl bg-[var(--teal)] px-5 py-3 font-semibold text-white" onClick={() => load()}>
              Try again
            </button>
          </div>
        )}

        {data && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-3 px-4 pt-4">
              <ShareCard link={data.campaign.link} open={data.campaign.open} />
              <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 focus-within:border-[var(--teal)]">
                <Search className="h-4 w-4 text-[var(--muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, district, phone or ID"
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]"
                />
              </label>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                      filter === f.id ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
                    }`}
                  >
                    {f.label}
                    <span className="tabular-nums opacity-70">{counts[f.id] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-2 flex-1 space-y-2 overflow-y-auto px-4 pb-10 pt-1">
              {shown.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setOpenId(r.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border bg-[var(--surface)] px-3 py-3 text-left transition hover:border-[var(--teal)] ${
                      r.id === openId ? "border-[var(--teal)] ring-1 ring-[var(--teal)]" : "border-[var(--line)]"
                    }`}
                  >
                    <span className="w-14 flex-none font-mono text-xs text-[var(--muted)]">{r.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.full_name || "(no name yet)"}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {[r.district, r.role, when(r.submitted || r.started)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${KIND_STYLE[kindOf(r)].cls}`}>{KIND_STYLE[kindOf(r)].label}</span>
                  </button>
                </li>
              ))}
              {!shown.length && (
                <li className="rounded-xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                  {regs.length ? "No registrations match." : "No registrations yet. Share the link above with players."}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className={`${open ? "fixed inset-0 z-30 overflow-y-auto" : "hidden"} bg-[var(--bg)] lg:static lg:block lg:h-dvh lg:overflow-y-auto`}>
        {open && data ? (
          <RegDetail
            key={open.id}
            reg={open}
            fields={data.fields}
            campaign={data.campaign.code}
            adminKey={adminKey}
            onBack={() => setOpenId(null)}
            onSaved={(d) => setData(d)}
          />
        ) : (
          <div className="hidden h-full flex-col items-center justify-center px-10 text-center lg:flex">
            <p className="font-heading text-lg font-bold">Choose a registration</p>
            <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">Check what Maitri collected, then confirm the player or mark them to call.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Score({ value, label, tone }: { value: number | string; label: string; tone?: "gold" | "teal" }) {
  const color = tone === "gold" ? "text-[var(--gold)]" : tone === "teal" ? "text-[var(--teal-bright)]" : "text-white";
  return (
    <div className="border-r border-white/10 px-2 py-2.5 text-center last:border-r-0">
      <p className={`font-display text-3xl leading-none tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/60">{label}</p>
    </div>
  );
}

/** The open link, ready to paste into a WhatsApp group or print as a QR poster. */
function ShareCard({ link, open }: { link: string; open: boolean }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 640, color: { dark: "#0B1F44", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [link]);
  const message =
    `KWPL Season 4 registration is open!\n\nRegister by talking with Maitri, DMSA's AI volunteer (about 6 minutes, Kannada or English):\n${link}\n\n` +
    `KWPL ಸೀಸನ್ 4 ನೋಂದಣಿ ಆರಂಭವಾಗಿದೆ! ಮೈತ್ರಿ ಜೊತೆ ಮಾತನಾಡಿ ನೋಂದಾಯಿಸಿ.`;
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">Registration link</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${open ? "bg-[var(--teal-soft)] text-[var(--teal)]" : "bg-[var(--alert-soft)] text-[var(--alert)]"}`}>
          {open ? "Open" : "Closed"}
        </span>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]">{link}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] px-2 py-2.5 text-sm font-semibold transition hover:border-[var(--teal)]"
        >
          {copied ? <Check className="h-4 w-4 text-[var(--teal)]" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1f9d55] px-2 py-2.5 text-sm font-semibold text-white"
        >
          <MessageCircle className="h-4 w-4" /> Share
        </a>
        <button
          onClick={() => setShowQr((v) => !v)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] px-2 py-2.5 text-sm font-semibold transition hover:border-[var(--teal)]"
          aria-expanded={showQr}
        >
          QR code
        </button>
      </div>
      {showQr && qr && (
        <div className="mt-3 flex flex-col items-center rounded-xl bg-[var(--bg)] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code for the registration link" className="h-48 w-48 rounded-lg bg-white p-2" />
          <a href={qr} download="KWPL4-registration-QR.png" className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--teal)]">
            <Download className="h-4 w-4" /> Download for posters
          </a>
        </div>
      )}
    </section>
  );
}

function RegDetail({
  reg,
  fields,
  campaign,
  adminKey,
  onBack,
  onSaved,
}: {
  reg: Reg;
  fields: { key: string; label: string }[];
  campaign: string;
  adminKey: string;
  onBack: () => void;
  onSaved: (d: RegData) => void;
}) {
  const [note, setNote] = useState(reg.review || "");
  const [busy, setBusy] = useState("");
  const kind = kindOf(reg);
  const phone = String(reg.phone || "").replace(/\D/g, "").slice(-10);
  const photoId = driveId(reg.photo);

  const save = async (status?: string) => {
    setBusy(status || "note");
    try {
      const d = await storyAdmin<RegData>("regReview", adminKey, { campaign, id: reg.id, status, review: note }, 60000);
      onSaved(d);
    } catch (e) {
      alert(String((e as Error)?.message || e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <button aria-label="Back" onClick={onBack} className="rounded-full border border-[var(--line)] bg-[var(--surface)] p-2.5 lg:hidden">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xl font-bold">{reg.full_name || "(no name yet)"}</p>
          <p className="text-xs text-[var(--muted)]">
            {reg.id} · {reg.language} · {reg.submitted ? `submitted ${when(reg.submitted)}` : `started ${when(reg.started)}`}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${KIND_STYLE[kind].cls}`}>{KIND_STYLE[kind].label}</span>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-10 pt-4">
        <section className="flex gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          {photoId ? (
            <a href={reg.photo} target="_blank" rel="noreferrer" className="flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://drive.google.com/thumbnail?id=${photoId}&sz=w300`}
                alt={`Registration photo of ${reg.full_name}`}
                className="h-28 w-24 rounded-xl bg-[var(--bg)] object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
              />
            </a>
          ) : (
            <div className="flex h-28 w-24 flex-none items-center justify-center rounded-xl bg-[var(--bg)] text-center text-[11px] text-[var(--muted)]">No photo</div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            {phone.length === 10 && (
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:+91${phone}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] px-2 py-2.5 text-sm font-semibold">
                  <PhoneCall className="h-4 w-4" /> Call
                </a>
                <a
                  href={`https://wa.me/91${phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1f9d55] px-2 py-2.5 text-sm font-semibold text-white"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {reg.recording && <Chip href={reg.recording} icon={<Mic className="h-3.5 w-3.5" />} label="Recording" />}
              {reg.transcript && <Chip href={reg.transcript} icon={<FileText className="h-3.5 w-3.5" />} label="Transcript" />}
              {reg.folder && <Chip href={reg.folder} icon={<FolderOpen className="h-3.5 w-3.5" />} label="Folder" />}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="font-heading text-[15px] font-bold">What Maitri collected</h2>
          <dl className="mt-3 divide-y divide-[var(--line)]">
            {fields.map((f) => (
              <div key={f.key} className="grid grid-cols-[minmax(0,11rem)_1fr] gap-3 py-2 text-sm">
                <dt className="text-[var(--muted)]">{f.label}</dt>
                <dd className={`font-semibold ${reg[f.key] ? "" : "text-[var(--muted)]"}`}>{String(reg[f.key] || "—")}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="font-heading text-[15px] font-bold">Your review</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Notes for the team (e.g. confirmed on call, jersey size changed)"
            className="mt-3 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[15px] outline-none focus:border-[var(--teal)] focus:bg-[var(--surface)]"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => save("Confirmed")}
              disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-lg bg-[var(--navy)] px-3 py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {busy === "Confirmed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm player
            </button>
            <button
              onClick={() => save("Needs follow-up")}
              disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-3 text-[15px] font-semibold disabled:opacity-50"
            >
              {busy === "Needs follow-up" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />} Mark to call
            </button>
          </div>
          {note !== (reg.review || "") && (
            <button onClick={() => save()} disabled={!!busy} className="mt-3 text-sm font-semibold text-[var(--teal)]">
              {busy === "note" ? "Saving…" : "Save note only"}
            </button>
          )}
        </section>

        <p className="text-center text-xs text-[var(--muted)]">Consent: {reg.consent || "not yet"}</p>
      </main>
    </div>
  );
}

function Chip({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold transition hover:border-[var(--teal)]"
    >
      {icon} {label}
    </a>
  );
}
