/**
 * Goal type is separate from the historical preferred_discipline field.
 * The existing target_grade and target_grade_system remain the boulder target.
 */
export const TARGET_DISCIPLINES = ["BOULDER", "ROUTE", "BOTH"] as const;
export type TargetDiscipline = (typeof TARGET_DISCIPLINES)[number];

export const includesBoulder = (goal: TargetDiscipline) => goal === "BOULDER" || goal === "BOTH";
export const includesRoute = (goal: TargetDiscipline) => goal === "ROUTE" || goal === "BOTH";
