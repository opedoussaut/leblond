import { methodName } from "@/lib/i18n/method-titles";
import { METHODS_FOR_PLANS } from "./catalogue";
import { SESSION_CATEGORIES, type CoachFamily, type FamilyAxis, type SessionCategory } from "./coach-sessions";

/**
 * The séance picker: coach sessions grouped into families (one card, then a
 * level and a duration), single coach sessions, and the Atlas methods, with an
 * accent-insensitive search and category / duration filters. Pure functions.
 */

export type PickerSession = {
  id: string; title: string; objective: string; minutes: number; exercises: number; family: CoachFamily | null;
};

export type PickerVariant = { value: string; id: string; title: string; minutes: number; exercises: number; objective: string };
export type PickerLevel = { key: string; label: string; rank: number; variants: PickerVariant[] };
export type PickerFamily = {
  kind: "family"; key: string; title: string; summary: string; category: SessionCategory; axis: FamilyAxis;
  levels: PickerLevel[]; minutes: number[]; haystack: string;
};
export type PickerSingle = {
  kind: "coach"; value: string; title: string; summary: string; minutes: number; exercises: number; haystack: string;
};
export type PickerMethod = { kind: "atlas"; value: string; title: string; summary: string; category: SessionCategory; haystack: string };
export type PickerEntry = PickerFamily | PickerSingle | PickerMethod;

/** Category and extra search words of each Atlas method (their titles are English only). */
export const ATLAS_PICKER: Record<string, { category: SessionCategory; keywords: string }> = {
  technique: { category: "TECHNIQUE", keywords: "technique pieds placements vidéo footwork drills" },
  constraints: { category: "TECHNIQUE", keywords: "technique contraintes variabilité gestuelle" },
  "limit-bouldering": { category: "POWER", keywords: "bloc limite puissance force maximale" },
  "max-hangs": { category: "FINGERS", keywords: "poutre doigts suspensions force maximale hangboard" },
  repeaters: { category: "FINGERS", keywords: "poutre doigts répétitions endurance de force hangboard" },
  "easy-volume": { category: "ENDURANCE", keywords: "volume facile continuité arc endurance aérobie" },
  "four-by-four": { category: "ENDURANCE", keywords: "4x4 résistance intervalles bloc" },
  campus: { category: "POWER", keywords: "campus pan güllich puissance contact" },
  "strength-conditioning": { category: "STRENGTH", keywords: "renfo renforcement musculation gainage antagonistes force" },
  mobility: { category: "MOBILITY", keywords: "mobilité souplesse étirements flexibilité stretching" },
  "hip-mobility": { category: "MOBILITY", keywords: "hanches bassin mobilité souplesse pied haut" },
  mental: { category: "TECHNIQUE", keywords: "mental chute peur lecture tactique tête" },
  periodized: { category: "PLANNING", keywords: "planification cycles programme périodisation" },
};

/** Lower case, no accents, no punctuation: "Mobilité" matches "mobilite". */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const haystack = (...parts: string[]) => normalizeSearch(parts.join(" "));

/**
 * Picker entries: families first (in category order, then by title), then the
 * coach sessions without a family (in the order given), then the Atlas methods.
 * `sessions` comes most recent first: when two sessions share a family, level
 * and duration, the most recent wins. `categoryLabels` makes "souplesse" find
 * everything filed under "Mobilité et souplesse".
 */
export function buildPickerEntries(
  sessions: readonly PickerSession[], locale: "fr" | "en", categoryLabels: Record<SessionCategory, string>,
): PickerEntry[] {
  const groups = new Map<string, PickerSession[]>();
  const singles: PickerSingle[] = [];
  for (const s of sessions) {
    if (s.family) {
      const list = groups.get(s.family.key) ?? [];
      list.push(s);
      groups.set(s.family.key, list);
    } else {
      singles.push({ kind: "coach", value: "coach:" + s.id, title: s.title, summary: s.objective, minutes: s.minutes,
        exercises: s.exercises, haystack: haystack(s.title, s.objective) });
    }
  }

  const families: PickerFamily[] = [];
  for (const list of groups.values()) {
    const levels = new Map<string, PickerLevel>();
    for (const s of list) {
      const f = s.family!;
      const level = levels.get(f.level.key) ?? { key: f.level.key, label: f.level.label, rank: f.level.rank, variants: [] };
      if (!level.variants.some((v) => v.minutes === s.minutes)) {
        level.variants.push({ value: "coach:" + s.id, id: s.id, title: s.title, minutes: s.minutes, exercises: s.exercises, objective: s.objective });
      }
      levels.set(f.level.key, level);
    }
    const sorted = [...levels.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
    for (const l of sorted) l.variants.sort((a, b) => a.minutes - b.minutes);
    // The family's own words come from its first level's shortest session, so they stay stable.
    const head = list.find((s) => s.id === sorted[0].variants[0].id)!.family!;
    families.push({
      kind: "family", key: head.key, title: head.title, summary: head.summary, category: head.category, axis: head.axis,
      levels: sorted, minutes: [...new Set(sorted.flatMap((l) => l.variants.map((v) => v.minutes)))].sort((a, b) => a - b),
      haystack: haystack(head.title, head.summary, categoryLabels[head.category], ...head.tags,
        ...list.map((s) => s.title), ...sorted.map((l) => l.label)),
    });
  }
  const order = (c: SessionCategory) => SESSION_CATEGORIES.indexOf(c);
  families.sort((a, b) => order(a.category) - order(b.category) || a.title.localeCompare(b.title, "fr"));

  const methods: PickerMethod[] = METHODS_FOR_PLANS.map((m) => {
    const extra = ATLAS_PICKER[m.id] ?? { category: "TECHNIQUE" as const, keywords: "" };
    const summary = m.description[locale];
    // Searchable by its name in the reader's language and by the English one ("max hangs").
    return { kind: "atlas", value: m.id, title: methodName(m, locale), summary, category: extra.category,
      haystack: haystack(methodName(m, locale), m.title, summary, extra.keywords, categoryLabels[extra.category]) };
  });

  return [...families, ...singles, ...methods];
}

export type PickerFilter = { query: string; category: SessionCategory | "ALL"; minutes: number | null };

/**
 * Every word of the query must appear (in any order). A duration keeps the
 * families that have it, the single sessions within 10 minutes of it, and the
 * Atlas methods (their duration is set in the form).
 */
export function filterPickerEntries(entries: readonly PickerEntry[], f: PickerFilter): PickerEntry[] {
  const words = normalizeSearch(f.query).split(" ").filter(Boolean);
  return entries.filter((e) => {
    if (f.category !== "ALL" && (e.kind === "coach" || e.category !== f.category)) return false;
    if (f.minutes !== null) {
      if (e.kind === "family" && !e.minutes.includes(f.minutes)) return false;
      if (e.kind === "coach" && Math.abs(e.minutes - f.minutes) > 10) return false;
    }
    return words.every((w) => e.haystack.includes(w));
  });
}

/** The categories that have at least one entry, in their fixed order. */
export function pickerCategories(entries: readonly PickerEntry[]): SessionCategory[] {
  const present = new Set(entries.flatMap((e) => (e.kind === "coach" ? [] : [e.category])));
  return SESSION_CATEGORIES.filter((c) => present.has(c));
}

/** The durations offered as filters: those of the families. */
export function pickerDurations(entries: readonly PickerEntry[]): number[] {
  return [...new Set(entries.flatMap((e) => (e.kind === "family" ? e.minutes : [])))].sort((a, b) => a - b);
}

/** The variant of a level closest to the wanted duration (the shorter one on a tie). */
export function variantFor(level: PickerLevel, minutes: number): PickerVariant {
  return level.variants.reduce((best, v) => (Math.abs(v.minutes - minutes) < Math.abs(best.minutes - minutes) ? v : best));
}

/** First choice on a family: the middle level, and 60 minutes or the duration closest to it. */
export function defaultVariant(family: PickerFamily, minutes: number | null = null): { level: PickerLevel; variant: PickerVariant } {
  const level = family.levels[Math.floor((family.levels.length - 1) / 2)];
  return { level, variant: variantFor(level, minutes ?? 60) };
}

/** Where a form value ("coach:<id>" or an Atlas id) sits in the entries. */
export function locateValue(entries: readonly PickerEntry[], value: string):
  | { entry: PickerFamily; level: PickerLevel; variant: PickerVariant }
  | { entry: PickerSingle | PickerMethod }
  | null {
  if (!value) return null;
  for (const e of entries) {
    if (e.kind === "family") {
      for (const level of e.levels) {
        const variant = level.variants.find((v) => v.value === value);
        if (variant) return { entry: e, level, variant };
      }
    } else if (e.value === value) return { entry: e };
  }
  return null;
}
