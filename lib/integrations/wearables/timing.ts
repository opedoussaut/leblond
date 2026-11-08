import { DEFAULT_TZ, utcToZoned } from "@/lib/time";

/** Pure helper (client-safe): compares a watch activity's timing with a climbing session's. */

export type TimingSide = {
  /** Local date (YYYY-MM-DD) and start / end times (HH:MM) in the climber's time zone. */
  date: string;
  start: string;
  end: string | null;
  minutes: number | null;
};

export type TimingComparison = {
  activity: TimingSide;
  session: TimingSide;
  /** The start minute or the duration differ. */
  differs: boolean;
  /** The watch's timing can replace the session's (finished session, plausible duration, not in the future). */
  usable: boolean;
  reason: "live" | "noTiming" | "future" | null;
};

export function activityMinutes(durationSeconds: number): number {
  return Math.round(durationSeconds / 60);
}

export function compareTiming(
  activity: { startedAt: string | Date; durationSeconds: number },
  session: { startedAt: string | Date; endedAt: string | Date | null; durationMinutes: number | null },
  now: Date = new Date(),
  timeZone = DEFAULT_TZ,
): TimingComparison {
  const aStart = new Date(activity.startedAt);
  const aEnd = new Date(aStart.getTime() + activity.durationSeconds * 1000);
  const aMinutes = activityMinutes(activity.durationSeconds);
  const sStart = new Date(session.startedAt);
  const sEnd = session.endedAt ? new Date(session.endedAt) : null;
  const sMinutes = session.durationMinutes ?? (sEnd ? Math.round((sEnd.getTime() - sStart.getTime()) / 60_000) : null);

  const a = utcToZoned(aStart, timeZone);
  const s = utcToZoned(sStart, timeZone);
  const differs =
    Math.floor(aStart.getTime() / 60_000) !== Math.floor(sStart.getTime() / 60_000) || aMinutes !== sMinutes;
  const reason = !sEnd ? "live" : aMinutes < 1 || aMinutes > 1440 ? "noTiming" : aStart.getTime() > now.getTime() ? "future" : null;
  return {
    activity: { date: a.date, start: a.time, end: utcToZoned(aEnd, timeZone).time, minutes: aMinutes },
    session: { date: s.date, start: s.time, end: sEnd ? utcToZoned(sEnd, timeZone).time : null, minutes: sMinutes },
    differs,
    usable: reason === null,
    reason,
  };
}
