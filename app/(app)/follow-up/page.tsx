import Link from "next/link";
import { RouteStats } from "@/components/climbing/route-stats";
import { PageHeader } from "@/components/ui/card";
import { computeSnapshot } from "@/lib/analytics";
import { requireViewer } from "@/lib/auth/viewer";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { loadRouteAscents } from "@/lib/data/routes";
import { formatDate, formatRatio } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { adherence, localDate_ } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Follow-up" };

function Evidence({ kind, fr }: { kind: "observed" | "recorded" | "self"; fr: boolean }) {
  const label = {
    observed: fr ? "Observé · carnet de grimpe" : "Observed · climbing journal",
    recorded: fr ? "Enregistré · séances d’entraînement" : "Recorded · training sessions",
    self: fr ? "Déclaratif · bilans" : "Self-reported · assessments",
  }[kind];
  return <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-2">{label}</span>;
}
function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-2xl bg-surface-2 p-4">
    <p className="text-xs font-semibold text-ink-3">{label}</p>
    <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
    {hint ? <p className="mt-1 text-[11px] text-ink-3">{hint}</p> : null}
  </div>;
}

export default async function FollowUpHome() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const now = new Date();
  const [dataset, routes, training, { data: assessments }] = await Promise.all([
    loadClimbingDataset(viewer.supabase),
    loadRouteAscents(viewer.supabase),
    listTrainingSessions(viewer.supabase, 400),
    viewer.supabase.from("training_assessments").select("id, kind, created_at").order("created_at", { ascending: false }).limit(12),
  ]);
  const snap = computeSnapshot(dataset, { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system }, now, 30);
  const today = localDate_(now);
  const since = localDate_(new Date(now.getTime() - 56 * 86_400_000));
  const recent = (training ?? []).filter((s) => (s.scheduledDate ?? s.createdAt.slice(0, 10)) >= since);
  const adh = adherence(recent, today);
  const working = snap.workingGrade;

  return <div className="space-y-8">
    <PageHeader
      title={fr ? "Suivi" : "Follow-up"}
      subtitle={fr ? "Ce qui s’est réellement passé. Chaque chiffre indique sa source."
                   : "What actually happened. Every number shows where it comes from."}/>

    <section aria-labelledby="climb-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="climb-heading" className="text-xl font-extrabold">{fr ? "Bloc · 30 derniers jours" : "Bouldering · last 30 days"}</h2>
        <Evidence kind="observed" fr={fr} />
      </div>
      {snap.counts.sessions === 0 ? <p className="text-sm text-ink-2">
        {fr ? "Aucune séance de grimpe enregistrée sur cette période." : "No climbing sessions logged in this period."}{" "}
        <Link href="/session/new" className="font-bold text-accent underline">{fr ? "Commencer une séance" : "Start a session"}</Link>
      </p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={fr ? "Séances" : "Sessions"} value={String(snap.counts.sessions)} />
        <Tile label={fr ? "Essais" : "Attempts"} value={String(snap.counts.attempts)} />
        <Tile label={fr ? "Blocs réussis" : "Sends"} value={String(snap.counts.tops)} hint={`${snap.counts.flashes} flash`} />
        <Tile label={fr ? "Taux de réussite" : "Send rate"} value={formatRatio(snap.sendRate)} hint={fr ? `${snap.counts.problems} blocs essayés` : `${snap.counts.problems} problems tried`} />
      </div>}
      <p className="text-sm text-ink-2">
        <strong>{fr ? "Niveau de travail observé" : "Observed working grade"} :</strong>{" "}
        {working.level ? `${working.level} (${working.sampleSize} ${fr ? "blocs, 60 j" : "problems, 60 d"})` : (fr ? "données insuffisantes" : "insufficient data")}
      </p>
      <Link href="/progress" className="inline-block text-sm font-bold text-accent underline underline-offset-4">{fr ? "Tous mes résultats de grimpe" : "All my climbing results"} →</Link>
    </section>

    {routes ? <RouteStats locale={locale} ascents={routes} now={now} /> : null}

    <section aria-labelledby="train-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="train-heading" className="text-xl font-extrabold">{fr ? "Entraînement · 8 dernières semaines" : "Training · last 8 weeks"}</h2>
        <Evidence kind="recorded" fr={fr} />
      </div>
      {training === null ? <p role="alert" className="text-sm text-danger">{fr ? "Données d’entraînement indisponibles." : "Training data unavailable."}</p>
        : recent.length === 0 ? <p className="text-sm text-ink-2">
          {fr ? "Pas encore de séance d’entraînement. Le suivi de grimpe ci-dessus reste complet sans programme."
              : "No training sessions yet. Your climbing follow-up above is complete without a plan."}{" "}
          <Link href="/train" className="font-bold text-accent underline">{fr ? "Découvrir l’entraînement" : "Explore training"}</Link>
        </p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={fr ? "Réalisées / prévues" : "Completed / due"} value={`${adh.completed} / ${adh.planned}`}
            hint={adh.completionRate === null ? undefined : `${Math.round(adh.completionRate * 100)} %`} />
          <Tile label={fr ? "Temps actif" : "Active time"} value={`${adh.activeMinutes} min`} />
          <Tile label={fr ? "Effort perçu moyen" : "Average RPE"} value={adh.averageRpe === null ? "—" : `${adh.averageRpe} / 10`} />
          <Tile label={fr ? "À venir" : "Upcoming"} value={String(adh.upcoming)} hint={adh.painReports ? (fr ? `${adh.painReports} douleur(s) ≥ 3 signalée(s)` : `${adh.painReports} pain report(s) ≥ 3`) : undefined} />
        </div>}
      <Link href="/follow-up/training" className="inline-block text-sm font-bold text-accent underline underline-offset-4">{fr ? "Historique d’entraînement" : "Training history"} →</Link>
    </section>

    <section aria-labelledby="assess-heading" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="assess-heading" className="text-xl font-extrabold">{fr ? "Bilans" : "Assessments"}</h2>
        <Evidence kind="self" fr={fr} />
      </div>
      {(assessments ?? []).length === 0 ? <p className="text-sm text-ink-2">{fr ? "Aucun bilan. C’est facultatif." : "No assessments. They are optional."}</p>
        : <p className="text-sm text-ink-2">
          {fr ? `${assessments!.length} bilan(s) · dernier le ` : `${assessments!.length} assessment(s) · latest on `}
          {formatDate(assessments![0].created_at, locale)}
        </p>}
      <Link href="/training-assessment" className="inline-block text-sm font-bold text-accent underline underline-offset-4">{fr ? "Comparer mes bilans" : "Compare my assessments"} →</Link>
      <p className="text-xs text-ink-3">{fr
        ? "Les scénarios d’évolution sont illustratifs et ne prédisent pas une cotation. Ils restent séparés des résultats observés."
        : "Progress scenarios are illustrative and do not predict a grade. They stay separate from observed results."}</p>
    </section>
  </div>;
}
