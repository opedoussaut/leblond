/**
 * Wall-clock ⇄ instant conversion for a named time zone (default Europe/Paris),
 * correct across daylight-saving changes. Used when a climber types the local
 * date and time of a past session.
 */
export const DEFAULT_TZ = "Europe/Paris";

function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((wall - at.getTime()) / 60_000);
}

/** The instant at which the wall clock in `timeZone` shows `date` (YYYY-MM-DD) `time` (HH:MM). */
export function zonedToUtc(date: string, time: string, timeZone = DEFAULT_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let guess = naive - offsetMinutes(new Date(naive), timeZone) * 60_000;
  // Re-check at the guessed instant: the offset may differ on DST change days.
  guess = naive - offsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess);
}

/** Local date (YYYY-MM-DD) and time (HH:MM) of an instant in `timeZone`. */
export function utcToZoned(at: Date | string, timeZone = DEFAULT_TZ): { date: string; time: string } {
  const d = typeof at === "string" ? new Date(at) : at;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
