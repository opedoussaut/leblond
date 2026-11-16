import { z } from "zod";
import { GRADES_BY_SYSTEM } from "@/lib/grading/systems";
import { parseCsv } from "./boardlib-csv";

/**
 * Reads a past-sends file for an Arkose gym: one line per day and colour with
 * the number of boulders sent, as Arkose's own statistics give them
 * (`date,couleur,nombre`, e.g. `2025-09-02,jaune,11`). Arkose does not say
 * which boulder, how many tries, or whether it was flashed, so every line
 * becomes plain sends: nothing is invented beyond the counts.
 */

export const ARKOSE_COLOURS = ["YELLOW", "GREEN", "BLUE", "RED", "BLACK", "PURPLE"] as const;
export type ArkoseColour = (typeof ARKOSE_COLOURS)[number];

/**
 * Gyms whose statistics pages Arkose hosts (same file format), each with its
 * own colour scale: Arkose, Le Labo (Grenoble), MROC Laennec (Lyon).
 */
export const HISTORY_SYSTEMS = ["ARKOSE_COLOR", "LELABO_COLOR", "MROC_COLOR"] as const;
export type HistorySystem = (typeof HISTORY_SYSTEMS)[number];
export const isHistorySystem = (s: unknown): s is HistorySystem => (HISTORY_SYSTEMS as readonly unknown[]).includes(s);

/** A scale's colours, easiest first. */
export const historyColours = (system: HistorySystem): string[] => GRADES_BY_SYSTEM[system].map((g) => g.id);

const COLOUR_NAMES: Record<string, string> = {
  jaune: "YELLOW", yellow: "YELLOW",
  vert: "GREEN", verte: "GREEN", green: "GREEN",
  "vert clair": "LIGHT_GREEN", "verte claire": "LIGHT_GREEN", "light green": "LIGHT_GREEN", light_green: "LIGHT_GREEN",
  "vert fonce": "DARK_GREEN", "verte foncee": "DARK_GREEN", "dark green": "DARK_GREEN", dark_green: "DARK_GREEN",
  orange: "ORANGE",
  bleu: "BLUE", bleue: "BLUE", blue: "BLUE",
  rouge: "RED", red: "RED",
  noir: "BLACK", noire: "BLACK", black: "BLACK",
  violet: "PURPLE", violette: "PURPLE", purple: "PURPLE",
};

/** At most this many sends on one line (a day and a colour). */
export const MAX_SENDS_PER_LINE = 60;
/** At most this many lines per file. */
export const MAX_LINES = 2000;

export type ArkoseDay = { date: string; counts: Partial<Record<string, number>> };
export type ArkoseRejectReason = "date" | "colour" | "count" | "future";
export type ArkoseParse = {
  days: ArkoseDay[];
  sends: number;
  rejected: Array<{ line: number; reason: ArkoseRejectReason }>;
  missingColumns: string[];
};

const strip = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** The colour a file names, if the gym's scale has it ("vert" is not a Le Labo colour: it has light and dark green). */
export function arkoseColour(value: string, system: HistorySystem = "ARKOSE_COLOR"): string | null {
  const v = strip(value).replace(/\s+/g, " ");
  const id = COLOUR_NAMES[v] ?? v.toUpperCase().replace(/ /g, "_");
  return historyColours(system).includes(id) ? id : null;
}

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= "2000-01-01";
}

/** Parses the file. `today` (YYYY-MM-DD) refuses days in the future. Several lines for the same day and colour add up. */
export function parseArkoseHistory(text: string, today: string, system: HistorySystem = "ARKOSE_COLOR"): ArkoseParse {
  const table = parseCsv(text.replace(/;/g, ","));
  const header = (table[0] ?? []).map(strip);
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iDate = col("date", "jour", "day"), iColour = col("couleur", "colour", "color", "niveau"), iCount = col("nombre", "count", "blocs", "sends");
  const missingColumns = [iDate < 0 && "date", iColour < 0 && "couleur", iCount < 0 && "nombre"].filter(Boolean) as string[];
  if (missingColumns.length) return { days: [], sends: 0, rejected: [], missingColumns };

  const byDay = new Map<string, ArkoseDay>();
  const rejected: ArkoseParse["rejected"] = [];
  let sends = 0;
  table.slice(1, MAX_LINES + 1).forEach((row, i) => {
    const line = i + 2;
    const date = (row[iDate] ?? "").trim();
    const colour = arkoseColour(row[iColour] ?? "", system);
    const raw = (row[iCount] ?? "").trim();
    const count = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!validDate(date)) return rejected.push({ line, reason: "date" });
    if (date > today) return rejected.push({ line, reason: "future" });
    if (!colour) return rejected.push({ line, reason: "colour" });
    if (!Number.isInteger(count) || count < 0 || count > MAX_SENDS_PER_LINE) return rejected.push({ line, reason: "count" });
    if (count === 0) return;
    const day = byDay.get(date) ?? { date, counts: {} };
    const total = (day.counts[colour] ?? 0) + count;
    if (total > MAX_SENDS_PER_LINE) return rejected.push({ line, reason: "count" });
    day.counts[colour] = total;
    byDay.set(date, day);
    sends += count;
  });
  const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { days, sends, rejected, missingColumns };
}

export const importArkoseHistorySchema = z.object({
  gymId: z.string().uuid(),
  days: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Any colour of a supported scale; the action then checks it against the chosen gym's own scale.
    counts: z.partialRecord(z.enum([...new Set(HISTORY_SYSTEMS.flatMap(historyColours))] as [string, ...string[]]), z.number().int().min(1).max(MAX_SENDS_PER_LINE)),
  })).min(1).max(40),
});

/** Splits the days into batches of at most 40 days each, sent one after the other. */
export function arkoseBatches(days: ArkoseDay[], size = 40): ArkoseDay[][] {
  const out: ArkoseDay[][] = [];
  for (let i = 0; i < days.length; i += size) out.push(days.slice(i, i + size));
  return out;
}

export function daySends(day: ArkoseDay): number {
  return Object.values(day.counts).reduce<number>((a, n) => a + (n ?? 0), 0);
}
