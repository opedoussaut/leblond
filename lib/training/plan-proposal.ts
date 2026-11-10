import { z } from "zod";
import type { Locale } from "@/lib/i18n";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { METHODS_FOR_PLANS } from "./catalogue";
import { methodVerdict, restrictionsOf, type Health } from "./health";
import {
  durationSchema, durationWeeks, MAX_PHASES, PHASE_KINDS, PLAN_PLACES, planPhaseSchema, planSessionSchema,
  type PlanPhase, type PlanSession, type TrainingPlanInput,
} from "./plans";

/**
 * Patrick mode: the climber gives a goal, a duration and an availability;
 * Patrick proposes phases of weekly templates as JSON. Everything here is pure:
 * what Patrick is asked, and how his answer is read and CHECKED (Atlas methods
 * only, declared health respected, weeks fitted to the duration). The result
 * is a draft the climber reviews before saving; it is never a prediction.
 */

export const planRequestSchema = z.object({
  goal: z.string().trim().min(3).max(300),
  duration: durationSchema,
  climbingPerWeek: z.number().int().min(0).max(6),
  offWallPerWeek: z.number().int().min(0).max(6),
  minutesPerSession: z.number().int().min(20).max(240),
  /** Days the climber can train (0 = Monday); empty = any day. */
  availableDays: z.array(z.number().int().min(0).max(6)).max(7),
  /** Days they usually climb outside (kept as climbing days, often unstructured). */
  outdoorDays: z.array(z.number().int().min(0).max(6)).max(7),
  /** The specific goal: a problem, a trip, its style (crimpy, steep, long), its length. */
  target: z.string().trim().max(300),
  /** Free text: home equipment, places, constraints ("right knee: runner's knee"). */
  notes: z.string().trim().max(500),
}).strict().refine((r) => r.climbingPerWeek + r.offWallPerWeek >= 1 && r.climbingPerWeek + r.offWallPerWeek <= 7, "1 to 7 sessions a week");
export type PlanRequest = z.infer<typeof planRequestSchema>;

/** Marks a plan request (the test stand-in for the model answers it with JSON). */
export const PLAN_REQUEST_MARKER = "LEBLOND_PLAN_REQUEST";

export function planInstructions(locale: Locale): string {
  const methods = METHODS_FOR_PLANS.map((m) => `- ${m.id}: ${m.title}`).join("\n");
  return `## Task: propose a training plan

The climber asks for a training plan (${PLAN_REQUEST_MARKER} in their message). Answer with ONE JSON object and nothing else: no prose, no Markdown fences.

Shape:
{"name": string (max 80 chars),
 "phases": [{"name": string (max 60), "kind": ${PHASE_KINDS.map((k) => `"${k}"`).join(" | ")}, "weeks": integer >= 1,
             "objective": string (max 200, checkable at the end of the phase),
             "sessions": [{"day": 0-6 (0 = Monday), "methodId": one id below or null, "title": string (required when methodId is null, max 80),
                           "minutes": 10-240, "place": ${PLAN_PLACES.map((p) => `"${p}"`).join(" | ")}, "optional": boolean, "notes": string (max 300)}]}]}

How to build it, in this order:
1. Structure. The phases' weeks add up EXACTLY to totalWeeks; 1 to ${MAX_PHASES} phases; one phase for a plan of 4 weeks or less. Blocks of about 3 to 5 weeks (BASE first, then BUILD, more specific to the goal), a 1-week DELOAD between blocks (free, unstructured climbing, finishing every session fresh), and when the plan leads to a goal date: a 1-week TAPER (same sessions, less volume) then PERFORMANCE when the goal itself is part of the plan (a trip).
2. Lifestyle first. Only programme sessions on availableDays (any day if empty). Keep outdoorDays as climbing days: unstructured or limit climbing outside, with an alternative indoor session in the notes for bad weather; a second outdoor day is optional ("optional": true). Climbing the climber enjoys keeps them consistent.
3. Strengths and weaknesses. Use the evidence in LEBLOND_CONTEXT and the notes; work on the weaknesses the goal needs, keep the strengths.
4. The specific goal (target): its style (crimps, slopers, steep, slab), the effort length, the movement it needs; later blocks get closer to it.
5. Workouts, by priority: climbing sessions first, then finger strength, then general strength, with mobility built into warm-ups (or as short home sessions). Each phase is ONE weekly template repeated for its weeks: at most climbingPerWeek climbing sessions and offWallPerWeek off-wall sessions (place HOME), at least one rest day, never two intense sessions (limit-bouldering, max-hangs, repeaters, campus, four-by-four, strength-conditioning, periodized) on consecutive days, intensity rising across blocks while volume falls.
- Sessions last about minutesPerSession.
- Use ONLY these Atlas method ids, or null with a title for mobility, stretching, open climbing or rest-like work:
${methods}
- Respect the declared health: never programme a method that loads a painful area; adapt (reduce load) where there is discomfort; say so in the session notes. You do not diagnose.
- Objectives and notes are concrete and checkable ("3 x 10 s on 20 mm with +5 kg", "flash two 6C"). Never promise or predict a grade or a result: the plan is a proposal.
- Write every name, objective and note in ${locale === "fr" ? "French" : "English"}.`;
}

export function planRequestMessage(request: PlanRequest, health: Health): string {
  return `${PLAN_REQUEST_MARKER} ${JSON.stringify({
    goal: request.goal,
    duration: request.duration,
    totalWeeks: durationWeeks(request.duration.value, request.duration.unit),
    climbingPerWeek: request.climbingPerWeek,
    offWallPerWeek: request.offWallPerWeek,
    minutesPerSession: request.minutesPerSession,
    availableDays: request.availableDays,
    outdoorDays: request.outdoorDays,
    target: request.target,
    declaredHealth: restrictionsOf(health),
    notes: request.notes,
  })}`;
}

/** What LEBLOND changed in Patrick's answer, shown to the climber with the draft. */
export type ProposalAdjustment = "unknownMethod" | "healthSwap" | "weeksFitted" | "sessionsDropped" | "phasesTrimmed";

export type ProposalResult =
  | { ok: true; plan: TrainingPlanInput; adjustments: ProposalAdjustment[] }
  | { ok: false };

const METHOD_IDS = new Set(METHODS_FOR_PLANS.map((m) => m.id));
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : NaN);

/** The JSON object in a model answer: tolerates Markdown fences and text around it. */
export function extractJson(answer: string): unknown {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(answer.slice(start, end + 1)); } catch { return null; }
}

export function readProposal(answer: string, request: PlanRequest, health: Health, locale: Locale): ProposalResult {
  const raw = extractJson(answer) as { name?: unknown; phases?: unknown } | null;
  if (!raw || !Array.isArray(raw.phases)) return { ok: false };
  const t = journeyDictionary(locale);
  const adjustments = new Set<ProposalAdjustment>();
  const totalWeeks = durationWeeks(request.duration.value, request.duration.unit);
  const mobility = (day: number, minutes: number): PlanSession => ({
    day, methodId: null, title: t.programme.mobilityTitle, minutes, place: "HOME", notes: t.programme.mobilityNotesInjury,
  });

  if (raw.phases.length > MAX_PHASES) adjustments.add("phasesTrimmed");
  const phases: PlanPhase[] = [];
  for (const [i, p] of (raw.phases as Array<Record<string, unknown>>).slice(0, MAX_PHASES).entries()) {
    if (!p || typeof p !== "object") continue;
    const sessions: PlanSession[] = [];
    for (const s of (Array.isArray(p.sessions) ? p.sessions : []).slice(0, 14) as Array<Record<string, unknown>>) {
      if (!s || typeof s !== "object") { adjustments.add("sessionsDropped"); continue; }
      let methodId = typeof s.methodId === "string" ? s.methodId : null;
      let title = text(s.title, 80) || undefined;
      if (methodId && !METHOD_IDS.has(methodId)) {
        adjustments.add("unknownMethod");
        title = title ?? text(s.methodId, 80);
        methodId = null;
      }
      const place = (PLAN_PLACES as readonly string[]).includes(s.place as string) ? (s.place as PlanSession["place"]) : undefined;
      const candidate = {
        day: int(s.day), methodId, minutes: Math.max(10, Math.min(240, int(s.minutes) || request.minutesPerSession)),
        notes: text(s.notes, 500), ...(place ? { place } : {}), ...(methodId === null && title ? { title } : {}),
        ...(s.optional === true ? { optional: true } : {}),
      };
      const parsed = planSessionSchema.safeParse(candidate);
      if (!parsed.success) { adjustments.add("sessionsDropped"); continue; }
      let session = parsed.data;
      // Never keep a method the declared health rules out.
      if (session.methodId && methodVerdict(session.methodId, health).status === "avoid") {
        adjustments.add("healthSwap");
        session = methodVerdict("technique", health).status !== "avoid" && session.place !== "HOME"
          ? { ...session, methodId: "technique", notes: [t.programme.mobilityNotesInjury, session.notes].filter(Boolean).join(" ").slice(0, 500) }
          : mobility(session.day, Math.min(session.minutes, 45));
      }
      sessions.push(session);
    }
    const phase = planPhaseSchema.safeParse({
      name: text(p.name, 60) || `Phase ${i + 1}`,
      ...((PHASE_KINDS as readonly string[]).includes(p.kind as string) ? { kind: p.kind } : {}),
      weeks: Math.max(1, int(p.weeks) || 1),
      ...(text(p.objective, 200) ? { objective: text(p.objective, 200) } : {}),
      sessions,
    });
    if (phase.success) phases.push(phase.data);
  }
  if (phases.length === 0) return { ok: false };

  // Fit the phases to the duration: shorten from the end (dropping phases left
  // with no week), or stretch the last phase.
  const sum = phases.reduce((s, p) => s + p.weeks, 0);
  if (sum !== totalWeeks) {
    adjustments.add("weeksFitted");
    let excess = sum - totalWeeks;
    for (let i = phases.length - 1; i >= 0 && excess > 0; i--) {
      const cut = Math.min(excess, phases[i].weeks - 1);
      phases[i].weeks -= cut;
      excess -= cut;
    }
    while (excess > 0 && phases.length > 1) excess -= phases.pop()!.weeks;
    if (excess < 0) phases[phases.length - 1].weeks -= excess;
  }

  return {
    ok: true,
    adjustments: [...adjustments],
    plan: {
      name: text(raw.name, 100) || request.goal.slice(0, 100),
      goal: request.goal,
      mode: "PATRICK",
      duration: request.duration,
      weeks: totalWeeks,
      sessions: phases[0].sessions,
      ...(phases.length > 1 ? { phases } : {}),
    },
  };
}
