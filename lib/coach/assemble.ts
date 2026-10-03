import "server-only";
import { computeProblemOutcomes, computeSnapshot, countActivity, summarizeSession } from "@/lib/analytics";
import type { Viewer } from "@/lib/auth/viewer";
import { isSend } from "@/lib/climbing/types";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { resolveNormalized } from "@/lib/grading";
import { buildCoachContext, type QuickAction, type RecentSessionInput } from "./context";

/**
 * Loads the climber's data (RLS-scoped to the viewer), runs the analytics
 * engine and assembles Patrick's bounded context.
 */
export async function assembleCoachContext(
  viewer: Viewer,
  opts: { sessionId?: string | null; projectId?: string | null; quickAction?: QuickAction | null },
) {
  const now = new Date();
  const data = await loadClimbingDataset(viewer.supabase);
  const target = { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system };
  const snapshot30 = computeSnapshot(data, target, now, 30);
  const snapshot90 = computeSnapshot(data, target, now, 90);
  const gymById = new Map(data.gyms.map((g) => [g.id, g]));
  const problemById = new Map(data.problems.map((p) => [p.id, p]));

  const { data: sessionRows } = await viewer.supabase
    .from("sessions")
    .select("id, started_at, ended_at, gym_id, duration_minutes, perceived_energy_before, perceived_energy_after, fatigue, motivation, notes")
    .order("started_at", { ascending: false })
    .limit(8);

  const recentSessions: RecentSessionInput[] = (sessionRows ?? []).map((s) => {
    const fact = data.sessions.find((x) => x.id === s.id);
    const c = countActivity(data.attempts.filter((a) => a.sessionId === s.id));
    const g = gymById.get(s.gym_id);
    return {
      id: s.id,
      startedAt: s.started_at,
      gymName: g?.name ?? "",
      gymBrand: g?.brand ?? "OTHER",
      durationMinutes: s.duration_minutes,
      ...c,
      energyBefore: s.perceived_energy_before,
      energyAfter: s.perceived_energy_after,
      fatigue: s.fatigue,
      motivation: s.motivation,
      wearable: fact?.wearable
        ? {
            avgHeartRate: fact.wearable.avgHeartRate,
            maxHeartRate: fact.wearable.maxHeartRate,
            trainingLoad: fact.wearable.trainingLoad,
            device: fact.wearable.deviceName,
          }
        : null,
    };
  });

  // Focus session: explicitly requested, or the last completed one for "analyse my last session".
  let focusSessionId = opts.sessionId ?? null;
  if (!focusSessionId && opts.quickAction === "lastSession") {
    focusSessionId = data.sessions.filter((s) => s.endedAt).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]?.id ?? null;
  }
  const focus = focusSessionId ? data.sessions.find((s) => s.id === focusSessionId) : undefined;
  const focusRow = sessionRows?.find((s) => s.id === focusSessionId);
  const focusSession = focus
    ? (() => {
        const sessionAttempts = data.attempts.filter((a) => a.sessionId === focus.id);
        const outcomes = computeProblemOutcomes(sessionAttempts);
        const gym = gymById.get(focus.gymId);
        return {
          id: focus.id,
          gymName: gym?.name ?? "",
          gymBrand: gym?.brand ?? "OTHER",
          startedAt: focus.startedAt.toISOString(),
          ended: focus.endedAt !== null,
          notes: focusRow?.notes ?? null,
          summary: summarizeSession(focus, data.problems, data.attempts),
          problems: [...outcomes.values()].map((o) => {
            const p = problemById.get(o.problemId)!;
            const est = resolveNormalized(p);
            return {
              grade: p.nativeGrade,
              system: p.nativeGradeSystem,
              fontEstimate: est && p.nativeGradeSystem !== "FONT" ? { grade: est.grade, confidence: est.confidence } : null,
              wallAngle: p.wallAngle,
              styles: p.tags,
              attemptsThisSession: o.attempts,
              result: o.flashed ? ("FLASH" as const) : o.sent ? ("TOP" as const) : ("NOT_SENT" as const),
              totalAttemptsEver: data.attempts.filter((a) => a.problemId === p.id).length,
            };
          }),
        };
      })()
    : null;

  const { data: projects } = await viewer.supabase
    .from("projects")
    .select("id, status, started_at, notes, problem_id")
    .order("started_at", { ascending: false });
  const activeProjects = (projects ?? [])
    .filter((p) => p.status === "ACTIVE")
    .map((p) => {
      const pr = problemById.get(p.problem_id);
      return {
        grade: pr?.nativeGrade ?? "",
        system: pr?.nativeGradeSystem ?? "UNKNOWN",
        attempts: data.attempts.filter((a) => a.problemId === p.problem_id).length,
        gymName: (pr && gymById.get(pr.gymId)?.name) ?? "",
      };
    });

  let projectId = opts.projectId ?? null;
  if (!projectId && opts.quickAction === "project") projectId = projects?.find((p) => p.status === "ACTIVE")?.id ?? null;
  const project = projectId ? projects?.find((p) => p.id === projectId) : undefined;
  let focusProject = null;
  if (project) {
    const pr = problemById.get(project.problem_id);
    const pa = data.attempts.filter((a) => a.problemId === project.problem_id).sort((a, b) => a.attemptNumber - b.attemptNumber);
    const { count: videos } = await viewer.supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("problem_id", project.problem_id)
      .neq("media_type", "PROBLEM_PHOTO");
    if (pr) {
      focusProject = {
        status: project.status,
        startedAt: project.started_at,
        notes: project.notes,
        grade: pr.nativeGrade,
        system: pr.nativeGradeSystem,
        gymName: gymById.get(pr.gymId)?.name ?? "",
        wallAngle: pr.wallAngle,
        styles: pr.tags,
        attempts: pa.map((a) => ({ n: a.attemptNumber, result: isSend(a.result) ? a.result : "ATTEMPT", date: a.createdAt.toISOString().slice(0, 10) })),
        sessionsCount: new Set(pa.map((a) => a.sessionId)).size,
        videos: videos ?? 0,
      };
    }
  }

  return buildCoachContext({
    climber: {
      name: viewer.profile.display_name,
      language: viewer.profile.preferred_language === "en" ? "en" : "fr",
      target,
    },
    snapshot30,
    snapshot90,
    recentSessions,
    focusSession,
    focusProject,
    activeProjects,
    quickAction: opts.quickAction ?? null,
    now,
  });
}
