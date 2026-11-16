import type { Place } from "@/lib/analytics/place";

/**
 * Progrès › Grimpe (/progress) is split into sections, each with its own
 * shareable address: /progress (a short summary linking to each section),
 * /progress?tab=boulder-indoor, … A section is one discipline in one kind of
 * place; boards, the gym-by-gym comparison, styles and the avatar have their
 * own. Each figure lives in one section only; the summary links to it.
 */
export const PROGRESS_TABS = [
  "overview", "boulder-indoor", "boulder-outdoor", "route-indoor", "route-outdoor", "boards", "gyms", "styles", "avatar",
] as const;
export type ProgressTab = (typeof PROGRESS_TABS)[number];

export type ProgressDiscipline = "boulder" | "route" | "board" | "avatar";
/** Which boulder blocks a section shows: the levels, the gym comparison, or styles and heart rate. */
export type ProgressView = "levels" | "gyms" | "styles" | "avatar";

/** What a section shows; the overview only sums the sections up. */
export const PROGRESS_SCOPES: Record<Exclude<ProgressTab, "overview">, { discipline: ProgressDiscipline; place: Place | null; view: ProgressView }> = {
  "boulder-indoor": { discipline: "boulder", place: "indoor", view: "levels" },
  "boulder-outdoor": { discipline: "boulder", place: "outdoor", view: "levels" },
  "route-indoor": { discipline: "route", place: "indoor", view: "levels" },
  "route-outdoor": { discipline: "route", place: "outdoor", view: "levels" },
  boards: { discipline: "board", place: null, view: "levels" },
  gyms: { discipline: "boulder", place: null, view: "gyms" },
  styles: { discipline: "boulder", place: null, view: "styles" },
  avatar: { discipline: "avatar", place: null, view: "avatar" },
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
