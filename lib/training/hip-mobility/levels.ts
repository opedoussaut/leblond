import { CORE_TESTS, MOBILITY_TESTS, classifyStage, testLevel, type MobilityResult, type Support } from "./assessment";
import { LEVELS, type Level, type TestId } from "./content";

/**
 * "Where I am / what I aim for" on the hip-mobility page. Pure: reads the
 * latest (self-reported) assessment and the stage rules of `classifyStage`,
 * nothing else.
 *
 * STAGE_REQUIREMENTS restates `classifyStage` (rules v1) as the level each test
 * must reach, on its weaker side, for a stage. It adds no threshold of its own:
 * a unit test checks, over every combination of levels, that a complete
 * assessment gets exactly the highest stage whose requirements it meets.
 * Null = the test does not count for that stage.
 */
export const STAGE_REQUIREMENTS: Record<Level, Record<TestId, number | null>> = {
  0: { A: null, B: null, C: null, D: null },
  1: { A: 2, B: 2, C: 2, D: null },
  2: { A: 3, B: 3, C: 3, D: null },
  3: { A: 3, B: 3, C: 3, D: 3 },
  4: { A: 4, B: 4, C: 4, D: 4 },
};

export const TOP_LEVEL: Level = 4;
export const TEST_LEVEL_MAX = 4;

/** The highest stage whose requirements these weaker-side levels meet (missing = not met). */
export function stageFromLevels(levels: Partial<Record<TestId, number | null>>): Level {
  let best: Level = 0;
  for (const stage of LEVELS) {
    const req = STAGE_REQUIREMENTS[stage];
    const met = (Object.keys(req) as TestId[]).every((t) => req[t] === null || (levels[t] ?? -1) >= req[t]!);
    if (met) best = stage;
  }
  return best;
}

export type SideView = {
  side: "LEFT" | "RIGHT";
  /** Described level 0–4, null when not done. */
  level: number | null;
  value: number | null;
  support: Support | null;
  discomfort: number | null;
  /** Why it was not done; PAIN counts as level 0 for the stage. */
  skipped: "PAIN" | "NOT_POSSIBLE" | null;
};

export type TargetView = {
  stage: Level;
  /** Level this test must reach on its weaker side; null = does not count for that stage. */
  required: number | null;
  /** True when reached; null when the test does not count. */
  met: boolean | null;
  /** Levels still to gain (0 when met); null when not tested or not counted. */
  gap: number | null;
};

export type TestView = {
  id: TestId;
  optional: boolean;
  /** Weaker-side level, as the stage reads it; null = not tested. */
  level: number | null;
  sides: SideView[];
  /** Whole-body extra measure (test B stance width), when recorded. */
  both: number | null;
  /** This test sets the current stage (the weakest link). */
  limiting: boolean;
  next: TargetView | null;
  final: TargetView;
};

export type LevelView = {
  assessed: boolean;
  stage: Level;
  /** Null at the top level. */
  next: Level | null;
  final: Level;
  tests: TestView[];
  missing: TestId[];
  functionalTested: boolean;
  /** Tests that must still progress (or be done) to reach the next stage. */
  nextBlockers: TestId[];
  /** Counted tests already at the next stage's requirement, out of `nextCounted`. */
  nextMetCount: number;
  nextCounted: number;
};

function target(stage: Level, test: TestId, level: number | null): TargetView {
  const required = STAGE_REQUIREMENTS[stage][test];
  if (required === null) return { stage, required, met: null, gap: null };
  if (level === null) return { stage, required, met: false, gap: null };
  return { stage, required, met: level >= required, gap: Math.max(0, required - level) };
}

function side(results: readonly MobilityResult[], test: TestId, s: "LEFT" | "RIGHT"): SideView {
  const r = results.find((x) => x.test === test && x.side === s);
  if (!r) return { side: s, level: null, value: null, support: null, discomfort: null, skipped: null };
  return {
    side: s,
    level: r.done ? r.level : null,
    value: r.done ? r.value : null,
    support: r.done ? r.support : null,
    discomfort: r.discomfort,
    skipped: r.done ? null : r.skipReason,
  };
}

/** The view of the latest assessment (null = none yet: everything starts at stage 0, untested). */
export function levelView(results: readonly MobilityResult[] | null): LevelView {
  const list = results ?? [];
  const staged = classifyStage(list);
  const stage = results ? staged.stage : 0;
  const next: Level | null = stage < TOP_LEVEL ? ((stage + 1) as Level) : null;
  const tests: TestView[] = MOBILITY_TESTS.map((def) => {
    const level = testLevel(list, def.id);
    const both = list.find((r) => r.test === def.id && r.side === "BOTH" && r.done)?.value ?? null;
    return {
      id: def.id, optional: def.optional, level,
      sides: [side(list, def.id, "LEFT"), side(list, def.id, "RIGHT")],
      both,
      limiting: results !== null && staged.limitedBy.includes(def.id),
      next: next === null ? null : target(next, def.id, level),
      final: target(TOP_LEVEL, def.id, level),
    };
  });
  const counted = next === null ? [] : tests.filter((t) => t.next!.required !== null);
  return {
    assessed: results !== null,
    stage, next, final: TOP_LEVEL, tests,
    missing: results ? staged.missing : [...CORE_TESTS],
    functionalTested: staged.functionalTested,
    nextBlockers: counted.filter((t) => !t.next!.met).map((t) => t.id),
    nextMetCount: counted.filter((t) => t.next!.met).length,
    nextCounted: counted.length,
  };
}

/** "Niveau 1 · Mobilité de base…" → { short: "Niveau 1", title: "Mobilité de base…" }. */
export function splitLevelName(name: string): { short: string; title: string } {
  const i = name.indexOf(" · ");
  return i < 0 ? { short: name, title: "" } : { short: name.slice(0, i), title: name.slice(i + 3) };
}
