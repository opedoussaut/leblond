import type { Board } from "./boards";

/**
 * The BoardLib commands a climber runs on their own computer to export a board
 * logbook. LEBLOND only shows them: it never runs BoardLib and never sees the
 * password, which BoardLib asks for in the climber's terminal.
 *
 * Board names and flags follow BoardLib's README and CLI: the Kilter and
 * MoonBoard logbooks need no database; the other Aurora boards first download
 * the public climb database, which the logbook reads to name the climbs.
 */

/** The MoonBoard versions BoardLib knows ("moon2024"…). */
export const MOON_YEARS = ["2016", "2017", "2019", "2020", "2024"] as const;
export type MoonYear = (typeof MOON_YEARS)[number];

/** BoardLib reports its MoonBoard export as broken for these versions. */
export const MOON_BROKEN: ReadonlySet<MoonYear> = new Set(["2016", "2024"]);

export const BOARDLIB_INSTALL = "pip install boardlib";

const AURORA_NAME: Partial<Record<Board, string>> = {
  TENSION: "tension", DECOY: "decoy", GRASSHOPPER: "grasshopper", TOUCHSTONE: "touchstone", SOILL: "soill", AURORA: "aurora",
};

/** The board name BoardLib expects on its command line. */
export function boardLibName(board: Board, moonYear: MoonYear = "2024"): string {
  if (board === "KILTER") return "kilter";
  if (board === "MOON") return "moon" + moonYear;
  return AURORA_NAME[board]!;
}

/**
 * The commands to run, in order. `username` is a placeholder the climber
 * replaces (the Kilter app signs in with an email address).
 */
export function boardLibCommands(board: Board, username: string, moonYear: MoonYear = "2024"): string[] {
  const name = boardLibName(board, moonYear);
  const user = `--username=${username}`;
  if (board === "KILTER" || board === "MOON") return [`boardlib logbook ${name} ${user} --output=${name}.csv`];
  return [
    `boardlib database ${name} ${name}.db ${user}`,
    `boardlib logbook ${name} ${user} --output=${name}.csv --database-path=${name}.db`,
  ];
}
