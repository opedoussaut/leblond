import { describe, expect, it } from "vitest";
import { NO_HEALTH_ISSUE, type Health } from "@/lib/training/health";
import { planHints } from "@/lib/training/plan-hints";
import { extractJson, planInstructions, planRequestMessage, readProposal, type PlanRequest } from "@/lib/training/plan-proposal";
import {
  durationWeeks, editablePlan, phaseAt, phasesOf, planFromRow, planRow, trainingPlanSchema,
  type PlanPhase, type PlanSession, type TrainingPlanInput,
} from "@/lib/training/plans";

const s = (day: number, methodId: string | null, extra: Partial<PlanSession> = {}): PlanSession =>
  ({ day, methodId, minutes: 60, notes: "", ...(methodId ? {} : { title: "Mobilité" }), ...extra });
const phase = (name: string, weeks: number, sessions: PlanSession[], extra: Partial<PlanPhase> = {}): PlanPhase =>
  ({ name, weeks, sessions, ...extra });
const knee: Health = { injuries: [{ area: "knee", level: "PAIN" }], unspecifiedPain: false };
const fingers: Health = { injuries: [{ area: "fingers", level: "PAIN" }], unspecifiedPain: false };

describe("plan durations", () => {
  it("turns weeks, months and years into weeks", () => {
    expect(durationWeeks(8, "WEEKS")).toBe(8);
    expect(durationWeeks(3, "MONTHS")).toBe(13);
    expect(durationWeeks(6, "MONTHS")).toBe(26);
    expect(durationWeeks(1, "YEARS")).toBe(52);
    expect(durationWeeks(5, "YEARS")).toBe(260);
    expect(durationWeeks(60, "MONTHS")).toBe(260);
  });
  it("refuses durations past the limit of each unit", () => {
    const base: TrainingPlanInput = { name: "P", goal: "", weeks: 4, sessions: [s(1, "technique")] };
    expect(trainingPlanSchema.safeParse({ ...base, duration: { value: 5, unit: "YEARS" } }).success).toBe(true);
    expect(trainingPlanSchema.safeParse({ ...base, duration: { value: 6, unit: "YEARS" } }).success).toBe(false);
    expect(trainingPlanSchema.safeParse({ ...base, duration: { value: 61, unit: "MONTHS" } }).success).toBe(false);
    expect(trainingPlanSchema.safeParse({ ...base, duration: { value: 0, unit: "WEEKS" } }).success).toBe(false);
  });
});

describe("plan phases", () => {
  const phases = [phase("Base", 4, [s(1, "technique")], { kind: "BASE", objective: "Flash trois 6B" }),
    phase("Allègement", 1, [s(2, "easy-volume")], { kind: "DELOAD" }),
    phase("Force", 4, [s(3, "max-hangs")], { kind: "BUILD" })];
  const plan: TrainingPlanInput = {
    name: "Saison", goal: "7A en 3 mois", weeks: 13, sessions: phases[0].sessions, mode: "ASSISTED",
    duration: { value: 3, unit: "MONTHS" }, phases,
  };
  it("stores the first phase as the template, the duration in weeks, phases only when there are several", () => {
    const row = planRow(plan);
    expect(row).toMatchObject({ weeks: 13, mode: "ASSISTED", duration_value: 3, duration_unit: "MONTHS", sessions: phases[0].sessions });
    expect(row.phases).toHaveLength(3);
    expect(planRow({ ...plan, phases: [phases[0]] }).phases).toEqual([]);
    expect(planRow({ name: "Old", goal: "", weeks: 6, sessions: [s(1, "technique")] }))
      .toMatchObject({ mode: "MANUAL", duration_value: 6, duration_unit: "WEEKS", weeks: 6, phases: [] });
  });
  it("reads plans back, with or without the new columns", () => {
    const row = planRow(plan);
    const back = planFromRow({ id: "11111111-1111-4111-8111-111111111111", ...row });
    expect(back?.phases?.map((p) => p.name)).toEqual(["Base", "Allègement", "Force"]);
    expect(back?.duration).toEqual({ value: 3, unit: "MONTHS" });
    const legacy = planFromRow({ id: "11111111-1111-4111-8111-111111111111", name: "Old", goal: "", weeks: 4, sessions: [s(1, "technique")] });
    expect(legacy).toMatchObject({ name: "Old", weeks: 4 });
    expect(legacy?.phases).toBeUndefined();
    expect(phasesOf(legacy!)).toEqual([{ name: "Phase 1", weeks: 4, sessions: [s(1, "technique")] }]);
    expect(planFromRow({ id: "x", name: "", goal: "", weeks: 4, sessions: [] })).toBeNull();
  });
  it("finds the phase covering a week", () => {
    expect(phaseAt(phases, 1).index).toBe(0);
    expect(phaseAt(phases, 4).index).toBe(0);
    expect(phaseAt(phases, 5).index).toBe(1);
    expect(phaseAt(phases, 6).index).toBe(2);
    expect(phaseAt(phases, 40).index).toBe(2);
  });
  it("keeps every field when a saved plan is edited", () => {
    const draft = editablePlan({ ...plan, id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-11-10" });
    expect(trainingPlanSchema.safeParse(draft).success).toBe(true);
    expect(draft.phases?.[0].objective).toBe("Flash trois 6B");
    expect(draft.phases).not.toBe(plan.phases);
  });
});

describe("assisted mode hints", () => {
  const codes = (plan: TrainingPlanInput, health: Health = NO_HEALTH_ISSUE) => planHints(plan, health).map((h) => h.code);
  const one = (sessions: PlanSession[], extra: Partial<TrainingPlanInput> = {}): TrainingPlanInput =>
    ({ name: "P", goal: "Faire 7A", weeks: 4, sessions, ...extra });

  it("is quiet for a sound short plan", () => {
    expect(planHints(one([s(1, "limit-bouldering"), s(3, "technique"), s(5, "max-hangs")]), NO_HEALTH_ISSUE)).toEqual([]);
  });
  it("asks for a measurable goal", () => {
    expect(codes(one([s(1, "limit-bouldering")], { goal: "Progresser" }))).toContain("goalNotMeasurable");
    expect(codes(one([s(1, "limit-bouldering")], { goal: "" }))).not.toContain("goalNotMeasurable");
  });
  it("flags intense days in a row (Sunday to Monday too), no rest day, too much intensity and volume", () => {
    const hints = planHints(one([s(0, "limit-bouldering"), s(1, "max-hangs"), s(6, "campus")]), NO_HEALTH_ISSUE);
    expect(hints.filter((h) => h.code === "intenseInARow").map((h) => h.days)).toEqual([[0, 1], [6, 0]]);
    expect(codes(one([0, 1, 2, 3, 4, 5, 6].map((d) => s(d, "technique"))))).toContain("noRestDay");
    expect(codes(one([0, 2, 4, 6].map((d) => s(d, "max-hangs"))))).toContain("tooManyIntense");
    expect(codes(one([0, 2, 4].map((d) => s(d, "limit-bouldering", { minutes: 240 }))))).toContain("heavyWeek");
  });
  it("flags phases that do not cover the duration, long single phases, missing deloads, taper and objectives", () => {
    expect(codes(one([s(1, "limit-bouldering")], { duration: { value: 6, unit: "MONTHS" }, weeks: 26 }))).toContain("longSinglePhase");
    const long = one([s(1, "limit-bouldering")], {
      duration: { value: 4, unit: "MONTHS" }, weeks: 17,
      phases: [phase("A", 8, [s(1, "limit-bouldering")]), phase("B", 4, [s(1, "max-hangs")], { objective: "3 × 10 s +5 kg" })],
    });
    const c = codes(long);
    expect(c).toEqual(expect.arrayContaining(["phasesShort", "noRecoveryWeek", "noTaper", "longBlock", "noObjective"]));
    expect(planHints(long, NO_HEALTH_ISSUE).find((h) => h.code === "phasesShort")).toMatchObject({ planned: 12, total: 17 });
    const fitted = one([s(1, "limit-bouldering")], {
      duration: { value: 10, unit: "WEEKS" }, weeks: 10,
      phases: [phase("Base", 4, [s(1, "limit-bouldering")], { kind: "BASE", objective: "o" }),
        phase("Allègement", 1, [s(2, "easy-volume")], { kind: "DELOAD", objective: "o" }),
        phase("Spécifique", 4, [s(1, "max-hangs")], { kind: "BUILD", objective: "o" }),
        phase("Affûtage", 1, [s(1, "technique")], { kind: "TAPER", objective: "o" })],
    });
    expect(codes(fitted)).toEqual([]);
  });
  it("flags a hard phase without strength work, but not a lighter one", () => {
    expect(codes(one([s(1, "technique"), s(3, "easy-volume")]))).toContain("noStrength");
  });
  it("names methods the declared health rules out or adapts", () => {
    const hints = planHints(one([s(1, "max-hangs"), s(3, "limit-bouldering")]), fingers);
    expect(hints.filter((h) => h.code === "avoidMethod").map((h) => h.methodId)).toEqual(["max-hangs", "limit-bouldering"]);
    expect(hints.find((h) => h.code === "avoidMethod")?.areas).toContain("fingers");
    expect(planHints(one([s(1, "technique")]), knee).some((h) => h.code === "adaptMethod" && h.areas?.includes("knee"))).toBe(true);
  });
});

describe("Patrick mode: request and proposal", () => {
  const request: PlanRequest = {
    goal: "Enchaîner mon premier 7A", duration: { value: 3, unit: "MONTHS" }, climbingPerWeek: 3, offWallPerWeek: 1,
    minutesPerSession: 90, availableDays: [1, 3, 5, 6], outdoorDays: [6], target: "Bloc à réglettes, 10 mouvements", notes: "Genou droit fragile",
  };
  it("asks for Atlas methods only, the structure and the declared health, in the climber's language", () => {
    const instructions = planInstructions("fr");
    expect(instructions).toContain("max-hangs");
    expect(instructions).toContain("DELOAD");
    expect(instructions).toContain("French");
    expect(instructions).toMatch(/Never promise or predict a grade/);
    const message = planRequestMessage(request, knee);
    expect(message).toContain("LEBLOND_PLAN_REQUEST");
    expect(JSON.parse(message.replace(/^LEBLOND_PLAN_REQUEST /, ""))).toMatchObject({
      totalWeeks: 13, outdoorDays: [6], declaredHealth: [{ area: "knee", level: "PAIN" }], target: request.target,
    });
  });
  it("reads JSON wrapped in prose or fences", () => {
    expect(extractJson("Voici : ```json\n{\"a\":1}\n``` bonne séance")).toEqual({ a: 1 });
    expect(extractJson("pas de JSON")).toBeNull();
    expect(extractJson("{cassé")).toBeNull();
  });
  it("returns a checked draft: kinds, objectives, optional sessions, weeks fitted to the duration", () => {
    const answer = JSON.stringify({
      name: "Objectif 7A",
      phases: [
        { name: "Base", kind: "BASE", weeks: 4, objective: "Réussir 50 % des blocs au pan", sessions: [
          { day: 1, methodId: "limit-bouldering", minutes: 90, place: "BOULDER_GYM", notes: "" },
          { day: 6, methodId: null, title: "Bloc dehors", minutes: 180, place: "CRAG", optional: true, notes: "Pluie : pan en salle" }] },
        { name: "Allègement", kind: "DELOAD", weeks: 1, sessions: [{ day: 3, methodId: "easy-volume", minutes: 60, notes: "" }] },
        { name: "Spécifique", kind: "BUILD", weeks: 6, sessions: [{ day: 3, methodId: "max-hangs", minutes: 45, place: "HOME", notes: "" }] },
      ],
    });
    const r = readProposal(answer, request, NO_HEALTH_ISSUE, "fr");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan).toMatchObject({ mode: "PATRICK", goal: request.goal, duration: request.duration, weeks: 13, name: "Objectif 7A" });
    expect(r.plan.phases?.map((p) => [p.kind, p.weeks])).toEqual([["BASE", 4], ["DELOAD", 1], ["BUILD", 8]]);
    expect(r.adjustments).toEqual(["weeksFitted"]);
    expect(r.plan.phases?.[0].sessions[1]).toMatchObject({ optional: true, title: "Bloc dehors" });
    expect(trainingPlanSchema.safeParse(r.plan).success).toBe(true);
  });
  it("replaces unknown methods and methods the declared health rules out, and shortens a plan that is too long", () => {
    const answer = JSON.stringify({ name: "X", phases: [
      { name: "A", weeks: 10, sessions: [{ day: 1, methodId: "made-up-drill", title: "Exercice maison", minutes: 60, notes: "" },
        { day: 3, methodId: "max-hangs", minutes: 45, place: "HOME", notes: "" }, { day: 9, methodId: "technique", minutes: 60, notes: "" }] },
      { name: "B", weeks: 10, sessions: [{ day: 2, methodId: "limit-bouldering", minutes: 90, place: "BOULDER_GYM", notes: "" }] },
    ] });
    const r = readProposal(answer, request, fingers, "fr");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.adjustments).toEqual(expect.arrayContaining(["unknownMethod", "healthSwap", "sessionsDropped", "weeksFitted"]));
    const all = (r.plan.phases ?? [{ sessions: r.plan.sessions }]).flatMap((p) => p.sessions);
    expect(all.some((x) => x.methodId === "max-hangs" || x.methodId === "limit-bouldering")).toBe(false);
    expect(all.find((x) => x.title === "Exercice maison")?.methodId).toBeNull();
    expect(phasesOf(r.plan).reduce((sum, p) => sum + p.weeks, 0)).toBe(13);
  });
  it("drops phases that do not fit at all and refuses an unreadable answer", () => {
    const tiny: PlanRequest = { ...request, duration: { value: 2, unit: "WEEKS" } };
    const answer = JSON.stringify({ name: "X", phases: ["A", "B", "C"].map((name) => ({ name, weeks: 3, sessions: [{ day: 1, methodId: "technique", minutes: 60, notes: "" }] })) });
    const r = readProposal(answer, tiny, NO_HEALTH_ISSUE, "fr");
    expect(r.ok && phasesOf(r.plan).map((p) => p.weeks)).toEqual([1, 1]);
    expect(readProposal("Désolé, je ne peux pas.", request, NO_HEALTH_ISSUE, "fr")).toEqual({ ok: false });
    expect(readProposal(JSON.stringify({ phases: [{ name: "A", weeks: 2, sessions: [] }] }), request, NO_HEALTH_ISSUE, "fr")).toEqual({ ok: false });
  });
});
