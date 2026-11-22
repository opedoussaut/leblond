import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { loadExerciseMethods } from "@/lib/data/training-sessions";
import { localDate_ } from "@/lib/training/sessions";
import type { MobilitySessionFact } from "@/lib/analytics/mobility-follow-up";

/** Enough for years of mobility séances among everything else the climber trains. */
const READ_LIMIT = 600;

const COLUMNS = "id,title,method_id,enrollment_id,status,scheduled_date,completed_at,created_at,actual_minutes,planned_minutes";

type Row = {
  id: string; title: string; method_id: string | null; enrollment_id: string | null; status: string;
  scheduled_date: string | null; completed_at: string | null; created_at: string; actual_minutes: number | null; planned_minutes: number | null;
};

/**
 * Every guided séance that may be mobility work (done, in progress or planned),
 * whatever started it: the hip programme, the Rebuild programme, a coach or an
 * Atlas séance. The exercises' methods are read only for séances without a
 * method of their own (coach séances). RLS scopes everything to the viewer.
 */
export async function loadMobilitySessionFacts(supabase: ServerSupabase): Promise<MobilitySessionFact[]> {
  const { data } = await supabase.from("training_sessions").select(COLUMNS)
    .in("status", ["COMPLETED", "INTERRUPTED", "IN_PROGRESS", "PLANNED"])
    .order("scheduled_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(READ_LIMIT);
  const rows = (data ?? []) as unknown as Row[];
  const methods = await loadExerciseMethods(supabase, rows.filter((r) => !r.method_id && !r.enrollment_id).map((r) => r.id));
  return rows.map((r) => ({
    id: r.id, title: r.title, methodId: r.method_id, enrollmentId: r.enrollment_id, status: r.status,
    // A finished séance counts on the day it was done (a programme séance can be done before its planned day).
    date: r.completed_at && (r.status === "COMPLETED" || r.status === "INTERRUPTED") ? localDate_(new Date(r.completed_at))
      : r.scheduled_date ?? localDate_(new Date(r.created_at)),
    actualMinutes: r.actual_minutes, plannedMinutes: r.planned_minutes,
    exerciseMethodIds: methods.get(r.id) ?? [],
  }));
}

/** The bilans 2.0 (date and status only), newest first: enough to place S4 / S8 / S12. */
export async function loadBilanDates(supabase: ServerSupabase): Promise<{ startedOn: string; status: "IN_PROGRESS" | "COMPLETED" | "STOPPED" }[]> {
  const { data } = await supabase.from("mobility_battery_sessions").select("started_on,status")
    .order("started_on", { ascending: false }).limit(60);
  return (data ?? []).map((r) => ({ startedOn: r.started_on, status: r.status }));
}
