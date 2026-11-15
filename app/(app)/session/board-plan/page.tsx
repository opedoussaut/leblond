import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { formatForMethod } from "@/lib/analytics/board-plan";
import { AVATAR_LEVELS, BOULDER_INDOOR_RULES } from "@/lib/analytics/avatar";
import { requireViewer } from "@/lib/auth/viewer";
import { BOARDS, DEFAULT_ANGLE, type Board } from "@/lib/climbing/boards";
import { loadAvatar } from "@/lib/data/avatar";
import { loadBoardAscents, loadBoardProjects } from "@/lib/data/boards";
import { loadProgramme } from "@/lib/data/programme";
import { avatarDictionary } from "@/lib/i18n/avatar";
import { boardsDictionary } from "@/lib/i18n/boards";
import { getI18n } from "@/lib/i18n/server";
import { BoardPlanner, type PlannerClimb } from "./board-planner";

export const metadata = { title: "Séance board guidée" };

/**
 * A board séance prepared for the climber: the target grade comes from the
 * avatar's boulder pillar, the format from today's programme séance, and the
 * named climbs from their own board log (computed in lib/analytics/board-plan).
 */
export default async function BoardPlanPage() {
  const viewer = await requireViewer();
  const [{ locale }, ascents, projects, programme] = await Promise.all([
    getI18n(viewer.profile.preferred_language),
    loadBoardAscents(viewer.supabase),
    loadBoardProjects(viewer.supabase, "ACTIVE"),
    loadProgramme(viewer.supabase),
  ]);
  const avatar = await loadAvatar(viewer.supabase, { boardRows: ascents });
  const b = boardsDictionary(locale);
  const av = avatarDictionary(locale);

  // Boards are indoor climbing: they feed the indoor boulder pillar.
  const boulder = avatar.pillars.boulderIndoor;
  const next = boulder.kind === "climb" ? boulder.next : null;
  const target = next?.rule.grade ?? BOULDER_INDOOR_RULES.at(-1)!.grade;
  const avatarLine = next
    ? { colour: av.colour[AVATAR_LEVELS[next.level]!], climbs: Math.min(next.have.climbs, next.rule.climbs), needClimbs: next.rule.climbs,
      sessions: Math.min(next.have.sessions, next.rule.sessions), needSessions: next.rule.sessions }
    : null;

  // Font climbs only (the avatar's scale), the latest ones; enough to name climbs at each grade.
  const font = ascents.filter((r) => r.grade_scale === "FONT").slice(-2000);
  const climbs: PlannerClimb[] = font.map((r) => ({
    board: r.board, angle: r.angle, key: r.climb_key, name: r.climb_name, grade: r.grade, result: r.result, tries: r.tries, at: r.climbed_at,
  }));
  const last = ascents.at(-1);
  const initialBoard: Board = last && (BOARDS as readonly string[]).includes(last.board) ? last.board as Board : "KILTER";
  const today = programme.scheduledToday ?? null;
  const methodId = today?.methodId ?? programme.todayCheck?.methodId ?? null;
  const format = formatForMethod(methodId);

  return <div className="space-y-6">
    <PageHeader icon={<PAGE_ICONS.newSession />} title={b.plan.title} subtitle={b.plan.intro} />
    <BoardPlanner
      climbs={climbs}
      projects={projects.map((p) => ({ board: p.board, angle: p.angle, climbName: p.climb_name, climbKey: p.climb_key, grade: p.grade, gradeScale: p.grade_scale }))}
      target={target} avatarLine={avatarLine}
      initialBoard={initialBoard} initialAngle={last?.angle ?? DEFAULT_ANGLE}
      initialMinutes={today?.minutes ?? 90} initialFormat={format}
      programmeTitle={format !== "progress" && today ? today.title : null} />
  </div>;
}
