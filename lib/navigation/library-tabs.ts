import { TRAINING_CATALOGUE, type TrainingCategory } from "@/lib/training/catalogue";

/**
 * The Bibliothèque (/atlas) is split into sections, each with its own
 * shareable address: /atlas (overview), /atlas?tab=methods, …
 */
export const LIBRARY_TABS = ["overview", "templates", "methods", "coaching", "tools", "compare"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

/** Catalogue sections and the catalogue category each one lists. */
export const CATALOGUE_TABS = { methods: "methods", coaching: "programs", tools: "tools" } as const satisfies Partial<Record<LibraryTab, TrainingCategory>>;
export type CatalogueTab = keyof typeof CATALOGUE_TABS;

export const isCatalogueTab = (tab: LibraryTab): tab is CatalogueTab => tab in CATALOGUE_TABS;

/** The section asked for in the URL; anything unknown falls back to the overview. */
export function parseLibraryTab(value: string | string[] | undefined): LibraryTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return (LIBRARY_TABS as readonly string[]).includes(raw ?? "") ? (raw as LibraryTab) : "overview";
}

export const MAX_COMPARED = 3;
export const DEFAULT_COMPARED = ["technique", "max-hangs"] as const;

/** Entries to compare from `?ids=a,b`: known ids only, no duplicates, at most three. */
export function parseCompareIds(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value;
  if (raw === undefined) return [...DEFAULT_COMPARED];
  const known = new Set(TRAINING_CATALOGUE.map((e) => e.id));
  return [...new Set(raw.split(",").map((id) => id.trim()).filter((id) => known.has(id)))].slice(0, MAX_COMPARED);
}

/** The address of a section (and, for the radar, of a given comparison). */
export function libraryHref(tab: LibraryTab, ids?: readonly string[]): string {
  if (tab === "overview") return "/atlas";
  const params = new URLSearchParams({ tab });
  if (tab === "compare" && ids) params.set("ids", ids.join(","));
  return "/atlas?" + params.toString().replace(/%2C/g, ",");
}

/** The section that lists a catalogue category (where a sheet's back link returns). */
export function catalogueTabFor(category: TrainingCategory): CatalogueTab {
  return (Object.keys(CATALOGUE_TABS) as CatalogueTab[]).find((tab) => CATALOGUE_TABS[tab] === category) ?? "methods";
}
