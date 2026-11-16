/**
 * Programmes › Mes programmes (/programmes) is split into sections, each with
 * its own shareable address: /programmes (the programme in progress),
 * /programmes?tab=editor, … A method added from the library opens the editor.
 */
export const PROGRAMME_TABS = ["overview", "editor", "rival", "checks", "guide"] as const;
export type ProgrammeTab = (typeof PROGRAMME_TABS)[number];

/** The section asked for in the URL; `?add=<method>` opens the editor; anything unknown falls back to the overview. */
export function parseProgrammeTab(value: string | string[] | undefined, add?: string | string[]): ProgrammeTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if ((PROGRAMME_TABS as readonly string[]).includes(raw ?? "")) return raw as ProgrammeTab;
  return typeof add === "string" && add ? "editor" : "overview";
}

/** The address of a section (the overview is plain /programmes). */
export function programmeHref(tab: ProgrammeTab, add?: string): string {
  const params = new URLSearchParams();
  if (tab !== "overview") params.set("tab", tab);
  if (add) params.set("add", add);
  const query = params.toString();
  return query ? `/programmes?${query}` : "/programmes";
}
