/**
 * Single source of truth for the five main product areas and their pages.
 *
 * Three words organise the app (structure v2): Séance, Programme, Agenda.
 *   Aujourd'hui — what to do now (live séance, daily form, today's plan)
 *   Séances     — what you do: one journal of grimpe and entraînement, the Agenda, projects
 *   Programmes  — what you follow: programmes, hip mobility, the library of methods and templates
 *   Progrès     — what happened, evaluation results included
 *   Patrick     — the coach
 * Profile, connections and settings live in the account (avatar) menu, not in
 * an area. An area link opens its first page; when that page is also listed
 * (Journal, Mes programmes), the listed page is the one marked as current.
 */
export const SECTION_IDS = ["today", "sessions", "programmes", "progress", "patrick"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** Where a path belongs: one of the five areas, or the account menu. */
export type NavContext = SectionId | "account";

/** i18n keys under `t.nav` used for sub-pages and account pages. */
export type SubPageKey =
  | "journal" | "calendar" | "projects"
  | "myProgrammes" | "library"
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
  // Forme du jour is reached from Aujourd'hui itself: one place, no sub-page.
  { id: "today", href: "/home", children: [] },
  {
    id: "sessions", href: "/session",
    children: [
      { href: "/session", key: "journal" },
      { href: "/calendar", key: "calendar" },
      { href: "/projects", key: "projects" },
    ],
  },
  {
    id: "programmes", href: "/programmes",
    children: [
      { href: "/programmes", key: "myProgrammes" },
      { href: "/atlas", key: "library" },
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
  if (pathname === "/" || startsWith(pathname, "/home") || startsWith(pathname, "/train/today")) return "today";
  // Evaluation results live in Progrès; the wizard itself is started from Programmes.
  if (startsWith(pathname, "/training/evaluate") || startsWith(pathname, "/training-assessment") ||
      startsWith(pathname, "/progress") || startsWith(pathname, "/follow-up")) return "progress";
  // A training séance (player included) is a séance like a climb: it lives in the journal.
  if (startsWith(pathname, "/session") || startsWith(pathname, "/train/sessions") || startsWith(pathname, "/calendar") ||
      startsWith(pathname, "/climbing") || startsWith(pathname, "/problem") || startsWith(pathname, "/route") ||
      startsWith(pathname, "/projects")) return "sessions";
  if (startsWith(pathname, "/programmes") || startsWith(pathname, "/train") || startsWith(pathname, "/training-plans") ||
      startsWith(pathname, "/training") || startsWith(pathname, "/atlas")) return "programmes";
  if (startsWith(pathname, "/patrick")) return "patrick";
  if (startsWith(pathname, "/profile") || startsWith(pathname, "/settings")) return "account";
  return "today";
}

/** Detail URLs that belong to a listed page under another prefix (first match wins). */
const ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["/problem", "/session"],          // a boulder opened from a séance
  ["/route", "/session"],            // a route ascent opened from a séance
  ["/train/sessions", "/session"],   // a training séance, in the same journal
  ["/climbing", "/session"],         // the old climbing home
  ["/training/evaluate", "/training-assessment"],
  ["/training-plans", "/programmes"],
  ["/train", "/programmes"],         // assessment wizard, hip mobility, alter ego
  ["/training", "/atlas"],           // the public methods page = the library
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

/**
 * True when the path is the area's own overview page, so the area link itself
 * is the current page. Not when that page is also listed as a sub-page
 * (Journal, Mes programmes): the sub-page is then the one marked.
 */
export function isAreaOverview(area: Area, pathname: string): boolean {
  if (area.children.some((c) => c.href === area.href)) return false;
  return pathname === area.href || (area.id === "today" && pathname === "/");
}
