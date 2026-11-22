import type { Localized } from "../catalogue";
import { TEMPLATE_VERSION, type ExerciseSnapshot, type Modality } from "../session-templates";
import { AWAY_EXERCISE_BY_ID, OPTIONAL_EQUIPMENT, type AwayEquipment, type AwayExercise } from "./exercises";
import { AWAY_SESSIONS, AWAY_SESSION_BY_KEY, type AwayItem, type AwayLoad, type AwayObjective, type AwaySession } from "./sessions";

export * from "./exercises";
export * from "./sessions";

/** Prefix of the snapshot key of every exercise of an away séance ("away:<session>:<n>"). */
export const AWAY_KEY_PREFIX = "away:";
export const awaySnapshotKey = (session: string, position: number) => `${AWAY_KEY_PREFIX}${session}:${position}`;

/** The away séance an exercise snapshot was copied from, or null. */
export function awaySessionOf(key: string | undefined | null): string | null {
  const m = /^away:([a-z0-9-]+):\d+$/.exec(key ?? "");
  return m && AWAY_SESSION_BY_KEY.has(m[1]) ? m[1] : null;
}

export const OBJECTIVES: readonly AwayObjective[] = ["MOBILITY", "STRENGTH", "CONDITIONING", "RECOVERY"];

/* ── Duration ──────────────────────────────────────────────────────────── */

/** Seconds to move to the next exercise and set up (band, floor, wall). */
export const TRANSITION_SECONDS = 20;
/** Seconds to switch sides within a set of a per-side exercise. */
export const SIDE_SWITCH_SECONDS = 5;

function exercise(id: string): AwayExercise {
  const e = AWAY_EXERCISE_BY_ID.get(id);
  if (!e) throw new Error("Unknown away exercise " + id);
  return e;
}

/** Seconds one item takes: its sets, the rests between them, the rest after it and a transition. */
export function itemSeconds(item: AwayItem): number {
  const e = exercise(item.id);
  const sides = e.perSide ? 2 : 1;
  const work = item.reps !== undefined ? item.reps * e.tempo * sides : (item.seconds ?? 0) * sides;
  return item.sets * work + (item.sets - 1) * item.rest + item.after + TRANSITION_SECONDS
    + (e.perSide ? item.sets * SIDE_SWITCH_SECONDS : 0);
}

export const sessionItems = (s: AwaySession): AwayItem[] => s.sections.flatMap((sec) => sec.items);

/** The estimated length of a séance, in seconds, rests and transitions included. */
export function estimateSeconds(s: AwaySession): number {
  return sessionItems(s).reduce((sum, item) => sum + itemSeconds(item), 0);
}

export const estimateMinutes = (s: AwaySession) => Math.round(estimateSeconds(s) / 60);

/* ── Equipment ─────────────────────────────────────────────────────────── */

const EQUIPMENT_ORDER: readonly AwayEquipment[] = ["FLOOR", "WALL", "LONG_BAND", "BODYWEIGHT", "CHAIR", "MINI_BAND"];

/** What the séance needs (`required`) and what helps but has an alternative (`optional`). */
export function sessionEquipment(s: AwaySession): { required: AwayEquipment[]; optional: AwayEquipment[] } {
  const all = new Set(sessionItems(s).flatMap((i) => exercise(i.id).equipment));
  // Bodyweight is implied by everything; listed only when nothing else is needed.
  const listed = EQUIPMENT_ORDER.filter((e) => all.has(e) && e !== "BODYWEIGHT");
  return {
    required: listed.filter((e) => !OPTIONAL_EQUIPMENT.has(e)),
    optional: listed.filter((e) => OPTIONAL_EQUIPMENT.has(e)),
  };
}

/* ── Hip adaptation ────────────────────────────────────────────────────── */

export type HipVersion = "EASIER" | "STANDARD" | "HARDER";

/** The version of an exercise for this hip-test stage (null = never tested, read as stage 0). */
export function hipVersion(e: AwayExercise, stage: number | null): HipVersion {
  if (!e.hip) return "STANDARD";
  const s = stage ?? 0;
  if (s < e.hip.fromStage) return "EASIER";
  if (e.hip.harder && s >= e.hip.harder.fromStage) return "HARDER";
  return "STANDARD";
}

/** Exercises of the séance whose version depends on the hip test. */
export const hipAdapted = (s: AwaySession) => sessionItems(s).some((i) => !!exercise(i.id).hip && exercise(i.id).hip!.fromStage > 0);

const VERSION_LABEL: Record<Exclude<HipVersion, "STANDARD">, Localized> = {
  EASIER: { fr: "Version adaptée à ton test des hanches", en: "Version matched to your hip test" },
  HARDER: { fr: "Version avancée, ton test des hanches le permet", en: "Advanced version, your hip test allows it" },
};
const EASIER_LABEL: Localized = { fr: "Plus facile", en: "Easier" };
const ADAPTED_SUFFIX: Record<Exclude<HipVersion, "STANDARD">, Localized> = {
  EASIER: { fr: "version adaptée", en: "adapted" },
  HARDER: { fr: "version avancée", en: "advanced" },
};

const join = (parts: Localized[]): Localized | undefined => parts.length
  ? { fr: parts.map((p) => p.fr).join(" "), en: parts.map((p) => p.en).join(" ") } : undefined;
const line = (label: Localized, text: Localized): Localized => ({ fr: `${label.fr} : ${text.fr}`, en: `${label.en}: ${text.en}` });

/** Timed work shown in whole minutes when it is whole minutes, otherwise as a hold in seconds. */
function modalityOf(e: AwayExercise, item: AwayItem): Modality {
  if (e.modality !== "TIME") return e.modality;
  return item.seconds !== undefined && item.seconds >= 60 && item.seconds % 60 === 0 ? "TIME" : "HOLD";
}

/** The training_session_exercises rows (without ids) of an away séance, for this climber. */
export function awayExerciseRows(s: AwaySession, opts: { locale: "fr" | "en"; hipStage: number | null }) {
  let position = 0;
  return s.sections.flatMap((sec) => sec.items.map((item) => {
    const e = exercise(item.id);
    const version = hipVersion(e, opts.hipStage);
    const adaptation = join([
      ...(version === "EASIER" ? [line(VERSION_LABEL.EASIER, e.hip!.easier)] : []),
      ...(version === "HARDER" ? [line(VERSION_LABEL.HARDER, e.hip!.harder!.how)] : []),
      ...(version !== "EASIER" && e.hip ? [line(EASIER_LABEL, e.hip.easier)] : []),
      ...(e.alternative ? [e.alternative] : []),
    ]);
    const intensity = item.note ?? e.cue;
    const instructions: ExerciseSnapshot = {
      version: TEMPLATE_VERSION,
      key: awaySnapshotKey(s.key, position),
      summary: e.summary,
      steps: [...e.steps],
      intensity,
      ...(e.safety ? { safety: e.safety } : {}),
      ...(adaptation ? { adaptation } : {}),
      ...(item.after > 0 ? { restAfter: item.after } : {}),
      ...(e.illustration ? { illustration: e.illustration } : {}),
      ...(e.alternative ? { alternative: e.alternative[opts.locale] } : {}),
    };
    const name = e.name[opts.locale] + (version === "STANDARD" ? "" : ` (${ADAPTED_SUFFIX[version][opts.locale]})`);
    return {
      position: position++, block: sec.block, method_id: s.method, name, instructions,
      modality: modalityOf(e, item),
      target_sets: item.sets, target_reps: item.reps ?? null, target_seconds: item.seconds ?? null,
      rest_seconds: item.rest > 0 ? item.rest : null, intensity: intensity[opts.locale].slice(0, 160),
    };
  }));
}

/** The title a started away séance gets ("Mobilité des hanches · En déplacement"). Never a duration. */
export const awayTitle = (s: AwaySession, locale: "fr" | "en") =>
  `${s.title[locale]} · ${locale === "fr" ? "En déplacement" : "Away"}`;

/* ── Recovery ──────────────────────────────────────────────────────────── */

/** A recent day of work, as the recovery advice reads it. */
export type RecentWork = { date: string; strain: AwayLoad };

const addDays = (date: string, days: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** The hardest strain logged on a day (null = nothing). */
function dayStrain(recent: readonly RecentWork[], date: string): AwayLoad | null {
  const rank: Record<AwayLoad, number> = { LIGHT: 1, MODERATE: 2, HARD: 3 };
  return recent.filter((r) => r.date === date)
    .reduce<AwayLoad | null>((max, r) => (max === null || rank[r.strain] > rank[max] ? r.strain : max), null);
}

export type RecoveryAdvice = { status: "OK" | "CAUTION"; reason: "HARD_YESTERDAY" | "HARD_TODAY" | null };

/**
 * Hard séances are not stacked on consecutive days: a HARD séance is flagged
 * when the climber already had a hard day yesterday or today. Light and
 * moderate séances are always fine.
 */
export function recoveryAdvice(s: Pick<AwaySession, "load">, recent: readonly RecentWork[], today: string): RecoveryAdvice {
  if (s.load !== "HARD") return { status: "OK", reason: null };
  if (dayStrain(recent, today) === "HARD") return { status: "CAUTION", reason: "HARD_TODAY" };
  if (dayStrain(recent, addDays(today, -1)) === "HARD") return { status: "CAUTION", reason: "HARD_YESTERDAY" };
  return { status: "OK", reason: null };
}

/** Strain of a logged séance: an away séance keeps its own load; otherwise the RPE decides (7+ is hard). */
export function strainOf(w: { awayKey?: string | null; mobility?: boolean; rpe?: number | null }): AwayLoad {
  const away = w.awayKey ? AWAY_SESSION_BY_KEY.get(w.awayKey) : undefined;
  if (away) return away.load;
  if (w.rpe !== null && w.rpe !== undefined) return w.rpe >= 7 ? "HARD" : w.rpe >= 4 ? "MODERATE" : "LIGHT";
  return w.mobility ? "LIGHT" : "MODERATE";
}

/** Strain of a climbing session: fatigue 4–5 (of 5), or two hours or more when no fatigue was logged, is hard. */
export function climbStrain(c: { fatigue: number | null; minutes: number | null }): AwayLoad {
  if (c.fatigue !== null) return c.fatigue >= 4 ? "HARD" : "MODERATE";
  return (c.minutes ?? 0) >= 120 ? "HARD" : "MODERATE";
}

/* ── Suggestion (Patrick and the page) ─────────────────────────────────── */

export type AwaySuggestion = {
  key: string;
  reason: "FATIGUE" | "HIPS" | "LONGER";
};

/**
 * One séance to propose: recovery after a hard day; the hips when the hip test
 * is low or missing; otherwise the 90-minute séance done least recently (a
 * trip is a chance for longer work), skipping hard ones after a hard day.
 */
export function suggestAway(input: {
  recent: readonly RecentWork[];
  today: string;
  hipStage: number | null;
  /** Last date each away séance was done. */
  lastDone: Readonly<Record<string, string>>;
}): AwaySuggestion {
  const tired = dayStrain(input.recent, input.today) === "HARD" || dayStrain(input.recent, addDays(input.today, -1)) === "HARD";
  if (tired) return { key: "recuperation-90", reason: "FATIGUE" };
  if ((input.hipStage ?? 0) <= 1) {
    const hips = (input.lastDone["mobilite-avancee-90"] ?? "") <= (input.lastDone["hanches-60"] ?? "") ? "mobilite-avancee-90" : "hanches-60";
    return { key: input.hipStage === null || input.hipStage === 0 ? "hanches-60" : hips, reason: "HIPS" };
  }
  const longest = AWAY_SESSIONS.filter((s) => s.minutes === 90)
    .map((s) => ({ key: s.key, last: input.lastDone[s.key] ?? "" }))
    .sort((a, b) => a.last.localeCompare(b.last))[0];
  return { key: longest.key, reason: "LONGER" };
}
