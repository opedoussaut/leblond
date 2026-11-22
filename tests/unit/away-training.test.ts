import { describe, expect, it } from "vitest";
import { computeSnapshot, type ClimbingDataset } from "@/lib/analytics";
import { isMobilityWork } from "@/lib/analytics/charts";
import { buildCoachContext, CONTEXT_CHAR_BUDGET, QUICK_ACTIONS } from "@/lib/coach/context";
import { sessionPickerDictionary } from "@/lib/i18n/session-picker";
import { buildPickerEntries, filterPickerEntries, locateValue, pickerCategories, pickerDurations } from "@/lib/training/session-picker";
import { awaySessionView, restLabel } from "@/lib/training/away/view";
import { NOW } from "./fixtures";
import { HIP_METHOD_ID } from "@/lib/training/hip-mobility/content";
import { isIllustration } from "@/lib/training/illustrations";
import type { Localized } from "@/lib/training/catalogue";
import {
  AWAY_EXERCISES, AWAY_EXERCISE_BY_ID, AWAY_SESSIONS, AWAY_SESSION_BY_KEY, OPTIONAL_EQUIPMENT, awayExerciseRows, awaySessionOf,
  awayTitle, estimateSeconds, hipAdapted, hipVersion, itemSeconds, recoveryAdvice, sessionEquipment, sessionItems, strainOf, suggestAway,
} from "@/lib/training/away";

const ALLOWED = new Set(["BODYWEIGHT", "FLOOR", "WALL", "LONG_BAND", "MINI_BAND", "CHAIR"]);
const LATTICE = ["calf-raise-step", "horse-stance-squat", "cossack-squat", "jefferson-curl", "single-leg-good-morning", "long-lunge-pulse"];
/** Pictures that show gym equipment, a bar or a band tied to an anchor. */
const NOT_AWAY_PICTURES = ["band-face-pull", "band-external-rotation", "band-internal-rotation", "passive-hang-feet", "romanian-deadlift",
  "dumbbell-curl", "parallel-bar-dips", "easy-pull-up", "weighted-pull-up", "cable-straight-arm-pulldown", "hanging-knee-raise", "no-hang-pin"];

const filled = (l: Localized | undefined) => !!l && l.fr.trim().length > 0 && l.en.trim().length > 0;
const mainSeconds = (key: string) => AWAY_SESSION_BY_KEY.get(key)!.sections
  .filter((s) => s.block === "MAIN").flatMap((s) => s.items).reduce((sum, i) => sum + itemSeconds(i), 0);

describe("away training catalogue", () => {
  it("has four 60-minute and four 90-minute séances with unique keys", () => {
    expect(AWAY_SESSIONS).toHaveLength(8);
    expect(AWAY_SESSIONS.filter((s) => s.minutes === 60)).toHaveLength(4);
    expect(AWAY_SESSIONS.filter((s) => s.minutes === 90)).toHaveLength(4);
    expect(new Set(AWAY_SESSIONS.map((s) => s.key)).size).toBe(8);
    expect(new Set(AWAY_EXERCISES.map((e) => e.id)).size).toBe(AWAY_EXERCISES.length);
  });

  it("estimates every séance within 5 % of its length, rests and transitions included", () => {
    for (const s of AWAY_SESSIONS) {
      const minutes = estimateSeconds(s) / 60;
      expect(Math.abs(minutes - s.minutes) / s.minutes, s.key).toBeLessThanOrEqual(0.05);
    }
  });

  it("gives the 90-minute séances more work, not just longer holds", () => {
    const sixty = AWAY_SESSIONS.filter((s) => s.minutes === 60).map((s) => mainSeconds(s.key));
    const ninety = AWAY_SESSIONS.filter((s) => s.minutes === 90).map((s) => mainSeconds(s.key));
    expect(Math.min(...ninety)).toBeGreaterThan(Math.max(...sixty));
    // No held position over 3 minutes except the closing breathing.
    for (const s of AWAY_SESSIONS) for (const i of sessionItems(s)) {
      if (i.id !== "legs-up-breathing") expect(i.seconds ?? 0, `${s.key} ${i.id}`).toBeLessThanOrEqual(180);
    }
  });

  it("starts with a warm-up, ends with a cool-down and has several main blocks", () => {
    for (const s of AWAY_SESSIONS) {
      expect(s.sections[0].block, s.key).toBe("WARMUP");
      expect(s.sections.at(-1)!.block, s.key).toBe("COOLDOWN");
      expect(s.sections.filter((x) => x.block === "MAIN").length, s.key).toBeGreaterThanOrEqual(2);
      expect(s.sections[0].items.length, s.key).toBeGreaterThanOrEqual(4);
    }
  });

  it("states sets, reps or holds and rests for every exercise", () => {
    for (const s of AWAY_SESSIONS) for (const i of sessionItems(s)) {
      const e = AWAY_EXERCISE_BY_ID.get(i.id);
      expect(e, `${s.key}: ${i.id}`).toBeDefined();
      expect(i.sets).toBeGreaterThanOrEqual(1);
      expect(i.rest).toBeGreaterThanOrEqual(0);
      expect(i.after).toBeGreaterThanOrEqual(0);
      if (e!.modality === "REPS") expect(i.reps, `${s.key} ${i.id}`).toBeGreaterThan(0);
      else expect(i.seconds, `${s.key} ${i.id}`).toBeGreaterThan(0);
      expect(i.reps !== undefined && i.seconds !== undefined).toBe(false);
      if (i.sets > 1) expect(i.rest, `${s.key} ${i.id}`).toBeGreaterThan(0);
    }
  });

  it("is written in French and English", () => {
    for (const e of AWAY_EXERCISES) {
      expect(filled(e.name) && filled(e.summary) && filled(e.cue), e.id).toBe(true);
      expect(e.steps.length, e.id).toBeGreaterThanOrEqual(3);
      for (const st of e.steps) expect(filled(st), e.id).toBe(true);
      if (e.alternative) expect(filled(e.alternative), e.id).toBe(true);
      if (e.hip) expect(filled(e.hip.easier), e.id).toBe(true);
    }
    for (const s of AWAY_SESSIONS) {
      expect(filled(s.title) && filled(s.summary) && filled(s.notes), s.key).toBe(true);
      for (const sec of s.sections) expect(filled(sec.title), s.key).toBe(true);
    }
  });
});

describe("away training equipment", () => {
  it("never needs a wall to climb, a hangboard, a bar, weights or a gym machine", () => {
    for (const e of AWAY_EXERCISES) for (const q of e.equipment) expect(ALLOWED.has(q), `${e.id} ${q}`).toBe(true);
    for (const e of AWAY_EXERCISES) {
      expect(e.illustration === undefined || isIllustration(e.illustration), e.id).toBe(true);
      expect(NOT_AWAY_PICTURES).not.toContain(e.illustration);
    }
  });

  it("gives an alternative to every exercise that needs a chair, a step or a mini band", () => {
    for (const e of AWAY_EXERCISES) {
      if (e.equipment.some((q) => OPTIONAL_EQUIPMENT.has(q))) expect(filled(e.alternative), e.id).toBe(true);
    }
  });

  it("never ties a band to furniture", () => {
    for (const e of AWAY_EXERCISES.filter((x) => x.equipment.includes("LONG_BAND"))) {
      const text = [e.summary, ...e.steps].map((l) => `${l.fr} ${l.en}`).join(" ").toLowerCase();
      expect(text, e.id).not.toMatch(/\b(door|porte|poignée|handle|bed leg|pied de lit|attach)/);
    }
  });

  it("lists what each séance needs, chair and mini band as optional", () => {
    expect(sessionEquipment(AWAY_SESSION_BY_KEY.get("hanches-60")!)).toEqual({ required: ["FLOOR", "WALL"], optional: ["CHAIR"] });
    const upper = sessionEquipment(AWAY_SESSION_BY_KEY.get("haut-du-corps-60")!);
    expect(upper.required).toContain("LONG_BAND");
    expect(upper.optional).toEqual(["MINI_BAND"]);
  });

  it("never claims bands replace finger training", () => {
    for (const key of ["haut-du-corps-60", "force-gainage-90"]) {
      expect(AWAY_SESSION_BY_KEY.get(key)!.notes.fr).toMatch(/ne remplacent pas le travail des doigts/);
      expect(AWAY_SESSION_BY_KEY.get(key)!.notes.en).toMatch(/do not replace finger training/);
    }
    expect(AWAY_EXERCISE_BY_ID.get("finger-extensions")!.summary.en).toMatch(/not finger strength training/);
  });
});

describe("away training priorities", () => {
  it("puts the six-exercise active flexibility block, in order, in every mobility séance", () => {
    for (const s of AWAY_SESSIONS.filter((x) => x.method === "mobility")) {
      const ids = sessionItems(s).map((i) => i.id);
      const start = ids.indexOf(LATTICE[0]);
      expect(ids.slice(start, start + 6), s.key).toEqual(LATTICE);
    }
  });

  it("works high steps, lateral placements, shoulders, pulling, core and balance across the catalogue", () => {
    const used = new Set(AWAY_SESSIONS.flatMap((s) => sessionItems(s).map((i) => i.id)));
    for (const id of ["wall-high-step", "lateral-foot-placement", "high-knee-hold", "band-external-rotation-free", "band-bent-row",
      "band-lockoff", "hollow-hold", "side-plank", "single-leg-rdl", "eyes-closed-balance", "balance-reach"]) {
      expect(used.has(id), id).toBe(true);
    }
  });
});

describe("away training rows", () => {
  const hips = AWAY_SESSION_BY_KEY.get("hanches-60")!;

  it("adapts demanding hip movements to the hip test (never tested = easier)", () => {
    const knee = AWAY_EXERCISE_BY_ID.get("high-knee-hold")!;
    expect(hipVersion(knee, null)).toBe("EASIER");
    expect(hipVersion(knee, 1)).toBe("EASIER");
    expect(hipVersion(knee, 2)).toBe("STANDARD");
    const sways = AWAY_EXERCISE_BY_ID.get("supine-knee-sways")!;
    expect(hipVersion(sways, null)).toBe("STANDARD");
    expect(hipVersion(sways, 3)).toBe("HARDER");
    expect(hipVersion(AWAY_EXERCISE_BY_ID.get("push-up")!, null)).toBe("STANDARD");
    expect(hipAdapted(hips)).toBe(true);
    expect(hipAdapted(AWAY_SESSION_BY_KEY.get("haut-du-corps-60")!)).toBe(false);

    const untested = awayExerciseRows(hips, { locale: "fr", hipStage: null });
    const row = untested.find((r) => r.name.startsWith("Genou haut"))!;
    expect(row.name).toMatch(/version adaptée/);
    expect(row.instructions.adaptation?.fr).toMatch(/^Version adaptée à ton test des hanches : Genou à hauteur de hanche/);
    const stage2 = awayExerciseRows(hips, { locale: "en", hipStage: 2 });
    expect(stage2.find((r) => r.name.startsWith("Active high-knee"))!.name).toBe("Active high-knee hold");
  });

  it("builds numbered rows keyed to the séance, in the climber's language", () => {
    for (const s of AWAY_SESSIONS) {
      const rows = awayExerciseRows(s, { locale: "en", hipStage: 2 });
      expect(rows).toHaveLength(sessionItems(s).length);
      rows.forEach((r, i) => {
        expect(r.position).toBe(i);
        expect(r.instructions.key).toBe(`away:${s.key}:${i}`);
        expect(awaySessionOf(r.instructions.key)).toBe(s.key);
        expect(r.method_id).toBe(s.method);
        expect(r.method_id).not.toBe(HIP_METHOD_ID);
        expect(r.intensity.length).toBeLessThanOrEqual(160);
        if (r.modality === "TIME") expect((r.target_seconds ?? 0) % 60).toBe(0);
      });
      expect(rows.at(-1)!.block).toBe("COOLDOWN");
    }
    expect(awaySessionOf("away:unknown:0")).toBeNull();
    expect(awaySessionOf("coach:hanches-60:0")).toBeNull();
    expect(awayTitle(hips, "fr")).toBe("Mobilité des hanches · En déplacement");
    expect(awayTitle(hips, "en")).not.toMatch(/\d/);
  });

  it("counts mobility séances as mobility work and strength ones as training", () => {
    for (const s of AWAY_SESSIONS) {
      const rows = awayExerciseRows(s, { locale: "fr", hipStage: 0 });
      expect(isMobilityWork(null, rows.map((r) => r.method_id)), s.key).toBe(s.method === "mobility");
    }
  });
});

describe("away training recovery", () => {
  const today = "2026-11-22";
  const hard = AWAY_SESSION_BY_KEY.get("force-gainage-90")!;
  const light = AWAY_SESSION_BY_KEY.get("recuperation-90")!;

  it("does not stack hard séances on consecutive days", () => {
    expect(recoveryAdvice(hard, [{ date: "2026-11-21", strain: "HARD" }], today)).toEqual({ status: "CAUTION", reason: "HARD_YESTERDAY" });
    expect(recoveryAdvice(hard, [{ date: today, strain: "HARD" }], today)).toEqual({ status: "CAUTION", reason: "HARD_TODAY" });
    expect(recoveryAdvice(hard, [{ date: "2026-11-20", strain: "HARD" }, { date: "2026-11-21", strain: "MODERATE" }], today).status).toBe("OK");
    expect(recoveryAdvice(light, [{ date: "2026-11-21", strain: "HARD" }], today).status).toBe("OK");
  });

  it("reads the strain of logged séances", () => {
    expect(strainOf({ awayKey: "conditionnement-90" })).toBe("HARD");
    expect(strainOf({ awayKey: "hanches-60", rpe: 9 })).toBe("LIGHT");
    expect(strainOf({ rpe: 8 })).toBe("HARD");
    expect(strainOf({ rpe: 5 })).toBe("MODERATE");
    expect(strainOf({ mobility: true })).toBe("LIGHT");
    expect(strainOf({})).toBe("MODERATE");
  });

  it("suggests recovery after a hard day, the hips when untested, otherwise the longest séance done least recently", () => {
    expect(suggestAway({ recent: [{ date: "2026-11-21", strain: "HARD" }], today, hipStage: 3, lastDone: {} }))
      .toEqual({ key: "recuperation-90", reason: "FATIGUE" });
    expect(suggestAway({ recent: [], today, hipStage: null, lastDone: {} })).toEqual({ key: "hanches-60", reason: "HIPS" });
    const s = suggestAway({ recent: [], today, hipStage: 3, lastDone: {
      "mobilite-avancee-90": "2026-11-01", "force-gainage-90": "2026-10-01", "conditionnement-90": "2026-11-10", "recuperation-90": "2026-11-15",
    } });
    expect(s).toEqual({ key: "force-gainage-90", reason: "LONGER" });
    expect(AWAY_SESSION_BY_KEY.get(s.key)!.minutes).toBe(90);
  });
});

describe("away training page, picker and Patrick", () => {
  const labels = { perSide: "par côté", reps: "rép.", restBetween: "récup {d}", restAfter: "puis {d} avant la suite" };

  it("writes doses and rests the way the page shows them", () => {
    expect(restLabel(30)).toBe("30 s");
    expect(restLabel(60)).toBe("1 min");
    expect(restLabel(90)).toBe("1 min 30");
    const view = awaySessionView(AWAY_SESSION_BY_KEY.get("hanches-60")!, "fr", null, labels);
    expect(view.exercises).toBe(sessionItems(AWAY_SESSION_BY_KEY.get("hanches-60")!).length);
    const items = view.sections.flatMap((s) => s.items);
    const knee = items.find((i) => i.name.startsWith("Genou haut"))!;
    expect(knee.dose).toBe("3 × 4 rép. par côté");
    expect(knee.rest).toBe("récup 30 s");
    expect(knee.version).toBe("EASIER");
    expect(knee.hipNote).toMatch(/^Genou à hauteur de hanche/);
    expect(items.find((i) => i.name.startsWith("Tour des articulations"))!.dose).toBe("2 min 30");
    expect(awaySessionView(AWAY_SESSION_BY_KEY.get("hanches-60")!, "en", 2, labels).sections.flatMap((s) => s.items)
      .every((i) => i.version !== "EASIER")).toBe(true);
  });

  it("files the eight séances under En déplacement in the séance picker", () => {
    const cats = sessionPickerDictionary("fr").categories;
    expect(buildPickerEntries([], "fr", cats).some((e) => e.kind === "away")).toBe(false);
    const entries = buildPickerEntries([], "fr", cats, { away: true });
    expect(entries.filter((e) => e.kind === "away")).toHaveLength(8);
    expect(pickerCategories(entries)).toContain("AWAY");
    expect(pickerDurations(entries)).toEqual(expect.arrayContaining([60, 90]));
    expect(filterPickerEntries(entries, { query: "", category: "AWAY", minutes: 90 })).toHaveLength(4);
    expect(filterPickerEntries(entries, { query: "hotel", category: "ALL", minutes: null }).every((e) => e.kind === "away")).toBe(true);
    expect(locateValue(entries, "away:hanches-60")?.entry.title).toBe("Mobilité des hanches");
  });

  it("gives Patrick the catalogue and LEBLOND's suggestion, never raw rows", () => {
    const empty: ClimbingDataset = { gyms: [], problems: [], attempts: [], sessions: [] };
    const target = { grade: "7A", system: "FONT" as const };
    const base = {
      climber: { name: "Alex", language: "fr" as const, target },
      snapshot30: computeSnapshot(empty, target, NOW, 30), snapshot90: computeSnapshot(empty, target, NOW, 90),
      recentSessions: [], activeProjects: [], now: NOW,
    };
    expect(buildCoachContext(base).away).toBeNull();
    const ctx = buildCoachContext({ ...base, quickAction: "away", away: {
      suggestion: { key: "recuperation-90", reason: "FATIGUE" }, hipStage: null, recovery: "HARD_YESTERDAY", lastDone: { "hanches-60": "2026-11-01" },
    } });
    expect(QUICK_ACTIONS).toContain("away");
    expect(ctx.away?.catalogue).toHaveLength(8);
    expect(ctx.away?.suggestion).toEqual({ key: "recuperation-90", title: "Mobilité, souplesse et récupération", reason: "FATIGUE" });
    expect(ctx.away?.catalogue.find((c) => c.key === "hanches-60")?.lastDone).toBe("2026-11-01");
    expect(ctx.definitions).toHaveProperty("away");
    expect(JSON.stringify(ctx).length).toBeLessThanOrEqual(CONTEXT_CHAR_BUDGET);
  });
});
