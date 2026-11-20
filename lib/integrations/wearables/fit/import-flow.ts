/**
 * One-step FIT import, pure and client-safe parts: what to file an activity as,
 * the marker kept on the activity once filed, and the import endpoint's answer.
 */
import {
  detectFitSession,
  normaliseName,
  type ClimbDiscipline,
  type ClimbSetting,
  type DetectionSource,
  type FitDetection,
  type FitHints,
  type TrainingKind,
  type VenuePick,
} from "./classify";
import type { FitUploadErrorCode } from "./attach";

export type FileChoice =
  | { kind: "CLIMB"; discipline: ClimbDiscipline | null; setting: ClimbSetting }
  | { kind: "TRAINING"; training: TrainingKind };

/** What the climber can pick when asked, or to correct an import. */
export const FILE_AS = ["BOULDER", "ROUTE", "TRAINING"] as const;
export type FileAs = (typeof FILE_AS)[number];

export function choiceFromDetection(d: Exclude<FitDetection, { kind: "UNKNOWN" }>): FileChoice {
  return d.kind === "CLIMB" ? { kind: "CLIMB", discipline: d.discipline, setting: d.setting } : { kind: "TRAINING", training: d.training };
}

/**
 * The climber's pick, completed from the file: indoor/outdoor from what the
 * file says (or its GPS), the kind of training from its sport or name.
 */
export function choiceFor(hints: FitHints, as: FileAs): FileChoice {
  const detected = detectFitSession(hints);
  if (as === "TRAINING") {
    if (detected.kind === "TRAINING") return { kind: "TRAINING", training: detected.training };
    // Climbing per the watch, training per the climber: the name may still say which.
    const byName = detectFitSession({ ...hints, sport: null, subSport: null, durationSeconds: 0 });
    return { kind: "TRAINING", training: byName.kind === "TRAINING" ? byName.training : "OTHER" };
  }
  const setting: ClimbSetting = detected.kind === "CLIMB" ? detected.setting : hints.hasGps ? "OUTDOOR" : "INDOOR";
  return { kind: "CLIMB", discipline: as, setting };
}

/* ───────────── Marker on the activity ───────────── */

export type ImportedWhat =
  | "BOULDER_INDOOR" | "BOULDER_OUTDOOR" | "ROUTE_INDOOR" | "ROUTE_OUTDOOR"
  | TrainingKind;

/** Kept in the activity's raw_metadata once a one-step import filed it. */
export interface ImportedAs {
  what: ImportedWhat;
  by: DetectionSource | "climber";
  via: VenuePick["via"] | null;
}

const WHATS: readonly ImportedWhat[] = [
  "BOULDER_INDOOR", "BOULDER_OUTDOOR", "ROUTE_INDOOR", "ROUTE_OUTDOOR", "STRENGTH", "HANGBOARD", "MOBILITY", "CARDIO", "OTHER",
];
const BYS = ["sport", "name", "duration", "climber"] as const;
const VIAS = ["gps", "recent", "favourite"] as const;

export function importedWhat(filed: { kind: "CLIMB"; discipline: ClimbDiscipline; setting: ClimbSetting } | { kind: "TRAINING"; training: TrainingKind }): ImportedWhat {
  return filed.kind === "CLIMB" ? `${filed.discipline}_${filed.setting}` : filed.training;
}

export function readImportedAs(rawMetadata: unknown): ImportedAs | null {
  const meta = rawMetadata && typeof rawMetadata === "object" ? (rawMetadata as Record<string, unknown>) : null;
  const m = meta?.importedAs && typeof meta.importedAs === "object" ? (meta.importedAs as Record<string, unknown>) : null;
  if (!m) return null;
  const what = WHATS.find((w) => w === m.what);
  const by = BYS.find((b) => b === m.by);
  if (!what || !by) return null;
  return { what, by, via: VIAS.find((v) => v === m.via) ?? null };
}

/** The activity's name for display, when it says more than the sport itself. */
export function activityNameOf(rawMetadata: unknown): string | null {
  const meta = rawMetadata && typeof rawMetadata === "object" ? (rawMetadata as Record<string, unknown>) : {};
  const name = typeof meta.activityName === "string" ? meta.activityName.trim() : "";
  return normaliseName(name) ? name : null;
}

/* ───────────── The endpoint's answer ───────────── */

export type FitImportResult =
  /** Filed: open the new séance. */
  | { kind: "created"; activityId: string; href: string }
  /** Already in the journal (same file imported and filed before). */
  | { kind: "existing"; activityId: string; href: string }
  /** The file could not tell climbing from training: ask. */
  | { kind: "ask"; activityId: string; startedAt: string; durationSeconds: number }
  /** Climbing, but no venue could be found: the past-séance form asks for it. */
  | { kind: "needs_venue"; activityId: string; href: string }
  | { kind: "error"; code: FitUploadErrorCode | "future" };

const UPLOAD_ERRORS: readonly FitUploadErrorCode[] = ["not_fit", "no_activity", "too_large"];

/** Reads POST /api/uploads/fit/import's JSON. Links are only ever app paths. */
export function readFitImportResponse(httpOk: boolean, body: unknown): FitImportResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!httpOk) {
    if (b.error === "future") return { kind: "error", code: "future" };
    return { kind: "error", code: UPLOAD_ERRORS.find((c) => c === b.error) ?? "unknown" };
  }
  if (typeof b.activityId !== "string") return { kind: "error", code: "unknown" };
  const href = typeof b.href === "string" && /^\/(session|train\/sessions)\//.test(b.href) ? b.href : null;
  if ((b.status === "created" || b.status === "existing" || b.status === "needs_venue") && href) {
    return { kind: b.status, activityId: b.activityId, href };
  }
  const a = (b.activity && typeof b.activity === "object" ? b.activity : {}) as Record<string, unknown>;
  if (b.status === "ask" && typeof a.startedAt === "string" && !Number.isNaN(Date.parse(a.startedAt)) && typeof a.durationSeconds === "number") {
    return { kind: "ask", activityId: b.activityId, startedAt: a.startedAt, durationSeconds: a.durationSeconds };
  }
  return { kind: "error", code: "unknown" };
}

/** Where a climbing import goes when its venue is unknown: the past-séance form, with the file attached. */
export const pickVenueHref = (activityId: string) => `/session/new?where=past&fit=${activityId}`;
