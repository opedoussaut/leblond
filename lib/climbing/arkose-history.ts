import { z } from "zod";
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

const COLOUR_NAMES: Record<string, ArkoseColour> = {
  jaune: "YELLOW", yellow: "YELLOW",
  vert: "GREEN", verte: "GREEN", green: "GREEN",
  bleu: "BLUE", bleue: "BLUE", blue: "BLUE",
  rouge: "RED", red: "RED",
  noir: "BLACK", noire: "BLACK", black: "BLACK",
  violet: "PURPLE", violette: "PURPLE", purple: "PURPLE",
};

/** At most this many sends on one line (a day and a colour). */
export const MAX_SENDS_PER_LINE = 60;
/** At most this many lines per file. */
export const MAX_LINES = 2000;

export type ArkoseDay = { date: string; counts: Partial<Record<ArkoseColour, number>> };
export type ArkoseRejectReason = "date" | "colour" | "count" | "future";
export type ArkoseParse = {
  days: ArkoseDay[];
  sends: number;
  rejected: Array<{ line: number; reason: ArkoseRejectReason }>;
  missingColumns: string[];
};

const strip = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function arkoseColour(value: string): ArkoseColour | null {
  const v = strip(value);
  return COLOUR_NAMES[v] ?? ((ARKOSE_COLOURS as readonly string[]).includes(v.toUpperCase()) ? (v.toUpperCase() as ArkoseColour) : null);
}

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= "2000-01-01";
}

/** Parses the file. `today` (YYYY-MM-DD) refuses days in the future. Several lines for the same day and colour add up. */
export function parseArkoseHistory(text: string, today: string): ArkoseParse {
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
    const colour = arkoseColour(row[iColour] ?? "");
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
    counts: z.partialRecord(z.enum(ARKOSE_COLOURS), z.number().int().min(1).max(MAX_SENDS_PER_LINE)),
  })).min(1).max(40),
});

/** Splits the days into batches of at most 40 days each, sent one after the other. */
export function arkoseBatches(days: ArkoseDay[], size = 40): ArkoseDay[][] {
  const out: ArkoseDay[][] = [];
  for (let i = 0; i < days.length; i += size) out.push(days.slice(i, i + size));
  return out;
}

export function daySends(day: ArkoseDay): number {
  return Object.values(day.counts).reduce((a, n) => a + (n ?? 0), 0);
}
