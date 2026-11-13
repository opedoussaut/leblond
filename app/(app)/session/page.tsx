import Link from "next/link";
import { LinkButton, chipClass, linkClass, segmentClass, segmentGroupClass } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { countActivity, summarizeRoutes } from "@/lib/analytics";
import { areasDictionary } from "@/lib/i18n/areas";
import { routeDictionary } from "@/lib/i18n/routes";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { requireViewer } from "@/lib/auth/viewer";
import { toAttemptFact } from "@/lib/data/climbing";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { localDate_, type TrainingSession } from "@/lib/training/sessions";
import { IconNext, IconPast, LiveDot } from "@/components/ui/icons";

export const metadata = { title: "Journal" };

const FILTERS = ["all", "climb", "training"] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Journal: one list for every séance, grimpe and entraînement, newest first.
 * A filter narrows it to one kind; live séances of both kinds come first.
 */
export default async function JournalPage({ searchParams }: PageProps<"/session">) {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const a = areasDictionary(locale).journal;
  const ts = trainingSessionDictionary(locale);
  const r = routeDictionary(locale);
  const sp = await searchParams;
  const filter: Filter = FILTERS.includes(sp.type as Filter) ? (sp.type as Filter) : "all";
  const showClimb = filter !== "training";
  const showTraining = filter !== "climb";

  const [{ data: sessions }, training] = await Promise.all([
    viewer.supabase
      .from("sessions")
      .select("id, started_at, ended_at, duration_minutes, discipline, title, gyms(name, brand)")
      .order("started_at", { ascending: false })
      .limit(50),
    listTrainingSessions(viewer.supabase, 100),
  ]);
  const ids = (sessions ?? []).map((s) => s.id);
  const [{ data: attempts }, { data: routeRows }] = ids.length
    ? await Promise.all([
      viewer.supabase.from("attempts").select("*").in("session_id", ids),
      viewer.supabase.from("route_ascents").select("id, session_id, grade, style, result, falls, created_at").in("session_id", ids),
    ])
    : [{ data: [] }, { data: [] }];
  const facts = (attempts ?? []).map(toAttemptFact);
  const routeFacts = (routeRows ?? []).map((x) => ({ id: x.id, sessionId: x.session_id, grade: x.grade, style: x.style,
    result: x.result, falls: x.falls, createdAt: new Date(x.created_at) }));

  const liveClimb = (sessions ?? []).find((s) => !s.ended_at);
  const allTraining = training ?? [];
  const liveTraining = allTraining.filter((s) => s.status === "IN_PROGRESS" || s.status === "INTERRUPTED");
  const today = localDate_(new Date());
  // Planned séances whose day has passed are not "coming up": they are counted, and the Agenda shows them.
  const missed = allTraining.filter((s) => s.status === "PLANNED" && s.scheduledDate && s.scheduledDate < today).length;
  const upcoming = allTraining.filter((s) => s.status === "PLANNED" && (s.scheduledDate ?? today) >= today)
    .sort((x, y) => (x.scheduledDate ?? "").localeCompare(y.scheduledDate ?? "") || (x.scheduledTime ?? "").localeCompare(y.scheduledTime ?? ""));
  const doneTraining = allTraining.filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED" || s.status === "CANCELED");

  // One history, sorted by when the séance happened.
  type Item = { kind: "climb"; at: string; s: NonNullable<typeof sessions>[number] } | { kind: "training"; at: string; s: TrainingSession };
  const history: Item[] = [
    ...(showClimb ? (sessions ?? []).filter((s) => s.ended_at).map((s) => ({ kind: "climb" as const, at: s.started_at, s })) : []),
    ...(showTraining ? doneTraining.map((s) => ({ kind: "training" as const,
      at: s.startedAt ?? s.completedAt ?? (s.scheduledDate ? s.scheduledDate + "T12:00:00" : ""), s })) : []),
  ].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 60);

  const kindChip = (kind: "climb" | "training") =>
    <span className={chipClass(kind === "climb" ? "accent" : "neutral", "shrink-0")}>{kind === "climb" ? a.climb : a.training}</span>;
  // A one-off séance has no scheduled date: show the day it was done.
  const dayOf = (s: TrainingSession) => s.scheduledDate ?? (s.startedAt ? localDate_(new Date(s.startedAt)) : null);
  const trainingLine = (s: TrainingSession) => [
    ts.status[s.status],
    dayOf(s) ? formatDate(dayOf(s) + "T12:00:00", locale, { weekday: "short", day: "numeric", month: "short" }) : "",
    s.scheduledTime ?? "",
    s.status === "COMPLETED" && s.actualMinutes !== null ? `${s.actualMinutes} ${ts.minutesShort}` : s.plannedMinutes ? `${s.plannedMinutes} ${ts.minutesShort}` : "",
  ].filter(Boolean).join(" · ");
  const rowClass = "block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent";

  return (
    <div className="space-y-6">
      <PageHeader icon={<PAGE_ICONS.journal />} title={a.title} subtitle={a.subtitle} />

      {(showClimb && liveClimb) || (showTraining && liveTraining.length) ? (
        <section aria-label={t.session.active} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {showClimb && liveClimb ? (
            <Link href={`/session/${liveClimb.id}`}
              className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-accent hover:border-accent">
              <span><span className="block text-xs font-bold uppercase tracking-[0.12em]"><LiveDot /> {a.liveClimb}</span>
                <strong className="block text-base text-ink">{liveClimb.gyms?.name}</strong></span>
              <span className="shrink-0 whitespace-nowrap text-sm font-bold">{a.resume} <IconNext /></span>
            </Link>
          ) : null}
          {showTraining ? liveTraining.map((s) => (
            <Link key={s.id} href={`/train/sessions/${s.id}`}
              className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-accent hover:border-accent">
              <span><span className="block text-xs font-bold uppercase tracking-[0.12em]"><LiveDot /> {a.liveTraining}</span>
                <strong className="block text-base text-ink">{s.title}</strong></span>
              <span className="shrink-0 whitespace-nowrap text-sm font-bold">{a.resume} <IconNext /></span>
            </Link>
          )) : null}
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <LinkButton href={filter === "training" ? "/session/new?kind=train" : "/session/new"} size="xl" className="w-full sm:flex-1">
          <PAGE_ICONS.newSession aria-hidden="true" /> {a.newSession}
        </LinkButton>
        <LinkButton href={filter === "training" ? "/session/new?kind=train#past-training" : "/session/new?where=past"}
          variant="secondary" size="xl" className="w-full sm:flex-1">
          <IconPast /> {a.addPast}
        </LinkButton>
      </div>

      <nav aria-label={a.filter} className={cn(segmentGroupClass, "grid-cols-3")}>
        {FILTERS.map((f) => (
          <Link key={f} href={f === "all" ? "/session" : `/session?type=${f}`} aria-current={filter === f ? "page" : undefined}
            className={segmentClass(filter === f, "inline-flex items-center justify-center")}>
            {a[f]}
          </Link>
        ))}
      </nav>

      {showTraining && training === null ? <p role="alert" className="rounded-xl border border-warn p-4 text-sm">{a.trainingError}</p> : null}

      {showTraining && (upcoming.length || missed) ? (
        <section aria-labelledby="upcoming-heading" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionTitle><span id="upcoming-heading">{a.upcoming}</span></SectionTitle>
            <Link href="/calendar" className={cn(linkClass, "text-sm")}>{a.seeAgenda} <IconNext /></Link>
          </div>
          {missed ? <p className="text-sm text-ink-2">
            <Link href="/calendar" className={linkClass}>{missed === 1 ? a.missedOne : fmt(a.missedMany, { n: missed })}</Link>
          </p> : null}
          <ul className="space-y-2">
            {upcoming.slice(0, 5).map((s) => (
              <li key={s.id}>
                <Link href={`/train/sessions/${s.id}`} className={cn(rowClass, "flex min-h-16 items-center justify-between gap-3")}>
                  <span className="min-w-0">
                    <strong className="line-clamp-2 block">{s.title}</strong>
                    <span className="text-xs text-ink-2">{trainingLine(s)}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm font-bold text-accent">{ts.open} <IconNext /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="history-heading" className="space-y-3">
        <SectionTitle><span id="history-heading">{a.history}</span></SectionTitle>
        {history.length ? (
          <ul className="space-y-2">
            {history.map((item) => {
              if (item.kind === "training") {
                const s = item.s;
                return (
                  <li key={"t" + s.id}>
                    <Link href={`/train/sessions/${s.id}`} className={rowClass}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{s.title}</span>
                        {kindChip("training")}
                      </div>
                      <p className="mt-1 text-sm tabular-nums text-ink-2">{trainingLine(s)}</p>
                    </Link>
                  </li>
                );
              }
              const s = item.s;
              const c = countActivity(facts.filter((f) => f.sessionId === s.id));
              const rs = s.discipline === "ROUTE" ? summarizeRoutes(routeFacts.filter((f) => f.sessionId === s.id)) : null;
              return (
                <li key={"c" + s.id}>
                  <Link href={`/session/${s.id}`} className={rowClass}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{s.title ? `${s.title} · ${s.gyms?.name ?? ""}` : s.gyms?.name}</span>
                      {kindChip("climb")}
                    </div>
                    <p className="mt-1 text-sm tabular-nums text-ink-2">
                      {formatDateTime(s.started_at, locale)} · {rs ? <>
                        {r.route} · {formatDuration(s.duration_minutes)} · {rs.ascents} {r.climbed} · {rs.clean} {r.clean}
                        {rs.highestClean ? ` · max ${rs.highestClean.grade}` : ""}
                      </> : <>
                        {formatDuration(s.duration_minutes)} · {c.problems} {t.session.problems} · {c.tops}{" "}
                        {t.session.tops} · {c.flashes} {t.session.flashes} · {c.attempts} {t.session.attempts}
                      </>}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState body={filter === "climb" ? a.emptyClimb : filter === "training" ? a.emptyTraining : a.empty} />
        )}
      </section>
    </div>
  );
}
