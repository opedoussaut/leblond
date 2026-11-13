import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionLifecycleActions } from "@/components/training/session-actions";
import { SessionExport } from "@/components/training/session-export";
import { SessionSummary } from "@/components/training/session-summary";
import { TrainingPlayer } from "@/components/training/training-player";
import { EditTrainingForm } from "@/components/training/training-free-forms";
import { loadFactor, pactClock, pactWeek } from "@/lib/analytics/alter-ego";
import { loadOpenRival } from "@/lib/data/alter-ego";
import { loadAvatar } from "@/lib/data/avatar";
import { REACH_MARGIN } from "@/lib/analytics/rival";
import { utcToZoned } from "@/lib/time";
import { localDate_ } from "@/lib/training/sessions";
import { requireViewer } from "@/lib/auth/viewer";
import { loadTrainingSession } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { demoUrl, musclewikiUrl } from "@/lib/training/coach-sessions";
import { formatClock, pick } from "@/lib/training/sessions";
import { fmt } from "@/lib/i18n";
import { IconBack, IconExternal } from "@/components/ui/icons";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

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
  const c = coachSessionsDictionary(locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const loaded = await loadTrainingSession(viewer.supabase, id);
  if (!loaded) notFound();
  const { session, exercises } = loaded;

  const running = session.status === "IN_PROGRESS";
  const finished = session.status === "COMPLETED" || session.status === "INTERRUPTED";
  const climbs = running ? await recentClimbs(viewer.supabase) : [];
  const rival = running ? await loadOpenRival(viewer.supabase) : null;
  const pact = rival?.pact ?? null;
  const factor = pact ? loadFactor(pactWeek(pact, pactClock(pact, localDate_(new Date()))), pact.progression) : 1;
  const ego = pact?.status === "ACTIVE" && rival ? {
    name: pact.displayName,
    // Within reach, it stays at most 10 % ahead in the lane too.
    factor: rival.settings.level === "REACH" ? Math.min(factor, 1 + REACH_MARGIN) : factor,
    portrait: rival.settings.portrait,
    avatar: (await loadAvatar(viewer.supabase)).level,
  } : null;

  return <div className="space-y-6">
    <Link href="/session?type=training" className={cn(linkClass, "text-sm")}><IconBack /> {t.backToList}</Link>
    <header>
      <p className="leblond-eyebrow text-accent">{t.status[session.status]}
        {session.scheduledDate ? " · " + formatDate(session.scheduledDate + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" }) : ""}
        {session.scheduledTime ? " · " + session.scheduledTime : ""}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{session.title}</h1>
      {session.objective ? <p className="mt-2 text-sm text-ink-2"><strong>{t.objective} :</strong> {session.objective}</p> : null}
      <p className="mt-1 text-xs text-ink-3">
        {session.plannedMinutes ? `${t.planned} : ${session.plannedMinutes} ${t.minutesShort}` : ""}
        {session.planId ? ` · ${t.source} : ${t.fromPlan}` : session.calendarEntryId ? ` · ${t.source} : ${t.fromCalendar}` : ""}
      </p>
    </header>

    {running ? <TrainingPlayer locale={locale} session={session} exercises={exercises} ego={ego}
      climbs={climbs.map((c) => ({ id: c.id, label: `${c.gyms?.name ?? "Session"} · ${formatDate(c.started_at, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` }))} /> : null}

    {finished ? <SessionSummary locale={locale} session={session} exercises={exercises} /> : null}
    {!running ? <SessionExport locale={locale} session={session} exercises={exercises} /> : null}

    {!running && !finished ? <section aria-labelledby="exercise-list" className="space-y-3">
      <h2 id="exercise-list" className="text-lg font-bold">{t.exercises}</h2>
      <ol className="space-y-3">
        {exercises.map((e, i) => <li key={e.id} className="leblond-premium-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{i + 1} · {t.block[e.block]}</p>
          <h3 className="mt-1 text-base font-bold">{e.name}</h3>
          <p className="mt-1 text-sm font-semibold text-ink">
            {[e.targetSets ? `${e.targetSets} ${e.targetSets > 1 ? t.sets : t.set.toLowerCase()}` : null, e.targetReps ? `${e.targetReps} ${t.reps}` : null,
              e.targetSeconds ? (e.modality === "TIME" || e.modality === "FREE" ? `${Math.round(e.targetSeconds / 60)} ${t.minutesShort}` : `${e.targetSeconds} ${t.seconds}`) : null,
              e.restSeconds ? `${t.rest} ${e.restSeconds} ${t.seconds}` : null].filter(Boolean).join(" · ")}
          </p>
          {e.instructions.load ? <p className="mt-1 text-sm text-ink-2"><strong>{c.load} :</strong> {e.instructions.load}</p> : null}
          {e.instructions.restAfter && i < exercises.length - 1 ? <p className="mt-1 text-sm text-ink-2">{fmt(c.restAfter, { d: formatClock(e.instructions.restAfter) })}</p> : null}
          {e.instructions.summary ? <p className="mt-1 text-sm text-ink-2">{pick(e.instructions.summary, locale)}</p> : null}
          {e.instructions.safety ? <p className="mt-2 text-xs text-ink-2"><strong>{t.safety} :</strong> {pick(e.instructions.safety, locale)}</p> : null}
          {musclewikiUrl(e.instructions.musclewiki) ? <a href={musclewikiUrl(e.instructions.musclewiki)!} target="_blank" rel="noopener noreferrer"
            className={cn(linkClass, "mr-4 mt-2 text-xs")}>{c.musclewiki} <IconExternal /></a> : null}
          {e.instructions.demo && demoUrl(e.instructions.demo.url) ? <a href={demoUrl(e.instructions.demo.url)!} target="_blank" rel="noopener noreferrer"
            className={cn(linkClass, "mr-4 mt-2 text-xs")}>{fmt(c.demo, { site: e.instructions.demo.label })} <IconExternal /></a> : null}
          {e.methodId ? <Link href={"/atlas/" + e.methodId} className={cn(linkClass, "mt-2 text-xs")}>{t.atlasSheet} <IconExternal /></Link> : null}
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
