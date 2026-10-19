/** Single source of truth for the five main product areas. */
export const SECTION_IDS = ["home", "climbing", "training", "followUp", "profile"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

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
