import Link from "next/link";
import { PactControls, SignPactForm } from "@/components/training/alter-ego-forms";
import { AlterEgoScore } from "@/components/training/alter-ego-score";
import { PageHeader } from "@/components/ui/card";
import { computeSnapshot, routeWorkingGrade } from "@/lib/analytics";
import { pactProgress } from "@/lib/analytics/alter-ego";
import { requireViewer } from "@/lib/auth/viewer";
import { loadClimberWork, loadOpenRival } from "@/lib/data/alter-ego";
import { RivalFeed } from "@/components/training/rival-feed";
import { RivalSettingsForm } from "@/components/training/rival-settings";
import { rivalBoulderGrade, rivalFeed, rivalStanding, weeklyDuels } from "@/lib/analytics/rival";
import { BOARD_NAMES, BOARD_SHORT, type Board } from "@/lib/climbing/boards";
import { loadBoardAscents, loadBoardProjects } from "@/lib/data/boards";
import { addDays } from "@/lib/training/programme";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { loadRouteAscents } from "@/lib/data/routes";
import { formatDate } from "@/lib/format";
import { listGrades } from "@/lib/grading/ordering";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { fmt } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";
import { getI18n } from "@/lib/i18n/server";
import { localDate_ } from "@/lib/training/sessions";
import { IconBack } from "@/components/ui/icons";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "LEBLOND — Alter ego" };

export default async function AlterEgoPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = alterEgoDictionary(locale);
  const today = localDate_(new Date());
  const rival = await loadOpenRival(viewer.supabase);
  const pact = rival?.pact ?? null;
  const back = <Link href="/programmes" className={cn(linkClass, "text-sm")}><IconBack /> Programmes</Link>;

  if (!pact) {
    const { data: plans } = await viewer.supabase.from("training_plans").select("id, name, weeks").order("updated_at", { ascending: false });
    const p = viewer.profile;
    const boulderGrades = listGrades("FONT").filter((g) => g.ordinal !== null).map((g) => g.id);
    const known = (grades: readonly string[], grade: string | null) => (grade && grades.includes(grade) ? grade : "");
    return <div className="space-y-5">
      {back}
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <SignPactForm locale={locale} plans={plans ?? []} today={today} boulderGrades={boulderGrades} routeGrades={FRENCH_ROUTE_GRADES}
        defaults={{
          boulderFrom: p.self_reported_level_system === "FONT" ? known(boulderGrades, p.self_reported_level) : "",
          boulderTo: p.target_grade_system === "FONT" ? known(boulderGrades, p.target_grade) : "",
          routeFrom: known(FRENCH_ROUTE_GRADES, p.self_reported_route_grade),
          routeTo: known(FRENCH_ROUTE_GRADES, p.target_route_grade),
        }} />
      <p className="text-xs leading-relaxed text-ink-3">{t.fiction}</p>
    </div>;
  }

  const now = new Date();
  const settings = rival!.settings;
  const [work, dataset, routes, boardRows, boardProjects, { data: boulderProjects }, { data: routeProjects }] = await Promise.all([
    loadClimberWork(viewer.supabase), loadClimbingDataset(viewer.supabase), loadRouteAscents(viewer.supabase),
    loadBoardAscents(viewer.supabase, 500), loadBoardProjects(viewer.supabase, "ACTIVE"),
    viewer.supabase.from("projects").select("problems(name, native_grade)").eq("status", "ACTIVE").limit(20),
    viewer.supabase.from("route_projects").select("route_name").eq("status", "ACTIVE").limit(20),
  ]);
  const base = pactProgress(pact, work, today);
  // The score at the rival's level (À ta portée never runs away).
  const progress = { ...base, standing: rivalStanding(pact, settings, work, today) };
  const lastBoard = boardRows[boardRows.length - 1];
  const projects = [
    ...(boulderProjects ?? []).map((p) => p.problems?.name || p.problems?.native_grade || "").filter(Boolean),
    ...(routeProjects ?? []).map((p) => p.route_name),
    ...boardProjects.map((p) => `${p.climb_name} (${BOARD_SHORT[p.board as Board]} ${p.angle}°)`),
  ];
  const weekdays = Array.from({ length: 7 }, (_, i) => formatDate(`2026-11-${String(16 + i).padStart(2, "0")}T12:00:00`, locale, { weekday: "long" }));
  const feed = rivalFeed({ pact, settings, work, today, projects, weekdays,
    board: lastBoard ? { name: BOARD_NAMES[lastBoard.board as Board], angle: lastBoard.angle } : null });
  const duels = weeklyDuels(pact, settings, work, today);
  const lastGym = dataset.sessions.length ? dataset.gyms.find((g) => g.id === dataset.sessions[dataset.sessions.length - 1]?.gymId)?.name ?? null : null;
  const snapshot = computeSnapshot(dataset, { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system }, now, 60);

  return <div className="space-y-5">
    {back}
    <PageHeader title={t.title} subtitle={fmt(t.planLabel, { plan: pact.planName })} />
    <RivalFeed locale={locale} name={pact.displayName} settings={settings} grade={rivalBoulderGrade(pact, settings, today)}
      gym={lastGym} feed={feed} duels={duels} today={today} yesterday={addDays(today, -1)} />
    <AlterEgoScore locale={locale} pact={pact} progress={progress}
      observed={{ boulder: snapshot.workingGrade.level, route: routeWorkingGrade(routes ?? [], now).grade }} />
    {progress.next ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
      {fmt(t.next, { name: pact.displayName, date: formatDate(progress.next.date + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" }) })}
    </p> : null}
    <p className="text-sm font-semibold text-ink-2">{t.gapNote}</p>
    <RivalSettingsForm locale={locale} pactId={pact.id} initial={settings} today={today}
      hasBoulderGrades={!!pact.startBoulderGrade && !!pact.targetBoulderGrade} />
    <PactControls locale={locale} id={pact.id} status={pact.status} over={progress.over} />
    <p className="text-xs leading-relaxed text-ink-3">
      {fmt(t.trained, { gain: Math.round(pact.progression.maxGain * 100) })} {t.fiction}
    </p>
  </div>;
}
