import type { Locale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { methodMatches, type SkillRatings } from "./assessment";
import { reassessmentDate, type AssessmentContext, type Availability, type HomeEquipment } from "./assessment-protocol";
import { METHODS_FOR_PLANS } from "./catalogue";
import { healthFromContext, methodVerdict, type BodyArea, type Health, type Injury, type Verdict } from "./health";
import type { PlanPlace, PlanSession } from "./plans";

/**
 * The programme in progress, as ONE notion:
 *   full assessment (bilan complet) → chosen method + weekly template (training_plans row
 *   linked by assessment_id) repeated for `horizonWeeks` → sessions in the calendar.
 * The daily check-in adapts today's session from it. Everything here is pure.
 */

export type Discipline = AssessmentContext["discipline"];

/** Atlas methods that can be done off the wall, at home, with the right equipment. */
export const OFF_WALL_METHODS: ReadonlySet<string> = new Set(["max-hangs", "repeaters", "strength-conditioning"]);
/** Methods whose effort is high enough to swap out on a tired day. */
export const INTENSE_METHODS: ReadonlySet<string> = new Set([
  "limit-bouldering", "max-hangs", "repeaters", "campus", "four-by-four", "strength-conditioning", "periodized",
]);

const COMPLEMENTS: Record<Discipline, readonly string[]> = {
  BOULDER: ["technique", "limit-bouldering"],
  ROUTE: ["easy-volume", "four-by-four", "technique"],
  BOTH: ["technique", "easy-volume", "limit-bouldering"],
};
const SAFE_WALL = ["technique", "easy-volume", "constraints"] as const;
/** Weekday indexes (0 = Monday) for N climbing sessions, spread with recovery days. */
const CLIMB_DAYS: Record<number, readonly number[]> = {
  0: [], 1: [5], 2: [1, 4], 3: [1, 3, 5], 4: [0, 2, 4, 5], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5],
};
const OFF_WALL_PREFERENCE = [2, 6, 0, 3, 5, 1, 4] as const;

export type ProgrammeInput = {
  methodId: string;
  discipline: Discipline;
  availability: Availability;
  health: Health;
  experienceMonths: number;
  locale: Locale;
};

function title(methodId: string | null): string {
  return METHODS_FOR_PLANS.find((m) => m.id === methodId)?.title ?? "";
}

function areaList(because: Verdict["because"], locale: Locale): string {
  const t = journeyDictionary(locale);
  return [...new Set(because.map((b) => b.area))].map((a) => t.areas[a].toLowerCase()).join(", ");
}

/** First method of `candidates` the declared health does not rule out. */
function firstSafe(candidates: readonly (string | null)[], health: Health): { methodId: string | null; verdict: Verdict } | null {
  for (const methodId of candidates) {
    const verdict = methodVerdict(methodId, health);
    if (verdict.status !== "avoid") return { methodId, verdict };
  }
  return null;
}

function offWallOptions(input: ProgrammeInput): string[] {
  const eq = new Set<HomeEquipment>(input.availability.homeEquipment);
  const out: string[] = [];
  if (OFF_WALL_METHODS.has(input.methodId) && input.methodId !== "strength-conditioning" && eq.has("hangboard")) out.push(input.methodId);
  if (eq.has("hangboard") && input.experienceMonths >= 12) out.push(input.methodId === "max-hangs" && input.experienceMonths >= 24 ? "max-hangs" : "repeaters");
  if (eq.has("pullupBar") || eq.has("weights") || eq.has("bands")) out.push("strength-conditioning");
  return [...new Set(out)];
}

/**
 * Proposes the weekly template of a programme: climbing sessions built around
 * the chosen method and the discipline, off-wall sessions from the home
 * equipment, and every session checked against the declared injuries
 * (avoided methods are replaced, adapted ones carry a reduced-load note).
 */
export function proposeProgramme(input: ProgrammeInput): PlanSession[] {
  const t = journeyDictionary(input.locale);
  const { climbingPerWeek, offWallPerWeek } = input.availability;
  const climbDays = CLIMB_DAYS[Math.min(6, climbingPerWeek)] ?? [];
  const sessions: PlanSession[] = [];
  const noteFor = (verdict: Verdict) => verdict.status === "adapt"
    ? fmt(t.programme.adaptNote, { areas: areaList(verdict.because, input.locale) }) : "";
  const mobility = (day: number): PlanSession => ({
    day, methodId: null, minutes: 30, place: "HOME", title: t.programme.mobilityTitle,
    notes: input.health.injuries.length || input.health.unspecifiedPain ? t.programme.mobilityNotesInjury : t.programme.mobilityNotes,
  });

  // Climbing sessions: the chosen method first (unless it belongs off the wall), then complements.
  const offWallChosen = OFF_WALL_METHODS.has(input.methodId) && offWallPerWeek > 0 && offWallOptions(input).includes(input.methodId);
  const rotation = [...new Set([...(offWallChosen ? [] : [input.methodId]), ...COMPLEMENTS[input.discipline]])];
  climbDays.forEach((day, i) => {
    const wanted = rotation[i % rotation.length];
    const picked = firstSafe([wanted, ...SAFE_WALL], input.health);
    if (!picked) { sessions.push(mobility(day)); return; }
    const place: PlanPlace = input.discipline === "ROUTE" ? "ROUTE_GYM"
      : input.discipline === "BOULDER" ? "BOULDER_GYM" : i % 2 === 0 ? "BOULDER_GYM" : "ROUTE_GYM";
    const swapped = picked.methodId !== wanted
      ? fmt(t.programme.swapNote, { from: title(wanted), areas: areaList(methodVerdict(wanted, input.health).because, input.locale) }) : "";
    sessions.push({ day, methodId: picked.methodId, minutes: 90, place, notes: [swapped, noteFor(picked.verdict)].filter(Boolean).join(" ") });
  });

  // Off-wall sessions: equipment-based training, and mobility when there is nothing else or an area to look after.
  const options = offWallOptions(input).flatMap((m) => {
    const verdict = methodVerdict(m, input.health);
    return verdict.status === "avoid" ? [] : [{ methodId: m, verdict }];
  });
  const injured = input.health.injuries.length > 0 || input.health.unspecifiedPain;
  const free = OFF_WALL_PREFERENCE.filter((d) => !climbDays.includes(d));
  for (let i = 0; i < Math.min(6, offWallPerWeek); i++) {
    const day = free[i] ?? OFF_WALL_PREFERENCE[i % OFF_WALL_PREFERENCE.length];
    const lastWithInjury = injured && offWallPerWeek >= 2 && i === offWallPerWeek - 1;
    const option = options.length && !lastWithInjury ? options[i % options.length] : null;
    sessions.push(option
      ? { day, methodId: option.methodId, minutes: 45, place: "HOME", notes: noteFor(option.verdict) }
      : mobility(day));
  }
  return sessions.sort((a, b) => a.day - b.day).slice(0, 14);
}

/** Method suggestions for the assessment: fit to the self-reported gaps, then filtered by health. */
export function methodSuggestions(ratings: SkillRatings, health: Health, limit = 3) {
  const all = methodMatches(ratings, Infinity).map((m) => ({ ...m, verdict: methodVerdict(m.method.id, health) }));
  return {
    suggested: all.filter((m) => m.verdict.status !== "avoid").slice(0, limit),
    setAside: all.filter((m) => m.verdict.status === "avoid"),
  };
}

// ── Programme in progress ───────────────────────────────────────────────────

export type ProgrammeAssessment = {
  id: string; methodId: string; horizonWeeks: number; sessionsPerWeek: number; goal: string;
  /** Local start date (YYYY-MM-DD) of the assessment that set the programme. */
  startDate: string;
  context: AssessmentContext | null;
};
export type ProgrammePlan = { id: string; name: string; sessions: PlanSession[] };
export type ScheduledSession = { id: string; title: string; methodId: string | null; date: string; minutes: number | null };

export type NextSession = {
  date: string; title: string; methodId: string | null; minutes: number | null; place: PlanPlace | null;
  source: "scheduled" | "template"; sessionId: string | null;
};

export type ProgrammeView = {
  assessmentId: string;
  methodId: string;
  goal: string;
  discipline: Discipline;
  startDate: string;
  horizonWeeks: number;
  week: number;
  finished: boolean;
  nextReassessment: string;
  reassessmentDue: boolean;
  availability: Availability;
  health: Health;
  plan: ProgrammePlan | null;
  next: NextSession | null;
};

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); });
  return Math.round((b - a) / 86_400_000);
}
/** 0 = Monday … 6 = Sunday, like plan days. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Availability of an assessment; legacy rows only had a total of sessions per week. */
export function availabilityOf(a: Pick<ProgrammeAssessment, "sessionsPerWeek" | "context">): Availability {
  return a.context?.availability ?? { climbingPerWeek: Math.min(6, a.sessionsPerWeek), offWallPerWeek: 0, homeEquipment: [] };
}

export function sessionTitle(s: Pick<PlanSession, "methodId" | "title">): string {
  return s.title ?? title(s.methodId);
}

/**
 * Where the climber stands in the programme: week X of N, the next session
 * (a scheduled one, or the next day of the weekly template) and the next full
 * assessment date.
 */
export function programmeView(input: {
  assessment: ProgrammeAssessment; plan: ProgrammePlan | null; scheduled: readonly ScheduledSession[]; today: string;
}): ProgrammeView {
  const { assessment: a, plan, today } = input;
  const elapsed = Math.max(0, daysBetween(a.startDate, today));
  const end = addDays(a.startDate, a.horizonWeeks * 7);
  const finished = elapsed >= a.horizonWeeks * 7;
  const nextReassessment = reassessmentDate(a.startDate, a.horizonWeeks);

  const scheduled = [...input.scheduled].filter((s) => s.date >= today).sort((x, y) => x.date.localeCompare(y.date))[0];
  let fromTemplate: NextSession | null = null;
  if (plan && !finished) {
    for (let offset = 0; offset < 7 && !fromTemplate; offset++) {
      const date = addDays(today, offset);
      if (date >= end) break;
      const s = plan.sessions.find((p) => p.day === weekdayOf(date));
      if (s) fromTemplate = { date, title: sessionTitle(s), methodId: s.methodId, minutes: s.minutes, place: s.place ?? null, source: "template", sessionId: null };
    }
  }
  const next: NextSession | null = scheduled && (!fromTemplate || scheduled.date <= fromTemplate.date)
    ? { date: scheduled.date, title: scheduled.title, methodId: scheduled.methodId, minutes: scheduled.minutes, place: null, source: "scheduled", sessionId: scheduled.id }
    : fromTemplate;

  return {
    assessmentId: a.id, methodId: a.methodId, goal: a.goal, discipline: a.context?.discipline ?? "BOULDER",
    startDate: a.startDate, horizonWeeks: a.horizonWeeks,
    week: Math.min(a.horizonWeeks, Math.floor(elapsed / 7) + 1), finished,
    nextReassessment, reassessmentDue: today >= nextReassessment,
    availability: availabilityOf(a), health: healthFromContext(a.context), plan, next,
  };
}

// ── "Réajuster le plan" ─────────────────────────────────────────────────────

export const DAY_OUTCOMES = ["AS_PLANNED", "REDUCED", "TECHNIQUE", "MOBILITY", "REST"] as const;
export type DayOutcome = (typeof DAY_OUTCOMES)[number];
export type DayCheckRecord = { date: string; outcome: DayOutcome; reasons: readonly string[]; pain: readonly Injury[] };

export const REPLAN_WINDOW_DAYS = 10;
const HEALTH_OR_FATIGUE = /^(acute|pain|painAdapt|tired|veryTired)\b/;

/**
 * Suggests re-adjusting the programme when the daily check-ins keep flagging
 * problems over the last ten days: any acute pain, three or more sessions
 * changed because of pain or fatigue, or the same area painful three times.
 * Days changed only for lack of time or place do not count.
 */
export function replanSignal(checks: readonly DayCheckRecord[], today: string): {
  suggested: boolean; acute: boolean; flagged: number; areas: BodyArea[];
} {
  const from = addDays(today, -(REPLAN_WINDOW_DAYS - 1));
  const recent = checks.filter((c) => c.date >= from && c.date <= today);
  const acute = recent.some((c) => c.pain.some((p) => p.level === "ACUTE"));
  const flagged = recent.filter((c) => c.outcome !== "AS_PLANNED" && c.reasons.some((r) => HEALTH_OR_FATIGUE.test(r))).length;
  const counts = new Map<BodyArea, number>();
  for (const c of recent) for (const p of c.pain) counts.set(p.area, (counts.get(p.area) ?? 0) + 1);
  const areas = [...counts].filter(([, n]) => n >= 3).map(([a]) => a);
  return { suggested: acute || flagged >= 3 || areas.length > 0, acute, flagged, areas };
}
