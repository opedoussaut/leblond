"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { calendarEntrySchema } from "@/lib/calendar/schema";

type CalendarResult = { ok: true; id: string } | { ok: false; error: "invalid" | "limit" | "unknown" };

export async function addCalendarEntry(input: unknown): Promise<CalendarResult> {
  const viewer = await requireViewer();
  const parsed = calendarEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { count, error: countError } = await viewer.supabase
    .from("calendar_entries").select("id", { head: true, count: "exact" });
  if (countError) return { ok: false, error: "unknown" };
  if ((count ?? 0) >= 2000) return { ok: false, error: "limit" };
  const v = parsed.data;
  const { data, error } = await viewer.supabase.from("calendar_entries").insert({
    user_id: viewer.userId, event_date: v.eventDate, start_time: v.startTime || null,
    title: v.title, kind: v.kind, discipline: v.discipline,
    duration_minutes: v.minutes, method_id: v.methodId, notes: v.notes,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "unknown" };
  revalidatePath("/calendar");
  return { ok: true, id: data.id };
}

export async function changeCalendarStatus(id: string, status: "PLANNED"|"DONE"|"SKIPPED") {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(id).success || !["PLANNED","DONE","SKIPPED"].includes(status)) return { ok: false };
  const { data, error } = await viewer.supabase.from("calendar_entries")
    .update({ status }).eq("id", id).eq("user_id", viewer.userId).select("id").maybeSingle();
  if (error || !data) return { ok: false };
  revalidatePath("/calendar");
  return { ok: true };
}

export async function removeCalendarEntry(id: string) {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(id).success) return { ok: false };
  const { error } = await viewer.supabase.from("calendar_entries")
    .delete().eq("id", id).eq("user_id", viewer.userId);
  if (error) return { ok: false };
  revalidatePath("/calendar");
  return { ok: true };
}
