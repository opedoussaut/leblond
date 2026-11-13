import { z } from "zod";
import { BOARDS, BOARD_RESULTS, climbKey, isBoardGrade, normaliseBoardGrade, type Board, type BoardResult, type BoardScale } from "./boards";

/**
 * Reads a logbook file written by BoardLib (https://github.com/lemeryfertitta/BoardLib),
 * the open-source tool a climber runs themself to export their Kilter or Tension
 * logbook. LEBLOND never talks to the board apps and never sees the password:
 * the climber exports the file, then uploads it here.
 *
 * Columns are found by name, so their order and the extra ones do not matter.
 */

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

export type BoardLibRow = {
  /** Stable reference of the line: importing the same file twice adds nothing. */
  ref: string;
  board: Board; angle: number; name: string;
  /** Local date and time of the climb, as the board app recorded it. */
  date: string; time: string;
  grade: string; gradeScale: BoardScale; tries: number; result: BoardResult;
  isBenchmark: boolean; isMirror: boolean; notes: string;
};

export const REJECT_REASONS = ["board", "name", "angle", "date", "grade"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type BoardLibParse = {
  rows: BoardLibRow[];
  rejected: { line: number; reason: RejectReason }[];
  /** Required columns the file does not have; when not empty, nothing was read. */
  missingColumns: string[];
};

const BOARD_BY_NAME: Record<string, Board> = {
  kilter: "KILTER", kilterboard: "KILTER", tension: "TENSION", tension2: "TENSION", tensionboard: "TENSION",
  moon: "MOON", moonboard: "MOON", moon2016: "MOON", moon2017: "MOON", moon2019: "MOON", moon2020: "MOON", moon2024: "MOON",
  decoy: "DECOY", grasshopper: "GRASSHOPPER", touchstone: "TOUCHSTONE", soill: "SOILL", aurora: "AURORA",
};
const truthy = (v: string | undefined) => /^(true|1|yes|y)$/i.test((v ?? "").trim());
const blank = (v: string | undefined) => { const s = (v ?? "").trim(); return s === "" || /^(none|nan|null)$/i.test(s); };

/** "6a/V3" → Font 6A; "V4" → V4. The Font side is kept when both are given. */
function readGrade(raw: string): { grade: string; scale: BoardScale } | null {
  for (const part of raw.split("/").map((p) => p.trim())) {
    const font = normaliseBoardGrade("FONT", part);
    if (font) return { grade: font, scale: "FONT" };
  }
  for (const part of raw.split("/").map((p) => p.trim())) {
    const v = normaliseBoardGrade("V", part);
    if (v) return { grade: v, scale: "V" };
  }
  return null;
}

/**
 * The climbs of a BoardLib logbook file. `fallbackBoard` is used for files
 * without a board column (the climber says which board the file is from).
 */
export function parseBoardLibCsv(text: string, fallbackBoard: Board | null = null): BoardLibParse {
  const table = parseCsv(text);
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const at = {
    board: col("board"), angle: col("angle"), name: col("climb_name", "name", "climb"), date: col("date", "climbed_at"),
    logged: col("logged_grade", "grade"), displayed: col("displayed_grade", "difficulty"), tries: col("tries", "bid_count", "attempts"),
    benchmark: col("is_benchmark"), mirror: col("is_mirror"), ascent: col("is_ascent"), comment: col("comment", "notes"),
    uuid: col("climb_angle_uuid", "climb_uuid", "uuid"),
  };
  const missingColumns = [
    at.name < 0 ? "climb_name" : null, at.date < 0 ? "date" : null, at.angle < 0 ? "angle" : null,
    at.logged < 0 && at.displayed < 0 ? "logged_grade" : null, at.board < 0 && !fallbackBoard ? "board" : null,
  ].filter((c): c is string => c !== null);
  if (missingColumns.length) return { rows: [], rejected: [], missingColumns };

  const rows: BoardLibRow[] = [], rejected: BoardLibParse["rejected"] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const reject = (reason: RejectReason) => { rejected.push({ line, reason }); };
    const board = at.board >= 0 ? BOARD_BY_NAME[get(at.board).toLowerCase().replace(/[\s_-]+/g, "")] ?? null : fallbackBoard;
    if (!board) return reject("board");
    const name = get(at.name).slice(0, 120);
    if (!climbKey(name)) return reject("name");
    const angle = Number(get(at.angle));
    if (!Number.isInteger(angle) || angle < 0 || angle > 90) return reject("angle");
    const when = get(at.date).match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!when || Number.isNaN(Date.parse(when[1] + "T00:00:00Z"))) return reject("date");
    const [, date, hh = "12", mm = "00", ss = "00"] = when;
    const isAscent = at.ascent < 0 || blank(cells[at.ascent]) ? true : truthy(cells[at.ascent]);
    const graded = readGrade(!blank(cells[at.logged]) ? get(at.logged) : get(at.displayed)) ?? readGrade(get(at.displayed));
    if (!graded) return reject("grade");
    const tries = Math.max(1, Math.min(999, Math.round(Number(get(at.tries))) || 1));
    const result: BoardResult = !isAscent ? "ATTEMPT" : tries === 1 ? "FLASH" : "SENT";
    const id = get(at.uuid) || `${climbKey(name)}@${angle}`;
    let ref = `${board}|${id}|${date}T${hh}:${mm}:${ss}|${isAscent ? "A" : "B"}`.slice(0, 190);
    // Two identical lines in one file are two goes logged in the same second: keep both.
    for (let n = 2; seen.has(ref); n++) ref = ref.replace(/(#\d+)?$/, "#" + n);
    seen.add(ref);
    rows.push({
      ref, board, angle, name, date, time: `${hh}:${mm}`, grade: graded.grade, gradeScale: graded.scale, tries, result,
      isBenchmark: truthy(cells[at.benchmark]), isMirror: truthy(cells[at.mirror]),
      notes: blank(cells[at.comment]) ? "" : get(at.comment).slice(0, 500),
    });
  });
  return { rows, rejected, missingColumns: [] };
}

/** What the server accepts from the import screen: lines already read by parseBoardLibCsv. */
export const boardLibRowSchema = z.object({
  ref: z.string().min(1).max(200),
  board: z.enum(BOARDS),
  angle: z.number().int().min(0).max(90),
  name: z.string().trim().min(1).max(120),
  date: z.iso.date(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  grade: z.string().min(1).max(8),
  gradeScale: z.enum(["FONT", "V"]),
  tries: z.number().int().min(1).max(999),
  result: z.enum(BOARD_RESULTS),
  isBenchmark: z.boolean(),
  isMirror: z.boolean(),
  notes: z.string().max(500),
}).strict()
  .refine((r) => isBoardGrade(r.gradeScale, r.grade), "Unknown grade for this scale")
  .refine((r) => r.result !== "FLASH" || r.tries === 1, "A flash is one try");

/** Days per request, so a séance is never split between two requests. */
export const IMPORT_MAX_ROWS = 400;
export const importBoardLogbookSchema = z.object({ rows: z.array(boardLibRowSchema).min(1).max(IMPORT_MAX_ROWS) }).strict();

/** Groups lines into requests of whole days (a day is one séance per board). */
export function importBatches(rows: readonly BoardLibRow[], max = IMPORT_MAX_ROWS): BoardLibRow[][] {
  const days = new Map<string, BoardLibRow[]>();
  for (const r of rows) days.set(r.date, [...(days.get(r.date) ?? []), r]);
  const batches: BoardLibRow[][] = [];
  let current: BoardLibRow[] = [];
  for (const date of [...days.keys()].sort()) {
    const day = days.get(date)!;
    if (current.length && current.length + day.length > max) { batches.push(current); current = []; }
    // A single day longer than a request is cut; the server finds the séance again.
    for (let i = 0; i < day.length; i += max) {
      const part = day.slice(i, i + max);
      if (part.length === max) batches.push(part); else current.push(...part);
    }
  }
  if (current.length) batches.push(current);
  return batches;
}
