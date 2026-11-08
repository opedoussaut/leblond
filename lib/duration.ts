/**
 * Durations are stored in whole minutes and entered as hours + minutes
 * ("2 h 15" rather than "135"). Pure helpers for the picker and its validation.
 */

export function splitMinutes(total: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function joinDuration(hours: number, minutes: number): number {
  return Math.max(0, Math.trunc(hours)) * 60 + Math.max(0, Math.min(59, Math.trunc(minutes)));
}

/** Hour choices from 0 up to the longest allowed duration. */
export function hourChoices(maxMinutes: number): number[] {
  return Array.from({ length: Math.floor(maxMinutes / 60) + 1 }, (_, h) => h);
}

/** Minute choices every `step` minutes, plus the current value when it is off-step (e.g. 2 h 07 from a watch). */
export function minuteChoices(step: number, current?: number | null): number[] {
  const s = Math.min(30, Math.max(1, Math.trunc(step)));
  const choices = new Set<number>();
  for (let m = 0; m < 60; m += s) choices.add(m);
  if (current != null && current >= 0 && current < 60) choices.add(Math.trunc(current));
  return [...choices].sort((a, b) => a - b);
}

export function durationProblem(total: number, min: number, max: number): "tooShort" | "tooLong" | null {
  if (total < min) return "tooShort";
  if (total > max) return "tooLong";
  return null;
}
