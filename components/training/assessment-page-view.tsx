import Link from "next/link";
import { AssessmentWorkspace } from "@/components/training/assessment-workspace";
import { computeSnapshot } from "@/lib/analytics";
import { requireViewer } from "@/lib/auth/viewer";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { getI18n } from "@/lib/i18n/server";
import { assessmentDictionary } from "@/lib/i18n/assessment";
import { skillRatingsSchema, type SavedAssessment, type SavedCheckin } from "@/lib/training/assessment";
import { workingGradeHistory } from "@/lib/training/grade-history";
import { gradeToScore } from "@/lib/grading";
import { observedEvidence } from "@/lib/training/assessment-protocol";
import { localDate_ } from "@/lib/training/sessions";



export async function TrainingAssessmentView({ backHref }: { backHref: "/train" | "/follow-up" }) {
  const doing = backHref === "/train";
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const a = assessmentDictionary(locale);

  const [{ data: assessments, error: assessmentError }, { data: checkins, error: checkinsError }, dataset] = await Promise.all([
    viewer.supabase.from("training_assessments")
      .select("id, method_id, ratings, horizon_weeks, sessions_per_week, goal, kind, measurements, context, created_at")
      .order("created_at", { ascending: false }).limit(12),
    viewer.supabase.from("training_checkins")
      .select("id, assessment_id, week, ratings, notes, created_at")
      .order("week", { ascending: true }).limit(300),
    loadClimbingDataset(viewer.supabase),
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
  const gradeObservation = working.level
    ? { label: String(working.system), level: working.level, sampleSize: working.sampleSize }
    : snapshot.workingGrade.level
      ? { label: "FONT (reliable estimates)", level: snapshot.workingGrade.level, sampleSize: snapshot.workingGrade.sampleSize }
      : null;

  const history = Object.fromEntries(saved.map(item => [item.id,
    workingGradeHistory(dataset, viewer.profile.target_grade_system, item.createdAt, item.horizonWeeks, new Date()),
  ]));
  const targetOrdinal = gradeToScore(viewer.profile.target_grade_system, viewer.profile.target_grade);

  return (
    <div className="pb-12">
      <div className="flex flex-wrap justify-between gap-3">
        <Link href={backHref} className="text-sm font-bold text-accent underline underline-offset-4">← {backHref === "/train" ? (locale === "fr" ? "Mon parcours" : "My training journey") : (locale === "fr" ? "Suivi" : "Follow-up")}</Link>
        <Link href="/progress" className="text-sm font-bold text-accent underline underline-offset-4">{locale==="fr"?"Mes résultats":"My results"} →</Link>
      </div>
      <h1 className="mt-6 text-3xl font-black tracking-tight">{doing
        ? (locale === "fr" ? "Bilan d’entraînement" : "Training assessment")
        : (locale === "fr" ? "Bilans et évolution" : "Assessments and progress")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{doing
        ? (locale === "fr" ? "Un protocole guidé et reproductible : préparation, tests sûrs, observations de ton carnet et auto-évaluation, puis priorités." : "A guided, repeatable protocol: preparation, safe tests, journal observations and self-evaluation, then priorities.")
        : a.subtitle}</p>
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
          gradeObservation={gradeObservation} gradeHistory={history} gradeSystem={viewer.profile.target_grade_system}
          today={localDate_(new Date())} observedEvidence={observed}
          defaults={{ discipline: viewer.profile.target_discipline === "ROUTE" || viewer.profile.target_discipline === "BOTH" ? viewer.profile.target_discipline : "BOULDER",
            sessionsPerWeekNow: Math.round(recent.counts.sessions / 4) }}
          gradeTarget={viewer.profile.target_discipline === "ROUTE" || targetOrdinal === null
            ? null : { grade: viewer.profile.target_grade, ordinal: targetOrdinal }}/>}
    </div>
  );
}
