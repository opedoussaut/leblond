import { awayExerciseRows, estimateMinutes, hipAdapted, sessionEquipment, sessionItems, hipVersion, type HipVersion } from "./index";
import { AWAY_EXERCISE_BY_ID, type AwayEquipment } from "./exercises";
import type { AwayLoad, AwayObjective, AwaySession } from "./sessions";
import type { Block } from "../session-templates";

/**
 * What the En déplacement page shows of a séance, in the reader's language and
 * for their hip test: serialisable, so the page hands it to its client part.
 */

/** "30 s", "1 min", "1 min 30", "2 min". */
export function restLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
}

export type AwayViewLabels = { perSide: string; reps: string; restBetween: string; restAfter: string };

export type AwayItemView = {
  name: string; dose: string; rest: string | null; after: string | null; summary: string; cue: string;
  /** The hip-test version and its text, when it is not the standard one. */
  version: HipVersion; hipNote: string | null; alternative: string | null; illustration: string | null;
};
export type AwaySectionView = { block: Block; title: string; items: AwayItemView[] };
export type AwaySessionView = {
  key: string; minutes: 60 | 90; estimate: number; objective: AwayObjective; load: AwayLoad;
  title: string; summary: string; focus: string[]; notes: string;
  required: AwayEquipment[]; optional: AwayEquipment[];
  exercises: number; sets: number; hipAdapted: boolean; sections: AwaySectionView[];
};

const fill = (s: string, d: string) => s.replace("{d}", d);

export function awaySessionView(s: AwaySession, locale: "fr" | "en", hipStage: number | null, labels: AwayViewLabels): AwaySessionView {
  const rows = awayExerciseRows(s, { locale, hipStage });
  const equipment = sessionEquipment(s);
  let i = 0;
  return {
    key: s.key, minutes: s.minutes, estimate: estimateMinutes(s), objective: s.objective, load: s.load,
    title: s.title[locale], summary: s.summary[locale], focus: s.focus.map((f) => f[locale]), notes: s.notes[locale],
    required: equipment.required, optional: equipment.optional,
    exercises: sessionItems(s).length, sets: sessionItems(s).reduce((n, it) => n + it.sets, 0), hipAdapted: hipAdapted(s),
    sections: s.sections.map((sec) => ({
      block: sec.block, title: sec.title[locale],
      items: sec.items.map((item) => {
        const row = { ...rows[i++], version: hipVersion(AWAY_EXERCISE_BY_ID.get(item.id)!, hipStage) };
        const e = AWAY_EXERCISE_BY_ID.get(item.id)!;
        const side = e.perSide ? " " + labels.perSide : "";
        const amount = item.reps !== undefined ? `${item.reps} ${labels.reps}` : restLabel(item.seconds ?? 0);
        return {
          name: row.name,
          dose: (item.sets > 1 ? `${item.sets} × ` : "") + amount + side,
          rest: item.sets > 1 && item.rest > 0 ? fill(labels.restBetween, restLabel(item.rest)) : null,
          after: item.after > 0 ? fill(labels.restAfter, restLabel(item.after)) : null,
          summary: e.summary[locale], cue: (item.note ?? e.cue)[locale],
          version: row.version,
          hipNote: row.version === "EASIER" ? e.hip!.easier[locale] : row.version === "HARDER" ? e.hip!.harder!.how[locale] : null,
          alternative: e.alternative?.[locale] ?? null,
          illustration: e.illustration ?? null,
        };
      }),
    })),
  };
}
