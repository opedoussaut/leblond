/**
 * Progrès (/follow-up) is split into sections, each with its own shareable
 * address: /follow-up (the overview: hero, section summaries, records),
 * /follow-up?tab=load, … The chosen period (?weeks=) is kept across sections.
 */
export const FOLLOW_UP_TABS = ["overview", "load", "climbing", "training", "compare"] as const;
export type FollowUpTab = (typeof FOLLOW_UP_TABS)[number];

/** The section asked for in the URL; anything unknown falls back to the overview. */
export function parseFollowUpTab(value: string | string[] | undefined): FollowUpTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return (FOLLOW_UP_TABS as readonly string[]).includes(raw ?? "") ? (raw as FollowUpTab) : "overview";
}

/** The address of a section, keeping the chosen period (the default 12 weeks is left out). */
export function followUpHref(tab: FollowUpTab, weeks?: number | string): string {
  const params = new URLSearchParams();
  if (tab !== "overview") params.set("tab", tab);
  if (weeks !== undefined && String(weeks) !== "12") params.set("weeks", String(weeks));
  const query = params.toString();
  return query ? `/follow-up?${query}` : "/follow-up";
}
