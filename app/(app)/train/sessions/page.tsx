import Link from "next/link";
import { QuickSessionForm } from "@/components/training/session-actions";
import { PastTrainingForm } from "@/components/training/training-free-forms";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { localDate_, type TrainingSession } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Training sessions" };

export default async function TrainingSessionsPage({ searchParams }: PageProps<"/train/sessions">) {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = trainingSessionDictionary(locale);
  const sp = await searchParams;
  const presetMethod = typeof sp.method === "string" && METHODS_FOR_PLANS.some((m) => m.id === sp.method) ? sp.method : "";
  const sessions = await listTrainingSessions(viewer.supabase);
  const today = localDate_(new Date());
  const all = sessions ?? [];
  const live = all.filter((s) => s.status === "IN_PROGRESS" || s.status === "INTERRUPTED");
  const upcoming = all.filter((s) => s.status === "PLANNED")
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "") || (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
  const done = all.filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED" || s.status === "CANCELED").slice(0, 20);

  const row = (s: TrainingSession, cta: string) => <li key={s.id}>
    <Link href={"/train/sessions/" + s.id}
      className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent">
      <span className="min-w-0">
        <strong className="block truncate">{s.title}</strong>
        <span className="text-xs text-ink-2">
          {t.status[s.status]}
          {s.scheduledDate ? " · " + formatDate(s.scheduledDate + "T12:00:00", locale, { weekday: "short", day: "numeric", month: "short" }) : ""}
          {s.scheduledTime ? " · " + s.scheduledTime : ""}
          {s.status === "COMPLETED" && s.actualMinutes !== null ? ` · ${s.actualMinutes} ${t.minutesShort}` : s.plannedMinutes ? ` · ${s.plannedMinutes} ${t.minutesShort}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-accent">{cta} →</span>
    </Link>
  </li>;

  return <div className="space-y-7">
    <PageHeader title={t.listTitle} subtitle={t.listSubtitle} />
    {sessions === null ? <p role="alert" className="rounded-xl border border-warn p-4 text-sm">{t.error}</p> : null}

    {live.length ? <section aria-labelledby="live-heading" className="space-y-3">
      <h2 id="live-heading" className="text-lg font-extrabold">{t.inProgress}</h2>
      <ul className="space-y-2">{live.map((s) => row(s, t.resume))}</ul>
    </section> : null}

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="new-heading" className="leblond-premium-surface p-5 sm:p-6">
        <h2 id="new-heading" className="text-xl font-extrabold">{t.newSession}</h2>
        <p className="mt-1 text-sm text-ink-2">{t.newSessionHint}</p>
        <div className="mt-4"><QuickSessionForm locale={locale} today={today} presetMethod={presetMethod} /></div>
        <details className="mt-6 border-t border-line pt-4">
          <summary className="min-h-10 cursor-pointer text-base font-extrabold text-accent">+ {t.pastTitle}</summary>
          <p className="mt-1 text-sm text-ink-2">{t.pastHint}</p>
          <div className="mt-4"><PastTrainingForm locale={locale} today={today} /></div>
        </details>
      </section>
      <div className="space-y-6">
        <section aria-labelledby="upcoming-heading" className="space-y-3">
          <h2 id="upcoming-heading" className="text-lg font-extrabold">{t.upcoming}</h2>
          {upcoming.length ? <ul className="space-y-2">{upcoming.slice(0, 12).map((s) => row(s, t.open))}</ul>
            : <p className="text-sm text-ink-3">{t.nothingUpcoming}</p>}
        </section>
        <section aria-labelledby="done-heading" className="space-y-3">
          <h2 id="done-heading" className="text-lg font-extrabold">{t.history}</h2>
          {done.length ? <ul className="space-y-2">{done.map((s) => row(s, t.review))}</ul>
            : <p className="text-sm text-ink-3">{t.nothingDone}</p>}
        </section>
      </div>
    </div>
  </div>;
}
