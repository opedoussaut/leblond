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
  return ctx;
}

export function serializeContext(ctx: CoachContext): string {
  return `LEBLOND_CONTEXT = ${JSON.stringify(ctx)}`;
}
