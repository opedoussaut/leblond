import Link from "next/link";
import { Info } from "lucide-react";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { AssessmentWorkspace } from "@/components/training/assessment-workspace";
import { PageHeader } from "@/components/ui/card";
import { computeSnapshot, routeWorkingGrade } from "@/lib/analytics";
import { requireViewer } from "@/lib/auth/viewer";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { loadFontView } from "@/lib/data/font-view";
import { fontTarget } from "@/lib/analytics/font-view";
import { boulderGrade } from "@/lib/grading/display";
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



export async function TrainingAssessmentView({ backHref, startInForm = false }: { backHref: "/programmes" | "/follow-up"; startInForm?: boolean }) {
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

  // Boulders are read on Font, as everywhere in Progrès (#217): gym colours and
  // levels are converted, so the observed level and its history are one grade.
  const fv = await loadFontView(viewer.supabase, dataset);
  const fd = fv.dataset;
  const target = fontTarget({ grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system }, fv.table);
  const snapshot = computeSnapshot(fd, target, new Date(), 60);
  const recent = computeSnapshot(fd, target, new Date(), 28);
  const observed = observedEvidence({
    sessions28d: recent.counts.sessions, problems28d: recent.counts.problems,
    sends28d: recent.counts.tops, flashes28d: recent.counts.flashes,
    workingGrade: snapshot.workingGrade.level ? boulderGrade(snapshot.workingGrade.level) : null, workingSample: snapshot.workingGrade.sampleSize,
  });
  const routeWorking = routeWorkingGrade(routes ?? [], new Date());
  // The observed level is a level sent regularly (lib/analytics/working-grade.ts), never one good day.
  const atLevel = snapshot.workingGrade.levels.find((l) => l.grade === snapshot.workingGrade.level);
  const boulderObserved = snapshot.workingGrade.level
    ? { level: boulderGrade(snapshot.workingGrade.level), sample: snapshot.workingGrade.sampleSize,
      regular: atLevel ? { sends: atLevel.sends, tried: atLevel.problems } : null }
    : { level: null, sample: 0, regular: null };
  // Boulder and route levels stay side by side: one is never converted into the other.
  const discipline = viewer.profile.target_discipline;
  const levels = {
    boulder: {
      declared: viewer.profile.self_reported_level ? boulderGrade(viewer.profile.self_reported_level) : null,
      observed: boulderObserved.level, sample: boulderObserved.sample, regular: boulderObserved.regular,
      target: discipline === "ROUTE" ? null : boulderGrade(target.grade),
    },
    route: {
      declared: viewer.profile.self_reported_route_grade, observed: routeWorking.grade, sample: routeWorking.sampleSize,
      target: discipline === "BOULDER" ? null : viewer.profile.target_route_grade,
    },
  };

  const history = Object.fromEntries(saved.map(item => [item.id,
    workingGradeHistory(fd, target.system, item.createdAt, item.horizonWeeks, new Date()),
  ]));
  const targetOrdinal = gradeToScore(target.system, target.grade);

  return (
    <div className="pb-12">
      <div className="flex flex-wrap justify-between gap-3">
        <Link href={backHref === "/programmes" ? "/programmes?tab=checks" : backHref} className={cn(linkClass, "text-sm")}><IconBack /> {backHref === "/programmes" ? "Programmes" : (locale === "fr" ? "Progrès" : "Progress")}</Link>
        <Link href="/progress" className={cn(linkClass, "text-sm")}>{locale==="fr"?"Mes résultats":"My results"} <IconNext /></Link>
      </div>
      <div className="mt-6">
        <PageHeader icon={<PAGE_ICONS.assessment />} title={doing ? j.hub.fullTitle
          : (locale === "fr" ? "Évaluations et évolution" : "Assessments and progress")}
          subtitle={doing ? j.full.intro : a.subtitle} />
      </div>
      {doing ? <Link href="/train/today" className={cn(linkClass, "mt-2 text-sm")}>{j.hub.dayTitle} · {j.hub.dayBadge} <IconNext /></Link> : null}
      {viewer.profile.target_discipline !== "BOULDER" ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-2">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={2.25} />
          {viewer.profile.target_discipline === "BOTH"
            ? a.routeTargetNoteBoth
            : a.routeTargetNote}
        </p>
      ) : null}
      {assessmentError || checkinsError
        ? <p role="alert" className="mt-6 rounded-xl border border-warn p-4 text-sm">{a.savedAccess} — database migration may be missing.</p>
        : <AssessmentWorkspace locale={locale} startInForm={startInForm} initialAssessments={saved} initialCheckins={entries}
          levels={levels} gradeHistory={history} gradeSystem={target.system}
          today={localDate_(new Date())} observedEvidence={observed}
          defaults={{ discipline: viewer.profile.target_discipline === "ROUTE" || viewer.profile.target_discipline === "BOTH" ? viewer.profile.target_discipline : "BOULDER",
            sessionsPerWeekNow: Math.round(recent.counts.sessions / 4) }}
          gradeTarget={viewer.profile.target_discipline === "ROUTE" || targetOrdinal === null
            ? null : { grade: boulderGrade(target.grade), ordinal: targetOrdinal }}/>}
    </div>
  );
}
