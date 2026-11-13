import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/viewer";
import { loadSessionView } from "@/lib/data/session";
import { getI18n } from "@/lib/i18n/server";
import { SessionSummaryView } from "./summary";
import { BoardSession, type KnownBoardClimb } from "./board-session";
import { climbHistory } from "@/lib/analytics/boards";
import { decodePlan } from "@/lib/analytics/board-plan";
import { DEFAULT_ANGLE, type Board } from "@/lib/climbing/boards";
import { loadBoardAscents, toBoardFact } from "@/lib/data/boards";
import { RouteSessionSummary } from "./route-summary";
import { SessionLogger, loadRouteAscents } from "./session-logger";

export default async function SessionPage({ params, searchParams }: PageProps<"/session/[id]">) {
  const { id } = await params;
  const planParam = (await searchParams).plan;
  const viewer = await requireViewer();
  const view = await loadSessionView(viewer.supabase, id);
  if (!view) notFound();

  if (view.session.discipline === "BOARD" && view.session.board) {
    const board = view.session.board as Board;
    const [all, { locale }] = await Promise.all([loadBoardAscents(viewer.supabase), getI18n(viewer.profile.preferred_language)]);
    const facts = all.filter((r) => r.board === board).map(toBoardFact);
    const here = all.filter((r) => r.session_id === view.session.id).reverse();
    // Each climb already tried on this board, at each angle, with its history (computed in lib/analytics).
    const seen = new Map<string, (typeof facts)[number]>();
    for (const f of facts) seen.set(f.climbKey + "|" + f.angle, f);
    const known: KnownBoardClimb[] = [...seen.values()].reverse().slice(0, 400).map((f) => {
      const h = climbHistory(facts, f);
      return { name: f.climbName, key: f.climbKey, angle: f.angle, grade: h.lastGrade ?? f.grade, scale: h.lastScale ?? f.gradeScale,
        tries: h.tries, sessions: h.sessions, sent: h.sent };
    });
    const lastScale = facts.length ? facts[facts.length - 1].gradeScale : locale === "en" ? "V" : "FONT";
    return <BoardSession sessionId={view.session.id} board={board} layout={view.session.board_layout}
      initialAngle={view.session.board_angle ?? DEFAULT_ANGLE} startedAt={view.session.started_at} ended={!!view.session.ended_at}
      initialAscents={here} known={known} defaultScale={lastScale}
      plan={view.session.ended_at ? null : decodePlan(typeof planParam === "string" ? planParam : null)} />;
  }

  if (!view.session.ended_at) return <SessionLogger viewer={viewer} view={view} mode="live" />;

  if (view.session.discipline === "ROUTE") {
    const { locale } = await getI18n(viewer.profile.preferred_language);
    const ascents = await loadRouteAscents(viewer, view.session.id);
    return <RouteSessionSummary locale={locale} session={view.session} gymName={view.gym.name} ascents={ascents} />;
  }
  return <SessionSummaryView viewer={viewer} view={view} />;
}
