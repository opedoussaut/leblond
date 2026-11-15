import type { DayCheckInput } from "@/lib/training/day-check";

/**
 * Self-reported form of the day, read from today's check-in ("forme du jour").
 * It summarises what the climber declared — sleep, fatigue, soreness, pain —
 * into three levels for the Aujourd'hui card. It is a declarative reading,
 * never a measurement: no score is shown, only the level and the answers.
 *
 *  - REST  : acute or worsening pain, or very tired (poor night + very tired,
 *            or very tired + strong soreness) — the same thresholds the
 *            session recommendation treats as "stop";
 *  - WATCH : any declared pain, or one answer at its worst, or several small
 *            signals adding up;
 *  - GOOD  : everything else (at most one small signal).
 */
export const DAY_FORM_LEVELS = ["GOOD", "WATCH", "REST"] as const;
export type DayFormLevel = (typeof DAY_FORM_LEVELS)[number];

export type DayForm = {
  level: DayFormLevel;
  /** Lit segments of the 3-segment ring: 3 good, 2 watch, 1 rest. */
  segments: 1 | 2 | 3;
  /** Strain points from sleep, fatigue and soreness (0 = nothing to report, 6 = all at worst). */
  strain: number;
  /** Worst declared pain, if any. */
  worstPain: "DISCOMFORT" | "PAIN" | "ACUTE" | null;
};

type FormAnswers = Pick<DayCheckInput, "sleep" | "fatigue" | "soreness" | "pain">;

const PAIN_RANK = { DISCOMFORT: 1, PAIN: 2, ACUTE: 3 } as const;

export function dayForm(answers: FormAnswers): DayForm {
  const sleepStrain = 3 - answers.sleep; // 3 good → 0, 1 poor → 2
  const fatigueStrain = answers.fatigue - 1; // 1 fresh → 0, 3 very tired → 2
  const sorenessStrain = answers.soreness; // 0 none → 0, 2 strong → 2
  const strain = sleepStrain + fatigueStrain + sorenessStrain;
  const worstPain = answers.pain.reduce<DayForm["worstPain"]>(
    (worst, p) => (!worst || PAIN_RANK[p.level] > PAIN_RANK[worst] ? p.level : worst), null);

  const veryTired = (answers.sleep === 1 && answers.fatigue === 3) || (answers.fatigue === 3 && answers.soreness === 2);
  const level: DayFormLevel = worstPain === "ACUTE" || veryTired || strain >= 5 ? "REST"
    : worstPain || strain >= 2 || answers.sleep === 1 || answers.fatigue === 3 || answers.soreness === 2 ? "WATCH"
    : "GOOD";
  return { level, segments: level === "GOOD" ? 3 : level === "WATCH" ? 2 : 1, strain, worstPain };
}
