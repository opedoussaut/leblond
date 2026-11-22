import { isMobilityWork } from "@/lib/analytics/charts";
import { HIP_METHOD_ID, type Level, type TestId } from "@/lib/training/hip-mobility/content";
import type { LevelView } from "@/lib/training/hip-mobility/levels";
import { REBUILD_METHOD_ID, reassessments } from "@/lib/training/mobility-rebuild/engine";
import { mondayOf } from "@/lib/training/sessions";

/**
 * Suivi › Mobilité: every mobility séance the climber did, whatever started it
 * (the hip programme, the 12-week Rebuild programme, a coach or Atlas mobility
 * séance), and the three answers of the page's first screen: where I am, what
 * I aim for, what I have done. Pure: the loader passes plain facts in.
 */

export type MobilitySource = "HIP" | "REBUILD" | "LIBRARY";

export type MobilitySessionFact = {
  id: string;
  title: string;
  methodId: string | null;
  enrollmentId: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "INTERRUPTED" | "SKIPPED" | string;
  /** Local day of the séance (scheduled, else completed, else created). */
  date: string;
  actualMinutes: number | null;
  plannedMinutes: number | null;
  /** Method ids of its exercises (used only when the séance has no method of its own, e.g. coach séances). */
  exerciseMethodIds: readonly (string | null)[];
};

export type MobilitySessionItem = {
  id: string; title: string; date: string; source: MobilitySource;
  status: "COMPLETED" | "INTERRUPTED";
  /** Recorded minutes, else the planned ones (flagged), else null. */
  minutes: number | null; minutesPlanned: boolean;
};

export type UpcomingMobility = { id: string; title: string; date: string | null; source: MobilitySource; inProgress: boolean };

/** Which kind of mobility séance it is, or null when it is not mobility work. */
export function mobilitySource(f: Pick<MobilitySessionFact, "methodId" | "enrollmentId" | "exerciseMethodIds">): MobilitySource | null {
  if (f.methodId === REBUILD_METHOD_ID || f.enrollmentId) return "REBUILD";
  if (f.methodId === HIP_METHOD_ID) return "HIP";
  return isMobilityWork(f.methodId, f.exerciseMethodIds) ? "LIBRARY" : null;
}

const finished = (s: string): s is "COMPLETED" | "INTERRUPTED" => s === "COMPLETED" || s === "INTERRUPTED";

/** Done mobility séances (completed or interrupted), newest first, each séance once even if several reads returned it. */
export function doneMobilitySessions(facts: readonly MobilitySessionFact[], today: string): MobilitySessionItem[] {
  const seen = new Set<string>();
  const out: MobilitySessionItem[] = [];
  for (const f of facts) {
    if (seen.has(f.id) || !finished(f.status) || f.date > today) continue;
    const source = mobilitySource(f);
    if (!source) continue;
    seen.add(f.id);
    const minutes = f.actualMinutes ?? f.plannedMinutes ?? null;
    out.push({ id: f.id, title: f.title, date: f.date, source, status: f.status, minutes, minutesPlanned: f.actualMinutes === null && minutes !== null });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** The séance in progress, else the soonest planned one from today on (null when nothing is planned). */
export function nextMobilitySession(facts: readonly MobilitySessionFact[], today: string): UpcomingMobility | null {
  const open = facts.flatMap((f) => {
    const source = mobilitySource(f);
    if (!source) return [];
    if (f.status === "IN_PROGRESS") return [{ id: f.id, title: f.title, date: f.date, source, inProgress: true }];
    if (f.status === "PLANNED" && f.date >= today) return [{ id: f.id, title: f.title, date: f.date as string | null, source, inProgress: false }];
    return [];
  });
  return open.find((u) => u.inProgress) ?? open.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))[0] ?? null;
}

function shiftDays(date: string, by: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

export type MobilityActivity = {
  total: number;
  thisWeek: number;
  last28: number;
  minutesThisWeek: number;
  /** Weeks in a row with at least one séance, ending this week (or last week while this one is still open). */
  streakWeeks: number;
  lastDate: string | null;
  /** Oldest to newest, the current week last. */
  weeks: { start: string; sessions: number }[];
};

export function mobilityActivity(done: readonly MobilitySessionItem[], today: string, weekCount = 8): MobilityActivity {
  const monday = mondayOf(today);
  const byWeek = new Map<string, number>();
  for (const s of done) byWeek.set(mondayOf(s.date), (byWeek.get(mondayOf(s.date)) ?? 0) + 1);
  let start = (byWeek.get(monday) ?? 0) > 0 ? monday : shiftDays(monday, -7);
  let streak = 0;
  while ((byWeek.get(start) ?? 0) > 0) { streak += 1; start = shiftDays(start, -7); }
  const thisWeek = done.filter((s) => s.date >= monday && s.date <= today);
  const since = shiftDays(today, -27);
  return {
    total: done.length,
    thisWeek: thisWeek.length,
    last28: done.filter((s) => s.date >= since && s.date <= today).length,
    minutesThisWeek: thisWeek.reduce((n, s) => n + (s.minutes ?? 0), 0),
    streakWeeks: streak,
    lastDate: done[0]?.date ?? null,
    weeks: Array.from({ length: weekCount }, (_, i) => {
      const w = shiftDays(monday, -7 * (weekCount - 1 - i));
      return { start: w, sessions: byWeek.get(w) ?? 0 };
    }),
  };
}

export type Checkpoint = { key: "S4" | "S8" | "S12"; from: string; due: boolean; daysLeft: number };

/**
 * The Rebuild programme's next reassessment not yet done: S4, S8, S12 open on
 * their day; one counts as done once a bilan 2.0 was recorded on or after it.
 */
export function nextCheckpoint(startedOn: string | null, bilanDates: readonly string[], today: string): Checkpoint | null {
  if (!startedOn) return null;
  for (const x of reassessments(startedOn)) {
    if (bilanDates.some((d) => d >= x.from)) continue;
    const days = Math.round((Date.parse(x.from + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000);
    return { key: x.key, from: x.from, due: days <= 0, daysLeft: Math.max(0, days) };
  }
  return null;
}

export type MobilityCompass = {
  /** Where I am: the latest hip assessment's internal level, else nothing measured. */
  where: { stage: Level; date: string } | null;
  /** The latest finished bilan 2.0 (measured test by test, no level). */
  lastBilan: { date: string; stopped: boolean } | null;
  /** What I aim for: the next internal level and what still blocks it; null before any assessment or at the top. */
  goal: { stage: Level; met: number; counted: number; blockers: TestId[] } | null;
  atTop: boolean;
  checkpoint: Checkpoint | null;
};

export function mobilityCompass(input: {
  latestAssessment: { stage: Level; date: string } | null;
  view: Pick<LevelView, "assessed" | "next" | "nextMetCount" | "nextCounted" | "nextBlockers">;
  bilans: readonly { startedOn: string; status: "IN_PROGRESS" | "COMPLETED" | "STOPPED" }[];
  rebuildStartedOn: string | null;
  today: string;
}): MobilityCompass {
  const closed = input.bilans.filter((b) => b.status !== "IN_PROGRESS").sort((a, b) => b.startedOn.localeCompare(a.startedOn));
  const assessed = input.latestAssessment !== null && input.view.assessed;
  return {
    where: input.latestAssessment,
    lastBilan: closed[0] ? { date: closed[0].startedOn, stopped: closed[0].status === "STOPPED" } : null,
    goal: assessed && input.view.next !== null
      ? { stage: input.view.next, met: input.view.nextMetCount, counted: input.view.nextCounted, blockers: [...input.view.nextBlockers] }
      : null,
    atTop: assessed && input.view.next === null,
    checkpoint: nextCheckpoint(input.rebuildStartedOn, closed.map((b) => b.startedOn), input.today),
  };
}
