"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth/viewer";
import { historyColours, importArkoseHistorySchema, isHistorySystem, type ArkoseDay } from "@/lib/climbing/arkose-history";
import { zonedToUtc } from "@/lib/time";
import type { ActionResult } from "@/lib/validation/common";

export type ArkoseImportResult = { sessions: number; sends: number; skippedDays: number };

/** Note stored on each imported séance and boulder, so they are never mistaken for logged ones. */
const NOTE = "Importée d'Arkose : nombre de blocs réussis par couleur ce jour-là. Arkose ne donne ni les essais, ni les flashs, ni l'heure.";

/**
 * Imports past sends counted by Arkose. Each day becomes one finished boulder
 * séance at the chosen Arkose gym (source ARKOSE), with one boulder per send
 * in its colour, sent (TOP) with no flash claimed. A day that already has a
 * boulder séance at that gym is skipped, so importing the same file twice
 * adds nothing. The boulders are marked as taken down, so they never show
 * among the gym's current boulders.
 */
export async function importArkoseHistory(input: unknown): Promise<ActionResult<ArkoseImportResult>> {
  const viewer = await requireViewer();
  const parsed = importArkoseHistorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { gymId, days } = parsed.data as { gymId: string; days: ArkoseDay[] };
  const sb = viewer.supabase;

  const { data: gym } = await sb.from("gyms").select("id, brand, grading_system, has_bouldering").eq("id", gymId).maybeSingle();
  if (!gym || !gym.has_bouldering || !isHistorySystem(gym.grading_system)) return { ok: false, error: "invalid" };
  const system = gym.grading_system;
  const colours = historyColours(system);
  if (days.some((d) => Object.keys(d.counts).some((c) => !colours.includes(c)))) return { ok: false, error: "invalid" };

  const result: ArkoseImportResult = { sessions: 0, sends: 0, skippedDays: 0 };
  for (const day of days) {
    const dayStart = zonedToUtc(day.date, "00:00"), dayEnd = new Date(zonedToUtc(day.date, "00:00").getTime() + 86_400_000);
    if (dayStart.getTime() > Date.now()) return { ok: false, error: "invalid" };
    const { data: existing, error: lookup } = await sb.from("sessions").select("id")
      .eq("gym_id", gymId).eq("discipline", "BOULDER")
      .gte("started_at", dayStart.toISOString()).lt("started_at", dayEnd.toISOString()).limit(1).maybeSingle();
    if (lookup) return { ok: false, error: "unknownError" };
    if (existing) { result.skippedDays += 1; continue; }

    // Arkose gives no time of day: noon, one second per boulder.
    const sends = colours.flatMap((c) => Array.from({ length: day.counts[c] ?? 0 }, () => c));
    const start = zonedToUtc(day.date, "12:00").getTime();
    const at = (i: number) => new Date(start + (i + 1) * 1000).toISOString();
    const ended = at(sends.length);

    const { data: session, error } = await sb.from("sessions").insert({
      user_id: viewer.userId, gym_id: gymId, discipline: "BOULDER", source: "ARKOSE", session_type: "BOULDERING",
      grade_system: system, started_at: new Date(start).toISOString(), ended_at: ended, notes: NOTE,
    }).select("id").single();
    if (error || !session) return { ok: false, error: "unknownError" };

    const problems = sends.map((grade, i) => ({
      id: crypto.randomUUID(), gym_id: gymId, created_by: viewer.userId, native_grade: grade,
      native_grade_system: system, wall_angle: "UNKNOWN" as const,
      notes: NOTE, created_at: at(i), retired_at: ended,
    }));
    const { error: pErr } = await sb.from("problems").insert(problems);
    if (pErr) { await sb.from("sessions").delete().eq("id", session.id); return { ok: false, error: "unknownError" }; }

    const { error: aErr } = await sb.from("attempts").insert(problems.map((p, i) => ({
      session_id: session.id, problem_id: p.id, user_id: viewer.userId, attempt_number: 1, result: "TOP" as const,
      created_at: at(i), notes: NOTE,
    })));
    if (aErr) {
      await sb.from("problems").delete().in("id", problems.map((p) => p.id));
      await sb.from("sessions").delete().eq("id", session.id);
      return { ok: false, error: "unknownError" };
    }
    result.sessions += 1;
    result.sends += sends.length;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: result };
}
