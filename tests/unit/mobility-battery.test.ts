import { describe, expect, it } from "vitest";
import {
  batteryTrends, cardStatus, cardTrend, changeBetween, d1Open, nextDue, pointFor, sessionProgress, sideGap,
  type BatteryResult, type BatterySession,
} from "@/lib/analytics/mobility-battery";
import { CARDS, CARD_BY_ID, CARD_IDS, cardSides, type CardId } from "@/lib/training/mobility-battery/cards";
import {
  PAINFREE_MAX_REST_PAIN, accessFor, cardAccess, evaluateMovement, safetyScreen, symptomsEndSession, type GateContext,
} from "@/lib/training/mobility-battery/safety";
import { buildCardRows, cardInputSchema, entrySchema, restFromRows, startSchema, type EntryInput } from "@/lib/training/mobility-battery/results";
import { batteryDictionary } from "@/lib/i18n/mobility-battery";

const card = (id: CardId) => CARD_BY_ID.get(id)!;
const entry = (e: EntryInput) => entrySchema.parse(e);
const OPEN: GateContext = { sessionOpen: true, kneePainToday: false, clinicalReviewOn: null, rest: { backPain: 2, legPain: 1, neuro: "SAME" } };

describe("catalogue", () => {
  it("has the 20 cards: 18 home cards and 2 clinician-only", () => {
    expect(CARDS.map((c) => c.id)).toEqual([...CARD_IDS]);
    expect(CARDS.filter((c) => c.access === "clinician_only").map((c) => c.id)).toEqual(["M19", "M20"]);
    expect(CARDS.filter((c) => c.access !== "clinician_only")).toHaveLength(18);
  });
  it("matches the brief's access levels", () => {
    const by = (a: string) => CARDS.filter((c) => c.access === a).map((c) => c.id);
    expect(by("self_baseline")).toEqual(["M01", "M02"]);
    expect(by("conditional_no_knee_pain")).toEqual(["M05"]);
    expect(by("after_clinical_review")).toEqual(["M11", "M17", "M18"]);
  });
  it("never gives a clinician card a how-to (no self-test tutorial)", () => {
    for (const c of CARDS.filter((x) => x.access === "clinician_only")) {
      expect(c.how).toBeNull();
      expect(c.measure).toBeNull();
      expect(c.slot).toBe(0);
    }
    for (const c of CARDS.filter((x) => x.access !== "clinician_only")) expect(c.how?.length).toBeGreaterThan(0);
  });
  it("only knee-to-wall carries a minimal detectable change (the only one the brief gives)", () => {
    expect(CARDS.filter((c) => c.mdc).map((c) => c.id)).toEqual(["M05"]);
    expect(card("M05").mdc?.value).toBe(1.9);
  });
  it("keeps the texts generic: no single age, no one-sided body part", () => {
    const text = JSON.stringify(CARDS).toLowerCase();
    expect(text).not.toMatch(/(?<![–-])\d{2} ?(ans|-year)/);
    expect(text).not.toMatch(/(genou|hanche|cheville|épaule) (droite?|gauche)|(right|left) (knee|hip|ankle|shoulder)/);
  });
  it("records left and right separately for one-sided cards", () => {
    expect(cardSides(card("M07"))).toEqual(["LEFT", "RIGHT"]);
    expect(cardSides(card("M03"))).toEqual(["BOTH"]);
  });
});

describe("safety screen and stop conditions", () => {
  const none = { newNeuro: false, bladderBowel: false, saddleNumbness: false, recentFallSpinalPain: false };
  it("is clear only when no red flag is ticked", () => {
    expect(safetyScreen(none)).toBe("CLEAR");
  });
  it.each(["newNeuro", "bladderBowel", "saddleNumbness"] as const)("%s calls for urgent medical evaluation", (k) => {
    expect(safetyScreen({ ...none, [k]: true })).toBe("URGENT_MEDICAL");
  });
  it("a recent fall with unusual spinal pain calls for a medical check before any assessment", () => {
    expect(safetyScreen({ ...none, recentFallSpinalPain: true })).toBe("MEDICAL_BEFORE_ASSESSMENT");
    expect(safetyScreen({ ...none, recentFallSpinalPain: true, bladderBowel: true })).toBe("URGENT_MEDICAL");
  });
  it("worse or new neurological symptoms at rest end the bilan", () => {
    expect(symptomsEndSession({ backPain: 1, legPain: 1, neuro: "WORSE" })).toBe(true);
    expect(symptomsEndSession({ backPain: 1, legPain: 1, neuro: "NEW" })).toBe(true);
    expect(symptomsEndSession({ backPain: 8, legPain: 8, neuro: "SAME" })).toBe(false);
  });
  it("any stop sign stops the movement; radiation lower/stronger or weakness ends the bilan", () => {
    expect(evaluateMovement({ signs: [], radiation: "NONE", painBefore: 1, painAfter: 1 })).toEqual({ stopMovement: false, endSession: false, signs: [] });
    expect(evaluateMovement({ signs: ["PINCHING"], radiation: null, painBefore: null, painAfter: null })).toMatchObject({ stopMovement: true, endSession: false });
    expect(evaluateMovement({ signs: ["HARD_BLOCK"], radiation: null, painBefore: null, painAfter: null }).endSession).toBe(false);
    expect(evaluateMovement({ signs: [], radiation: "LOWER_OR_STRONGER", painBefore: 1, painAfter: 1 })).toEqual({ stopMovement: true, endSession: true, signs: ["RADIATION_LOWER_STRONGER"] });
    expect(evaluateMovement({ signs: ["WEAKNESS"], radiation: "NONE", painBefore: 1, painAfter: 1 }).endSession).toBe(true);
  });
  it("a rise of 2 points of pain during a test counts as new pain", () => {
    expect(evaluateMovement({ signs: [], radiation: "NONE", painBefore: 2, painAfter: 3 }).stopMovement).toBe(false);
    expect(evaluateMovement({ signs: [], radiation: "NONE", painBefore: 2, painAfter: 4 })).toMatchObject({ stopMovement: true, signs: ["NEW_PAIN"] });
  });
});

describe("access gating", () => {
  it("baseline cards open as soon as the bilan is open", () => {
    expect(accessFor("self_baseline", { ...OPEN, rest: null })).toEqual({ state: "OPEN" });
  });
  it("pain-free cards wait for the symptoms card, then for low rest pain", () => {
    expect(accessFor("self_when_painfree", { ...OPEN, rest: null })).toEqual({ state: "LOCKED", reasons: ["NEEDS_SYMPTOMS"] });
    expect(accessFor("self_when_painfree", OPEN)).toEqual({ state: "OPEN" });
    expect(accessFor("self_when_painfree", { ...OPEN, rest: { backPain: PAINFREE_MAX_REST_PAIN, legPain: 0, neuro: "SAME" } })).toEqual({ state: "OPEN" });
    expect(accessFor("self_when_painfree", { ...OPEN, rest: { backPain: 2, legPain: PAINFREE_MAX_REST_PAIN + 1, neuro: "SAME" } }))
      .toEqual({ state: "LOCKED", reasons: ["REST_PAIN"] });
    expect(accessFor("self_when_painfree", { ...OPEN, rest: { backPain: 0, legPain: 0, neuro: "WORSE" } })).toEqual({ state: "LOCKED", reasons: ["REST_PAIN"] });
  });
  it("knee-to-wall is locked on a knee-pain day", () => {
    expect(cardAccess(card("M05"), OPEN)).toEqual({ state: "OPEN" });
    expect(cardAccess(card("M05"), { ...OPEN, kneePainToday: true })).toEqual({ state: "LOCKED", reasons: ["KNEE_PAIN"] });
  });
  it("climbing and floor cards wait for a clinical review", () => {
    for (const id of ["M11", "M17", "M18"] as const) {
      expect(cardAccess(card(id), OPEN)).toEqual({ state: "LOCKED", reasons: ["NEEDS_CLINICAL_REVIEW"] });
      expect(cardAccess(card(id), { ...OPEN, clinicalReviewOn: "2026-11-01" })).toEqual({ state: "OPEN" });
    }
  });
  it("clinician cards are never open for a self-test, even with a review", () => {
    expect(cardAccess(card("M19"), { ...OPEN, clinicalReviewOn: "2026-11-01" })).toEqual({ state: "CLINICIAN" });
    expect(cardAccess(card("M20"), OPEN)).toEqual({ state: "CLINICIAN" });
  });
  it("nothing opens on a finished bilan", () => {
    expect(cardAccess(card("M01"), { ...OPEN, sessionOpen: false })).toEqual({ state: "LOCKED", reasons: ["SESSION_CLOSED"] });
  });
});

describe("building rows: not done is never a zero", () => {
  it("keeps raw values per side and trial", () => {
    const r = buildCardRows(card("M07"), [
      entry({ side: "LEFT", trial: 1, status: "DONE", value: 14.25, painBefore: 1, painAfter: 1, radiation: "NONE" }),
      entry({ side: "LEFT", trial: 2, status: "DONE", value: 13 }),
      entry({ side: "RIGHT", status: "NOT_DONE", notDoneReason: "PAIN" }),
    ], "same chair", OPEN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.map((x) => [x.side, x.trial, x.status, x.value, x.unit, x.not_done_reason])).toEqual([
      ["LEFT", 1, "DONE", 14.3, "CM", null], ["LEFT", 2, "DONE", 13, "CM", null], ["RIGHT", 1, "NOT_DONE", null, "CM", "PAIN"],
    ]);
    expect(r.rows[0].note).toBe("same chair");
    expect(r.endSession).toBeNull();
  });
  it("a not-done entry never keeps a value, even a zero sent by the browser", () => {
    const r = buildCardRows(card("M04"), [entry({ side: "LEFT", status: "NOT_DONE", value: 0, notDoneReason: "NO_TIME" })], "", OPEN);
    expect(r.ok && r.rows[0].value).toBe(null);
  });
  it("not done needs a reason, and LOCKED is the app's, not the climber's", () => {
    expect(buildCardRows(card("M04"), [entry({ side: "LEFT", status: "NOT_DONE" })], "", OPEN)).toEqual({ ok: false, error: "needs_reason" });
    expect(buildCardRows(card("M04"), [entry({ side: "LEFT", status: "NOT_DONE", notDoneReason: "LOCKED" })], "", OPEN)).toEqual({ ok: false, error: "needs_reason" });
  });
  it("done needs a value inside the card's range", () => {
    expect(buildCardRows(card("M04"), [entry({ side: "LEFT", status: "DONE" })], "", OPEN)).toEqual({ ok: false, error: "bad_value" });
    expect(buildCardRows(card("M04"), [entry({ side: "LEFT", status: "DONE", value: 21 })], "", OPEN)).toEqual({ ok: false, error: "bad_value" });
  });
  it("rejects sides, items and trials the card does not have", () => {
    expect(buildCardRows(card("M03"), [entry({ side: "LEFT", status: "DONE", value: 10 })], "", OPEN)).toEqual({ ok: false, error: "bad_side" });
    expect(buildCardRows(card("M03"), [entry({ side: "BOTH", item: 2, status: "DONE", value: 10 })], "", OPEN)).toEqual({ ok: false, error: "bad_item" });
    expect(buildCardRows(card("M01"), [entry({ side: "BOTH", trial: 2, status: "DONE", value: 1 })], "", OPEN)).toEqual({ ok: false, error: "bad_trial" });
    expect(buildCardRows(card("M03"), [entry({ side: "BOTH", status: "DONE", value: 10 }), entry({ side: "BOTH", status: "DONE", value: 11 })], "", OPEN))
      .toEqual({ ok: false, error: "duplicate" });
  });
  it("accepts a stable category where the card offers one", () => {
    const r = buildCardRows(card("M15"), [entry({ side: "LEFT", status: "DONE", category: "EYES" })], "", OPEN);
    expect(r.ok && [r.rows[0].unit, r.rows[0].category, r.rows[0].value]).toEqual(["CATEGORY", "EYES", null]);
    expect(buildCardRows(card("M15"), [entry({ side: "LEFT", status: "DONE", category: "MOON" })], "", OPEN)).toEqual({ ok: false, error: "bad_category" });
    expect(buildCardRows(card("M07"), [entry({ side: "LEFT", status: "DONE", category: "EYES" })], "", OPEN)).toEqual({ ok: false, error: "bad_category" });
  });
  it("a locked card can only be stored as not done (locked), whatever was sent", () => {
    const r = buildCardRows(card("M05"), [entry({ side: "LEFT", status: "DONE", value: 9 })], "", { ...OPEN, kneePainToday: true });
    expect(r.ok && r.rows.map((x) => [x.status, x.value, x.not_done_reason])).toEqual([["NOT_DONE", null, "LOCKED"]]);
  });
  it("a stop sign turns the movement into 'not done (stopped)' and drops its value", () => {
    const r = buildCardRows(card("M08"), [entry({ side: "LEFT", status: "DONE", value: 12, signs: ["PINCHING"], painBefore: 1, painAfter: 2 })], "", OPEN);
    expect(r.ok && r.rows[0]).toMatchObject({ status: "NOT_DONE", value: null, not_done_reason: "STOPPED_SYMPTOM", details: { stopSigns: ["PINCHING"] } });
    expect(r.ok && r.endSession).toBeNull();
  });
  it("radiation lower or stronger stops the bilan", () => {
    const r = buildCardRows(card("M12"), [entry({ side: "RIGHT", status: "DONE", value: 20, radiation: "LOWER_OR_STRONGER" })], "", OPEN);
    expect(r.ok && [r.endSession, r.stopped]).toEqual(["SYMPTOM", ["RADIATION_LOWER_STRONGER"]]);
  });
  it("stop signs sent by the browser in details are not trusted", () => {
    const r = buildCardRows(card("M08"), [entry({ side: "LEFT", status: "DONE", value: 12, details: { stopSigns: ["WEAKNESS"] } })], "", OPEN);
    expect(r.ok && r.rows[0].details.stopSigns).toBeUndefined();
  });
  it("worse neurological symptoms on M01 end the bilan", () => {
    const r = buildCardRows(card("M01"), [
      entry({ side: "BOTH", item: 1, status: "DONE", value: 2, details: { neuro: "WORSE", distal: "CALF", legSide: "LEFT" } }),
      entry({ side: "BOTH", item: 2, status: "DONE", value: 3 }),
    ], "", { ...OPEN, rest: null });
    expect(r.ok && r.endSession).toBe("NEURO_WORSE");
  });
  it("clinician cards only store a transcribed report", () => {
    const ok = buildCardRows(card("M19"), [entry({ side: "BOTH", status: "DONE", details: { angles: [{ move: "FLEXION", side: "LEFT", mode: "ACTIVE", degrees: 105 }] } })], "From the physio", OPEN);
    expect(ok.ok && ok.rows[0]).toMatchObject({ unit: "REPORT", value: null, note: "From the physio", details: { angles: [{ degrees: 105 }] } });
    expect(buildCardRows(card("M19"), [entry({ side: "BOTH", status: "DONE", value: 100 })], "", OPEN)).toEqual({ ok: false, error: "not_report" });
  });
  it("rebuilds rest symptoms from M01 rows", () => {
    expect(restFromRows([])).toBeNull();
    expect(restFromRows([
      { card_id: "M01", item: 1, status: "DONE", value: 2, details: { neuro: "SAME" } },
      { card_id: "M01", item: 2, status: "DONE", value: 4, details: {} },
    ])).toEqual({ backPain: 2, legPain: 4, neuro: "SAME" });
  });
  it("validates inputs strictly", () => {
    expect(cardInputSchema.safeParse({ sessionId: "x", cardId: "M01", entries: [] }).success).toBe(false);
    expect(cardInputSchema.safeParse({ sessionId: "6c1f7a1e-1111-4111-8111-111111111111", cardId: "M21", entries: [{ side: "BOTH", status: "DONE", value: 1 }] }).success).toBe(false);
    expect(startSchema.safeParse({ safety: { newNeuro: false, bladderBowel: false, saddleNumbness: false }, kneePainToday: false, clinicalReviewOn: null, conditions: {} }).success).toBe(false);
  });
});

// ── Trends ────────────────────────────────────────────────────────────────
const S = (id: string, startedOn: string, status: BatterySession["status"] = "COMPLETED"): BatterySession => ({ id, startedOn, status });
const R = (sessionId: string, cardId: CardId, side: BatteryResult["side"], value: number | null, extra: Partial<BatteryResult> = {}): BatteryResult => ({
  sessionId, cardId, side, item: 1, trial: 1, status: value === null ? "NOT_DONE" : "DONE", value, category: null,
  unit: CARD_BY_ID.get(cardId)!.measure?.unit ?? "CATEGORY", notDoneReason: value === null ? "PAIN" : null,
  painBefore: 1, painAfter: 1, radiation: "NONE", ...extra,
});

describe("trends per test", () => {
  const sessions = [S("s0", "2026-01-05"), S("s4", "2026-02-03"), S("s8", "2026-03-02"), S("s12", "2026-03-30"), S("open", "2026-04-27", "IN_PROGRESS")];

  it("places bilans on S0 / S4 / S8 / S12 and ignores the one still open", () => {
    const results = [R("s0", "M05", "LEFT", 6), R("s4", "M05", "LEFT", 7), R("s8", "M05", "LEFT", 8), R("s12", "M05", "LEFT", 9), R("open", "M05", "LEFT", 15)];
    const t = cardTrend(card("M05"), "LEFT", 1, sessions, results);
    expect(t.checkpoints.map((c) => [c.label, c.point?.value ?? null])).toEqual([["S0", 6], ["S4", 7], ["S8", 8], ["S12", 9]]);
    expect(t.points).toHaveLength(4);
    expect(t.latest).toMatchObject({ label: "S12", change: { delta: 3, withinMdc: false, painIncreased: false, direction: "USUAL" } });
  });
  it("leaves a checkpoint empty when no bilan is within two weeks of it", () => {
    const t = cardTrend(card("M05"), "LEFT", 1, [S("a", "2026-01-05"), S("b", "2026-03-02")], [R("a", "M05", "LEFT", 6), R("b", "M05", "LEFT", 7)]);
    expect(t.checkpoints.map((c) => c.point?.sessionId ?? null)).toEqual(["a", null, "b", null]);
  });
  it("two bilans on the same day give no change", () => {
    const t = cardTrend(card("M05"), "LEFT", 1, [S("a", "2026-01-05"), S("b", "2026-01-05", "STOPPED")], [R("a", "M05", "LEFT", 6), R("b", "M05", "LEFT", 9)]);
    expect(t.latest).toBeNull();
  });
  it("symptoms at rest get a raw change but no direction", () => {
    const t = cardTrend(card("M01"), "BOTH", 1, sessions, [R("s0", "M01", "BOTH", 4), R("s4", "M01", "BOTH", 2)]);
    expect(t.latest?.change).toMatchObject({ delta: -2, direction: null });
  });
  it("a change smaller than the minimal detectable change is flagged and not given a direction", () => {
    const t = cardTrend(card("M05"), "RIGHT", 1, sessions, [R("s0", "M05", "RIGHT", 6), R("s4", "M05", "RIGHT", 7.5)]);
    expect(t.latest?.change).toEqual({ delta: 1.5, unit: "CM", withinMdc: true, painIncreased: false, direction: null });
  });
  it("a gain with more pain or radiation is never read as favourable", () => {
    const more = changeBetween(card("M08"), pointFor(card("M08"), sessions[0], [R("s0", "M08", "LEFT", 5)])!,
      pointFor(card("M08"), sessions[1], [R("s4", "M08", "LEFT", 12, { painAfter: 4 })])!);
    expect(more).toMatchObject({ delta: 7, painIncreased: true, direction: null });
    const rad = changeBetween(card("M08"), pointFor(card("M08"), sessions[0], [R("s0", "M08", "LEFT", 5)])!,
      pointFor(card("M08"), sessions[1], [R("s4", "M08", "LEFT", 12, { radiation: "LOWER_OR_STRONGER" })])!);
    expect(rad?.direction).toBeNull();
  });
  it("not done stays not done: shown with its reason, never a zero, never in a change", () => {
    const t = cardTrend(card("M08"), "LEFT", 1, sessions, [R("s0", "M08", "LEFT", 5), R("s4", "M08", "LEFT", null)]);
    expect(t.points[1]).toMatchObject({ kind: "NOT_DONE", value: null, notDoneReason: "PAIN" });
    expect(t.latest?.change).toBeNull();
  });
  it("uses the best scored trial in the card's direction (shorter time for chair stands)", () => {
    const p = pointFor(card("M03"), sessions[0], [R("s0", "M03", "BOTH", 11.4), R("s0", "M03", "BOTH", 10.9, { trial: 2 })])!;
    expect([p.value, p.trials]).toEqual([10.9, [11.4, 10.9]]);
    const t = cardTrend(card("M03"), "BOTH", 1, sessions, [R("s0", "M03", "BOTH", 11), R("s4", "M03", "BOTH", 9.5)]);
    expect(t.latest?.change).toMatchObject({ delta: -1.5, direction: "USUAL" });
  });
  it("categories are shown raw, without a computed change", () => {
    const t = cardTrend(card("M15"), "LEFT", 1, sessions, [
      R("s0", "M15", "LEFT", null, { status: "DONE", category: "SHOULDERS", unit: "CATEGORY", notDoneReason: null }),
      R("s4", "M15", "LEFT", null, { status: "DONE", category: "EYES", unit: "CATEGORY", notDoneReason: null }),
    ]);
    expect(t.points.map((p) => p.category)).toEqual(["SHOULDERS", "EYES"]);
    expect(t.latest?.change).toBeNull();
  });
  it("lists only tracked series, never the clinician cards, and computes no global score", () => {
    const trends = batteryTrends(sessions, [R("s0", "M05", "LEFT", 6), R("s0", "M19", "BOTH", null, { status: "DONE", unit: "REPORT", notDoneReason: null })]);
    expect(trends.map((t) => [t.cardId, t.side])).toEqual([["M05", "LEFT"]]);
    expect(Object.keys(trends[0])).not.toContain("score");
  });
  it("compares sides raw", () => {
    const l = pointFor(card("M07"), sessions[0], [R("s0", "M07", "LEFT", 14)]);
    const r = pointFor(card("M07"), sessions[0], [R("s0", "M07", "RIGHT", 18)]);
    expect(sideGap(l, r)).toBe(-4);
    expect(sideGap(l, null)).toBeNull();
  });
  it("counts progress per card, next due date and the D+1 window", () => {
    expect(sessionProgress([
      { cardId: "M01", status: "DONE", unit: "SCORE" }, { cardId: "M07", status: "DONE", unit: "CM" }, { cardId: "M07", status: "NOT_DONE", unit: "CM" },
      { cardId: "M05", status: "NOT_DONE", unit: "CM" }, { cardId: "M20", status: "DONE", unit: "REPORT" },
    ])).toEqual({ done: 2, notDone: 1, untouched: 15, clinicianReports: 1 });
    expect(nextDue(sessions)).toBe("2026-04-27");
    expect(nextDue([])).toBeNull();
    expect(d1Open(S("x", "2026-01-05"), "2026-01-05")).toBe(false);
    expect(d1Open(S("x", "2026-01-05"), "2026-01-06")).toBe(true);
    expect(d1Open(S("x", "2026-01-05", "IN_PROGRESS"), "2026-01-07")).toBe(false);
  });
});

describe("card status in the list", () => {
  it("done wins, then stopped, then not done; untouched is null", () => {
    expect(cardStatus([])).toBeNull();
    expect(cardStatus([{ status: "NOT_DONE", notDoneReason: "PAIN" }, { status: "DONE", notDoneReason: null }])).toBe("DONE");
    expect(cardStatus([{ status: "NOT_DONE", notDoneReason: "STOPPED_SYMPTOM" }, { status: "NOT_DONE", notDoneReason: "PAIN" }])).toBe("STOPPED");
    expect(cardStatus([{ status: "NOT_DONE", notDoneReason: "LOCKED" }])).toBe("NOT_DONE");
  });
});

describe("strings", () => {
  it("has the same keys in French and English", () => {
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v).map((x) => `${k}.${x}`) : [k])).sort();
    expect(keys(batteryDictionary("en"))).toEqual(keys(batteryDictionary("fr")));
  });
});
