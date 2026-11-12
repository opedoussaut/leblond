import { describe, expect, it } from "vitest";
import {
  MOBILITY_TESTS, asymmetries, classifyStage, mobilityAssessmentInputSchema, testLevel, type MobilityResult,
} from "@/lib/training/hip-mobility/assessment";
import { EXERCISES, EXERCISE_BY_ID, LEVEL_LABELS, LEVEL_SESSIONS, ROADMAP, contentLevel } from "@/lib/training/hip-mobility/content";
import {
  RULES, clinicianAdvice, decideExercise, mobilityExerciseRows, nextDose, planSession, previousDose, sessionTitle,
  summarizePerformance, type ExercisePerformance, type MobilitySessionRecord, type MobilitySet,
} from "@/lib/training/hip-mobility/prescription";
import { mobilityRecord } from "@/lib/training/hip-mobility/records";
import { NO_HEALTH_ISSUE } from "@/lib/training/health";
import { saveSetSchema, type TrainingExercise, type TrainingSession } from "@/lib/training/sessions";
import { templateFor } from "@/lib/training/session-templates";

const r = (test: MobilityResult["test"], side: MobilityResult["side"], level: number | null, extra: Partial<MobilityResult> = {}): MobilityResult => ({
  test, side, done: level !== null, skipReason: level === null ? "NOT_POSSIBLE" : null, level, value: null,
  support: "HANDS", discomfort: 0, discomfortArea: null, active: true, flags: [], ...extra,
});
const core = (a: number, b: number, c: number): MobilityResult[] => [
  r("A", "LEFT", a), r("A", "RIGHT", a), r("B", "LEFT", b), r("B", "RIGHT", b), r("C", "LEFT", c), r("C", "RIGHT", c),
];

const set = (side: MobilitySet["side"], reps: number, extra: Partial<MobilitySet> = {}): MobilitySet => ({
  side, reps, variant: "STANDARD", controlled: true, discomfort: 0, flags: [], completed: true, ...extra,
});
const rotations = EXERCISE_BY_ID.get("seated-hip-rotations")!;
const perf = (sets: MobilitySet[], prescribed = { variant: "STANDARD" as const, reps: 6 }): ExercisePerformance =>
  ({ exerciseId: rotations.id, status: "DONE", prescribed, sets });
const clean = (reps = 6) => perf([set("LEFT", reps), set("RIGHT", reps)], { variant: "STANDARD", reps });
const ok = { assessment: null, health: "ok" as const, clinician: false };

describe("hip mobility content", () => {
  it("gives every exercise full FR/EN content and an easier and a harder version", () => {
    for (const e of EXERCISES) {
      for (const l of [e.name, e.purpose, e.cue, e.easier.name, e.easier.how, e.harder.name, e.harder.how, ...e.steps, ...e.mistakes, ...e.safety]) {
        expect(l.fr.trim().length, e.id).toBeGreaterThan(0);
        expect(l.en.trim().length, e.id).toBeGreaterThan(0);
      }
      expect(e.steps.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.mistakes.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.safety.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.reps.min).toBeLessThanOrEqual(e.reps.start);
      expect(e.reps.start).toBeLessThanOrEqual(e.reps.max);
    }
  });

  it("matches the requested level 0 starter session (8, 6, 6, 5, 6 reps) and a shorter option", () => {
    const standard = LEVEL_SESSIONS[0]!.STANDARD;
    expect(standard.exercises.map((id) => EXERCISE_BY_ID.get(id)!.reps.start)).toEqual([8, 6, 6, 5, 6]);
    expect(standard.exercises.map((id) => EXERCISE_BY_ID.get(id)!.perSide)).toEqual([false, true, true, true, true]);
    expect(standard.minutes).toBeGreaterThanOrEqual(8);
    expect(standard.minutes).toBeLessThanOrEqual(12);
    const short = LEVEL_SESSIONS[0]!.SHORT;
    expect(short.minutes).toBeLessThan(standard.minutes);
    expect(short.exercises.every((id) => standard.exercises.includes(id))).toBe(true);
  });

  it("labels every stage as internal, and only promises content that exists", () => {
    expect(Object.keys(LEVEL_LABELS)).toHaveLength(5);
    expect(contentLevel(0)).toBe(0);
    expect(contentLevel(3)).toBe(0);
    expect(ROADMAP.filter((s) => s.available).flatMap((s) => s.levels).every((l) => LEVEL_SESSIONS[l])).toBe(true);
  });

  it("is the Atlas template of the hip-mobility method, with no separate warm-up", () => {
    const t = templateFor("hip-mobility", 10);
    expect(t.map((e) => e.key)).toEqual(LEVEL_SESSIONS[0]!.STANDARD.exercises.map((id) => "hip:" + id));
    expect(t.every((e) => e.block === "MAIN")).toBe(true);
  });
});

describe("beginner assessment", () => {
  const conditions = { warmedUp: false, timeOfDay: "EVENING" as const, cushionCm: 10, wall: null, notes: "" };

  it("accepts a complete core assessment and rejects missing sides, levels or reasons", () => {
    expect(mobilityAssessmentInputSchema.safeParse({ assessedOn: "2026-11-18", conditions, results: core(1, 2, 1), notes: "" }).success).toBe(true);
    expect(mobilityAssessmentInputSchema.safeParse({ assessedOn: "2026-11-18", conditions, results: core(1, 2, 1).slice(1), notes: "" }).success).toBe(false);
    const noLevel = core(1, 2, 1); noLevel[0] = { ...noLevel[0], level: null };
    expect(mobilityAssessmentInputSchema.safeParse({ assessedOn: "2026-11-18", conditions, results: noLevel, notes: "" }).success).toBe(false);
    const noReason = core(1, 2, 1); noReason[0] = { ...noReason[0], done: false, level: null, skipReason: null };
    expect(mobilityAssessmentInputSchema.safeParse({ assessedOn: "2026-11-18", conditions, results: noReason, notes: "" }).success).toBe(false);
  });

  it("needs the wall conditions for test D, and keeps values within each test's range", () => {
    const withD = [...core(3, 3, 3), r("D", "LEFT", 2, { value: 3 }), r("D", "RIGHT", 2, { value: 2 })];
    expect(mobilityAssessmentInputSchema.safeParse({ assessedOn: "2026-11-18", conditions, results: withD, notes: "" }).success).toBe(false);
    expect(mobilityAssessmentInputSchema.safeParse({ assessedOn: "2026-11-18", notes: "",
      conditions: { ...conditions, wall: { kind: "BOARD", angleDeg: 20, spacingCm: 40 } }, results: withD }).success).toBe(true);
    const tooMany = core(2, 2, 2); tooMany[0] = { ...tooMany[0], value: 7 };
    expect(mobilityAssessmentInputSchema.safeParse({ assessedOn: "2026-11-18", conditions, results: tooMany, notes: "" }).success).toBe(false);
  });

  it("has no flexibility score: every test is described levels plus a measured value", () => {
    for (const t of MOBILITY_TESTS) {
      expect(t.levels).toHaveLength(5);
      expect(["count", "cm"]).toContain(t.value.unit);
    }
    expect(MOBILITY_TESTS.find((t) => t.id === "D")!.optional).toBe(true);
  });

  it("classifies by the weakest test, caps the stage without the wall test", () => {
    expect(classifyStage(core(1, 3, 2)).stage).toBe(0);
    expect(classifyStage(core(1, 3, 2)).limitedBy).toEqual(["A"]);
    expect(classifyStage(core(2, 3, 2)).stage).toBe(1);
    expect(classifyStage(core(4, 4, 4)).stage).toBe(2);
    expect(classifyStage(core(4, 4, 4)).functionalTested).toBe(false);
    expect(classifyStage([...core(3, 4, 3), r("D", "LEFT", 3), r("D", "RIGHT", 4)]).stage).toBe(3);
    expect(classifyStage([...core(4, 4, 4), r("D", "LEFT", 4), r("D", "RIGHT", 4)]).stage).toBe(4);
    expect(classifyStage([...core(4, 4, 4), r("D", "LEFT", 2), r("D", "RIGHT", 4)])).toMatchObject({ stage: 2, limitedBy: ["D"] });
  });

  it("counts a test stopped by pain as the lowest level and a missing test as missing", () => {
    const results = core(3, 3, 3);
    results[0] = { ...results[0], done: false, level: null, skipReason: "PAIN" };
    expect(testLevel(results, "A")).toBe(0);
    expect(classifyStage(results).stage).toBe(0);
    const noStep = core(3, 3, 3).filter((x) => x.test !== "C");
    expect(classifyStage(noStep)).toMatchObject({ stage: 2, missing: ["C"] });
  });

  it("flags large left/right gaps only", () => {
    expect(asymmetries(core(2, 2, 2))).toEqual([]);
    const gap = core(2, 2, 2); gap[1] = { ...gap[1], level: 4 };
    expect(asymmetries(gap).map((a) => a.test)).toEqual(["A"]);
    const cm = core(2, 2, 2); cm[2] = { ...cm[2], value: 20 }; cm[3] = { ...cm[3], value: 32 };
    expect(asymmetries(cm).map((a) => a.test)).toEqual(["B"]);
  });
});

describe("progression rules", () => {
  it("steps up reps first, then the harder version, and stops at the top", () => {
    expect(nextDose(rotations, { variant: "EASIER", reps: 6 })).toEqual({ variant: "EASIER", reps: 7 });
    expect(nextDose(rotations, { variant: "EASIER", reps: 10 })).toEqual({ variant: "STANDARD", reps: 4 });
    expect(nextDose(rotations, { variant: "HARDER", reps: 10 })).toBeNull();
    expect(previousDose(rotations, { variant: "STANDARD", reps: 4 })).toEqual({ variant: "EASIER", reps: 6 });
    expect(previousDose(rotations, { variant: "EASIER", reps: 4 })).toEqual({ variant: "EASIER", reps: 4 });
  });

  it("starts at the planned version, or the easier one when the linked test was very limited", () => {
    expect(decideExercise(rotations, [], ok)).toMatchObject({ dose: { variant: "STANDARD", reps: 6 }, offer: null, reason: "start" });
    const limited = decideExercise(rotations, [], { ...ok, assessment: core(1, 3, 3) });
    expect(limited).toMatchObject({ dose: { variant: "EASIER", reps: 6 }, reason: "startEasier" });
    const strong = decideExercise(rotations, [], { ...ok, assessment: core(3, 3, 3) });
    expect(strong.dose.variant).toBe("STANDARD");
    expect(strong.offer).toEqual({ variant: "HARDER", reps: 4 });
  });

  it("never increases on its own: an increase is only offered after two clean sessions", () => {
    expect(decideExercise(rotations, [clean()], ok)).toMatchObject({ dose: { variant: "STANDARD", reps: 6 }, offer: null, reason: "steady" });
    const ready = decideExercise(rotations, [clean(), clean()], ok);
    expect(ready.dose).toEqual({ variant: "STANDARD", reps: 6 });
    expect(ready.offer).toEqual({ variant: "STANDARD", reps: 7 });
    expect(ready.reason).toBe("ready");
  });

  it("needs control, low discomfort and both sides for a clean session", () => {
    const notSure = perf([set("LEFT", 6, { controlled: null }), set("RIGHT", 6)]);
    expect(summarizePerformance(rotations, notSure).clean).toBe(false);
    const oneSide = perf([set("LEFT", 6)]);
    expect(summarizePerformance(rotations, oneSide).clean).toBe(false);
    const mild = perf([set("LEFT", 6, { discomfort: 3 }), set("RIGHT", 6)]);
    expect(decideExercise(rotations, [mild, clean()], ok)).toMatchObject({ offer: null, reason: "steady" });
  });

  it("steps back by default after strong discomfort, a warning sign or uncontrolled reps", () => {
    const sore = perf([set("LEFT", 6, { discomfort: RULES.regressDiscomfort }), set("RIGHT", 6)]);
    expect(decideExercise(rotations, [sore, clean()], ok)).toMatchObject({ dose: { variant: "EASIER", reps: 4 }, reason: "discomfort", stepBack: true });
    const caught = perf([set("LEFT", 6, { flags: ["CATCHING"] }), set("RIGHT", 6)]);
    expect(decideExercise(rotations, [caught], ok)).toMatchObject({ dose: { variant: "EASIER", reps: 4 }, reason: "flag", offer: null });
    const shaky = perf([set("LEFT", 6, { controlled: false }), set("RIGHT", 6, { controlled: false })]);
    expect(decideExercise(rotations, [shaky], ok)).toMatchObject({ dose: { variant: "STANDARD", reps: 4 }, reason: "uncontrolled", stepBack: true });
  });

  it("follows what was actually done, never more than was prescribed", () => {
    const easier = perf([set("LEFT", 6, { variant: "EASIER" }), set("RIGHT", 6)]);
    expect(decideExercise(rotations, [easier], ok).dose).toEqual({ variant: "EASIER", reps: 6 });
    const extra = perf([set("LEFT", 9), set("RIGHT", 9)]);
    expect(decideExercise(rotations, [extra], ok).dose).toEqual({ variant: "STANDARD", reps: 6 });
  });

  it("keeps the dose after one skip and steps back after two", () => {
    const skipped: ExercisePerformance = { exerciseId: rotations.id, status: "SKIPPED", prescribed: { variant: "STANDARD", reps: 6 }, sets: [] };
    expect(decideExercise(rotations, [skipped, clean()], ok)).toMatchObject({ dose: { variant: "STANDARD", reps: 6 }, reason: "skipped", stepBack: false });
    expect(decideExercise(rotations, [skipped, skipped], ok)).toMatchObject({ dose: { variant: "STANDARD", reps: 4 }, reason: "skipped", stepBack: true });
  });

  it("offers nothing while a clinician check is recommended or an area is declared", () => {
    expect(decideExercise(rotations, [clean(), clean()], { ...ok, clinician: true })).toMatchObject({ offer: null, reason: "clinician" });
    expect(decideExercise(rotations, [clean(), clean()], { ...ok, health: "adapt" })).toMatchObject({ dose: { variant: "EASIER", reps: 4 }, offer: null, reason: "healthAdapt" });
  });
});

const record = (date: string, exercises: ExercisePerformance[], extra: Partial<MobilitySessionRecord> = {}): MobilitySessionRecord =>
  ({ id: "s-" + date, date, status: "COMPLETED", level: 0, pain: 0, rpe: 3, minutes: 10, exercises, ...extra });

describe("clinician advice", () => {
  it("stays quiet on clean records", () => {
    expect(clinicianAdvice([record("2026-11-18", [clean()])], core(1, 1, 1))).toEqual({ recommended: false, reasons: [], asymmetricTests: [] });
  });

  it("recommends a clinician for catching, a block, sharp pain, persistent discomfort or a large gap", () => {
    const caught = record("2026-11-18", [perf([set("LEFT", 6, { flags: ["CATCHING"] })])]);
    expect(clinicianAdvice([caught], null).reasons).toEqual(["catching"]);
    const sore = ["2026-11-10", "2026-11-12", "2026-11-14"].map((d) => record(d, [perf([set("LEFT", 6, { discomfort: 4 })])]));
    expect(clinicianAdvice(sore, null).reasons).toEqual(["persistentDiscomfort"]);
    expect(clinicianAdvice(sore.slice(0, 2), null).recommended).toBe(false);
    const gap = core(1, 1, 1); gap[5] = { ...gap[5], level: 3 };
    expect(clinicianAdvice([], gap)).toMatchObject({ recommended: true, reasons: ["asymmetry"], asymmetricTests: ["C"] });
    const blocked = core(1, 1, 1); blocked[0] = { ...blocked[0], flags: ["BLOCK"] };
    expect(clinicianAdvice([], blocked).reasons).toContain("block");
  });

  it("only looks at the five most recent sessions", () => {
    const old = record("2026-10-01", [perf([set("LEFT", 6, { flags: ["SHARP_PAIN"] })])]);
    const recent = ["2026-11-01", "2026-11-03", "2026-11-05", "2026-11-07", "2026-11-09"].map((d) => record(d, [clean()]));
    expect(clinicianAdvice([old, ...recent], null).recommended).toBe(false);
  });
});

describe("session plan", () => {
  it("builds the level 0 session, applies only the increases the climber accepts", () => {
    const records = ["2026-11-10", "2026-11-12"].map((d) => record(d, [clean()]));
    const plan = planSession({ workingLevel: 0, length: "STANDARD", records, assessment: null, health: NO_HEALTH_ISSUE });
    const rot = plan.decisions.find((d) => d.exerciseId === rotations.id)!;
    expect(rot.dose).toEqual({ variant: "STANDARD", reps: 6 });
    expect(rot.offer).toEqual({ variant: "STANDARD", reps: 7 });
    const accepted = planSession({ workingLevel: 0, length: "STANDARD", records, assessment: null, health: NO_HEALTH_ISSUE, accept: [rotations.id] });
    expect(accepted.decisions.find((d) => d.exerciseId === rotations.id)).toMatchObject({ dose: { variant: "STANDARD", reps: 7 }, offer: null, accepted: true });
    expect(planSession({ workingLevel: 0, length: "SHORT", records: [], assessment: null, health: NO_HEALTH_ISSUE }).decisions).toHaveLength(3);
  });

  it("leaves out exercises a declared area rules out, and eases the others", () => {
    const hipAcute = planSession({ workingLevel: 0, length: "STANDARD", records: [], assessment: null,
      health: { injuries: [{ area: "hip", level: "ACUTE" }], unspecifiedPain: false } });
    expect(hipAcute.decisions).toHaveLength(0);
    const kneePain = planSession({ workingLevel: 0, length: "STANDARD", records: [], assessment: null,
      health: { injuries: [{ area: "knee", level: "PAIN" }], unspecifiedPain: false } });
    expect(kneePain.excluded).toEqual(["adductor-rock-backs"]);
    expect(kneePain.decisions.filter((d) => d.reason === "healthAdapt").map((d) => d.exerciseId))
      .toEqual(["seated-hip-rotations", "low-step-placements", "lateral-weight-shifts"]);
  });

  it("writes exercise rows the player can run: one set per side, snapshot with both variations", () => {
    const plan = planSession({ workingLevel: 0, length: "STANDARD", records: [], assessment: core(1, 2, 2), health: NO_HEALTH_ISSUE });
    const rows = mobilityExerciseRows(plan, "fr");
    expect(rows.map((x) => [x.target_sets, x.target_reps])).toEqual([[1, 8], [2, 6], [2, 6], [2, 5], [2, 6]]);
    expect(rows[1].intensity).toContain("coussin");
    expect(rows[1].instructions.mobility).toMatchObject({ exerciseId: "seated-hip-rotations", dose: { variant: "EASIER", reps: 6 }, reason: "startEasier" });
    expect(rows.every((x) => x.instructions.mobility?.easier.how.fr && x.instructions.mobility?.harder.how.en)).toBe(true);
    expect(sessionTitle(plan, "en")).toBe("Hip mobility · Level 0");
    expect(sessionTitle({ level: 0, length: "SHORT" }, "fr")).toBe("Mobilité des hanches · Niveau 0 · courte");
  });
});

describe("recording", () => {
  it("accepts mobility details on a set and rejects unknown values", () => {
    const base = { exerciseId: "00000000-0000-4000-8000-000000000001", setIndex: 1, reps: 6, seconds: null, loadKg: null, completed: true, notes: "" };
    expect(saveSetSchema.safeParse({ ...base, side: "LEFT", variant: "EASIER", controlled: true, discomfort: 2, flags: ["CATCHING"] }).success).toBe(true);
    expect(saveSetSchema.safeParse({ ...base, side: "UP" }).success).toBe(false);
    expect(saveSetSchema.safeParse({ ...base, discomfort: 11 }).success).toBe(false);
    expect(saveSetSchema.safeParse({ ...base, flags: ["CRACK"] }).success).toBe(false);
  });

  it("turns a recorded session into a record, ignoring sessions that were not done", () => {
    const plan = planSession({ workingLevel: 0, length: "SHORT", records: [], assessment: null, health: NO_HEALTH_ISSUE });
    const rows = mobilityExerciseRows(plan, "en");
    const session: TrainingSession = {
      id: "t1", title: "Hip mobility", objective: "", methodId: "hip-mobility", planId: null, planSessionIndex: null, calendarEntryId: null,
      climbingSessionId: null, venue: "", status: "COMPLETED", scheduledDate: "2026-11-18", scheduledTime: null, plannedMinutes: 5,
      startedAt: "2026-11-18T18:00:00Z", pausedAt: null, pausedSeconds: 0, completedAt: "2026-11-18T18:06:00Z", actualMinutes: 6,
      currentIndex: 0, rpe: 3, pain: 1, painNotes: "", notes: "", createdAt: "2026-11-18T17:59:00Z",
    };
    const exercises: TrainingExercise[] = rows.map((x, i) => ({
      id: "e" + i, position: x.position, block: x.block, methodId: x.method_id, name: x.name, instructions: x.instructions,
      modality: x.modality, targetSets: x.target_sets, targetReps: x.target_reps, targetSeconds: null, restSeconds: x.rest_seconds,
      intensity: x.intensity, status: "DONE", rpe: null, notes: "",
      sets: [{ id: "s" + i, setIndex: 1, reps: 5, seconds: null, loadKg: null, completed: true, notes: "", side: "LEFT", variant: "EASIER", controlled: true, discomfort: 1, flags: [] }],
    }));
    const rec = mobilityRecord(session, exercises)!;
    expect(rec).toMatchObject({ date: "2026-11-18", level: 0, pain: 1, minutes: 6 });
    expect(rec.exercises.map((e) => e.exerciseId)).toEqual(LEVEL_SESSIONS[0]!.SHORT.exercises);
    expect(rec.exercises[0].sets[0]).toMatchObject({ side: "LEFT", variant: "EASIER", discomfort: 1 });
    expect(mobilityRecord({ ...session, status: "PLANNED" }, exercises)).toBeNull();
    expect(mobilityRecord({ ...session, methodId: "technique" }, exercises)).toBeNull();
  });
});
