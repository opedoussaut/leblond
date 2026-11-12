import { fmt, type Locale } from "@/lib/i18n";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { pick } from "@/lib/training/sessions";
import { EXERCISE_BY_ID } from "./content";
import { VARIANT_NAMES, type Dose } from "./prescription";

/** "6 reps per side · easier version": shared by server pages and client forms. */
export function doseText(locale: Locale, exerciseId: string, dose: Dose): string {
  const m = mobilityDictionary(locale);
  const ex = EXERCISE_BY_ID.get(exerciseId);
  if (!ex) return "";
  const reps = fmt(ex.perSide ? m.perSide : m.total, { reps: dose.reps });
  return dose.variant === "STANDARD" ? reps : `${reps} · ${pick(VARIANT_NAMES[dose.variant], locale).toLowerCase()}`;
}
