import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { REBUILD_PROGRAMME, type Phase, type StopReason, type Overall, type Verdict, type Weekday } from "@/lib/training/mobility-rebuild/engine";
import { parseContent, type RebuildContent } from "@/lib/training/mobility-rebuild/templates";
import { buildView, type CheckRow, type RebuildRow, type RebuildView } from "@/lib/training/mobility-rebuild/state";
import { localDate_ } from "@/lib/training/sessions";

export type RebuildEnrollment = {
  id: string; startedOn: string; days: Weekday[]; status: "ACTIVE" | "PAUSED";
  clinicalReviewOn: string | null; clinicalRestrictions: string; content: RebuildContent | null;
};

export type RebuildState = { enrollment: RebuildEnrollment; view: RebuildView; today: string };

const SESSION_COLUMNS = "id,title,status,programme_slot,programme_phase,planned_minutes,scheduled_date,original_date,pain,completed_at";
const CHECK_COLUMNS = "session_id,moment,back_pain,leg_radiation,verdict,phase_used,stop_reason,overall,updated_at";

type CheckDbRow = {
  session_id: string; moment: "BEFORE" | "AFTER" | "D1"; back_pain: number | null; leg_radiation: number | null;
  verdict: Verdict | null; phase_used: number | null; stop_reason: StopReason | null; overall: Overall | null; updated_at: string;
};

export function toCheck(c: CheckDbRow): CheckRow {
  return {
    sessionId: c.session_id, moment: c.moment, backPain: c.back_pain, legRadiation: c.leg_radiation, verdict: c.verdict,
    phaseUsed: c.phase_used, stopReason: c.stop_reason, overall: c.overall, updatedAt: c.updated_at,
  };
}

/** The viewer's Mobility Rebuild programme (RLS scopes everything to them), or null if not assigned. */
export async function loadRebuild(supabase: ServerSupabase): Promise<RebuildState | null> {
  const { data: e } = await supabase.from("mobility_enrollments")
    .select("id,started_on,schedule_days,status,clinical_review_on,clinical_restrictions,content")
    .eq("programme", REBUILD_PROGRAMME).maybeSingle();
  if (!e) return null;
  const enrollment: RebuildEnrollment = {
    id: e.id, startedOn: e.started_on, days: (e.schedule_days ?? []) as Weekday[], status: e.status,
    clinicalReviewOn: e.clinical_review_on, clinicalRestrictions: e.clinical_restrictions, content: parseContent(e.content),
  };
  const { data: rows } = await supabase.from("training_sessions").select(SESSION_COLUMNS)
    .eq("enrollment_id", e.id).order("programme_slot").limit(100);
  const sessions: RebuildRow[] = (rows ?? []).filter((r) => r.programme_slot !== null && r.programme_phase !== null).map((r) => ({
    id: r.id, title: r.title, status: r.status, slot: r.programme_slot!, phase: r.programme_phase! as Phase,
    plannedMinutes: r.planned_minutes, scheduledDate: r.scheduled_date, originalDate: r.original_date, pain: r.pain, completedAt: r.completed_at,
  }));
  const ids = sessions.map((s) => s.id);
  const { data: checkRows } = ids.length
    ? await supabase.from("mobility_session_checks").select(CHECK_COLUMNS).in("session_id", ids)
    : { data: [] as CheckDbRow[] };
  const today = localDate_(new Date());
  const view = buildView(sessions, (checkRows ?? []).map((c) => toCheck(c as CheckDbRow)), enrollment.content?.usual ?? null, today,
    (iso) => localDate_(new Date(iso)));
  return { enrollment, view, today };
}

/** The check-ins of one séance. */
export async function loadSessionChecks(supabase: ServerSupabase, sessionId: string): Promise<Partial<Record<CheckRow["moment"], CheckRow>>> {
  const { data } = await supabase.from("mobility_session_checks").select(CHECK_COLUMNS).eq("session_id", sessionId);
  const out: Partial<Record<CheckRow["moment"], CheckRow>> = {};
  for (const c of data ?? []) out[c.moment as CheckRow["moment"]] = toCheck(c as CheckDbRow);
  return out;
}
