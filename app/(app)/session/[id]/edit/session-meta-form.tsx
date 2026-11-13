"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { deleteSession, rescheduleSession, updateSessionTitle } from "@/lib/actions/sessions";
import { loggingDictionary } from "@/lib/i18n/logging";
import { sessionEditDictionary } from "@/lib/i18n/session-edit";
import { buttonClass } from "@/components/ui/button";
import { DurationField } from "@/components/ui/duration-field";
import { fieldClass as field } from "@/components/ui/field";


/** Date / start time / duration of a finished session. Attempts move with it (server-side). */
export function SessionMetaForm({ sessionId, initial, today, fromWatch = false }: {
  sessionId: string; initial: { date: string; time: string; minutes: number; title: string }; today: string; fromWatch?: boolean;
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
    <h2 className="font-bold">{e.when}</h2>
    <label className="block text-sm font-semibold">{L.sessionName}
      <input className={field} maxLength={80} value={title} placeholder={L.sessionNamePlaceholder} onChange={(ev) => setTitle(ev.target.value)} />
    </label>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <label className="text-sm font-semibold">{e.date}
        <input className={field} type="date" required max={today} min="2015-01-01" value={date} onChange={(ev) => setDate(ev.target.value)} />
      </label>
      <label className="text-sm font-semibold">{e.time}
        <input className={field} type="time" required value={time} onChange={(ev) => setTime(ev.target.value)} />
      </label>
      <DurationField className="col-span-2 sm:col-span-1" label={e.minutes} value={minutes}
        onChange={(v) => setMinutes(v ?? 0)} min={1} max={1440} />
    </div>
    {fromWatch ? <p className="text-xs font-semibold text-ink-2">⌚ {t.session.timingEditHint}</p> : null}
    <p className="text-xs text-ink-3">{e.moveHint}</p>
    {message ? <p role={message.ok ? "status" : "alert"} className={"text-sm font-semibold " + (message.ok ? "text-ink-2" : "text-danger")}>{message.text}</p> : null}
    <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>{e.save}</button>
  </form>;
}

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const { locale } = useI18n();
  const e = sessionEditDictionary(locale);
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending}
    onClick={() => { if (window.confirm(e.deleteConfirm)) start(async () => { await deleteSession(sessionId); }); }}
    className={buttonClass("danger", "md")}>{e.delete}</button>;
}
