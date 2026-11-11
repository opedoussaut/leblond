import type { coachSummary } from "@/lib/analytics/alter-ego";
import {
  DEFAULT_TREND_RULE,
  DEFAULT_WORKING_LEVEL_RULE,
  type HighestGrade,
  type NativeDistribution,
  type SessionSummary,
  type Snapshot,
} from "@/lib/analytics";
import type { RouteSummary } from "@/lib/analytics/routes";
import type { GradeSystem } from "@/lib/climbing/types";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { listGrades, RELIABLE_CONFIDENCE } from "@/lib/grading";
import type { Injury } from "@/lib/training/health";
import {
  changesSinceBaseline, discomfortReports, hardestMovement, mobilityOverview, mobilityPeriods, sideComparison,
  type AssessmentPoint,
} from "@/lib/analytics/mobility";
import { MOBILITY_TESTS } from "@/lib/training/hip-mobility/assessment";
import { EXERCISE_BY_ID, LEVEL_LABELS } from "@/lib/training/hip-mobility/content";
import { summarizePerformance, type MobilitySessionRecord, type SessionPlan } from "@/lib/training/hip-mobility/prescription";
import type { DayOutcome, ProgrammeView } from "@/lib/training/programme";

/**
 * The real grade scales for the systems this climber uses, easiest first, so
 * the model never invents a colour or guesses the "next" grade. Mystery and
 * unordered grades are listed separately.
 */
export function gradeScalesFor(systems: Iterable<GradeSystem>) {
  const out: Record<string, { ordered: string[]; unranked: string[] }> = {};
  for (const system of new Set(systems)) {
    if (system === "UNKNOWN") continue;
    const grades = listGrades(system);
    out[system] = {
      ordered: grades.filter((g) => g.ordinal !== null).map((g) => g.id),
      unranked: grades.filter((g) => g.ordinal === null).map((g) => g.id),
    };
  }
  return out;
}

/**
 * Builds the bounded, structured evidence Patrick receives.
 *
 * Patrick NEVER sees raw database rows: only figures computed by lib/analytics,
 * trimmed to a fixed budget. Everything here is a pure function so it can be
 * tested, and so the exact context sent to the model is reproducible.
 */

export const QUICK_ACTIONS = [
  "climbToday",
  "lastSession",
  "holdingBack",
  "targetDistance",
  "project",
  "nextSession",
  "compareGyms",
  "fatigue",
  "mobility",
] as const;
export type QuickAction = (typeof QUICK_ACTIONS)[number];

export interface RecentSessionInput {
  id: string;
  /** BOULDER sessions carry problems/tops/flashes/attempts; ROUTE sessions carry `routes`. */
  discipline?: "BOULDER" | "ROUTE";
  routes?: { climbed: number; clean: number; onsights: number; hardestClean: string | null } | null;
  startedAt: string;
  gymName: string;
  gymBrand: string;
  durationMinutes: number | null;
  problems: number;
  tops: number;
  flashes: number;
  attempts: number;
  energyBefore: number | null;
  energyAfter: number | null;
  fatigue: number | null;
  motivation: number | null;
  wearable: { avgHeartRate: number | null; maxHeartRate: number | null; trainingLoad: number | null; device: string | null } | null;
}

export interface FocusSessionInput {
  id: string;
  gymName: string;
  gymBrand: string;
  startedAt: string;
  ended: boolean;
  notes: string | null;
  summary: SessionSummary;
  problems: Array<{
    grade: string;
    system: string;
    fontEstimate: { grade: string; confidence: number } | null;
    wallAngle: string;
    styles: string[];
    attemptsThisSession: number;
    result: "FLASH" | "TOP" | "NOT_SENT";
    totalAttemptsEver: number;
  }>;
}

export interface FocusProjectInput {
  status: string;
  startedAt: string;
  notes: string | null;
  grade: string;
  system: string;
  gymName: string;
  wallAngle: string;
  styles: string[];
  attempts: Array<{ n: number; result: string; date: string }>;
  sessionsCount: number;
  videos: number;
}

export interface RouteAscentInput {
  grade: string;
  style: "LEAD" | "TOPROPE" | "AUTOBELAY";
  result: "ONSIGHT" | "FLASH" | "REDPOINT" | "TOP_WITH_REST" | "ATTEMPT";
  falls: number | null;
  project: string | null;
}

export interface RouteClimbingInput {
  last30: RouteSummary;
  last90: RouteSummary;
  leadWorkingGrade: { grade: string | null; sampleSize: number };
}

export interface FocusRouteSessionInput {
  gymName: string;
  startedAt: string;
  ended: boolean;
  notes: string | null;
  summary: RouteSummary;
  ascents: RouteAscentInput[];
}

export interface FocusRouteProjectInput {
  name: string;
  grade: string;
  goalStyle: string;
  status: string;
  gymName: string;
  startedAt: string;
  sentAt: string | null;
  notes: string;
  goes: Array<{ n: number; date: string; style: string; result: string; falls: number | null }>;
  sessionsCount: number;
}

/** The programme in progress and the latest daily check-in (bilan du jour), as loaded by lib/data/programme. */
export interface CoachTrainingInput {
  view: ProgrammeView | null;
  lastCheck: {
    date: string; outcome: DayOutcome; reasons: readonly string[];
    input: { sleep: number; fatigue: number; soreness: number; pain: readonly Injury[]; minutes: number; place: string };
  } | null;
  replanSuggested: boolean;
}

/**
 * Bounded summary of the climber's training programme for Patrick: method,
 * week X of N, availability, the next session, declared body areas (self-reported,
 * not a diagnosis) and the last daily check-in. Null when there is nothing to say.
 */
export function trainingContext(input: CoachTrainingInput | null | undefined) {
  if (!input || (!input.view && !input.lastCheck)) return null;
  const v = input.view;
  const c = input.lastCheck;
  return {
    programme: v ? {
      methodId: v.methodId,
      goal: v.goal.slice(0, 120),
      discipline: v.discipline,
      week: v.week,
      horizonWeeks: v.horizonWeeks,
      finished: v.finished,
      nextFullAssessment: v.nextReassessment,
      fullAssessmentDue: v.reassessmentDue,
      climbingSessionsPerWeek: v.availability.climbingPerWeek,
      offWallSessionsPerWeek: v.availability.offWallPerWeek,
      homeEquipment: v.availability.homeEquipment,
      weeklyTemplate: (v.plan?.sessions ?? []).slice(0, 14).map((s) => ({
        weekday: s.day, methodId: s.methodId, title: s.title ?? null, minutes: s.minutes, place: s.place ?? null,
      })),
      nextSession: v.next ? { date: v.next.date, title: v.next.title, minutes: v.next.minutes, place: v.next.place } : null,
    } : null,
    declaredBodyAreas: v ? v.health.injuries.map((i) => ({ area: i.area, level: i.level })) : [],
    unlocalisedPainDeclared: v?.health.unspecifiedPain ?? false,
    lastDailyCheck: c ? {
      date: c.date,
      sleep: c.input.sleep,
      fatigue: c.input.fatigue,
      soreness: c.input.soreness,
      pain: c.input.pain.map((p) => ({ area: p.area, level: p.level })),
      minutesAvailable: c.input.minutes,
      place: c.input.place,
      outcome: c.outcome,
      reasons: c.reasons.slice(0, 8),
    } : null,
    replanSuggested: input.replanSuggested,
  };
}

/** The hip-mobility programme as loaded by lib/data/mobility (records and plan are already computed). */
export interface CoachMobilityInput {
  enrollment: { startedOn: string; workingLevel: number; sessionLength: "SHORT" | "STANDARD"; sessionsPerWeek: number; status: "ACTIVE" | "PAUSED" } | null;
  assessments: readonly AssessmentPoint[];
  records: readonly MobilitySessionRecord[];
  plan: SessionPlan | null;
  today: string;
}

const exerciseName = (id: string) => EXERCISE_BY_ID.get(id)?.name.en ?? id;
const testName = (id: string) => MOBILITY_TESTS.find((t) => t.id === id)?.name.en ?? id;

/**
 * Bounded hip-mobility summary for Patrick: the computed internal stage (a label,
 * NOT clinical), the latest assessment and its changes against the first
 * comparable one, recent sessions per exercise and side, the current prescription
 * with any offered increase, and whether a clinician check is recommended.
 * Everything is computed by lib/analytics and lib/training; Patrick only explains it.
 */
export function mobilityContext(input: CoachMobilityInput | null | undefined) {
  if (!input || (!input.enrollment && input.assessments.length === 0 && input.records.length === 0)) return null;
  const points = [...input.assessments].sort((a, b) => b.date.localeCompare(a.date));
  const latest = points[0] ?? null;
  const records = [...input.records].sort((a, b) => b.date.localeCompare(a.date));
  const overview = mobilityOverview(records, points, input.today);
  const hardest = hardestMovement(records);
  const unitOf = (test: string, side: string) => {
    const def = MOBILITY_TESTS.find((t) => t.id === test);
    return (side === "BOTH" ? def?.both?.unit : def?.value.unit) ?? "";
  };
  const measured = (test: string, side: string, value: number | null) => (value === null ? null : `${value} ${unitOf(test, side)}`.trim());
  const some = <T,>(list: readonly T[]) => (list.length ? [...list] : undefined);
  return {
    programme: "Hip Mobility — From Zero to Functional Climbing Mobility",
    enrolled: !!input.enrollment,
    startedOn: input.enrollment?.startedOn ?? null,
    status: input.enrollment?.status ?? null,
    workingLevel: input.enrollment?.workingLevel ?? 0,
    sessionsPerWeekTarget: input.enrollment?.sessionsPerWeek ?? null,
    tests: Object.fromEntries(MOBILITY_TESTS.map((t) => [t.id, testName(t.id)])),
    assessedStage: latest ? { stage: latest.stage, label: LEVEL_LABELS[latest.stage].name.en, date: latest.date } : null,
    latestAssessment: latest ? {
      date: latest.date,
      conditions: latest.conditions ? {
        warmedUp: latest.conditions.warmedUp, timeOfDay: latest.conditions.timeOfDay, cushionCm: latest.conditions.cushionCm,
        wall: latest.conditions.wall ?? undefined,
      } : null,
      results: latest.results.slice(0, 10).map((r) => ({
        test: r.test, side: r.side, level: r.level, notDone: r.done ? undefined : r.skipReason,
        measured: measured(r.test, r.side, r.value), support: r.support, discomfort: r.discomfort,
        active: r.active, warningSigns: some(r.flags),
      })),
    } : null,
    changesSinceFirstComparable: changesSinceBaseline(points).slice(0, 10).map((c) => c.comparable ? {
      test: c.test, side: c.side, since: c.since, direction: c.direction,
      before: { level: c.before.level, measured: measured(c.test, c.side, c.before.value), support: c.before.support },
      after: { level: c.after.level, measured: measured(c.test, c.side, c.after.value), support: c.after.support },
      caveats: some(c.caveats),
    } : { test: c.test, side: c.side, since: c.since, comparable: false, differences: c.differences }),
    sessions: {
      total: overview.sessionsTotal,
      last28Days: overview.sessionsLast28,
      lastDate: overview.lastSession,
      perWeekLast8: mobilityPeriods(records, input.today, "week", 8).map((p) => p.sessions),
    },
    recentSessions: records.slice(0, 3).map((r) => ({
      date: r.date, level: r.level, status: r.status, sessionPain: r.pain, rpe: r.rpe,
      exercises: r.exercises.slice(0, 6).map((e) => {
        const ex = EXERCISE_BY_ID.get(e.exerciseId);
        const sum = ex ? summarizePerformance(ex, e) : null;
        const reps = (side: "LEFT" | "RIGHT" | "BOTH") => {
          const list = e.sets.filter((x) => x.completed && (x.side ?? "BOTH") === side).map((x) => x.reps ?? 0);
          return list.length ? Math.max(...list) : undefined;
        };
        return {
          exercise: exerciseName(e.exerciseId), version: sum?.dose?.variant ?? null,
          reps: { left: reps("LEFT"), right: reps("RIGHT"), both: reps("BOTH") },
          clean: sum?.clean ?? false, maxDiscomfort: sum?.maxDiscomfort ?? 0, warningSigns: some(sum?.flags ?? []),
        };
      }),
    })),
    leftRight: sideComparison(records).slice(0, 4).map((c) => {
      const side = (s: typeof c.left) => ({
        averageReps: s.averageReps, easierShare: Math.round(s.easierShare * 100) / 100,
        averageDiscomfort: s.averageDiscomfort, uncontrolledSets: s.uncontrolled,
      });
      return { exercise: exerciseName(c.exerciseId), harderSide: c.harderSide, left: side(c.left), right: side(c.right) };
    }),
    discomfortReports: discomfortReports(records, 3, 6).map((d) => ({
      date: d.date, exercise: d.exerciseId ? exerciseName(d.exerciseId) : "whole session", side: d.side ?? undefined,
      discomfort: d.discomfort, warningSigns: some(d.flags),
    })),
    hardestMovement: hardest ? exerciseName(hardest.exerciseId) : null,
    nextSession: input.plan ? {
      level: input.plan.level,
      exercises: input.plan.decisions.map((d) => ({
        exercise: exerciseName(d.exerciseId), dose: d.dose, offeredIncrease: d.offer, reason: d.reason, stepBack: d.stepBack || undefined,
      })),
      leftOutForDeclaredAreas: some(input.plan.excluded.map(exerciseName)),
    } : null,
    progressionSupportedByRecords: !!input.plan && input.plan.decisions.some((d) => d.offer !== null),
    clinicianCheckRecommended: input.plan ? input.plan.clinician.recommended : false,
    clinicianReasons: input.plan ? input.plan.clinician.reasons : [],
  };
}

export interface CoachContextInput {
  climber: { name: string; language: "fr" | "en"; target: { grade: string; system: string } };
  snapshot30: Snapshot;
  snapshot90: Snapshot;
  recentSessions: RecentSessionInput[];
  focusSession?: FocusSessionInput | null;
  focusProject?: FocusProjectInput | null;
  activeProjects: Array<{ grade: string; system: string; attempts: number; gymName: string }>;
  routeClimbing?: RouteClimbingInput | null;
  focusRouteSession?: FocusRouteSessionInput | null;
  focusRouteProject?: FocusRouteProjectInput | null;
  activeRouteProjects?: Array<{ name: string; grade: string; goalStyle: string; gymName: string; goes: number }>;
  quickAction?: QuickAction | null;
  alterEgo?: ReturnType<typeof coachSummary> | null;
  training?: CoachTrainingInput | null;
  mobility?: CoachMobilityInput | null;
  now: Date;
}

export const CONTEXT_CHAR_BUDGET = 14_000;

const round = (n: number | null | undefined, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const rate = (r: { numerator: number; denominator: number; value: number | null }) => ({
  value: round(r.value),
  count: `${r.numerator}/${r.denominator}`,
});
const highest = (hs: HighestGrade[]) =>
  hs.map((h) => ({
    system: h.system,
    grade: h.grade,
    fontEstimate: h.normalized && h.system !== "FONT" ? { grade: h.normalized.grade, confidence: h.normalized.confidence } : null,
  }));
const distribution = (ds: NativeDistribution[]) =>
  ds.map((d) => ({ system: d.system, grades: d.buckets.map((b) => ({ grade: b.grade, sent: b.sent, tried: b.attempted, flashed: b.flashed })) }));

function routePeriod(s: RouteSummary, days: number) {
  return {
    days,
    routes: s.ascents,
    topped: s.topped,
    clean: s.clean,
    onsights: s.onsights,
    flashes: s.flashes,
    redpoints: s.redpoints,
    byStyle: { lead: s.lead, toprope: s.toprope, autobelay: s.autobelay },
    cleanRate: rate(s.cleanRate),
    hardestCleanLead: s.highestLeadClean,
    hardestClean: s.highestClean,
    hardestOnsight: s.highestOnsight,
    cleanPyramid: s.pyramid.slice(0, 8).map((p) => ({ grade: p.grade, clean: p.clean, onLead: p.lead })),
  };
}

function period(s: Snapshot) {
  return {
    days: s.periodDays,
    sessions: s.counts.sessions,
    problems: s.counts.problems,
    attempts: s.counts.attempts,
    tops: s.counts.tops,
    flashes: s.counts.flashes,
    sendRate: rate(s.sendRate),
    flashRate: rate(s.flashRate),
    attemptsPerSend: { value: round(s.attemptsPerSend.value), sends: s.attemptsPerSend.sends },
    highestSent: highest(s.highestSent),
    highestFlashed: highest(s.highestFlashed),
  };
}

export function buildCoachContext(input: CoachContextInput) {
  const { snapshot30: s30, snapshot90: s90 } = input;
  const ctx = {
    generatedAt: input.now.toISOString(),
    climber: {
      name: input.climber.name,
      language: input.climber.language,
      target: input.climber.target,
      workingLevels: s90.workingLevels.map((w) => ({
        system: w.system,
        level: w.level,
        evidence: w.levels.map((l) => `${l.grade}: ${l.sends}/${l.problems} sent`),
      })),
      fontWorkingGrade: s90.workingGrade.level,
    },
    gradeScales: {
      ...gradeScalesFor([
      input.climber.target.system as GradeSystem,
      ...s90.workingLevels.map((w) => w.system as GradeSystem),
      ...s90.crossGym.native.flatMap((n) => n.distributions.map((d) => d.system)),
      ]),
      ...(input.routeClimbing || input.focusRouteSession || input.focusRouteProject
        ? { FRENCH_SPORT_ROUTES: { ordered: [...FRENCH_ROUTE_GRADES], unranked: [] as string[] } } : {}),
    },
    definitions: {
      workingLevel: `Highest grade with, over the last ${DEFAULT_WORKING_LEVEL_RULE.windowDays} days, ≥${DEFAULT_WORKING_LEVEL_RULE.minProblems} distinct problems tried, ≥${DEFAULT_WORKING_LEVEL_RULE.minSends} sent and send rate ≥${DEFAULT_WORKING_LEVEL_RULE.minSendRate * 100}%. Computed per native system; Font uses only estimates with confidence ≥${RELIABLE_CONFIDENCE}.`,
      trend: `Mean of the ${DEFAULT_TREND_RULE.topN} hardest sends (in grade steps) over the last ${DEFAULT_TREND_RULE.windowDays} days vs the previous ${DEFAULT_TREND_RULE.windowDays}; needs ≥${DEFAULT_TREND_RULE.minSendsPerWindow} sends per window and a change ≥${DEFAULT_TREND_RULE.threshold} grade step.`,
      sendRate: "sent problems ÷ problems tried (distinct problems)",
      tops: "distinct problems sent",
      gradeScales: "Each system's grades, easiest first. The next grade up is the next item. Unranked grades (e.g. Climbing District PINK) have no position.",
      routeResults: "Route (sport/roped) ascents: ONSIGHT = first go without beta, FLASH = first go with beta, REDPOINT = no fall after working it (these three are 'clean'); TOP_WITH_REST = reached the top with falls/rests on the rope; ATTEMPT = did not reach the anchor. Styles: LEAD, TOPROPE, AUTOBELAY.",
      routeLeadWorkingGrade: "Hardest French route grade climbed clean on LEAD at least twice in the last 60 days; null unless ≥6 routes were logged in that window. Top-rope and auto-belay never count toward it.",
      routeVsBoulder: "Route grades (French sport scale, lower-case, e.g. 6b+) and boulder grades (Font, colours) are separate scales. Never convert one into the other.",
      trainingProgramme: "Programme set by the climber's latest full assessment: one main method and a weekly template (weekday 0 = Monday) repeated for horizonWeeks, until the next full assessment.",
      declaredBodyAreas: "Self-reported by the climber, NOT a diagnosis. DISCOMFORT = train at reduced load; PAIN = avoid loading that area; ACUTE = stop loading it and see a health professional.",
      mobility: "Hip Mobility programme. Stages 0–4 are LEBLOND's internal training stages, NOT a clinical assessment. Assessment performance levels are described levels (0–4) per test and side; 'measured' values are tape-measure cm or counts taken by the climber; tests are named by letter (see 'tests'); discomfort is self-reported 0–10. Changes are only meaningful when 'comparable' is true. Versions: EASIER < STANDARD < HARDER. 'offeredIncrease' is the only progression the records support; null means stay or step back.",
      dailyCheck: "Daily check-in (self-reported): sleep 1 = poor … 3 = good; fatigue 1 = fresh … 3 = very tired; soreness 0 = none … 2 = marked. outcome is what LEBLOND recommended for that day: AS_PLANNED, REDUCED, TECHNIQUE, MOBILITY or REST.",
    },
    last30Days: period(s30),
    last90Days: period(s90),
    trends: s90.trends.map((t) => ({
      scale: t.scale,
      direction: t.direction,
      recentScore: round(t.recentScore),
      previousScore: round(t.previousScore),
      recentSends: t.recentSends,
      previousSends: t.previousSends,
    })),
    roadToTarget: s90.roadToTarget.dimensions.map((d) => ({ dimension: d.key, status: d.status, evidence: d.evidence })),
    gyms: {
      native: s90.crossGym.native.map((n) => ({ network: n.brand, distributions: distribution(n.distributions) })),
      normalizedFont: {
        sufficient: s90.crossGym.normalized.sufficient,
        coverage: s90.crossGym.normalized.coverage,
        grades: s90.crossGym.normalized.sufficient
          ? s90.crossGym.normalized.buckets.map((b) => ({ grade: b.grade, sent: b.sent, tried: b.attempted }))
          : [],
      },
      perGym: s90.gymBreakdown.slice(0, 8).map((g) => ({
        name: g.gym.name,
        network: g.gym.brand,
        sessions: g.sessions,
        problems: g.problems,
        sendRate: rate(g.sendRate),
      })),
    },
    styles: s90.styleStats
      .filter((s) => s.problems > 0)
      .sort((a, b) => b.problems - a.problems)
      .slice(0, 12)
      .map((s) => ({ style: s.key, sent: s.sent, tried: s.problems })),
    wallAngles: s90.wallAngleStats.map((s) => ({ angle: s.key, sent: s.sent, tried: s.problems })),
    recentSessions: input.recentSessions.slice(0, 8),
    wearable: {
      latestComparison: s90.wearable.latestTrend
        ? {
            avgHeartRate: s90.wearable.latestTrend.avgHeartRate,
            baselineAvgHeartRate: round(s90.wearable.latestTrend.baselineAvgHeartRate, 0),
            comparableSessions: s90.wearable.latestTrend.comparableSessions,
            direction: s90.wearable.latestTrend.direction,
            rule: "previous 3 sessions within ±25% duration; ≥5 bpm difference to call higher/lower",
          }
        : null,
      sessionsWithWearableData: s90.wearable.sessions.length,
    },
    activeProjects: input.activeProjects.slice(0, 6),
    routeClimbing: input.routeClimbing && input.routeClimbing.last90.ascents > 0
      ? {
          last30Days: routePeriod(input.routeClimbing.last30, 30),
          last90Days: routePeriod(input.routeClimbing.last90, 90),
          leadWorkingGrade: input.routeClimbing.leadWorkingGrade,
        }
      : null,
    activeRouteProjects: (input.activeRouteProjects ?? []).slice(0, 6),
    focusRouteSession: input.focusRouteSession
      ? {
          gymName: input.focusRouteSession.gymName,
          startedAt: input.focusRouteSession.startedAt,
          ended: input.focusRouteSession.ended,
          notes: input.focusRouteSession.notes,
          summary: routePeriod(input.focusRouteSession.summary, 0),
          ascents: input.focusRouteSession.ascents.slice(0, 40),
        }
      : null,
    focusRouteProject: input.focusRouteProject
      ? { ...input.focusRouteProject, goes: input.focusRouteProject.goes.slice(-40) }
      : null,
    focusSession: input.focusSession
      ? {
          ...input.focusSession,
          summary: {
            durationMinutes: input.focusSession.summary.durationMinutes,
            problems: input.focusSession.summary.problems,
            tops: input.focusSession.summary.tops,
            flashes: input.focusSession.summary.flashes,
            attempts: input.focusSession.summary.attempts,
            highestSent: highest(input.focusSession.summary.highestSent),
            mostSuccessfulStyle: input.focusSession.summary.mostSuccessfulStyle?.key ?? null,
            hardestStyle: input.focusSession.summary.hardestStyle?.key ?? null,
            wearable: input.focusSession.summary.wearable,
          },
          problems: input.focusSession.problems.slice(0, 40),
        }
      : null,
    focusProject: input.focusProject
      ? { ...input.focusProject, attempts: input.focusProject.attempts.slice(-40) }
      : null,
    quickAction: input.quickAction ?? null,
    alterEgo: input.alterEgo ?? null,
    training: trainingContext(input.training),
    mobility: mobilityContext(input.mobility),
  };
  return enforceBudget(ctx);
}

export type CoachContext = ReturnType<typeof buildCoachContext>;

/** Trim the least important lists until the serialised context fits the budget. */
function enforceBudget<T extends Record<string, unknown>>(ctx: T): T {
  const trimmable: Array<[keyof T & string, number]> = [
    ["styles", 6],
    ["recentSessions", 4],
    ["wallAngles", 4],
  ];
  let json = JSON.stringify(ctx);
  for (const [key, keep] of trimmable) {
    if (json.length <= CONTEXT_CHAR_BUDGET) break;
    const v = ctx[key];
    if (Array.isArray(v)) (ctx as Record<string, unknown>)[key] = v.slice(0, keep);
    json = JSON.stringify(ctx);
  }
  const fs = ctx.focusSession as { problems?: unknown[] } | null;
  if (json.length > CONTEXT_CHAR_BUDGET && fs?.problems) fs.problems = fs.problems.slice(0, 15);
  json = JSON.stringify(ctx);
  const frs = ctx.focusRouteSession as { ascents?: unknown[] } | null;
  if (json.length > CONTEXT_CHAR_BUDGET && frs?.ascents) frs.ascents = frs.ascents.slice(0, 15);
  json = JSON.stringify(ctx);
  const mob = ctx.mobility as { recentSessions?: unknown[]; leftRight?: unknown[]; discomfortReports?: unknown[] } | null | undefined;
  if (json.length > CONTEXT_CHAR_BUDGET && mob) {
    mob.recentSessions = mob.recentSessions?.slice(0, 1);
    mob.leftRight = mob.leftRight?.slice(0, 2);
    mob.discomfortReports = mob.discomfortReports?.slice(0, 3);
  }
  return ctx;
}

export function serializeContext(ctx: CoachContext): string {
  return `LEBLOND_CONTEXT = ${JSON.stringify(ctx)}`;
}
