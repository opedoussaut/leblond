import type { GradeSystem } from "@/lib/climbing/types";
import type { Snapshot } from "./snapshot";

type Trend = Snapshot["trends"][number]["direction"];

/** One grading scale on the Progrès page: everything it says, on one row. */
export type ScaleRow = {
  system: GradeSystem;
  /** Working level (60-day rule), or null when there is not enough data. */
  working: string | null;
  top: string | null;
  flash: string | null;
  tried: string | null;
  trend: Trend | null;
  /** Sent / attempted per grade, easiest first (from the working-level window). */
  levels: Array<{ grade: string; sent: number; attempted: number }>;
};

/**
 * Groups the snapshot's per-scale figures (working level, highest top, flash,
 * highest tried, trend) by scale, so each scale is read once. Scales are never
 * compared or merged. Order: scales with a working level first, then the most
 * climbed (problems tried in the window), then by name of the system.
 */
export function scaleRows(snap: Pick<Snapshot, "workingLevels" | "highestSent" | "highestFlashed" | "highestUnsent" | "trends">): ScaleRow[] {
  const systems = new Set<GradeSystem>();
  for (const w of snap.workingLevels) systems.add(w.system as GradeSystem);
  for (const list of [snap.highestSent, snap.highestFlashed, snap.highestUnsent]) for (const h of list) systems.add(h.system);
  const pick = (list: Snapshot["highestSent"], s: GradeSystem) => list.find((h) => h.system === s)?.grade ?? null;
  const rows = [...systems].map((system): ScaleRow & { volume: number } => {
    const w = snap.workingLevels.find((x) => x.system === system);
    const trend = snap.trends.find((x) => x.scale === system)?.direction ?? null;
    const levels = (w?.levels ?? []).map((l) => ({ grade: l.grade, sent: l.sends, attempted: l.problems }));
    return {
      system, working: w?.level ?? null,
      top: pick(snap.highestSent, system), flash: pick(snap.highestFlashed, system), tried: pick(snap.highestUnsent, system),
      trend, levels, volume: levels.reduce((n, l) => n + l.attempted, 0),
    };
  });
  rows.sort((a, b) => Number(!!b.working) - Number(!!a.working) || b.volume - a.volume || a.system.localeCompare(b.system));
  return rows.map((r) => ({ system: r.system, working: r.working, top: r.top, flash: r.flash, tried: r.tried, trend: r.trend, levels: r.levels }));
}

/** The Font estimate's trend (reliable estimates only), shown with the estimated Font level. */
export function fontTrend(snap: Pick<Snapshot, "trends">): Trend | null {
  return snap.trends.find((x) => x.scale === "FONT_NORMALIZED")?.direction ?? null;
}

/** The scale a section leads with: the first one with a working level (rows come sorted that way), or none. */
export function headlineRow(rows: readonly ScaleRow[]): ScaleRow | null {
  return rows.find((r) => r.working !== null) ?? null;
}
