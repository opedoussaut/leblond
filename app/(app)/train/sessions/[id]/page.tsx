import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionLifecycleActions } from "@/components/training/session-actions";
import { SessionSummary } from "@/components/training/session-summary";
import { TrainingPlayer } from "@/components/training/training-player";
import { EditTrainingForm } from "@/components/training/training-free-forms";
import { utcToZoned } from "@/lib/time";
import { localDate_ } from "@/lib/training/sessions";
import { requireViewer } from "@/lib/auth/viewer";
import { loadTrainingSession } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { pick } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Training session" };

/** Climbing sessions from the last 48 h that a finished workout may be linked to. */
async function recentClimbs(supabase: Awaited<ReturnType<typeof requireViewer>>["supabase"]) {
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { data } = await supabase.from("sessions").select("id, started_at, gyms(name)")
    .gte("started_at", since).order("started_at", { ascending: false }).limit(5);
  return data ?? [];
}

export default async function TrainingSessionPage({ params }: PageProps<"/train/sessions/[id]">) {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = trainingSessionDictionary(locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const loaded = await loadTrainingSession(viewer.supabase, id);
  if (!loaded) notFound();
  const { session, exercises } = loaded;

  const running = session.status === "IN_PROGRESS";
  const finished = session.status === "COMPLETED" || session.status === "INTERRUPTED";
  const climbs = running ? await recentClimbs(viewer.supabase) : [];

  return <div className="space-y-6">
    <Link href="/train/sessions" className="text-sm font-bold text-accent underline underline-offset-4">← {t.backToList}</Link>
    <header>
      <p className="leblond-eyebrow text-accent">{t.status[session.status]}
        {session.scheduledDate ? " · " + formatDate(session.scheduledDate + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" }) : ""}
        {session.scheduledTime ? " · " + session.scheduledTime : ""}</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">{session.title}</h1>
      {session.objective ? <p className="mt-2 text-sm text-ink-2"><strong>{t.objective} :</strong> {session.objective}</p> : null}
      <p className="mt-1 text-xs text-ink-3">
        {session.plannedMinutes ? `${t.planned} : ${session.plannedMinutes} ${t.minutesShort}` : ""}
        {session.planId ? ` · ${t.source} : ${t.fromPlan}` : session.calendarEntryId ? ` · ${t.source} : ${t.fromCalendar}` : ""}
      </p>
    </header>

    {running ? <TrainingPlayer locale={locale} session={session} exercises={exercises}
      climbs={climbs.map((c) => ({ id: c.id, label: `${c.gyms?.name ?? "Session"} · ${formatDate(c.started_at, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` }))} /> : null}

    {finished ? <SessionSummary locale={locale} session={session} exercises={exercises} /> : null}

    {!running && !finished ? <section aria-labelledby="exercise-list" className="space-y-3">
      <h2 id="exercise-list" className="text-lg font-black">{t.exercises}</h2>
      <ol className="space-y-3">
        {exercises.map((e, i) => <li key={e.id} className="leblond-premium-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{i + 1} · {t.block[e.block]}</p>
          <h3 className="mt-1 text-base font-extrabold">{e.name}</h3>
          <p className="mt-1 text-sm font-semibold text-ink">
            {[e.targetSets ? `${e.targetSets} ${e.targetSets > 1 ? t.sets : t.set.toLowerCase()}` : null, e.targetReps ? `${e.targetReps} ${t.reps}` : null,
              e.targetSeconds ? (e.modality === "TIME" || e.modality === "FREE" ? `${Math.round(e.targetSeconds / 60)} ${t.minutesShort}` : `${e.targetSeconds} ${t.seconds}`) : null,
              e.restSeconds ? `${t.rest} ${e.restSeconds} ${t.seconds}` : null].filter(Boolean).join(" · ")}
          </p>
          {e.instructions.summary ? <p className="mt-1 text-sm text-ink-2">{pick(e.instructions.summary, locale)}</p> : null}
          {e.instructions.safety ? <p className="mt-2 text-xs text-ink-2"><strong>{t.safety} :</strong> {pick(e.instructions.safety, locale)}</p> : null}
          {e.methodId ? <Link href={"/atlas/" + e.methodId} className="mt-2 inline-block text-xs font-bold text-accent underline underline-offset-4">{t.atlasSheet} ↗</Link> : null}
        </li>)}
      </ol>
    </section> : null}

    {!running && session.status !== "COMPLETED" ? <SessionLifecycleActions locale={locale} id={session.id} status={session.status} /> : null}
    {!running ? <EditTrainingForm locale={locale} today={localDate_(new Date())} session={{
      id: session.id, title: session.title,
      ...(session.startedAt ? utcToZoned(session.startedAt) : { date: session.scheduledDate ?? localDate_(new Date()), time: session.scheduledTime ?? "18:00" }),
      minutes: session.actualMinutes ?? session.plannedMinutes ?? 60,
      rpe: session.rpe, pain: session.pain, notes: session.notes,
    }} /> : null}
    <p className="text-xs text-ink-3">{t.safetyNote}</p>
  </div>;
}
