import type { Localized } from "@/lib/training/catalogue";

/**
 * Shapes of the enriched Training Atlas content.
 *
 * Content is written for LEBLOND in our own words (FR + EN) and cites its
 * sources; it never reproduces provider text, figures or photos. Protocol
 * numbers are conservative coaching conventions or study protocols, not
 * individual prescriptions.
 */

/** Rows of the protocol table. Methods must fill every METHOD_PROTOCOL_KEYS row. */
export type ProtocolKey =
  | "intensity" | "effort" | "rest" | "reps" | "sets" | "session" | "frequency"
  | "format" | "duration" | "equipment" | "cost";

export const METHOD_PROTOCOL_KEYS = ["intensity", "effort", "rest", "reps", "sets", "session", "frequency"] as const;

export type ProtocolRow = { key: ProtocolKey; value: Localized };

export type SourceKind = "study" | "review" | "coach" | "provider" | "video";

/** A citable reference: a short citation in the original language plus what it supports. */
export type AtlasSource = {
  kind: SourceKind;
  citation: string;
  url: string;
  finding: Localized;
};

/* ── Method-specific diagrams ────────────────────────────────────────────────
 * Every diagram is drawn from these numbers, so what the picture shows is the
 * protocol itself (durations to scale, exact counts). */

/** Efforts and pauses on a time axis (max hangs, repeaters, limit attempts). */
export type IntervalsDiagram = {
  kind: "intervals";
  /** Seconds of effort per repetition. */
  work: number;
  /** Seconds between repetitions inside a set (0 when reps = 1). */
  pause: number;
  reps: number;
  sets: number;
  /** Seconds between sets. */
  setRest: number;
  /** Seconds you could still hold when you stop (max hangs margin). */
  reserve?: number;
  /** True when `work` is a typical value rather than a fixed protocol time. */
  approximate?: boolean;
  workLabel: Localized;
  setLabel: Localized;
  /** Draw a second row zooming on one set (or one rep). */
  zoom: boolean;
};

/** Continuous low-intensity climbing blocks on an effort scale (ARC). */
export type ContinuousDiagram = {
  kind: "continuous";
  blockMinutes: number;
  blocks: number;
  restMinutes: number;
  /** Perceived effort band on a 0–10 scale. */
  rpe: readonly [number, number];
  /** Effort level that must not be crossed (marked pump). */
  ceiling: number;
};

/** Problems linked without rest, repeated in rounds (4×4). */
export type CircuitDiagram = {
  kind: "circuit";
  problems: number;
  rounds: number;
  /** Seconds between rounds. */
  roundRest: number;
  /** Typical seconds spent on one problem. */
  problemSeconds: readonly [number, number];
};

export type ConstraintMark = "slowHands" | "noRegrip" | "setFeet" | "free";

/** The same problem climbed under a different constraint each round. */
export type RoundsDiagram = {
  kind: "rounds";
  rounds: readonly { label: Localized; mark: ConstraintMark }[];
  attempts: number;
  /** Seconds between rounds. */
  rest: number;
};

/** A practice cycle, read clockwise from step 1. */
export type LoopDiagram = {
  kind: "loop";
  steps: readonly Localized[];
  center: readonly Localized[];
};

/** Campus-board ladders: hands alternate from a matched start on the first rung. */
export type LadderDiagram = {
  kind: "ladder";
  rungs: number;
  ladders: readonly (readonly number[])[];
  sets: number;
  reps: number;
  rest: number;
};

/** Strength exercises as sets of reps (or timed holds). */
export type SetsDiagram = {
  kind: "sets";
  exercises: readonly { name: Localized; sets: number; reps?: number; seconds?: number; rest: number }[];
};

/** A graded progression, one step at a time. */
export type StaircaseDiagram = {
  kind: "staircase";
  steps: readonly { label: Localized; detail?: Localized }[];
  axis: Localized;
};

/** Weeks of a training cycle with relative volume (and optional intensity) per phase. */
export type PhasesDiagram = {
  kind: "phases";
  phases: readonly { weeks: number; label: Localized; volume: number; intensity?: number }[];
};

/** Edge depths drawn to scale in millimetres. */
export type EdgesDiagram = {
  kind: "edges";
  edges: readonly { mm: number; note: Localized }[];
};

/** Wall angles past vertical, drawn to scale in degrees. */
export type AnglesDiagram = {
  kind: "angles";
  angles: readonly { deg: number; note: Localized }[];
};

/** Intermittent all-out force test (critical force), timing to scale. */
export type ForceTestDiagram = {
  kind: "forceTest";
  reps: number;
  on: number;
  off: number;
  edgeMm: number;
  /** Contractions averaged for the end-test (critical) force. */
  lastN: number;
};

/** Where to put the camera when filming attempts. */
export type CameraDiagram = {
  kind: "camera";
  notes: readonly Localized[];
};

export type AtlasDiagram =
  | IntervalsDiagram | ContinuousDiagram | CircuitDiagram | RoundsDiagram | LoopDiagram | LadderDiagram
  | SetsDiagram | StaircaseDiagram | PhasesDiagram | EdgesDiagram | AnglesDiagram | ForceTestDiagram | CameraDiagram;

export type AtlasDetail = {
  summary: Localized;
  /** Energy system or quality trained. */
  trains: Localized;
  /** Who the method suits. */
  suits: Localized;
  /** Level, age and injury-history prerequisites. */
  prerequisites: readonly Localized[];
  level: Localized;
  protocol: readonly ProtocolRow[];
  preparation: Localized;
  steps: readonly Localized[];
  progression: readonly Localized[];
  mistakes: readonly Localized[];
  safety: readonly Localized[];
  variants: readonly Localized[];
  observe: Localized;
  /** How strong the evidence is, in plain words. */
  evidenceNote: Localized;
  sources: readonly AtlasSource[];
  diagram: AtlasDiagram;
};
