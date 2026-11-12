/**
 * Single source of truth for the five main product areas and their pages.
 *
 * Areas follow intent, not data type:
 *   Aujourd'hui  — what to do today (daily form, agenda)
 *   Grimper      — the climbing journal
 *   S'entraîner  — prepare and run training
 *   Progrès      — what happened, evaluations included
 *   Patrick      — the coach
 * Profile, connections and settings live in the account (avatar) menu, not in
 * an area. Each area link opens that area's overview page, so there is no
 * "overview" sub-page.
 */
export const SECTION_IDS = ["today", "climbing", "training", "progress", "patrick"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** Where a path belongs: one of the five areas, or the account menu. */
export type NavContext = SectionId | "account";

/** i18n keys under `t.nav` used for sub-pages and account pages. */
export type SubPageKey =
  | "dayCheck" | "calendar"
  | "session" | "projects"
  | "trainingSessions" | "trainingPlans" | "atlas"
  | "climbingProgress" | "trainingHistory" | "mobility" | "assessment"
  | "profile" | "connections" | "settings";

export type SubPage = { href: string; key: SubPageKey };
export type Area = { id: SectionId; href: string; children: readonly SubPage[] };

/**
 * Each area owns its own pages. Only the selected area's pages are ever shown
 * (desktop sidebar submenu, mobile sub-navigation), so unrelated tools never
 * share the workspace.
 */
export const AREAS: readonly Area[] = [
  {
    id: "today", href: "/home",
    children: [
      { href: "/train/today", key: "dayCheck" },
      { href: "/calendar", key: "calendar" },
    ],
  },
  {
    id: "climbing", href: "/climbing",
    children: [
      { href: "/session", key: "session" },
      { href: "/projects", key: "projects" },
    ],
  },
  {
    id: "training", href: "/train",
    children: [
      { href: "/train/sessions", key: "trainingSessions" },
      { href: "/training-plans", key: "trainingPlans" },
      { href: "/atlas", key: "atlas" },
    ],
  },
  {
    id: "progress", href: "/follow-up",
    children: [
      { href: "/progress", key: "climbingProgress" },
      { href: "/follow-up/training", key: "trainingHistory" },
      { href: "/follow-up/mobility", key: "mobility" },
      { href: "/training-assessment", key: "assessment" },
    ],
  },
  { id: "patrick", href: "/patrick", children: [] },
];

/** Account pages, reached from the avatar menu (and the mobile sub-navigation there). */
export const ACCOUNT_PAGES: readonly SubPage[] = [
  { href: "/profile", key: "profile" },
  { href: "/settings/connections", key: "connections" },
  { href: "/settings", key: "settings" },
];

const startsWith = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + "/");

/**
 * The area (or the account menu) a path belongs to. Every route keeps working:
 * legacy and nested URLs are mapped to the area that now owns them.
 */
export function sectionForPath(pathname: string): NavContext {
  if (pathname === "/" || startsWith(pathname, "/home") ||
      startsWith(pathname, "/train/today") || startsWith(pathname, "/calendar")) return "today";
  // The full evaluation is launched from Progrès › Évaluations.
  if (startsWith(pathname, "/train/assess") || startsWith(pathname, "/training/evaluate") ||
      startsWith(pathname, "/training-assessment") || startsWith(pathname, "/progress") ||
      startsWith(pathname, "/follow-up")) return "progress";
  if (startsWith(pathname, "/climbing") || startsWith(pathname, "/session") ||
      startsWith(pathname, "/problem") || startsWith(pathname, "/route") ||
      startsWith(pathname, "/projects")) return "climbing";
  if (startsWith(pathname, "/train") || startsWith(pathname, "/training-plans") ||
      startsWith(pathname, "/training") || startsWith(pathname, "/atlas")) return "training";
  if (startsWith(pathname, "/patrick")) return "patrick";
  if (startsWith(pathname, "/profile") || startsWith(pathname, "/settings")) return "account";
  return "today";
}

/** Detail URLs that belong to a listed page under another prefix. */
const ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["/problem", "/session"],          // a boulder opened from a session
  ["/route", "/session"],            // a route ascent opened from a session
  ["/training/evaluate", "/training-assessment"],
  ["/train/assess", "/training-assessment"],
  ["/training", "/atlas"],           // public Training Lab = the Atlas
];

/** The pages listed for a context: an area's sub-pages, or the account pages. */
export function pagesFor(context: NavContext): readonly SubPage[] {
  if (context === "account") return ACCOUNT_PAGES;
  return AREAS.find((a) => a.id === context)?.children ?? [];
}

/**
 * The single listed page that should be marked as current, or null when the
 * path is an area overview (the area link itself is then the current page) or
 * a page that is not listed. Longest matching prefix wins, so /settings/connections
 * selects "Connexions", not "Réglages".
 */
export function activeSubPage(pathname: string): SubPage | null {
  let path = pathname;
  for (const [from, to] of ALIASES) {
    if (startsWith(path, from)) {
      path = to + path.slice(from.length);
      break;
    }
  }
  let best: SubPage | null = null;
  for (const child of pagesFor(sectionForPath(pathname))) {
    if (startsWith(path, child.href) && (!best || child.href.length > best.href.length)) best = child;
  }
  return best;
}

/** True when the path is the area's own overview page (the area link is then the current page). */
export function isAreaOverview(area: Area, pathname: string): boolean {
  return pathname === area.href || (area.id === "today" && pathname === "/");
}
