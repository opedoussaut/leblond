import Link from "next/link";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { AssessmentWorkspace } from "@/components/training/assessment-workspace";
import { PageHeader } from "@/components/ui/card";
import { computeSnapshot, routeWorkingGrade } from "@/lib/analytics";
import { requireViewer } from "@/lib/auth/viewer";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { loadRouteAscents } from "@/lib/data/routes";
import { getI18n } from "@/lib/i18n/server";
import { assessmentDictionary } from "@/lib/i18n/assessment";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { MAX_ASSESSMENTS, skillRatingsSchema, type SavedAssessment, type SavedCheckin } from "@/lib/training/assessment";
import { workingGradeHistory } from "@/lib/training/grade-history";
import { gradeToScore } from "@/lib/grading";
import { observedEvidence } from "@/lib/training/assessment-protocol";
import { localDate_ } from "@/lib/training/sessions";
import { IconBack, IconNext } from "@/components/ui/icons";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";



export async function TrainingAssessmentView({ backHref }: { backHref: "/programmes" | "/follow-up" }) {
  const doing = backHref === "/programmes";
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const a = assessmentDictionary(locale);
  const j = journeyDictionary(locale);

  const [{ data: assessments, error: assessmentError }, { data: checkins, error: checkinsError }, dataset, routes] = await Promise.all([
    viewer.supabase.from("training_assessments")
      .select("id, method_id, ratings, horizon_weeks, sessions_per_week, goal, kind, measurements, context, created_at")
      .order("created_at", { ascending: false }).limit(MAX_ASSESSMENTS),
    viewer.supabase.from("training_checkins")
      .select("id, assessment_id, week, ratings, notes, created_at")
      .order("week", { ascending: true }).limit(1000),
    loadClimbingDataset(viewer.supabase),
    loadRouteAscents(viewer.supabase),
  ]);

  const saved: SavedAssessment[] = (assessments ?? []).flatMap(record => {
    const validated = skillRatingsSchema.safeParse(record.ratings);
    if (!validated.success) return [];
    return [{
      id: record.id,
      methodId: record.method_id,
      ratings: validated.data,
      horizonWeeks: record.horizon_weeks,
      sessionsPerWeek: record.sessions_per_week,
      goal: record.goal,
      kind: record.kind === "SELF" ? undefined : record.kind,
      measurements: record.measurements as SavedAssessment["measurements"],
      context: record.context as SavedAssessment["context"],
      createdAt: record.created_at,
    }];
  });
  const entries: SavedCheckin[] = (checkins ?? []).flatMap(record => {
    const validated = skillRatingsSchema.safeParse(record.ratings);
    if (!validated.success) return [];
    return [{
      id: record.id, assessmentId: record.assessment_id,
      week: record.week, ratings: validated.data,
      notes: record.notes, createdAt: record.created_at,
    }];
  });

  const snapshot = computeSnapshot(dataset, {
    grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system,
  }, new Date(), 60);
  const working = snapshot.roadToTarget.workingLevel;
  const recent = computeSnapshot(dataset, { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system }, new Date(), 28);
  const observed = observedEvidence({
    sessions28d: recent.counts.sessions, problems28d: recent.counts.problems,
    sends28d: recent.counts.tops, flashes28d: recent.counts.flashes,
    workingGrade: snapshot.workingGrade.level, workingSample: snapshot.workingGrade.sampleSize,
  });
  const routeWorking = routeWorkingGrade(routes ?? [], new Date());
  const boulderObserved = working.level
    ? { level: working.level + " · " + working.system, sample: working.sampleSize }
    : snapshot.workingGrade.level
      ? { level: snapshot.workingGrade.level + " · " + a.levelFontEstimate, sample: snapshot.workingGrade.sampleSize }
      : { level: null, sample: 0 };
  // Boulder and route levels stay side by side: one is never converted into the other.
  const discipline = viewer.profile.target_discipline;
  const levels = {
    boulder: {
      declared: viewer.profile.self_reported_level, observed: boulderObserved.level, sample: boulderObserved.sample,
      target: discipline === "ROUTE" ? null : viewer.profile.target_grade,
    },
    route: {
      declared: viewer.profile.self_reported_route_grade, observed: routeWorking.grade, sample: routeWorking.sampleSize,
      target: discipline === "BOULDER" ? null : viewer.profile.target_route_grade,
    },
  };

  const history = Object.fromEntries(saved.map(item => [item.id,
    workingGradeHistory(dataset, viewer.profile.target_grade_system, item.createdAt, item.horizonWeeks, new Date()),
  ]));
  const targetOrdinal = gradeToScore(viewer.profile.target_grade_system, viewer.profile.target_grade);

  return (
    <div className="pb-12">
      <div className="flex flex-wrap justify-between gap-3">
        <Link href={backHref} className={cn(linkClass, "text-sm")}><IconBack /> {backHref === "/programmes" ? "Programmes" : (locale === "fr" ? "Progrès" : "Progress")}</Link>
        <Link href="/progress" className={cn(linkClass, "text-sm")}>{locale==="fr"?"Mes résultats":"My results"} <IconNext /></Link>
      </div>
      <div className="mt-6">
        <PageHeader icon={<PAGE_ICONS.assessment />} title={doing ? j.hub.fullTitle
          : (locale === "fr" ? "Évaluations et évolution" : "Assessments and progress")}
          subtitle={doing ? j.full.intro : a.subtitle} />
      </div>
      {doing ? <Link href="/train/today" className={cn(linkClass, "mt-2 text-sm")}>{j.hub.dayTitle} · {j.hub.dayBadge} <IconNext /></Link> : null}
      {viewer.profile.target_discipline !== "BOULDER" ? (
        <p className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm text-ink-2">
          {viewer.profile.target_discipline === "BOTH"
            ? a.routeTargetNoteBoth
            : a.routeTargetNote}
        </p>
      ) : null}
      {assessmentError || checkinsError
        ? <p role="alert" className="mt-6 rounded-xl border border-warn p-4 text-sm">{a.savedAccess} — database migration may be missing.</p>
        : <AssessmentWorkspace locale={locale} initialAssessments={saved} initialCheckins={entries}
          levels={levels} gradeHistory={history} gradeSystem={viewer.profile.target_grade_system}
          today={localDate_(new Date())} observedEvidence={observed}
          defaults={{ discipline: viewer.profile.target_discipline === "ROUTE" || viewer.profile.target_discipline === "BOTH" ? viewer.profile.target_discipline : "BOULDER",
            sessionsPerWeekNow: Math.round(recent.counts.sessions / 4) }}
          gradeTarget={viewer.profile.target_discipline === "ROUTE" || targetOrdinal === null
            ? null : { grade: viewer.profile.target_grade, ordinal: targetOrdinal }}/>}
    </div>
  );
}
