import type {
  CircuitDiagram, ContinuousDiagram, ForceTestDiagram, IntervalsDiagram, PhasesDiagram,
} from "@/lib/training/atlas-types";

/**
 * Pure geometry for the Atlas diagrams. Every function works from the
 * protocol's own numbers so the drawing is exact: durations are to scale,
 * counts are the protocol counts. No strings here; labels live in lib/i18n.
 */

export type TimeSegment = {
  type: "work" | "pause" | "setRest" | "reserve";
  start: number;
  duration: number;
  set: number;
  rep: number;
};

/** Seconds of one set, from the first effort to the end of the last one. */
export function setDuration(spec: Pick<IntervalsDiagram, "work" | "pause" | "reps">): number {
  return spec.reps * spec.work + (spec.reps - 1) * spec.pause;
}

/** The whole session, set by set, without warm-up. */
export function intervalSegments(spec: IntervalsDiagram): { total: number; segments: TimeSegment[] } {
  const segments: TimeSegment[] = [];
  let t = 0;
  for (let set = 1; set <= spec.sets; set++) {
    for (let rep = 1; rep <= spec.reps; rep++) {
      segments.push({ type: "work", start: t, duration: spec.work, set, rep });
      t += spec.work;
      if (rep < spec.reps && spec.pause > 0) {
        segments.push({ type: "pause", start: t, duration: spec.pause, set, rep });
        t += spec.pause;
      }
    }
    if (set < spec.sets) {
      segments.push({ type: "setRest", start: t, duration: spec.setRest, set, rep: spec.reps });
      t += spec.setRest;
    }
  }
  return { total: t, segments };
}

/** One set in detail; a single-rep set shows the unused reserve after the effort. */
export function zoomSegments(spec: IntervalsDiagram): { total: number; segments: TimeSegment[] } {
  const one = intervalSegments({ ...spec, sets: 1 });
  if (spec.reps === 1 && spec.reserve && spec.reserve > 0) {
    one.segments.push({ type: "reserve", start: one.total, duration: spec.reserve, set: 1, rep: 1 });
    return { total: one.total + spec.reserve, segments: one.segments };
  }
  return one;
}

/** Total work seconds in a session (time actually spent loading). */
export function workSeconds(spec: IntervalsDiagram): number {
  return spec.sets * spec.reps * spec.work;
}

export type ContinuousSegment = { type: "block" | "rest"; start: number; minutes: number; index: number };

export function continuousSegments(spec: ContinuousDiagram): { totalMinutes: number; segments: ContinuousSegment[] } {
  const segments: ContinuousSegment[] = [];
  let t = 0;
  for (let i = 1; i <= spec.blocks; i++) {
    segments.push({ type: "block", start: t, minutes: spec.blockMinutes, index: i });
    t += spec.blockMinutes;
    if (i < spec.blocks) {
      segments.push({ type: "rest", start: t, minutes: spec.restMinutes, index: i });
      t += spec.restMinutes;
    }
  }
  return { totalMinutes: t, segments };
}

/** [shortest, longest] session in seconds for a circuit. */
export function circuitDurationRange(spec: CircuitDiagram): readonly [number, number] {
  const rests = (spec.rounds - 1) * spec.roundRest;
  const efforts = spec.rounds * spec.problems;
  return [efforts * spec.problemSeconds[0] + rests, efforts * spec.problemSeconds[1] + rests];
}

export type PlacedPhase = { start: number; end: number; index: number };

export function phaseLayout(spec: PhasesDiagram): { totalWeeks: number; placed: PlacedPhase[] } {
  let w = 0;
  const placed = spec.phases.map((phase, index) => {
    const start = w;
    w += phase.weeks;
    return { start, end: w, index };
  });
  return { totalWeeks: w, placed };
}

export type HandMove = { hand: "L" | "R"; rung: number; order: number };

/**
 * Hand positions for a campus ladder: both hands start matched on the first
 * rung, then hands alternate, leading with the left.
 */
export function ladderMoves(ladder: readonly number[]): HandMove[] {
  if (ladder.length === 0) return [];
  const moves: HandMove[] = [
    { hand: "L", rung: ladder[0], order: 0 },
    { hand: "R", rung: ladder[0], order: 0 },
  ];
  ladder.slice(1).forEach((rung, i) => moves.push({ hand: i % 2 === 0 ? "L" : "R", rung, order: i + 1 }));
  return moves;
}

export type ForceBar = { start: number; duration: number; relative: number; counted: boolean };

/**
 * Contractions of an intermittent all-out test. Timing is exact; the height
 * decay is an ILLUSTRATIVE shape (fast fall towards a plateau), not data.
 */
export function forceTestBars(spec: ForceTestDiagram): { total: number; bars: ForceBar[]; plateau: number } {
  const plateau = 0.42;
  const bars: ForceBar[] = Array.from({ length: spec.reps }, (_, i) => ({
    start: i * (spec.on + spec.off),
    duration: spec.on,
    relative: plateau + (1 - plateau) * Math.exp(-i / 5),
    counted: i >= spec.reps - spec.lastN,
  }));
  const total = spec.reps * spec.on + (spec.reps - 1) * spec.off;
  const counted = bars.filter((b) => b.counted);
  const end = counted.reduce((sum, b) => sum + b.relative, 0) / Math.max(1, counted.length);
  return { total, bars, plateau: end };
}

const NICE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 3600] as const;

/** Evenly spaced "nice" tick values in [0, total], at most `maxTicks` intervals. */
export function niceTicks(total: number, maxTicks = 6, steps: readonly number[] = NICE_STEPS): number[] {
  if (total <= 0) return [0];
  const step = steps.find((s) => total / s <= maxTicks) ?? steps[steps.length - 1];
  const ticks: number[] = [];
  for (let v = 0; v <= total + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Linear map of a value in [0, domain] to [x0, x0 + width]. */
export function scale(value: number, domain: number, x0: number, width: number): number {
  return domain <= 0 ? x0 : x0 + (value / domain) * width;
}

/** Greedy word wrap for SVG labels (SVG has no automatic line breaks). */
export function wrapLabel(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  return kept;
}
