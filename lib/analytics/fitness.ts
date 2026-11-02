import type { SavedAssessment, SavedCheckin } from "@/lib/training/assessment";
import {
  PROTOCOL_TESTS, compareMeasurements, parseMeasurements, reassessmentDate,
  type Measurement, type MeasurementChange, type TestDefinition,
} from "@/lib/training/assessment-protocol";
import { TRAINING_AXES, type TrainingAxis } from "@/lib/training/catalogue";

/**
 * How a climber's fitness evolves across repeated assessments. Measured tests
 * and self-ratings stay in separate series and are never merged into one score:
 * a line only ever shows a single test, read in its own unit.
 */

export type FitnessPoint = { date: string; value: number; partial: boolean };

export type MeasuredSeries = {
  test: TestDefinition;
  points: FitnessPoint[];
  latest: FitnessPoint;
  /** First against latest result; null until the test was repeated. */
  change: MeasurementChange | null;
};

export type SelfRatedSeries = { axis: TrainingAxis; points: FitnessPoint[] };

type AssessmentFacts = Pick<SavedAssessment, "measurements" | "createdAt">;

/** One series per protocol test that has at least one result, oldest result first. */
export function measuredHistory(assessments: AssessmentFacts[]): MeasuredSeries[] {
  const chronological = [...assessments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const results = chronological.flatMap((a) => parseMeasurements(a.measurements));
  return PROTOCOL_TESTS.flatMap((test) => {
    const taken: Measurement[] = results.filter((m) => m.id === test.id);
    const order = new Map(taken.map((m, i) => [m, i]));
    const sorted = [...taken].sort((a, b) => a.date.localeCompare(b.date) || order.get(a)! - order.get(b)!);
    if (!sorted.length) return [];
    const points = sorted.map((m) => ({ date: m.date, value: m.value, partial: m.quality !== "complete" }));
    const first = sorted[0], last = sorted[sorted.length - 1];
    return [{
      test, points, latest: points[points.length - 1],
      change: sorted.length > 1 ? compareMeasurements([first], [last])[0] ?? null : null,
    }];
  });
}

/** Self-reported 1–5 ratings over time, from assessments and their follow-up check-ins. */
export function selfRatedHistory(
  assessments: Pick<SavedAssessment, "ratings" | "createdAt">[],
  checkins: Pick<SavedCheckin, "ratings" | "createdAt">[],
): SelfRatedSeries[] {
  const entries = [...assessments, ...checkins].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return TRAINING_AXES.map((axis) => ({
    axis,
    points: entries.map((e) => ({ date: e.createdAt.slice(0, 10), value: e.ratings[axis], partial: false })),
  }));
}

export type AssessmentCadence = { last: string; next: string; due: boolean };

/** When the latest assessment was done and when the next one is suggested; null before the first. */
export function assessmentCadence(
  assessments: Pick<SavedAssessment, "horizonWeeks" | "createdAt">[],
  today: string,
): AssessmentCadence | null {
  const latest = [...assessments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return null;
  const last = latest.createdAt.slice(0, 10);
  const next = reassessmentDate(last, latest.horizonWeeks);
  return { last, next, due: next <= today };
}
