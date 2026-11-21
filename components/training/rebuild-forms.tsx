"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  checkInAndStart, postponeRebuildSession, saveClinicalReview, saveRebuildFollowUp, setRebuildDays, stopRebuildSession,
} from "@/lib/actions/mobility-rebuild";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { rebuildDictionary } from "@/lib/i18n/mobility-rebuild";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { OVERALL, STOP_REASONS, validDays, type Overall, type StopReason, type Verdict } from "@/lib/training/mobility-rebuild/engine";
import { buttonClass, linkClass, toggleClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { IconPlay } from "@/components/ui/icons";

function Slider({ label, value, onChange, name }: { label: string; value: number; onChange: (v: number) => void; name: string }) {
  return <label className="block text-sm font-semibold">{label}
    <input type="range" name={name} min={0} max={10} value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="mt-2 w-full accent-accent" aria-valuetext={`${value} / 10`} />
    <span className="text-sm font-bold tabular-nums">{value} / 10</span>
  </label>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-start gap-2 text-sm">
    <input type="checkbox" className="mt-1 accent-accent" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>;
}

function Emergency({ locale }: { locale: Locale }) {
  const r = rebuildDictionary(locale);
  return <p role="alert" className="rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm font-semibold text-danger">{r.emergency}</p>;
}

/** Before a séance (or before resuming it): the symptom gate. Only GO and ADAPT start it. */
export function RebuildCheckIn({ locale, sessionId, resume }: { locale: Locale; sessionId: string; resume: boolean }) {
  const r = rebuildDictionary(locale);
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [back, setBack] = useState(0);
  const [leg, setLeg] = useState(0);
  const [flags, setFlags] = useState({
    radiationSpreading: false, unusualPain: false, newNeuro: false, bladderBowel: false, saddleNumbness: false, recentFallSpinalPain: false,
  });
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<{ msg: string; liveId?: string } | null>(null);
  const [pending, start] = useTransition();
  const flag = (k: keyof typeof flags) => (v: boolean) => setFlags((f) => ({ ...f, [k]: v }));
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setVerdict(null);
    start(async () => {
      const res = await checkInAndStart({ sessionId, backPain: back, legRadiation: leg, ...flags });
      if (!res.ok) { setError({ msg: res.error === "live" ? t.liveElsewhere : r.error, liveId: res.liveId }); return; }
      setVerdict(res.data.verdict);
      if (res.data.verdict === "GO" || res.data.verdict === "ADAPT") router.refresh();
    });
  }
  return <form onSubmit={submit} className="leblond-premium-surface space-y-4 p-4" aria-labelledby="rebuild-check-title">
    <h2 id="rebuild-check-title" className="text-lg font-bold">{r.checkTitle}</h2>
    <p className="text-xs text-ink-3">{r.checkHint}</p>
    <Slider name="backPain" label={r.backPain} value={back} onChange={setBack} />
    <Slider name="legRadiation" label={r.legRadiation} value={leg} onChange={setLeg} />
    <div className="space-y-2">
      <Check label={r.radiationSpreading} checked={flags.radiationSpreading} onChange={flag("radiationSpreading")} />
      <Check label={r.unusualPain} checked={flags.unusualPain} onChange={flag("unusualPain")} />
    </div>
    <fieldset className="space-y-2 rounded-xl border border-danger/30 p-3">
      <legend className="px-1 text-sm font-semibold text-danger">{r.emergencySigns}</legend>
      <Check label={r.newNeuro} checked={flags.newNeuro} onChange={flag("newNeuro")} />
      <Check label={r.bladderBowel} checked={flags.bladderBowel} onChange={flag("bladderBowel")} />
      <Check label={r.saddleNumbness} checked={flags.saddleNumbness} onChange={flag("saddleNumbness")} />
      <Check label={r.recentFallSpinalPain} checked={flags.recentFallSpinalPain} onChange={flag("recentFallSpinalPain")} />
    </fieldset>
    {verdict === "EMERGENCY" ? <Emergency locale={locale} /> : null}
    {verdict === "STOP" ? <p role="alert" data-verdict="STOP" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm font-semibold">{r.verdict.STOP}</p> : null}
    {verdict === "ADAPT" || verdict === "GO" ? <p role="status" data-verdict={verdict} className="text-sm font-semibold">{r.verdict[verdict]}</p> : null}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error.msg}
      {error.liveId ? <> <Link className={linkClass} href={"/train/sessions/" + error.liveId}>{t.goLive}</Link></> : null}</p> : null}
    <button type="submit" disabled={pending} className={buttonClass("primary", "md")}><IconPlay /> {resume ? r.checkResume : r.checkSubmit}</button>
  </form>;
}

/** During a séance: one tap on a stop sign interrupts it. */
export function RebuildStopPanel({ locale, sessionId }: { locale: Locale; sessionId: string }) {
  const r = rebuildDictionary(locale);
  const router = useRouter();
  const [done, setDone] = useState<{ emergency: boolean } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function stop(reason: StopReason) {
    setError("");
    start(async () => {
      const res = await stopRebuildSession({ sessionId, reason });
      if (!res.ok) { setError(r.error); return; }
      setDone(res.data);
      router.refresh();
    });
  }
  return <section aria-labelledby="rebuild-stop-title" className="space-y-3 rounded-2xl border border-warn/40 bg-warn/5 p-4">
    <h2 id="rebuild-stop-title" className="text-base font-bold">{r.stopTitle}</h2>
    <p className="text-xs text-ink-3">{r.stopHint}</p>
    <div className="flex flex-wrap gap-2">
      {STOP_REASONS.map((reason) => <button key={reason} type="button" disabled={pending} onClick={() => stop(reason)}
        className={buttonClass("secondary", "sm")}>{r.stopReason[reason]}</button>)}
    </div>
    {done ? (done.emergency ? <Emergency locale={locale} /> : <p role="status" className="text-sm font-semibold">{r.stopped}</p>) : null}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
  </section>;
}

/** The next-day follow-up. */
export function RebuildFollowUp({ locale, sessionId }: { locale: Locale; sessionId: string }) {
  const r = rebuildDictionary(locale);
  const router = useRouter();
  const [overall, setOverall] = useState<Overall | null>(null);
  const [back, setBack] = useState(0);
  const [leg, setLeg] = useState(0);
  const [spreading, setSpreading] = useState(false);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    if (!overall) return;
    start(async () => {
      const res = await saveRebuildFollowUp({ sessionId, overall, backPain: back, legRadiation: leg, radiationSpreading: spreading, notes });
      if (!res.ok) { setMsg(r.error); return; }
      setMsg(r.followUpSaved);
      router.refresh();
    });
  }
  return <form onSubmit={submit} className="leblond-premium-surface space-y-4 p-4" aria-labelledby={"rebuild-d1-" + sessionId}>
    <h2 id={"rebuild-d1-" + sessionId} className="text-lg font-bold">{r.followUpTitle}</h2>
    <p className="text-xs text-ink-3">{r.followUpHint}</p>
    <fieldset>
      <legend className="text-sm font-semibold">{r.overallLabel}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {OVERALL.map((o) => <button key={o} type="button" aria-pressed={overall === o} onClick={() => setOverall(o)} className={toggleClass(overall === o)}>{r.overall[o]}</button>)}
      </div>
    </fieldset>
    <Slider name="d1BackPain" label={r.backPain} value={back} onChange={setBack} />
    <Slider name="d1LegRadiation" label={r.legRadiation} value={leg} onChange={setLeg} />
    <Check label={r.radiationSpreading} checked={spreading} onChange={setSpreading} />
    <label className="block text-sm font-semibold">{r.notes}
      <input className={fieldClass} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </label>
    {msg ? <p role="status" className="text-sm font-semibold">{msg}</p> : null}
    <button type="submit" disabled={pending || !overall} className={buttonClass("primary", "md")}>{r.followUpSave}</button>
  </form>;
}

export function RebuildPostponeButton({ locale, sessionId }: { locale: Locale; sessionId: string }) {
  const r = rebuildDictionary(locale);
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" disabled={pending} className={buttonClass("secondary", "sm")} onClick={() => start(async () => {
      const res = await postponeRebuildSession(sessionId);
      if (!res.ok) { setMsg(r.error); return; }
      setMsg(fmt(r.postponed, { date: formatDate(res.data.date + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" }) }));
      router.refresh();
    })}>{r.postpone}</button>
    {msg ? <span role="status" className="text-xs text-ink-2">{msg}</span> : null}
  </span>;
}

export function RebuildDaysForm({ locale, days: initial }: { locale: Locale; days: number[] }) {
  const r = rebuildDictionary(locale);
  const router = useRouter();
  const [days, setDays] = useState<number[]>(initial);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const ok = validDays(days);
  const toggle = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort((a, b) => a - b)));
  return <form className="space-y-3" aria-labelledby="rebuild-days-title" onSubmit={(e) => {
    e.preventDefault(); setMsg("");
    if (!ok) { setMsg(r.daysInvalid); return; }
    start(async () => {
      const res = await setRebuildDays(days);
      setMsg(res.ok ? r.daysSaved : r.error);
      if (res.ok) router.refresh();
    });
  }}>
    <h3 id="rebuild-days-title" className="text-base font-bold">{r.daysTitle}</h3>
    <div className="flex flex-wrap gap-2">
      {r.weekdays.map((label, i) => <button key={label} type="button" aria-pressed={days.includes(i + 1)} onClick={() => toggle(i + 1)}
        className={toggleClass(days.includes(i + 1))}>{label}</button>)}
    </div>
    <p className="text-xs text-ink-3">{r.daysHint}</p>
    {msg ? <p role="status" className="text-sm font-semibold">{msg}</p> : null}
    <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>{r.daysSave}</button>
  </form>;
}

export function ClinicalReviewForm({ locale, date: initialDate, restrictions: initialRestrictions, today }: {
  locale: Locale; date: string | null; restrictions: string; today: string;
}) {
  const r = rebuildDictionary(locale);
  const router = useRouter();
  const [date, setDate] = useState(initialDate ?? "");
  const [restrictions, setRestrictions] = useState(initialRestrictions);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  function save(clear: boolean) {
    setMsg("");
    start(async () => {
      const res = await saveClinicalReview({ date: clear || !date ? null : date, restrictions: clear ? "" : restrictions });
      setMsg(res.ok ? r.clinicalSaved : r.error);
      if (res.ok) { if (clear) { setDate(""); setRestrictions(""); } router.refresh(); }
    });
  }
  return <form className="space-y-3" aria-labelledby="rebuild-review-title" onSubmit={(e) => { e.preventDefault(); save(false); }}>
    <h3 id="rebuild-review-title" className="text-base font-bold">{r.clinicalTitle}</h3>
    <p className="text-xs text-ink-3">{r.clinicalHint}</p>
    <label className="block text-sm font-semibold">{r.clinicalDate}
      <input type="date" className={fieldClass} min="2020-01-01" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
    </label>
    <label className="block text-sm font-semibold">{r.clinicalRestrictions}
      <textarea className={fieldClass} maxLength={1000} rows={3} value={restrictions} onChange={(e) => setRestrictions(e.target.value)} />
    </label>
    {msg ? <p role="status" className="text-sm font-semibold">{msg}</p> : null}
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={pending || !date} className={buttonClass("secondary", "sm")}>{r.clinicalSave}</button>
      {initialDate ? <button type="button" disabled={pending} onClick={() => save(true)} className={buttonClass("ghost", "sm")}>{r.clinicalClear}</button> : null}
    </div>
  </form>;
}
