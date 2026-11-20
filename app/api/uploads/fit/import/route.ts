import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { linkedSessionHref } from "@/lib/integrations/wearables/fit/attach";
import { detectFitSession, hintsFromActivity } from "@/lib/integrations/wearables/fit/classify";
import { fileActivity } from "@/lib/integrations/wearables/fit/file";
import { choiceFromDetection } from "@/lib/integrations/wearables/fit/import-flow";
import { receiveFitUpload } from "@/lib/integrations/wearables/fit/receive";

export const runtime = "nodejs";

/**
 * One-step FIT import: the file is received like any FIT upload, then filed in
 * the journal at once — as a climbing séance or a training séance, depending on
 * what the file says (lib/integrations/wearables/fit/classify.ts). The answer
 * says where the new séance is, or that the climber has to choose.
 * The watch's start position is used here only, in memory, to find the venue.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "unauthenticated" }, { status: 401 });
  if (!viewer.active) return Response.json({ error: "forbidden" }, { status: 403 });

  const received = await receiveFitUpload(viewer, request);
  if (!received.ok) return Response.json({ error: received.error }, { status: received.status });
  const { workout, activityId, activity } = received;

  const existing = linkedSessionHref({ linkedSessionId: activity.sessionId, linkedTrainingSessionId: activity.trainingSessionId });
  if (existing) return Response.json({ status: "existing", activityId, href: existing });

  const detection = detectFitSession(hintsFromActivity({
    activity_type: workout.activityType, duration_seconds: workout.durationSeconds, raw_metadata: workout.rawMetadata,
  }));
  if (detection.kind === "UNKNOWN") {
    return Response.json({ status: "ask", activityId, activity: { startedAt: activity.startedAt, durationSeconds: activity.durationSeconds } });
  }

  const outcome = await fileActivity(viewer, activityId, choiceFromDetection(detection), {
    by: detection.source, start: workout.startPosition ?? null,
  });
  if (outcome.ok) {
    revalidatePath("/", "layout");
    return Response.json({ status: "created", activityId, href: outcome.href });
  }
  if (outcome.error === "needs_venue") return Response.json({ status: "needs_venue", activityId, href: outcome.href });
  if (outcome.error === "already" && outcome.href) return Response.json({ status: "existing", activityId, href: outcome.href });
  if (outcome.error === "future") return Response.json({ error: "future" }, { status: 422 });
  return Response.json({ error: "server_error" }, { status: 500 });
}
