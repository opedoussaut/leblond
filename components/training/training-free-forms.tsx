"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTrainingSession, logPastTrainingSession, updateTrainingSession } from "@/lib/actions/training-sessions";
import type { Locale } from "@/lib/i18n";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";

const field = "mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink";
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/** A training session already done: type, date, total time, effort, free description. */
export function PastTrainingForm({ locale, today }: { locale: Locale; today: string }) {
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [methodId, setMethodId] = useState("strength-conditioning");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("18:00");
  const [minutes, setMinutes] = useState(60);
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return <form aria-label={t.pastTitle} className="space-y-4" onSubmit={(e) => {
    e.preventDefault(); setError("");
    start(async () => {
      const r = await logPastTrainingSession({ methodId: methodId || null, title, date, time, minutes, rpe: numOrNull(rpe), notes });
      if (!r.ok) { setError(t.error); return; }
      router.push("/train/sessions/" + r.data.id);
    });
  }}>
    <label className="block text-sm font-semibold">{t.type}
      <select className={field} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
        {METHODS_FOR_PLANS.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        <option value="">{t.otherType}</option>
      </select>
    </label>
    <label className="block text-sm font-semibold">{t.sessionTitle}
      <input className={field} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
    </label>
    <div className="grid grid-cols-3 gap-3">
      <label className="text-sm font-semibold">{t.date}
        <input className={field} type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="text-sm font-semibold">{t.time}
        <input className={field} type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <label className="text-sm font-semibold">{t.totalMinutes}
        <input className={field} type="number" required min={5} max={480} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
      </label>
    </div>
    <label className="block text-sm font-semibold">{t.rpeShort}
      <input className={field} type="number" min={1} max={10} value={rpe} onChange={(e) => setRpe(e.target.value)} />
    </label>
    <label className="block text-sm font-semibold">{t.description}
      <textarea className={field} rows={4} maxLength={2000} placeholder={t.descriptionPlaceholder} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </label>
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-accent-ink disabled:opacity-60">{t.record}</button>
  </form>;
}

/** Edit or delete a session that is not running. */
export function EditTrainingForm({ locale, session, today }: {
  locale: Locale; today: string;
  session: { id: string; title: string; date: string; time: string; minutes: number; rpe: number | null; pain: number | null; notes: string };
}) {
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ ...session, rpe: session.rpe?.toString() ?? "", pain: session.pain?.toString() ?? "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, value: string | number) => setV((x) => ({ ...x, [k]: value }));

  return <div className="space-y-3">
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="min-h-12 rounded-full border border-line bg-surface px-5 text-sm font-bold text-accent">{t.edit}</button>
      <button type="button" disabled={pending}
        onClick={() => { if (window.confirm(t.deleteConfirm)) start(async () => { const r = await deleteTrainingSession(session.id); if (r.ok) router.push("/train/sessions"); else setError(t.error); }); }}
        className="min-h-12 rounded-full border border-danger/40 px-5 text-sm font-bold text-danger disabled:opacity-60">{t.delete}</button>
    </div>
    {open ? <form aria-label={t.editTitle} className="leblond-premium-surface space-y-4 p-5" onSubmit={(e) => {
      e.preventDefault(); setError("");
      start(async () => {
        const r = await updateTrainingSession({ sessionId: session.id, title: v.title, date: v.date, time: v.time, minutes: v.minutes,
          rpe: numOrNull(v.rpe), pain: numOrNull(v.pain), notes: v.notes });
        if (!r.ok) { setError(t.error); return; }
        setOpen(false); router.refresh();
      });
    }}>
      <h2 className="text-lg font-black">{t.editTitle}</h2>
      <label className="block text-sm font-semibold">{t.sessionTitle}
        <input className={field} required maxLength={120} value={v.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm font-semibold">{t.date}
          <input className={field} type="date" required max={today} value={v.date} onChange={(e) => set("date", e.target.value)} />
        </label>
        <label className="text-sm font-semibold">{t.time}
          <input className={field} type="time" required value={v.time} onChange={(e) => set("time", e.target.value)} />
        </label>
        <label className="text-sm font-semibold">{t.totalMinutes}
          <input className={field} type="number" required min={5} max={480} value={v.minutes} onChange={(e) => set("minutes", Number(e.target.value))} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold">{t.rpeShort}
          <input className={field} type="number" min={1} max={10} value={v.rpe} onChange={(e) => set("rpe", e.target.value)} />
        </label>
        <label className="text-sm font-semibold">{t.painShort}
          <input className={field} type="number" min={0} max={10} value={v.pain} onChange={(e) => set("pain", e.target.value)} />
        </label>
      </div>
      <label className="block text-sm font-semibold">{t.description}
        <textarea className={field} rows={4} maxLength={2000} placeholder={t.descriptionPlaceholder} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-accent-ink disabled:opacity-60">{t.saveChanges}</button>
    </form> : null}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
  </div>;
}
