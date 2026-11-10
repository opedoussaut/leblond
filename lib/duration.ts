/**
 * Durations are stored in whole minutes and typed the way people say them
 * ("1h30", "1:30", "90", "45 min"), or picked from common values.
 * Pure helpers for the duration field and its validation.
 */

export function splitMinutes(total: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function joinDuration(hours: number, minutes: number): number {
  return Math.max(0, Math.trunc(hours)) * 60 + Math.max(0, Math.min(59, Math.trunc(minutes)));
}

/** "45 min", "1 h", "1 h 30", "2 h 05". */
export function formatDuration(total: number): string {
  const { hours, minutes } = splitMinutes(total);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

/**
 * Reads a typed duration, in minutes. Accepts:
 *   "90", "90 min", "90mn", "90m"   minutes
 *   "1h30", "1 h 30", "1h30min", "2h", "1:30"   hours and minutes (minutes below 60)
 *   "1,5 h", "1.5h"   decimal hours
 * Returns null for an empty text, undefined when the text cannot be read.
 */
export function parseDuration(text: string): number | null | undefined {
  const s = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;
  let m = /^(\d{1,4}) ?(?:min|mn|m)?$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d{1,2}) ?(?:h|:) ?(?:(\d{1,2}) ?(?:min|mn|m)?)?$/.exec(s);
  if (m) {
    const minutes = m[2] == null ? 0 : Number(m[2]);
    if (minutes > 59) return undefined;
    // "1h3" reads as 1 h 03, "1:3" too: a single digit is a number of minutes.
    return Number(m[1]) * 60 + minutes;
  }
  m = /^(\d{1,2})[.,](\d{1,2}) ?h$/.exec(s);
  if (m) return Math.round(Number(`${m[1]}.${m[2]}`) * 60);
  return undefined;
}

/** Common durations offered as one-tap choices, within the allowed range. */
export function durationPresets(min: number, max: number): number[] {
  return [30, 45, 60, 90, 120, 180].filter((d) => d >= min && d <= max);
}

/** The drop-down list under the typed field: every 15 min up to 6 h, within the allowed range. */
export function durationSuggestions(min: number, max: number): number[] {
  const out: number[] = [];
  for (let d = 15; d <= Math.min(max, 360); d += 15) if (d >= min) out.push(d);
  return out;
}

export function durationProblem(total: number, min: number, max: number): "tooShort" | "tooLong" | null {
  if (total < min) return "tooShort";
  if (total > max) return "tooLong";
  return null;
}
