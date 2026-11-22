"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { CalendarPlus, Play, RotateCcw } from "lucide-react";
import { createTrainingSession } from "@/lib/actions/training-sessions";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { awayDictionary } from "@/lib/i18n/away";
import { buttonClass, linkClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { LiveNotice } from "./session-actions";

/**
 * Start an away séance now, or put it on a day of the calendar (a planned
 * séance, started later from the calendar or the journal). `redo` is the
 * compact "do it again" button of the history.
 */
export function AwayActions({ locale, awayKey, title, today, redo = false }: {
  locale: Locale; awayKey: string; title: string; today: string; redo?: boolean;
}) {
  const a = awayDictionary(locale);
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [error, setError] = useState<{ live: boolean; liveId?: string } | null>(null);
  const [done, setDone] = useState<{ id: string; date: string } | null>(null);

  function create(startNow: boolean) {
    setError(null);
    start(async () => {
      const r = await createTrainingSession({
        source: "away", awayKey, date: startNow ? today : date, time: startNow ? "" : time, startNow,
      });
      if (!r.ok) { setError({ live: r.error === "live", liveId: r.liveId }); return; }
      if (startNow) { router.push("/train/sessions/" + r.data.id); return; }
      setDone({ id: r.data.id, date });
      setOpen(false);
      router.refresh();
    });
  }

  if (redo) {
    return <div className="space-y-2">
      <button type="button" disabled={pending} onClick={() => create(true)} className={buttonClass("secondary", "sm")}>
        <RotateCcw aria-hidden="true" className="size-4" /> {a.redo}</button>
      {error ? (error.live ? <LiveNotice locale={locale} liveId={error.liveId} /> : <p role="alert" className="text-xs font-semibold text-danger">{a.error}</p>) : null}
    </div>;
  }

  return <div className="space-y-3">
    <div className="leblond-actions">
      <button type="button" disabled={pending} onClick={() => create(true)} className={buttonClass("primary", "md")}>
        <Play aria-hidden="true" className="size-4" /> {a.start}</button>
      <button type="button" disabled={pending} aria-expanded={open} aria-controls={id + "-schedule"} onClick={() => setOpen(!open)}
        className={buttonClass("secondary", "md")}><CalendarPlus aria-hidden="true" className="size-4" /> {a.schedule}</button>
    </div>
    {open ? <form id={id + "-schedule"} aria-label={fmt(a.scheduleTitle, { name: title })}
      onSubmit={(e) => { e.preventDefault(); create(false); }}
      className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-sm font-semibold">{a.date}
        <input className={fieldClass} type="date" required min={today} max="2100-12-31" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="text-sm font-semibold">{a.time}
        <input className={fieldClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <button type="submit" disabled={pending || !date} className={buttonClass("primary", "md", "col-span-2 sm:col-span-1")}>{a.addToCalendar}</button>
    </form> : null}
    {done ? <p role="status" className="text-sm text-ink-2">
      {fmt(a.scheduled, { date: formatDate(done.date + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" }) })}{" "}
      <Link href={"/train/sessions/" + done.id} className={linkClass}>{a.open}</Link></p> : null}
    {error ? (error.live ? <LiveNotice locale={locale} liveId={error.liveId} /> : <p role="alert" className="text-sm font-semibold text-danger">{a.error}</p>) : null}
  </div>;
}
