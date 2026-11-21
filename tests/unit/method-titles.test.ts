import { describe, expect, it } from "vitest";
import { FRENCH_METHOD_NAMES, methodName } from "@/lib/i18n/method-titles";
import { sessionPickerDictionary } from "@/lib/i18n/session-picker";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { buildPickerEntries, filterPickerEntries } from "@/lib/training/session-picker";

describe("method names", () => {
  it("has a French name for every Atlas method, and nothing else", () => {
    expect(Object.keys(FRENCH_METHOD_NAMES).sort()).toEqual(METHODS_FOR_PLANS.map((m) => m.id).sort());
    for (const m of METHODS_FOR_PLANS) expect(methodName(m, "fr")).not.toBe(m.title);
  });

  it("keeps the catalogue title in English and for unknown entries", () => {
    const strength = METHODS_FOR_PLANS.find((m) => m.id === "strength-conditioning")!;
    expect(methodName(strength, "en")).toBe("Strength & conditioning");
    expect(methodName(strength, "fr")).toBe("Renforcement et préparation physique");
    expect(methodName({ id: "lattice", title: "Lattice Training" }, "fr")).toBe("Lattice Training");
  });

  it("shows French names in the picker, still found by their English name", () => {
    const entries = buildPickerEntries([], "fr", sessionPickerDictionary("fr").categories);
    const maxHangs = entries.find((e) => e.kind === "atlas" && e.value === "max-hangs")!;
    expect(maxHangs.title).toBe("Suspensions max");
    const found = (query: string) => filterPickerEntries(entries, { query, category: "ALL", minutes: null })
      .map((e) => (e.kind === "atlas" ? e.value : e.kind));
    expect(found("max hangs")).toEqual(["max-hangs"]);
    expect(found("suspensions max")).toEqual(["max-hangs"]);
    const english = buildPickerEntries([], "en", sessionPickerDictionary("en").categories);
    expect(english.find((e) => e.kind === "atlas" && e.value === "max-hangs")!.title).toBe("Max hangs");
  });
});
