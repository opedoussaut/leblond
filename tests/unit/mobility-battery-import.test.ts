import { describe, expect, it } from "vitest";
import { bilanImportSchema, buildImportRows, type BilanImportInput } from "@/lib/training/mobility-battery/import";

// Synthetic values only: no real climber's measures in the repo.
const base: BilanImportInput = {
  startedOn: "2026-01-10",
  status: "STOPPED",
  stopReason: "CHOICE",
  conditions: { chairHeightCm: 44 },
  notes: "imported, self-reported",
  cards: [
    { cardId: "M05", entries: [{ side: "RIGHT", status: "DONE", value: 6 }, { side: "LEFT", status: "DONE", value: 2 }] },
    { cardId: "M01", entries: [{ side: "BOTH", item: 1, status: "DONE", value: 2 }, { side: "BOTH", item: 2, status: "DONE", value: 1, details: { legSide: "LEFT" } }] },
    { cardId: "M03", entries: [{ side: "BOTH", status: "DONE", value: 15.5, painBefore: 2, painAfter: 2, radiation: "NONE", details: { handsUsed: true } }] },
    { cardId: "M15", entries: [{ side: "RIGHT", status: "DONE", category: "SHOULDERS" }, { side: "LEFT", status: "DONE", category: "EYES" }] },
  ],
};

const parse = (b: BilanImportInput) => bilanImportSchema.parse(b);

describe("bilan import", () => {
  it("builds rows with the app's rules, M01 first", () => {
    const r = buildImportRows(parse(base));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0].card_id).toBe("M01");
    expect(r.rows).toHaveLength(7);
    const m05 = r.rows.filter((x) => x.card_id === "M05");
    expect(m05.map((x) => [x.side, x.value, x.unit])).toEqual([["RIGHT", 6, "CM"], ["LEFT", 2, "CM"]]);
    expect(r.rows.find((x) => x.card_id === "M03")?.details.handsUsed).toBe(true);
    expect(r.rows.find((x) => x.card_id === "M15" && x.side === "LEFT")?.category).toBe("EYES");
  });

  it("needs a stop reason exactly when stopped", () => {
    expect(bilanImportSchema.safeParse({ ...base, stopReason: null }).success).toBe(false);
    expect(bilanImportSchema.safeParse({ ...base, status: "COMPLETED" }).success).toBe(false);
    expect(bilanImportSchema.safeParse({ ...base, status: "COMPLETED", stopReason: null }).success).toBe(true);
  });

  it("refuses a card twice and unknown fields", () => {
    expect(bilanImportSchema.safeParse({ ...base, cards: [...base.cards, base.cards[0]] }).success).toBe(false);
    expect(bilanImportSchema.safeParse({ ...base, userId: "x" }).success).toBe(false);
  });

  it("refuses an out-of-range value or a wrong side", () => {
    const bad = buildImportRows(parse({ ...base, cards: [{ cardId: "M05", entries: [{ side: "RIGHT", status: "DONE", value: 80 }] }] }));
    expect(bad).toMatchObject({ ok: false, cardId: "M05" });
    const side = buildImportRows(parse({ ...base, cards: [{ cardId: "M05", entries: [{ side: "BOTH", status: "DONE", value: 3 }] }] }));
    expect(side).toMatchObject({ ok: false, error: "bad_side" });
  });

  it("never imports a locked card as a measure", () => {
    const knee = buildImportRows(parse({ ...base, kneePainToday: true }));
    expect(knee).toMatchObject({ ok: false, cardId: "M05" });
    const clinical = buildImportRows(parse({ ...base, cards: [{ cardId: "M11", entries: [{ side: "BOTH", status: "DONE", value: 3 }] }] }));
    expect(clinical.ok).toBe(false);
  });

  it("refuses a bilan whose symptoms would have ended it", () => {
    const worse = buildImportRows(parse({ ...base, cards: [{ cardId: "M03", entries: [{ side: "BOTH", status: "DONE", value: 15, painBefore: 2, painAfter: 3, radiation: "LOWER_OR_STRONGER" }] }] }));
    expect(worse.ok).toBe(false);
  });
});
