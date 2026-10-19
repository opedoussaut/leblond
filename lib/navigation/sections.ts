/** Single source of truth for the five main product areas and their pages. */
export const SECTION_IDS = ["home", "climbing", "training", "followUp", "profile"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** i18n keys under `t.nav` used for sub-pages. */
export type SubPageKey =
  | "overview" | "session" | "projects"
  | "trainingSessions" | "calendar" | "atlas" | "trainingPlans" | "baseline" | "patrick"
  | "progress" | "trainingHistory" | "assessment"
  | "myProfile" | "connections";

export type SubPage = { href: string; key: SubPageKey };
export type Area = { id: SectionId; href: string; children: readonly SubPage[] };

/**
 * Each area owns its own pages. Only the selected area's pages are ever shown
 * (desktop sidebar submenu, mobile sub-navigation), so unrelated tools never
 * share the workspace. Training = prepare & execute; Follow-up = what happened.
 */
export const AREAS: readonly Area[] = [
  { id: "home", href: "/home", children: [] },
  {
    id: "climbing", href: "/climbing",
    children: [
      { href: "/climbing", key: "overview" },
      { href: "/session", key: "session" },
      { href: "/projects", key: "projects" },
    ],
  },
  {
    id: "training", href: "/train",
    children: [
      { href: "/train", key: "overview" },
      { href: "/train/sessions", key: "trainingSessions" },
      { href: "/calendar", key: "calendar" },
      { href: "/atlas", key: "atlas" },
      { href: "/training-plans", key: "trainingPlans" },
      { href: "/train/assess", key: "baseline" },
      { href: "/patrick", key: "patrick" },
    ],
  },
  {
    id: "followUp", href: "/follow-up",
    children: [
      { href: "/follow-up", key: "overview" },
      { href: "/progress", key: "progress" },
      { href: "/follow-up/training", key: "trainingHistory" },
      { href: "/training-assessment", key: "assessment" },
    ],
  },
  {
    id: "profile", href: "/profile",
    children: [
      { href: "/profile", key: "myProfile" },
      { href: "/settings/connections", key: "connections" },
    ],
  },
];

export function sectionForPath(pathname: string): SectionId {
  if (pathname === "/home" || pathname === "/") return "home";
  if (pathname.startsWith("/training/evaluate") ||
      pathname.startsWith("/training-assessment") ||
      pathname.startsWith("/progress") ||
      pathname.startsWith("/follow-up")) return "followUp";
  if (pathname.startsWith("/session") || pathname.startsWith("/problem") ||
      pathname.startsWith("/projects") || pathname.startsWith("/climbing")) return "climbing";
  if (pathname.startsWith("/atlas") || pathname.startsWith("/calendar") ||
      pathname.startsWith("/training-plans") || pathname.startsWith("/training") ||
      pathname.startsWith("/patrick") || pathname.startsWith("/train")) return "training";
  if (pathname.startsWith("/profile") || pathname.startsWith("/settings")) return "profile";
  return "home";
}

/**
 * The single sub-page of the current area that should be marked as current.
 * Longest matching prefix wins, so /train/sessions/x selects "Sessions",
 * not the "/train" overview, and the overview only matches exactly.
 */
export function activeSubPage(pathname: string): SubPage | null {
  const area = AREAS.find((a) => a.id === sectionForPath(pathname));
  if (!area) return null;
  const aliases: Record<string, string> = { "/problem": "/session", "/training": "/atlas" };
  let path = pathname;
  for (const [from, to] of Object.entries(aliases)) {
    if ((path === from || path.startsWith(from + "/")) && !path.startsWith("/training/evaluate")) {
      path = to + path.slice(from.length);
    }
  }
  if (path.startsWith("/training/evaluate")) path = "/training-assessment";
  let best: SubPage | null = null;
  for (const child of area.children) {
    const exact = path === child.href;
    const nested = child.href !== area.href && path.startsWith(child.href + "/");
    if ((exact || nested) && (!best || child.href.length > best.href.length)) best = child;
  }
  return best;
}
