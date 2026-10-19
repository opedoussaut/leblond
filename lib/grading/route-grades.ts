/**
 * French lead/sport-climbing grades, deliberately separate from the
 * Fontainebleau bouldering scale. Do not convert between them automatically.
 * These are self-reported profile labels, NOT measured working grades.
 */
export const FRENCH_ROUTE_GRADES = [
  "3a", "3b", "3c", "4a", "4b", "4c",
  "5a", "5a+", "5b", "5b+", "5c", "5c+",
  "6a", "6a+", "6b", "6b+", "6c", "6c+",
  "7a", "7a+", "7b", "7b+", "7c", "7c+",
  "8a", "8a+", "8b", "8b+", "8c", "8c+",
  "9a", "9a+", "9b", "9b+", "9c",
] as const;

export function isFrenchRouteGrade(value: string): boolean {
  return (FRENCH_ROUTE_GRADES as readonly string[]).includes(value);
}
