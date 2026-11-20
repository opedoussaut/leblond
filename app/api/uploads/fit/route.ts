import { getViewer } from "@/lib/auth/viewer";
import { overlapsSession } from "@/lib/integrations/wearables/dedup";
import { receiveFitUpload } from "@/lib/integrations/wearables/fit/receive";

export const runtime = "nodejs";

/**
 * FIT import (provider-neutral fallback). Validates size and FIT integrity,
 * keeps the raw file in the user's private folder for provenance, normalises
 * it, de-duplicates, and suggests the climbing session it overlaps.
 * The answer also carries the activity's start, duration and linked séance
 * (climbing or training), so a séance page can attach the file right away
 * (lib/integrations/wearables/fit/attach.ts).
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "unauthenticated" }, { status: 401 });
  if (!viewer.active) return Response.json({ error: "forbidden" }, { status: 403 });

  const received = await receiveFitUpload(viewer, request);
  if (!received.ok) return Response.json({ error: received.error }, { status: received.status });
  const { workout, activityId, activity } = received;
  if (received.duplicate) return Response.json({ status: "duplicate", activityId, activity });

  const { data: sessions } = await viewer.supabase
    .from("sessions")
    .select("id, started_at, ended_at")
    .gte("started_at", new Date(workout.startedAt.getTime() - 12 * 3_600_000).toISOString())
    .lte("started_at", new Date(workout.startedAt.getTime() + 12 * 3_600_000).toISOString())
    .order("started_at", { ascending: false });
  const match = (sessions ?? []).find((s) =>
    overlapsSession(workout, { startedAt: new Date(s.started_at), endedAt: s.ended_at ? new Date(s.ended_at) : null }),
  );
  return Response.json({ status: "inserted", activityId, suggestedSessionId: match?.id ?? null, activity });
}
