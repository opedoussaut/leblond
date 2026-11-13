import { z } from "zod";
import { FONT_SCALE } from "@/lib/grading/systems";

/**
 * Training boards (Kilter, Tension, MoonBoard and the other Aurora boards a
 * BoardLib logbook can come from). A board séance is its own kind
 * of climbing séance: the climber types the name shown in the board app and
 * the grade as the app shows it. Board grades are never mixed with gym colours
 * or route grades, and Font and V grades are never converted into each other.
 */
export const BOARDS = ["KILTER", "TENSION", "MOON", "DECOY", "GRASSHOPPER", "TOUCHSTONE", "SOILL", "AURORA"] as const;
export type Board = (typeof BOARDS)[number];

export const BOARD_NAMES: Record<Board, string> = {
  KILTER: "Kilter Board", TENSION: "Tension Board", MOON: "MoonBoard",
  DECOY: "Decoy Board", GRASSHOPPER: "Grasshopper Board", TOUCHSTONE: "Touchstone Board", SOILL: "So iLL Board", AURORA: "Aurora Board",
};
export const BOARD_SHORT: Record<Board, string> = {
  KILTER: "Kilter", TENSION: "Tension", MOON: "Moon",
  DECOY: "Decoy", GRASSHOPPER: "Grasshopper", TOUCHSTONE: "Touchstone", SOILL: "So iLL", AURORA: "Aurora",
};

/**
 * The layouts a climber can pick; the first one is offered by default. Boards
 * whose layouts LEBLOND does not know offer none (the séance has no layout).
 */
export const BOARD_LAYOUTS: Record<Board, readonly string[]> = {
  KILTER: ["Original", "Homewall"],
  TENSION: ["TB2 Mirror", "TB2 Spray", "TB1"],
  MOON: ["2016", "2017", "2019", "2020", "2024", "Mini"],
  DECOY: [], GRASSHOPPER: [], TOUCHSTONE: [], SOILL: [], AURORA: [],
};

/** Boards whose apps offer a mirrored version of each climb. */
export const hasMirror = (board: Board) => board === "TENSION";

export const ANGLE_STEP = 5;
/**
 * The angles offered for a board, in 5° steps like the board apps. Kilter goes
 * from 0° to 70°; the same range is offered for Tension and the other Aurora
 * boards (their exact ranges are not confirmed); a MoonBoard is built at 25° or 40°.
 */
export function boardAngles(board: Board): number[] {
  if (board === "MOON") return [25, 40];
  return Array.from({ length: 70 / ANGLE_STEP + 1 }, (_, i) => i * ANGLE_STEP);
}
export const DEFAULT_ANGLE = 40;
/** The nearest angle the board offers. */
export function clampAngle(board: Board, angle: number): number {
  return boardAngles(board).reduce((best, a) => (Math.abs(a - angle) < Math.abs(best - angle) ? a : best));
}

export const BOARD_SCALES = ["FONT", "V"] as const;
export type BoardScale = (typeof BOARD_SCALES)[number];
const FONT_BOARD: readonly string[] = FONT_SCALE.slice((FONT_SCALE as readonly string[]).indexOf("4a"));
const V_BOARD: readonly string[] = Array.from({ length: 18 }, (_, i) => "V" + i);

/** The grades of a scale, easiest first. */
export const boardGrades = (scale: BoardScale): readonly string[] => (scale === "FONT" ? FONT_BOARD : V_BOARD);
/** Position of a grade inside its own scale (never compare ranks across scales), or -1. */
export const gradeRank = (scale: BoardScale, grade: string): number => boardGrades(scale).indexOf(grade);
export const isBoardGrade = (scale: BoardScale, grade: string): boolean => gradeRank(scale, grade) >= 0;
/** The grade as LEBLOND writes it ("6a+" → "6A+", "v4" → "V4"), or null when it is not in the scale. */
export function normaliseBoardGrade(scale: BoardScale, raw: string): string | null {
  const wanted = raw.trim().toLowerCase();
  return boardGrades(scale).find((g) => g.toLowerCase() === wanted) ?? null;
}

/** FLASH: sent first go. SENT: sent after tries. ATTEMPT: not yet. */
export const BOARD_RESULTS = ["FLASH", "SENT", "ATTEMPT"] as const;
export type BoardResult = (typeof BOARD_RESULTS)[number];
export const isBoardSend = (r: BoardResult) => r !== "ATTEMPT";

/** Accent/case-insensitive key: the same board, key and angle make the same climb. */
export function climbKey(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const board = z.enum(BOARDS);
const angle = z.number().int().min(0).max(90);
const scale = z.enum(BOARD_SCALES);
const validGrade = (v: { grade?: string; gradeScale?: BoardScale }) =>
  v.grade === undefined || v.gradeScale === undefined || isBoardGrade(v.gradeScale, v.grade);

export const startBoardSessionSchema = z.object({
  board,
  layout: z.string().trim().max(40),
  angle,
  /** The gym where the board is, or null for a board at home. */
  gymId: z.guid().nullable(),
  /** Set for a séance that already happened (local Paris date and time). */
  past: z.object({
    date: z.iso.date(),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    minutes: z.number().int().min(10).max(720),
  }).strict().nullable().default(null),
}).strict().refine((v) => boardAngles(v.board).includes(v.angle), "Angle not offered by this board");

export const logBoardAscentSchema = z.object({
  sessionId: z.guid(),
  clientId: z.guid(),
  climbName: z.string().trim().min(1).max(120),
  grade: z.string().min(1).max(8),
  gradeScale: scale,
  angle,
  tries: z.number().int().min(1).max(999),
  result: z.enum(BOARD_RESULTS),
  isBenchmark: z.boolean(),
  isMirror: z.boolean(),
  notes: z.string().trim().max(500).default(""),
  /** Keep a climb not sent yet as a project. */
  asProject: z.boolean().default(false),
}).strict()
  .refine(validGrade, "Unknown grade for this scale")
  .refine((v) => v.result !== "FLASH" || v.tries === 1, "A flash is one try");
export type LogBoardAscentInput = z.infer<typeof logBoardAscentSchema>;

export const updateBoardAscentSchema = z.object({
  id: z.guid(),
  notes: z.string().trim().max(500).optional(),
  tries: z.number().int().min(1).max(999).optional(),
  result: z.enum(BOARD_RESULTS).optional(),
}).strict();

export const boardProjectSchema = z.object({
  board,
  climbName: z.string().trim().min(1).max(120),
  angle,
  grade: z.string().min(1).max(8),
  gradeScale: scale,
}).strict().refine(validGrade, "Unknown grade for this scale");

export const BOARD_PROJECT_STATUSES = ["ACTIVE", "SENT", "ABANDONED"] as const;
export type BoardProjectStatus = (typeof BOARD_PROJECT_STATUSES)[number];
