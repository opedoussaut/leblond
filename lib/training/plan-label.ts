import { fmt } from "@/lib/i18n";

/**
 * A programme's name as people read it. Programmes made from an assessment used to be named
 * after their date only ("Programme du 12 novembre 2026"), which says nothing about what they
 * are: those are shown by their goal and length instead. A name the climber chose is kept.
 * Pure, so the label is the same everywhere a programme is listed.
 */

/** The old default names, in French and English. */
const DATE_NAMES = [/^Programme du \d{1,2}(er)? [^\s\d]+ \d{4}$/u, /^Programme of \d{1,2} [^\s\d]+ \d{4}$/u];

export function isDateOnlyName(name: string): boolean {
  const n = name.trim();
  return DATE_NAMES.some((r) => r.test(n));
}

/** Goals are free text up to 300 characters: a label keeps the start, cut on a word. */
export function shortGoal(goal: string, max = 70): string {
  const g = goal.trim().replace(/\s+/g, " ");
  if (g.length <= max) return g;
  const cut = g.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.·-]+$/u, "") + "…";
}

export type PlanLabelTexts = {
  /** "{goal} · {weeks} semaines" */
  withGoal: string;
  /** "Programme de {weeks} semaines · {n} séances par semaine" */
  plain: string;
};

/** A descriptive name from the goal and length (also used to name a new programme). */
export function describePlan(plan: { goal: string; weeks: number; sessions: readonly unknown[] }, t: PlanLabelTexts): string {
  const goal = shortGoal(plan.goal ?? "");
  return goal ? fmt(t.withGoal, { goal, weeks: plan.weeks }) : fmt(t.plain, { weeks: plan.weeks, n: plan.sessions.length });
}

export function planLabel(plan: { name: string; goal: string; weeks: number; sessions: readonly unknown[] }, t: PlanLabelTexts): string {
  return isDateOnlyName(plan.name) ? describePlan(plan, t) : plan.name;
}
