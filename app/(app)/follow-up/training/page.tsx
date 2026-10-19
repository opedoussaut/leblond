import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { adherence, localDate_, mondayOf } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Training history" };

/** Retrospective training record: planned versus actually completed, week by week. */
export default async function TrainingHistoryPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const t = trainingSessionDictionary(locale);
  const sessions = await listTrainingSessions(viewer.supabase, 500) ?? [];
  const today = localDate_(new Date());
  const past = sessions.filter((s) => s.status !== "PLANNED" || (s.scheduledDate ?? today) < today)
    .filter((s) => s.status !== "IN_PROGRESS");

  const weeks = new Map<string, typeof sessions>();
  for (const s of past) {
    const key = mondayOf(s.scheduledDate ?? s.createdAt.slice(0, 10));
    weeks.set(key, [...(weeks.get(key) ?? []), s]);
  }
  const ordered = [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  const overall = adherence(past, today);

  return <div className="space-y-7">
    <PageHeader title={fr ? "Historique d’entraînement" : "Training history"}
      subtitle={fr ? "Séances prévues et réellement réalisées, avec leur contenu." : "Planned and actually completed sessions, with their content."} />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        [fr ? "Réalisées" : "Completed", String(overall.completed)],
        [fr ? "Non faites" : "Missed / skipped", String(overall.skipped)],
        [fr ? "Interrompues" : "Interrupted", String(overall.interrupted)],
        [fr ? "Temps actif total" : "Total active time", `${overall.activeMinutes} min`],
      ].map(([label, value]) => <div key={label} className="rounded-2xl bg-surface-2 p-4">
        <p className="text-xs font-semibold text-ink-3">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
      </div>)}
    </div>
    {ordered.length === 0 ? <p className="text-sm text-ink-2">{t.nothingDone}{" "}
      <Link href="/train/sessions" className="font-bold text-accent underline">{t.newSession}</Link></p> : null}
    {ordered.map(([monday, list]) => {
      const a = adherence(list, today);
      return <section key={monday} aria-label={monday} className="space-y-2">
        <h2 className="flex flex-wrap items-baseline justify-between gap-2 text-base font-extrabold">
          <span>{t.weekOf} {formatDate(monday + "T12:00:00", locale, { day: "numeric", month: "long" })}</span>
          <span className="text-sm font-semibold text-ink-2">{a.completed} / {a.planned} · {a.activeMinutes} min</span>
        </h2>
        <ul className="space-y-2">
          {list.map((s) => <li key={s.id}>
            <Link href={"/train/sessions/" + s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-accent">
              <span className="min-w-0"><strong className="block truncate">{s.title}</strong>
                <span className="text-xs text-ink-2">{t.status[s.status]}
                  {s.plannedMinutes ? ` · ${t.planned} ${s.plannedMinutes} min` : ""}
                  {s.actualMinutes !== null ? ` · ${t.actual} ${s.actualMinutes} min` : ""}
                  {s.rpe ? ` · RPE ${s.rpe}` : ""}{s.pain ? ` · ${t.painReported} ${s.pain}/10` : ""}</span></span>
              <span className="text-sm font-bold text-accent">→</span>
            </Link>
          </li>)}
        </ul>
      </section>;
    })}
  </div>;
}
