import { describe, expect, it } from "vitest";
import { coachSessionFromRow, coachSessionSchema, type CoachFamily } from "@/lib/training/coach-sessions";
import { sessionPickerDictionary } from "@/lib/i18n/session-picker";
import {
  buildPickerEntries, defaultVariant, filterPickerEntries, locateValue, normalizeSearch, pickerCategories, pickerDurations,
  type PickerFamily, type PickerSession,
} from "@/lib/training/session-picker";

const labels = sessionPickerDictionary("fr").categories;

const family = (level: [string, string, number], over: Partial<CoachFamily> = {}): CoachFamily => ({
  key: "souplesse", title: "Souplesse et mobilité pour grimpeurs", summary: "Bassin, épaules, chaîne arrière",
  category: "MOBILITY", axis: "STIFFNESS", level: { key: level[0], label: level[1], rank: level[2] }, tags: ["flexibilité", "stretching"], ...over,
});

const LEVELS: [string, string, number][] = [["tres-raide", "Très raide", 1], ["raide", "Raide", 2], ["standard", "Standard", 3]];
const grid: PickerSession[] = LEVELS.flatMap((l) => [90, 30, 60].map((m) => ({
  id: `${l[0]}-${m}`, title: `Souplesse · ${l[1]} · ${m}`, objective: "", minutes: m, exercises: 20, family: family(l),
})));
const veille: PickerSession[] = ([["normale", "Normale", 1, 30], ["dure", "Dure", 2, 60], ["a-bloc", "À bloc", 3, 90]] as const).map(([k, label, rank, m]) => ({
  id: "vb-" + k, title: "Veille de bloc · " + label, objective: "", minutes: m, exercises: 15,
  family: { key: "veille-bloc", title: "Veille de bloc", summary: "", category: "PREP", axis: "TOMORROW", level: { key: k, label, rank }, tags: [] },
}));
const single: PickerSession = { id: "solo", title: "Haut et bas test", objective: "Renfo complet", minutes: 90, exercises: 12, family: null };

describe("session picker", () => {
  const entries = buildPickerEntries([...grid, single, ...veille], "fr", labels);
  const souplesse = entries.find((e) => e.kind === "family" && e.key === "souplesse") as PickerFamily;

  it("folds a 3 × 3 grid into one family, levels by rank and durations in order", () => {
    expect(entries.filter((e) => e.kind === "family")).toHaveLength(2);
    expect(souplesse.levels.map((l) => l.label)).toEqual(["Très raide", "Raide", "Standard"]);
    expect(souplesse.levels[0].variants.map((v) => v.minutes)).toEqual([30, 60, 90]);
    expect(souplesse.minutes).toEqual([30, 60, 90]);
    // Families first (mobility before the day-before family), then the single session, then the Atlas.
    expect(entries.slice(0, 3).map((e) => e.kind === "family" ? e.key : e.kind)).toEqual(["souplesse", "veille-bloc", "coach"]);
    expect(entries.at(-1)!.kind).toBe("atlas");
  });

  it("keeps the most recent session when two share a level and a duration", () => {
    const newer = { ...grid[0], id: "newer" };
    const f = buildPickerEntries([newer, ...grid], "fr", labels)[0] as PickerFamily;
    expect(f.levels[0].variants.find((v) => v.minutes === 90)!.id).toBe("newer");
  });

  it("searches without accents, in any order, across tags, levels and Atlas keywords", () => {
    const find = (query: string) => filterPickerEntries(entries, { query, category: "ALL", minutes: null })
      .map((e) => e.kind === "family" ? e.key : e.kind === "atlas" ? e.value : e.title);
    expect(normalizeSearch("Mobilité, HANCHES !")).toBe("mobilite hanches");
    expect(find("flexibilite")).toEqual(["souplesse", "mobility"]);
    expect(find("tres raide")[0]).toBe("souplesse");
    expect(find("souplesse")).toEqual(expect.arrayContaining(["souplesse", "mobility", "hip-mobility"]));
    expect(find("poutre")).toEqual(["max-hangs", "repeaters"]);
    expect(find("renfo")).toEqual(["Haut et bas test", "strength-conditioning"]);
    expect(find("veille bloc")).toEqual(["veille-bloc"]);
    expect(find("zzz")).toEqual([]);
  });

  it("filters by category and by duration", () => {
    const keys = (category: Parameters<typeof filterPickerEntries>[1]["category"], minutes: number | null) =>
      filterPickerEntries(entries, { query: "", category, minutes }).map((e) => e.kind === "family" ? e.key : e.kind === "atlas" ? e.value : "solo");
    expect(keys("PREP", null)).toEqual(["veille-bloc"]);
    expect(keys("MOBILITY", null)).toEqual(["souplesse", "mobility", "hip-mobility"]);
    // 30 min: the veille de bloc only has 30 at its first level, which still counts; the 90 min single does not.
    const coachOnly = (minutes: number) => filterPickerEntries(entries, { query: "", category: "ALL", minutes })
      .flatMap((e) => e.kind === "family" ? [e.key] : e.kind === "coach" ? ["solo"] : []);
    expect(coachOnly(30)).toEqual(["souplesse", "veille-bloc"]);
    expect(coachOnly(90)).toEqual(["souplesse", "veille-bloc", "solo"]);
    // Atlas methods stay: their duration is chosen in the form.
    expect(keys("ALL", 30)).toContain("max-hangs");
    expect(pickerCategories(entries)).toEqual(["MOBILITY", "STRENGTH", "FINGERS", "POWER", "ENDURANCE", "TECHNIQUE", "PREP", "PLANNING"]);
    expect(pickerDurations(entries)).toEqual([30, 60, 90]);
  });

  it("starts a family on the middle level at 60 minutes, and finds any value back", () => {
    const d = defaultVariant(souplesse);
    expect([d.level.label, d.variant.minutes]).toEqual(["Raide", 60]);
    expect(defaultVariant(souplesse, 90).variant.minutes).toBe(90);
    const veilleFamily = entries.find((e) => e.kind === "family" && e.key === "veille-bloc") as PickerFamily;
    expect(defaultVariant(veilleFamily).variant.id).toBe("vb-dure");
    const found = locateValue(entries, "coach:standard-30");
    expect(found && "level" in found ? [found.entry.key, found.level.label, found.variant.minutes] : null).toEqual(["souplesse", "Standard", 30]);
    expect(locateValue(entries, "coach:solo")?.entry.kind).toBe("coach");
    expect(locateValue(entries, "max-hangs")?.entry.kind).toBe("atlas");
    expect(locateValue(entries, "")).toBeNull();
  });
});

describe("coach session family", () => {
  const base = {
    slug: "souplesse-raide-60", title: "Souplesse et mobilité pour grimpeurs · raide", minutes: 60,
    exercises: [{ block: "MAIN", name: "Squat profond", modality: "HOLD", seconds: 60 }],
  };

  it("is optional, validated, and kept in the content column", () => {
    expect(coachSessionSchema.parse(base).family).toBeNull();
    const parsed = coachSessionSchema.parse({ ...base, family: family(["raide", "Raide", 2]) });
    expect(parsed.family?.level.label).toBe("Raide");
    expect(coachSessionSchema.safeParse({ ...base, family: { ...family(["raide", "Raide", 2]), category: "YOGA" } }).success).toBe(false);
    expect(coachSessionSchema.safeParse({ ...base, family: { ...family(["raide", "Raide", 2]), extra: 1 } }).success).toBe(false);
  });

  it("ungroups a stored session whose family no longer parses, without hiding it", () => {
    const row = { id: "1", user_id: "u", shared: true, slug: base.slug, title: base.title, objective: "", minutes: 60, place: null,
      author: "CLAUDE", updated_at: "2026-11-21T10:00:00Z" };
    expect(coachSessionFromRow({ ...row, content: { exercises: base.exercises, family: family(["raide", "Raide", 2]) } })?.family?.key).toBe("souplesse");
    const broken = coachSessionFromRow({ ...row, content: { exercises: base.exercises, family: { key: "Bad Key" } } });
    expect(broken?.title).toBe(base.title);
    expect(broken?.family).toBeNull();
  });
});
