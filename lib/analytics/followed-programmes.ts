/**
 * The programmes a climber follows, as the home page shows them: one card each, with where
 * they stand and what comes next. Pure: the page loads the data, this decides what to say.
 * Progress is counted (weeks elapsed, séances done), never predicted.
 */

export type FollowedKind = "PLAN" | "REBUILD" | "HIP";

export type FollowedProgramme = {
  kind: FollowedKind;
  href: string;
  title: string;
  /** 0–1, for the ring; null when the programme has no fixed length. */
  ratio: number | null;
  progress: { unit: "WEEK"; current: number; total: number } | { unit: "SESSIONS"; done: number; total: number } | { unit: "LEVEL"; level: number };
  /** The next séance's date (YYYY-MM-DD), if one is planned. */
  next: string | null;
  finished: boolean;
};

export type PlanInput = { title: string; week: number; horizonWeeks: number; finished: boolean; next: string | null } | null;
export type RebuildInput = { title: string; done: number; total: number; next: string | null } | null;
export type HipInput = { title: string; level: number; next: string | null } | null;

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function followedProgrammes(input: { plan: PlanInput; rebuild: RebuildInput; hip: HipInput }): FollowedProgramme[] {
  const out: FollowedProgramme[] = [];
  const { plan, rebuild, hip } = input;
  if (plan && plan.horizonWeeks > 0) {
    const current = Math.max(1, Math.min(plan.horizonWeeks, plan.week));
    out.push({
      kind: "PLAN", href: "/programmes", title: plan.title,
      ratio: plan.finished ? 1 : clamp(current / plan.horizonWeeks),
      progress: { unit: "WEEK", current, total: plan.horizonWeeks }, next: plan.finished ? null : plan.next, finished: plan.finished,
    });
  }
  if (rebuild && rebuild.total > 0) {
    const done = Math.max(0, Math.min(rebuild.total, rebuild.done));
    out.push({
      kind: "REBUILD", href: "/train/mobility/rebuild", title: rebuild.title,
      ratio: clamp(done / rebuild.total), progress: { unit: "SESSIONS", done, total: rebuild.total },
      next: rebuild.next, finished: done >= rebuild.total,
    });
  }
  if (hip) {
    out.push({ kind: "HIP", href: "/train/mobility", title: hip.title, ratio: null, progress: { unit: "LEVEL", level: hip.level }, next: hip.next, finished: false });
  }
  // The one with the soonest séance first; those with nothing planned last.
  return out.sort((a, b) => (a.next ?? "9999").localeCompare(b.next ?? "9999"));
}
