"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { deleteSession, rescheduleSession, updateSessionTitle } from "@/lib/actions/sessions";
import { loggingDictionary } from "@/lib/i18n/logging";
import { sessionEditDictionary } from "@/lib/i18n/session-edit";

const field = "mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink";

/** Date / start time / duration of a finished session. Attempts move with it (server-side). */
export function SessionMetaForm({ sessionId, initial, today }: {
  sessionId: string; initial: { date: string; time: string; minutes: number; title: string }; today: string;
}) {
  const { t, locale } = useI18n();
  const e = sessionEditDictionary(locale);
  const router = useRouter();
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [title, setTitle] = useState(initial.title);
  const L = loggingDictionary(locale);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return <form aria-label={e.when} className="space-y-3 rounded-2xl border border-line bg-surface p-4" onSubmit={(ev) => {
    ev.preventDefault(); setMessage(null);
    start(async () => {
      const named = await updateSessionTitle(sessionId, title);
      const res = named.ok ? await rescheduleSession({ sessionId, date, time, minutes }) : named;
      setMessage(res.ok ? { ok: true, text: e.saved } : { ok: false, text: res.error === "invalidDate" ? e.invalidDate : t.common.unknownError });
      if (res.ok) router.refresh();
    });
  }}>
    <h2 className="font-extrabold">{e.when}</h2>
    <label className="block text-sm font-semibold">{L.sessionName}
      <input className={field} maxLength={80} value={title} placeholder={L.sessionNamePlaceholder} onChange={(ev) => setTitle(ev.target.value)} />
    </label>
    <div className="grid grid-cols-3 gap-3">
      <label className="text-sm font-semibold">{e.date}
        <input className={field} type="date" required max={today} min="2015-01-01" value={date} onChange={(ev) => setDate(ev.target.value)} />
      </label>
      <label className="text-sm font-semibold">{e.time}
        <input className={field} type="time" required value={time} onChange={(ev) => setTime(ev.target.value)} />
      </label>
      <label className="text-sm font-semibold">{e.minutes}
        <input className={field} type="number" required min={1} max={1440} value={minutes} onChange={(ev) => setMinutes(Number(ev.target.value))} />
      </label>
    </div>
    <p className="text-xs text-ink-3">{e.moveHint}</p>
    {message ? <p role={message.ok ? "status" : "alert"} className={"text-sm font-semibold " + (message.ok ? "text-ink-2" : "text-danger")}>{message.text}</p> : null}
    <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-accent-ink disabled:opacity-60">{e.save}</button>
  </form>;
}

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const { locale } = useI18n();
  const e = sessionEditDictionary(locale);
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending}
    onClick={() => { if (window.confirm(e.deleteConfirm)) start(async () => { await deleteSession(sessionId); }); }}
    className="min-h-12 rounded-full border border-danger/40 px-5 text-sm font-bold text-danger disabled:opacity-60">{e.delete}</button>;
}
