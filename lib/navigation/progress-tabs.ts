import type { Place } from "@/lib/analytics/place";

/**
 * Progrès › Grimpe (/progress) is split into sections, each with its own
 * shareable address: /progress (everything, as before), /progress?tab=boulder-indoor, …
 * A section is one discipline in one kind of place; boards are their own.
 */
export const PROGRESS_TABS = ["overview", "boulder-indoor", "boulder-outdoor", "route-indoor", "route-outdoor", "boards"] as const;
export type ProgressTab = (typeof PROGRESS_TABS)[number];

export type ProgressDiscipline = "boulder" | "route" | "board";

/** What a section shows; the overview shows everything, in every place. */
export const PROGRESS_SCOPES: Record<Exclude<ProgressTab, "overview">, { discipline: ProgressDiscipline; place: Place | null }> = {
  "boulder-indoor": { discipline: "boulder", place: "indoor" },
  "boulder-outdoor": { discipline: "boulder", place: "outdoor" },
  "route-indoor": { discipline: "route", place: "indoor" },
  "route-outdoor": { discipline: "route", place: "outdoor" },
  boards: { discipline: "board", place: null },
};

/** The section asked for in the URL; anything unknown falls back to the overview. */
export function parseProgressTab(value: string | string[] | undefined): ProgressTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return (PROGRESS_TABS as readonly string[]).includes(raw ?? "") ? (raw as ProgressTab) : "overview";
}

/** The address of a section, keeping the chosen period (the default period is left out, as before). */
export function progressHref(tab: ProgressTab, period?: string): string {
  const params = new URLSearchParams();
  if (tab !== "overview") params.set("tab", tab);
  if (period) params.set("period", period);
  const query = params.toString();
  return query ? `/progress?${query}` : "/progress";
}
