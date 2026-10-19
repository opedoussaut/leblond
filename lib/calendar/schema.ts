import { z } from "zod";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";

const validMethods = new Set(METHODS_FOR_PLANS.map((entry) => entry.id));
export const calendarEntrySchema = z.object({
  eventDate: z.iso.date().refine((v) => v >= "2020-01-01" && v <= "2100-12-31"),
  startTime: z.union([z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), z.literal("")]),
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["CLIMB","TRAIN","REST","ASSESS","OTHER"]),
  discipline: z.enum(["BOULDER","ROUTE","BOTH","NONE"]),
  minutes: z.number().int().min(10).max(480).nullable(),
  methodId: z.string().nullable().refine((v) => !v || validMethods.has(v)),
  notes: z.string().trim().max(1000),
}).strict();
export type CalendarInput = z.infer<typeof calendarEntrySchema>;
export type CalendarEvent = {
  id: string; eventDate: string; startTime: string; title: string;
  kind: CalendarInput["kind"]; discipline: CalendarInput["discipline"];
  minutes: number | null; methodId: string | null; notes: string;
  status: "PLANNED" | "DONE" | "SKIPPED";
};
export type LoggedSession = { id: string; eventDate: string; title: string; startedAt: string };
export function monthBounds(month: string) {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) return null;
  const year = Number(month.slice(0,4)), index = Number(month.slice(5,7)) - 1;
  if (year < 2020 || year > 2100) return null;
  const days = new Date(Date.UTC(year,index+1,0)).getUTCDate();
  return { first: month+"-01", last: month+"-"+String(days).padStart(2,"0") };
}
