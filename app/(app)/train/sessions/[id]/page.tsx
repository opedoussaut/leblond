import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionLifecycleActions } from "@/components/training/session-actions";
import { SessionExport } from "@/components/training/session-export";
import { SessionSummary } from "@/components/training/session-summary";
import { TrainingPlayer } from "@/components/training/training-player";
import { EditTrainingForm } from "@/components/training/training-free-forms";
import { loadFactor, pactClock, pactWeek } from "@/lib/analytics/alter-ego";
import { loadOpenRival, rivalPhotoUrl } from "@/lib/data/alter-ego";
import { viewerAvatarLevel, viewerPhotoUrl } from "@/lib/data/profile-picture";
import { REACH_MARGIN } from "@/lib/analytics/rival";
import { utcToZoned } from "@/lib/time";
import { localDate_ } from "@/lib/training/sessions";
import { requireViewer } from "@/lib/auth/viewer";
import { loadTrainingSession } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { COACH_SESSION_COLUMNS, coachSessionFromRow, coachSlugOf, demoUrl, musclewikiUrl, withCurrentPictures } from "@/lib/training/coach-sessions";
import { MobilityIllustration } from "@/components/training/mobility-illustrations";
import { formatClock, pick } from "@/lib/training/sessions";
import { fmt } from "@/lib/i18n";
import { IconBack, IconExternal } from "@/components/ui/icons";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { FitImportNotice } from "@/components/wearables/fit-import-notice";
import { TrainingWatchCard } from "@/components/wearables/training-watch";
import { trainingSessionIsEmpty } from "@/lib/integrations/wearables/fit/file";
import { readImportedAs } from "@/lib/integrations/wearables/fit/import-flow";
import { RebuildCheckIn, RebuildFollowUp, RebuildPostponeButton, RebuildStopPanel } from "@/components/training/rebuild-forms";
import { loadSessionChecks } from "@/lib/data/mobility-rebuild";
import { rebuildDictionary } from "@/lib/i18n/mobility-rebuild";
import { REBUILD_METHOD_ID, followUpOpen } from "@/lib/training/mobility-rebuild/engine";

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
  const { locale, t: common } = await getI18n(viewer.profile.preferred_language);
  const t = trainingSessionDictionary(locale);
  const c = coachSessionsDictionary(locale);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const loaded = await loadTrainingSession(viewer.supabase, id);
  if (!loaded) notFound();
  const { session } = loaded;
  // Séances copied before their coach session got pictures show the current ones.
  const slugs = [...new Set(loaded.exercises.map((e) => coachSlugOf(e.instructions.key)).filter((s): s is string => !!s))];
  const { data: coachRows } = slugs.length
    ? await viewer.supabase.from("coach_sessions").select(COACH_SESSION_COLUMNS).in("slug", slugs)
    : { data: [] };
  const exercises = withCurrentPictures(loaded.exercises,
    (coachRows ?? []).map(coachSessionFromRow).filter((c) => c !== null));

  // The watch activity filed as this séance (one-step FIT import), if any.
  const { data: watch } = await viewer.supabase.from("wearable_activities")
    .select("id, provider, device_name, duration_seconds, avg_heart_rate, max_heart_rate, calories, training_load, raw_metadata")
    .eq("training_session_id", session.id).maybeSingle();
  const importedEmpty = watch && readImportedAs(watch.raw_metadata) ? await trainingSessionIsEmpty(viewer, session.id) : false;

  const running = session.status === "IN_PROGRESS";
  const finished = session.status === "COMPLETED" || session.status === "INTERRUPTED";
  // Mobility Rebuild: symptom gate before, stop signs during, next-day follow-up after.
  const rebuild = session.methodId === REBUILD_METHOD_ID;
  const r = rebuildDictionary(locale);
  const checks = rebuild ? await loadSessionChecks(viewer.supabase, session.id) : {};
  const { data: slotRow } = rebuild
    ? await viewer.supabase.from("training_sessions").select("programme_phase").eq("id", session.id).maybeSingle()
    : { data: null };
  const doneAt = session.completedAt ?? checks.AFTER?.updatedAt ?? session.startedAt;
  const doneOn = finished && doneAt ? localDate_(new Date(doneAt)) : null;
  const d1Open = rebuild && doneOn !== null && followUpOpen(doneOn, localDate_(new Date()), !!checks.D1);
  const climbs = running ? await recentClimbs(viewer.supabase) : [];
  const rival = running ? await loadOpenRival(viewer.supabase) : null;
  const pact = rival?.pact ?? null;
  const factor = pact ? loadFactor(pactWeek(pact, pactClock(pact, localDate_(new Date()))), pact.progression) : 1;
  const ego = pact?.status === "ACTIVE" && rival ? {
    name: pact.displayName,
    // Within reach, it stays at most 10 % ahead in the lane too.
    factor: rival.settings.level === "REACH" ? Math.min(factor, 1 + REACH_MARGIN) : factor,
    portrait: rival.settings.portrait,
    avatar: await viewerAvatarLevel(),
    photo: await viewerPhotoUrl(),
    rivalPhoto: await rivalPhotoUrl(viewer.supabase, rival),
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

    {watch ? <FitImportNotice activity={watch} empty={importedEmpty} locale={locale} /> : null}

    {rebuild ? <section aria-label={r.short} className="space-y-2 text-sm">
      <p className="text-xs text-ink-2">
        {slotRow?.programme_phase ? fmt(r.plannedPhase, { p: slotRow.programme_phase }) : null}
        {checks.BEFORE?.phaseUsed ? " · " + fmt(r.usedPhase, { p: checks.BEFORE.phaseUsed }) : null}
        {checks.BEFORE ? ` · ${r.painBefore} ${checks.BEFORE.backPain ?? "–"}/10` : null}
        {checks.AFTER?.stopReason ? ` · ${r.stopReason[checks.AFTER.stopReason]}` : null}
        {checks.D1?.overall ? ` · ${r.nextDay} : ${r.overall[checks.D1.overall]}` : null}
      </p>
      {checks.BEFORE?.verdict === "ADAPT" ? <p className="text-sm font-semibold">{r.verdict.ADAPT}</p> : null}
      <p className="text-xs text-ink-3">{r.notMedical}</p>
    </section> : null}
    {rebuild && (session.status === "PLANNED" || session.status === "INTERRUPTED") ? <>
      <RebuildCheckIn locale={locale} sessionId={session.id} resume={session.status === "INTERRUPTED"} />
      {session.status === "PLANNED" ? <RebuildPostponeButton locale={locale} sessionId={session.id} /> : null}
    </> : null}
    {rebuild && running ? <RebuildStopPanel locale={locale} sessionId={session.id} /> : null}
    {d1Open ? <RebuildFollowUp locale={locale} sessionId={session.id} /> : null}

    {running ? <TrainingPlayer locale={locale} session={session} exercises={exercises} ego={ego}
      climbs={climbs.map((c) => ({ id: c.id, label: `${c.gyms?.name ?? "Session"} · ${formatDate(c.started_at, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` }))} /> : null}

    {finished ? <SessionSummary locale={locale} session={session} exercises={exercises} /> : null}
    {watch ? <TrainingWatchCard activity={watch} t={common} locale={locale} /> : null}
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
              e.restSeconds ? `${t.rest} ${e.restSeconds} ${t.seconds}` : null,
              e.instructions.minutes ? fmt(r.minutes, { n: e.instructions.minutes }) : null].filter(Boolean).join(" · ")}
          </p>
          {e.instructions.load ? <p className="mt-1 text-sm text-ink-2"><strong>{c.load} :</strong> {e.instructions.load}</p> : null}
          {e.instructions.restAfter && i < exercises.length - 1 ? <p className="mt-1 text-sm text-ink-2">{fmt(c.restAfter, { d: formatClock(e.instructions.restAfter) })}</p> : null}
          {e.instructions.illustration ? <MobilityIllustration exerciseId={e.instructions.illustration} title={e.name} className="mt-2" /> : null}
          {e.instructions.summary ? <p className="mt-1 text-sm text-ink-2">{pick(e.instructions.summary, locale)}</p> : null}
          {e.instructions.safety ? <p className="mt-2 text-xs text-ink-2"><strong>{t.safety} :</strong> {pick(e.instructions.safety, locale)}</p> : null}
          {rebuild && e.instructions.steps?.length ? <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-ink-2">
            {e.instructions.steps.map((st, k) => <li key={k}>{pick(st, locale)}</li>)}</ol> : null}
          {e.instructions.alternative ? <p className="mt-2 text-xs text-ink-2"><strong>{r.alternative} :</strong> {e.instructions.alternative}</p> : null}
          {musclewikiUrl(e.instructions.musclewiki) ? <a href={musclewikiUrl(e.instructions.musclewiki)!} target="_blank" rel="noopener noreferrer"
            className={cn(linkClass, "mr-4 mt-2 text-xs")}>{c.musclewiki} <IconExternal /></a> : null}
          {e.instructions.demo && demoUrl(e.instructions.demo.url) ? <a href={demoUrl(e.instructions.demo.url)!} target="_blank" rel="noopener noreferrer"
            className={cn(linkClass, "mr-4 mt-2 text-xs")}>{fmt(c.demo, { site: e.instructions.demo.label })} <IconExternal /></a> : null}
          {e.methodId ? <Link href={"/atlas/" + e.methodId} className={cn(linkClass, "mt-2 text-xs")}>{t.atlasSheet} <IconExternal /></Link> : null}
        </li>)}
      </ol>
    </section> : null}

    {!running && session.status !== "COMPLETED" ? <SessionLifecycleActions locale={locale} id={session.id} status={session.status} canStart={!rebuild} /> : null}
    {!running ? <EditTrainingForm locale={locale} today={localDate_(new Date())} session={{
      id: session.id, title: session.title,
      ...(session.startedAt ? utcToZoned(session.startedAt) : { date: session.scheduledDate ?? localDate_(new Date()), time: session.scheduledTime ?? "18:00" }),
      minutes: session.actualMinutes ?? session.plannedMinutes ?? 60,
      rpe: session.rpe, pain: session.pain, notes: session.notes,
    }} /> : null}
    <p className="text-xs text-ink-3">{t.safetyNote}</p>
  </div>;
}
