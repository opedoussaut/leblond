import { notFound } from "next/navigation";
import type { StyleTag, WallAngle } from "@/lib/climbing/types";
import { requireViewer } from "@/lib/auth/viewer";
import { loadSessionView, tagSlugs } from "@/lib/data/session";
import { LiveSession } from "./live-session";
import { SessionSummaryView } from "./summary";

export default async function SessionPage({ params }: PageProps<"/session/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const view = await loadSessionView(viewer.supabase, id);
  if (!view) notFound();

  if (!view.session.ended_at) {
    return (
      <LiveSession
        sessionId={view.session.id}
        userId={viewer.userId}
        gym={{ id: view.gym.id, name: view.gym.name, system: view.gym.grading_system }}
        startedAt={view.session.started_at}
        initialProblems={view.problems.map((p) => ({
          id: p.id,
          native_grade: p.native_grade,
          wall_angle: p.wall_angle as WallAngle,
          tags: tagSlugs(p) as StyleTag[],
          created_at: p.created_at,
          name: p.name,
        }))}
        initialAttempts={view.attempts}
        projectProblemIds={view.activeProjectProblemIds}
      />
    );
  }
  return <SessionSummaryView viewer={viewer} view={view} />;
}
