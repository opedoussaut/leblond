import type { Locale } from "./index";

/**
 * French names of the Atlas training methods. The catalogue keeps the English
 * title (also used in Patrick's prompts); pages in French show these instead.
 */
const FR: Record<string, string> = {
  "technique": "Technique et retour vidéo",
  "constraints": "Pratique sous contraintes",
  "limit-bouldering": "Bloc à la limite",
  "max-hangs": "Suspensions max",
  "repeaters": "Repeaters à la poutre",
  "easy-volume": "Volume facile / ARC",
  "four-by-four": "4×4 en grimpe",
  "campus": "Campus board",
  "strength-conditioning": "Renforcement et préparation physique",
  "mobility": "Mobilité et étirements",
  "hip-mobility": "Mobilité des hanches, en partant de zéro",
  "mental": "Mental et tactique en voie",
  "periodized": "Entraînement périodisé complet",
};

/** A method's name in the reader's language (English when no French name exists). */
export function methodName(method: { id: string; title: string }, locale: Locale): string {
  return (locale === "fr" ? FR[method.id] : undefined) ?? method.title;
}

/** The ids that have a French name (for the test that keeps every method covered). */
export const FRENCH_METHOD_NAMES: Readonly<Record<string, string>> = FR;
