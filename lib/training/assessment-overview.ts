import { assessmentStatus, elapsedWeeks, type AssessmentStatus, type SavedAssessment } from "./assessment";
import { parseContext, parseMeasurements, reassessmentDate } from "./assessment-protocol";

/**
 * Where the current full assessment stands, as symbols a climber reads at a
 * glance: each weekly check-in is done, due, late or upcoming, and the whole
 * assessment is on track, due, late or ready to be redone. Pure: dates in,
 * states out; the pages only draw them.
 */

/** One weekly check-in. "late": its week passed without it and a newer one is open. */
export type CheckinState = "done" | "due" | "late" | "upcoming";
/** The assessment as a whole. "reassess": the suggested date for a new full assessment has come. */
export type OverallState = "upcoming" | "on-track" | "due" | "late" | "reassess";
/** A change between two results, never a verdict on the climber. */
export type Trend = "improving" | "stable" | "declining";

export type TimelineWeek = { week: number; state: CheckinState; /** The day the check-in opens (YYYY-MM-DD). */ opens: string };

export type NextStep =
  | { kind: "reassess"; since: string }
  | { kind: "checkin"; week: number }
  | { kind: "wait"; date: string }
  | { kind: "done" };

export type AssessmentOverview = {
  status: AssessmentStatus;
  timeline: TimelineWeek[];
  state: OverallState;
  next: NextStep;
  /** Check-ins whose week passed without one. */
  missed: number;
  /** The day the next check-in opens; null when one is open now or none is left. */
  nextCheckin: string | null;
  /** Suggested date for the next full assessment. */
  reassessOn: string;
  createdOn: string;
};

const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Every weekly check-in of the period, with its state. Week n opens n weeks after the assessment. */
export function checkinTimeline(createdAt: string, horizonWeeks: number, checkinWeeks: number[], now: Date): TimelineWeek[] {
  const open = Math.min(elapsedWeeks(createdAt, now), horizonWeeks);
  const done = new Set(checkinWeeks);
  const created = createdAt.slice(0, 10);
  return Array.from({ length: horizonWeeks }, (_, i) => {
    const week = i + 1;
    const state: CheckinState = done.has(week) ? "done" : week === open ? "due" : week < open ? "late" : "upcoming";
    return { week, state, opens: addDays(created, week * 7) };
  });
}

/** The current assessment's status, what it asks for now, and when the next steps come. */
export function assessmentOverview(
  a: { createdAt: string; horizonWeeks: number }, checkinWeeks: number[], now: Date, today: string,
): AssessmentOverview {
  const status = assessmentStatus(a, checkinWeeks, now);
  const timeline = checkinTimeline(a.createdAt, a.horizonWeeks, checkinWeeks, now);
  const createdOn = a.createdAt.slice(0, 10);
  const reassessOn = reassessmentDate(createdOn, a.horizonWeeks);
  const missed = timeline.filter((w) => w.state === "late").length;
  const upcoming = timeline.find((w) => w.state === "upcoming");
  const nextCheckin = status.dueCheckin === null ? upcoming?.opens ?? null : null;

  const state: OverallState = reassessOn <= today ? "reassess"
    : status.dueCheckin !== null ? (missed > 0 ? "late" : "due")
    : timeline.some((w) => w.state !== "upcoming") ? "on-track" : "upcoming";
  const next: NextStep = state === "reassess" ? { kind: "reassess", since: reassessOn }
    : status.dueCheckin !== null ? { kind: "checkin", week: status.dueCheckin }
    : nextCheckin ? { kind: "wait", date: nextCheckin }
    : { kind: "done" };
  return { status, timeline, state, next, missed, nextCheckin, reassessOn, createdOn };
}

/** Measured tests compare as better / worse / same; read as a trend. */
export function trendFromDirection(direction: "better" | "worse" | "same"): Trend {
  return direction === "better" ? "improving" : direction === "worse" ? "declining" : "stable";
}

/**
 * Self-reported 1–5 ratings: a change under half a point (the smallest step
 * of the scale) reads as stable.
 */
export function ratingTrend(before: number, after: number): Trend {
  const delta = Math.round((after - before) * 100) / 100;
  return delta >= 0.5 ? "improving" : delta <= -0.5 ? "declining" : "stable";
}

/** What an assessment in the history holds, by kind of evidence. */
export type HistoryFacts = { measured: number; observed: number; selfRated: number };

export function historyFacts(record: Pick<SavedAssessment, "measurements" | "context" | "ratings">): HistoryFacts {
  return {
    measured: parseMeasurements(record.measurements).length,
    observed: parseContext(record.context)?.observed.length ?? 0,
    selfRated: Object.keys(record.ratings).length,
  };
}
