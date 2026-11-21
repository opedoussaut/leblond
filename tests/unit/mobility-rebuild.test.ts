import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAYS, PHASE_MINUTES, SLOTS, TOTAL_SESSIONS, adherence, allowedPhase, beforeVerdict, followUpOpen, isoWeekday,
  nextDay, phaseFor, postponeDate, reassessments, rebuildStatus, redate, schedule, slotInfo, stopIsEmergency, tolerance,
  usualLevels, validDays, type BeforeCheck, type DoneSession, type Phase,
} from "@/lib/training/mobility-rebuild/engine";
import {
  contentOf, parseContent, plannedSessions, rebuildExerciseRows, rebuildProgrammeSchema, rebuildTemplateSchema,
  type RebuildProgrammeInput,
} from "@/lib/training/mobility-rebuild/templates";
import { rebuildDictionary } from "@/lib/i18n/mobility-rebuild";
import { buildView, currentPhase, type CheckRow, type RebuildRow } from "@/lib/training/mobility-rebuild/state";

/** A generic, made-up programme: one check-in, one main exercise filling the phase, one cool-down. */
function fakeProgramme(over: Partial<RebuildProgrammeInput> = {}): RebuildProgrammeInput {
  const templates = (["A", "B", "C"] as const).flatMap((letter) => ([1, 2, 3, 4, 5, 6] as const).map((phase) => ({
    letter, phase, title: `Séance ${letter}`, minutes: PHASE_MINUTES[phase],
    exercises: [
      { block: "WARMUP" as const, name: "Check-in", modality: "FREE" as const, minutes: 5 },
      { block: "MAIN" as const, name: "Exercice", modality: "REPS" as const, sets: 2, reps: 6, restSeconds: 60,
        minutes: 30, alternative: "Version assise" },
      { block: "MAIN" as const, name: "Marche douce", modality: "TIME" as const, seconds: 600,
        minutes: PHASE_MINUTES[phase] - 40, alternative: "Marche sur place avec appui" },
      { block: "COOLDOWN" as const, name: "Retour au calme", modality: "FREE" as const, minutes: 5 },
    ],
  })));
  return { programme: "REBUILD_12W", days: [...DEFAULT_DAYS], templates, ...over };
}

const CLEAR: BeforeCheck = {
  backPain: 2, legRadiation: 1, radiationSpreading: false, unusualPain: false,
  newNeuro: false, bladderBowel: false, saddleNumbness: false, recentFallSpinalPain: false,
};

const done = (o: Partial<DoneSession> = {}): DoneSession => ({
  slot: 1, status: "COMPLETED", phaseUsed: 1, verdict: "GO", painBefore: 2, painAfter: 2, stopReason: null, nextDay: "SAME", ...o,
});

describe("slots and phases", () => {
  it("has 36 séances, A/B/C each week, six two-week phases of 60 to 90 minutes", () => {
    expect(TOTAL_SESSIONS).toBe(36);
    expect(SLOTS.map((s) => s.letter).join("")).toBe("ABC".repeat(12));
    expect(SLOTS.filter((s) => s.letter === "A")).toHaveLength(12);
    expect(slotInfo(1)).toMatchObject({ week: 1, phase: 1, minutes: 60 });
    expect(slotInfo(6)).toMatchObject({ week: 2, phase: 1, minutes: 60 });
    expect(slotInfo(7)).toMatchObject({ week: 3, phase: 2, minutes: 65 });
    expect(slotInfo(36)).toMatchObject({ week: 12, phase: 6, minutes: 90 });
    expect([...new Set(SLOTS.map((s) => s.minutes))]).toEqual([60, 65, 70, 75, 80, 90]);
    expect(() => slotInfo(0)).toThrow();
    expect(() => slotInfo(37)).toThrow();
  });
});

describe("schedule", () => {
  it("accepts three weekdays never in a row, Sunday → Monday included", () => {
    expect(validDays([2, 4, 7])).toBe(true);
    expect(validDays([1, 3, 5])).toBe(true);
    expect(validDays([1, 3, 7])).toBe(false);
    expect(validDays([2, 3, 6])).toBe(false);
    expect(validDays([2, 4])).toBe(false);
    expect(validDays([2, 2, 5])).toBe(false);
    expect(validDays([0, 2, 4])).toBe(false);
  });

  it("starts on the next valid day strictly after today: never backdated, not even today", () => {
    // 2026-11-24 is a Tuesday.
    expect(isoWeekday("2026-11-24")).toBe(2);
    const s = schedule([2, 4, 7], "2026-11-24");
    expect(s[0]!.date).toBe("2026-11-26");
    expect(s.every((x) => x.date > "2026-11-24")).toBe(true);
  });

  it("plans 36 dated séances on the chosen days, never two days in a row", () => {
    const s = schedule([2, 4, 7], "2026-11-21");
    expect(s).toHaveLength(36);
    expect(s[0]!.date).toBe("2026-11-22");
    for (const x of s) expect([2, 4, 7]).toContain(isoWeekday(x.date));
    for (let i = 1; i < s.length; i++) {
      const gap = (Date.parse(s[i]!.date) - Date.parse(s[i - 1]!.date)) / 86_400_000;
      expect(gap).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(s.map((x) => x.date)).size).toBe(36);
  });

  it("gives the same dates for the same start (re-running plans the same séances)", () => {
    const first = schedule([2, 4, 7], "2026-11-21");
    const again = schedule([2, 4, 7], "2026-12-10", first[0]!.date);
    expect(again).toEqual(first);
  });

  it("refuses invalid days and a start that is not a programme day", () => {
    expect(() => schedule([1, 2, 5], "2026-11-21")).toThrow();
    expect(() => schedule([2, 4, 7], "2026-11-21", "2026-11-23")).toThrow();
  });

  it("schedules S4, S8 and S12 at the end of those weeks", () => {
    expect(reassessments("2026-11-22")).toEqual([
      { key: "S4", from: "2026-12-19" }, { key: "S8", from: "2027-01-16" }, { key: "S12", from: "2027-02-13" },
    ]);
  });

  it("postpones to the next free programme day after today", () => {
    expect(nextDay("2026-11-22", [2, 4, 7])).toBe("2026-11-24");
    expect(postponeDate("2026-11-22", "2026-11-22", [2, 4, 7], new Set(["2026-11-24"]))).toBe("2026-11-26");
    // A missed séance moves after today, not after its old date.
    expect(postponeDate("2026-11-10", "2026-11-22", [2, 4, 7], new Set())).toBe("2026-11-24");
  });

  it("re-dates the séances still planned when the days change, in slot order, from tomorrow", () => {
    const m = redate([{ slot: 5, date: "2026-12-01" }, { slot: 4, date: "2026-11-29" }], "2026-11-23", [1, 3, 5]);
    expect([...m.entries()]).toEqual([[4, "2026-11-25"], [5, "2026-11-27"]]);
    expect(() => redate([], "2026-11-23", [1, 2, 5])).toThrow();
  });
});

describe("before the séance: symptom gate", () => {
  it("goes when everything is at or below the usual levels", () => {
    expect(beforeVerdict(CLEAR, { backPain: 3, legRadiation: 1 }).verdict).toBe("GO");
  });
  it("calls for urgent advice on any emergency sign, whatever the pain", () => {
    for (const k of ["newNeuro", "bladderBowel", "saddleNumbness", "recentFallSpinalPain"] as const) {
      expect(beforeVerdict({ ...CLEAR, [k]: true }, null)).toEqual({ verdict: "EMERGENCY", reason: "emergency" });
    }
  });
  it("stops on spreading radiation, unusual pain, high pain or a big rise above usual", () => {
    expect(beforeVerdict({ ...CLEAR, radiationSpreading: true }, null).verdict).toBe("STOP");
    expect(beforeVerdict({ ...CLEAR, unusualPain: true }, null).verdict).toBe("STOP");
    expect(beforeVerdict({ ...CLEAR, backPain: 7 }, null).verdict).toBe("STOP");
    expect(beforeVerdict({ ...CLEAR, backPain: 6 }, { backPain: 3, legRadiation: 1 }).verdict).toBe("STOP");
    expect(beforeVerdict({ ...CLEAR, legRadiation: 4 }, { backPain: 3, legRadiation: 1 }).verdict).toBe("STOP");
  });
  it("adapts when pain is above usual but below the stop levels", () => {
    expect(beforeVerdict({ ...CLEAR, backPain: 4 }, { backPain: 3, legRadiation: 1 }).verdict).toBe("ADAPT");
    expect(beforeVerdict({ ...CLEAR, legRadiation: 2 }, { backPain: 3, legRadiation: 1 }).verdict).toBe("ADAPT");
    expect(beforeVerdict({ ...CLEAR, backPain: 5 }, null).verdict).toBe("ADAPT");
    expect(beforeVerdict({ ...CLEAR, legRadiation: 3 }, null).verdict).toBe("ADAPT");
  });
  it("reads the usual levels from the programme, else from recent GO check-ins", () => {
    expect(usualLevels({ backPain: 3, legRadiation: 1 }, [])).toEqual({ backPain: 3, legRadiation: 1 });
    expect(usualLevels(null, [])).toBeNull();
    expect(usualLevels(null, [
      { verdict: "GO", backPain: 2, legRadiation: 0 }, { verdict: "STOP", backPain: 9, legRadiation: 9 },
      { verdict: "GO", backPain: 4, legRadiation: 2 }, { verdict: "GO", backPain: 3, legRadiation: 1 },
    ])).toEqual({ backPain: 3, legRadiation: 1 });
  });
  it("treats a neurological stop as an emergency", () => {
    expect(stopIsEmergency("NEURO")).toBe(true);
    expect(stopIsEmergency("PAINFUL_BLOCK")).toBe(false);
  });
});

describe("progression gate", () => {
  it("counts a séance as tolerated only with a GO check-in, a next-day follow-up and no real pain rise", () => {
    expect(tolerance(done())).toBe("TOLERATED");
    expect(tolerance(done({ nextDay: null }))).toBe("NEUTRAL");
    expect(tolerance(done({ verdict: "ADAPT" }))).toBe("NEUTRAL");
    expect(tolerance(done({ painAfter: 4 }))).toBe("NEUTRAL");
    expect(tolerance(done({ painAfter: 5 }))).toBe("BAD");
    expect(tolerance(done({ nextDay: "WORSE" }))).toBe("BAD");
    expect(tolerance(done({ status: "INTERRUPTED", stopReason: "PAINFUL_BLOCK" }))).toBe("BAD");
  });
  it("opens the next phase after three tolerated séances at the phase in use", () => {
    expect(allowedPhase([])).toBe(1);
    expect(allowedPhase([done(), done()])).toBe(1);
    expect(allowedPhase([done(), done(), done()])).toBe(2);
    expect(allowedPhase([done(), done(), done(), done({ phaseUsed: 2 }), done({ phaseUsed: 2 }), done({ phaseUsed: 2 })])).toBe(3);
  });
  it("steps back after a bad séance and needs a fresh streak", () => {
    const h = [done(), done(), done(), done({ phaseUsed: 2, nextDay: "WORSE" }), done(), done()];
    expect(allowedPhase(h)).toBe(1);
    expect(allowedPhase([...h, done()])).toBe(2);
  });
  it("keeps the planned phase only when the record allows it", () => {
    expect(phaseFor(1, [], null)).toEqual({ phase: 1, reason: "planned", adapted: false });
    expect(phaseFor(3, [done(), done(), done()], null)).toEqual({ phase: 2, reason: "tolerance", adapted: true });
  });
  it("holds phases 5–6 until a clinical review is documented", () => {
    const perfect: DoneSession[] = [];
    for (let p = 1; p <= 6; p++) for (let i = 0; i < 3; i++) perfect.push(done({ phaseUsed: Math.min(p, 6) as Phase }));
    expect(allowedPhase(perfect)).toBe(6);
    expect(phaseFor(6, perfect, null)).toMatchObject({ phase: 4, reason: "clinical", adapted: true });
    expect(phaseFor(6, perfect, "2026-12-15")).toMatchObject({ phase: 6, adapted: false });
  });
  it("uses the earlier phase on a day the check-in says ADAPT", () => {
    expect(phaseFor(1, [], null, "ADAPT")).toMatchObject({ phase: 1, reason: "symptoms", adapted: false });
    expect(phaseFor(2, [done(), done(), done()], null, "ADAPT")).toMatchObject({ phase: 1, reason: "symptoms", adapted: true });
  });
});

describe("status, adherence and the next-day follow-up", () => {
  const today = "2026-12-01";
  it("maps séances to À faire / En cours / Fait / Reporté / Adapté", () => {
    expect(rebuildStatus({ status: "PLANNED", scheduledDate: "2026-12-03", originalDate: "2026-12-03" }, today, false)).toBe("TODO");
    expect(rebuildStatus({ status: "PLANNED", scheduledDate: "2026-12-05", originalDate: "2026-12-03" }, today, false)).toBe("POSTPONED");
    expect(rebuildStatus({ status: "PLANNED", scheduledDate: "2026-11-28", originalDate: "2026-11-28" }, today, false)).toBe("POSTPONED");
    expect(rebuildStatus({ status: "IN_PROGRESS", scheduledDate: today, originalDate: today }, today, false)).toBe("IN_PROGRESS");
    expect(rebuildStatus({ status: "COMPLETED", scheduledDate: today, originalDate: today }, today, false)).toBe("DONE");
    expect(rebuildStatus({ status: "COMPLETED", scheduledDate: today, originalDate: today }, today, true)).toBe("ADAPTED");
    expect(rebuildStatus({ status: "INTERRUPTED", scheduledDate: today, originalDate: today }, today, false)).toBe("INTERRUPTED");
  });
  it("counts adherence against séances already due", () => {
    expect(adherence([
      { status: "COMPLETED", originalDate: "2026-11-24" }, { status: "PLANNED", originalDate: "2026-11-26" },
      { status: "PLANNED", originalDate: "2026-12-03" },
    ], today)).toEqual({ done: 1, due: 2 });
    // Done ahead of its date: it counts as due, never "1 done out of 0".
    expect(adherence([{ status: "COMPLETED", originalDate: "2026-12-10" }, { status: "PLANNED", originalDate: "2026-12-12" }], today))
      .toEqual({ done: 1, due: 1 });
  });
  it("opens the follow-up from the next day, for a week, once", () => {
    expect(followUpOpen("2026-12-01", "2026-12-01", false)).toBe(false);
    expect(followUpOpen("2026-12-01", "2026-12-02", false)).toBe(true);
    expect(followUpOpen("2026-12-01", "2026-12-08", false)).toBe(true);
    expect(followUpOpen("2026-12-01", "2026-12-09", false)).toBe(false);
    expect(followUpOpen("2026-12-01", "2026-12-02", true)).toBe(false);
  });
});

describe("programme content", () => {
  it("accepts 18 séances whose exercises add up to each phase's length", () => {
    const p = rebuildProgrammeSchema.parse(fakeProgramme());
    expect(p.templates).toHaveLength(18);
    expect(parseContent(contentOf(p))?.templates).toHaveLength(18);
  });
  it("refuses a séance that does not last its phase's length, or whose exercises do not add up", () => {
    const base = fakeProgramme().templates[0]!;
    expect(rebuildTemplateSchema.safeParse({ ...base, minutes: 65 }).success).toBe(false);
    expect(rebuildTemplateSchema.safeParse({ ...base, exercises: base.exercises.slice(0, 3) }).success).toBe(false);
  });
  it("refuses a main exercise without an alternative", () => {
    const base = fakeProgramme().templates[0]!;
    const exercises = base.exercises.map((e) => (e.block === "MAIN" ? { ...e, alternative: undefined } : e));
    expect(rebuildTemplateSchema.safeParse({ ...base, exercises }).success).toBe(false);
  });
  it("refuses a missing séance, a duplicate, consecutive days or an unverified video link", () => {
    const p = fakeProgramme();
    expect(rebuildProgrammeSchema.safeParse({ ...p, templates: [...p.templates.slice(1), p.templates[1]] }).success).toBe(false);
    expect(rebuildProgrammeSchema.safeParse({ ...p, days: [1, 2, 5] }).success).toBe(false);
    const t = p.templates[0]!;
    const bad = { ...t, exercises: [{ ...t.exercises[0]!, demo: { label: "x", url: "https://example.com/video" } }, ...t.exercises.slice(1)] };
    expect(rebuildTemplateSchema.safeParse(bad).success).toBe(false);
  });
  it("plans 36 séances with their exercises, minutes and alternatives, none on or before today", () => {
    const p = rebuildProgrammeSchema.parse(fakeProgramme());
    const s = plannedSessions(p, "2026-11-21");
    expect(s).toHaveLength(36);
    expect(s[0]!.title).toBe("A · Séance A");
    expect(s[35]!).toMatchObject({ slot: 36, letter: "C", phase: 6, minutes: 90 });
    for (const x of s) {
      expect(x.exercises.reduce((a, e) => a + (e.instructions.minutes ?? 0), 0)).toBe(x.minutes);
    }
    const main = rebuildExerciseRows(p.templates[0]!)[1]!;
    expect(main.instructions).toMatchObject({ key: "rebuild:A1:1", minutes: 30, alternative: "Version assise" });
    expect(main).toMatchObject({ target_sets: 2, target_reps: 6, rest_seconds: 60 });
  });
  it("re-running after the start keeps the same dates and drops the séances already past (idempotent, never backdated)", () => {
    const p = rebuildProgrammeSchema.parse(fakeProgramme());
    const first = plannedSessions(p, "2026-11-21");
    const later = plannedSessions(p, "2026-11-29", first[0]!.date);
    expect(later.every((x) => x.date > "2026-11-29")).toBe(true);
    const byFirst = new Map(first.map((x) => [x.slot, x.date]));
    for (const x of later) expect(x.date).toBe(byFirst.get(x.slot));
    expect(later[0]!.slot).toBe(first.find((x) => x.date > "2026-11-29")!.slot);
  });
});

describe("dictionary", () => {
  it("has the same keys in French and English, with the programme names", () => {
    const fr = rebuildDictionary("fr");
    const en = rebuildDictionary("en");
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    expect(fr.title).toBe("Reconquête mobilité | 12 semaines");
    expect(en.title).toBe("Mobility Rebuild | 12 Weeks");
    expect(fr.clinicalPending).toBe("Prêt à démarrer / validation clinique à documenter");
  });
});

describe("state: séances and check-ins read together", () => {
  const row = (slot: number, o: Partial<RebuildRow> = {}): RebuildRow => ({
    id: "s" + slot, title: "X", status: "PLANNED", slot, phase: slotInfo(slot).phase, plannedMinutes: slotInfo(slot).minutes,
    scheduledDate: "2026-12-0" + slot, originalDate: "2026-12-0" + slot, pain: null, completedAt: null, ...o,
  });
  const check = (sessionId: string, o: Partial<CheckRow>): CheckRow => ({
    sessionId, moment: "BEFORE", backPain: 2, legRadiation: 1, verdict: "GO", phaseUsed: 1, stopReason: null, overall: null,
    updatedAt: "2026-12-01T10:00:00Z", ...o,
  });
  const day = (iso: string) => iso.slice(0, 10);

  it("builds the history, the next séance, adherence and open follow-ups", () => {
    const rows = [
      row(1, { status: "COMPLETED", completedAt: "2026-12-01T11:00:00Z", pain: 2 }),
      row(2, { status: "INTERRUPTED", completedAt: null, scheduledDate: "2026-12-03" }),
      row(3), row(4),
    ];
    const checks = [
      check("s1", {}), check("s1", { moment: "D1", overall: "SAME" }),
      check("s2", {}), check("s2", { moment: "AFTER", stopReason: "PAINFUL_BLOCK", updatedAt: "2026-12-03T10:00:00Z" }),
    ];
    const v = buildView(rows, checks, null, "2026-12-04", day);
    expect(v.history.map((h) => [h.slot, h.status, h.stopReason, h.nextDay])).toEqual([
      [1, "COMPLETED", null, "SAME"], [2, "INTERRUPTED", "PAINFUL_BLOCK", null],
    ]);
    expect(v.next?.slot).toBe(2);
    expect(v.followUps.map((s) => s.slot)).toEqual([2]);
    expect(v.adherence).toEqual({ done: 1, due: 4 });
    expect(v.usual).toEqual({ backPain: 2, legRadiation: 1 });
    expect(v.sessions.find((s) => s.slot === 1)!.view).toBe("DONE");
  });

  it("marks a séance done with an earlier phase as Adapté", () => {
    const rows = [row(7, { status: "COMPLETED", completedAt: "2026-12-07T10:00:00Z", scheduledDate: "2026-12-07", originalDate: "2026-12-07" })];
    const v = buildView(rows, [check("s7", { phaseUsed: 1 })], null, "2026-12-08", day);
    expect(v.sessions[0]).toMatchObject({ view: "ADAPTED", adapted: true, phaseUsed: 1 });
    expect(currentPhase(v)).toBe(1);
  });
});
