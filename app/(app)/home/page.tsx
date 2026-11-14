import Link from "next/link";
import Image from "next/image";
import { AreaCard } from "@/components/layout/area-card";
import { AREA_ICONS, PAGE_ICONS } from "@/components/layout/nav-icons";
import { buttonClass, linkClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { requireViewer } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { areasDictionary } from "@/lib/i18n/areas";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { dateForPlanDay, localDate_, mondayOf } from "@/lib/training/sessions";
import { IconNext, LiveDot } from "@/components/ui/icons";
import { DuelBanner } from "@/components/training/duel-banner";
import { pactClock, pactWeek } from "@/lib/analytics/alter-ego";
import { rivalStanding } from "@/lib/analytics/rival";
import { loadAvatar } from "@/lib/data/avatar";
import { loadClimberWork, loadOpenRival } from "@/lib/data/alter-ego";
import { boardsDictionary } from "@/lib/i18n/boards";

/**
 * Aujourd'hui: what to do now. A live séance first, then one button to start
 * any séance, today's form and plan, the week at a glance, and — only without
 * a programme — an invitation to follow one.
 */
export const metadata = { title: "LEBLOND — Your climbing, your way" };

export default async function HomePage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const j = journeyDictionary(locale);
  const a = areasDictionary(locale).today;
  const today = localDate_(new Date());
  const monday = mondayOf(today);
  const week = Array.from({ length: 7 }, (_, i) => dateForPlanDay(monday, i));
  const dateLabel = formatDate(today + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" });
  // A day earlier than Monday in UTC, so a séance just after midnight in Paris is not missed.
  const since = new Date(Date.parse(monday + "T00:00:00Z") - 86_400_000).toISOString();
  const [{ data: live }, { data: training }, { count: plans }, { data: dayCheck }, { data: weekTraining }, { data: weekClimbs }] = await Promise.all([
    viewer.supabase.from("sessions").select("id, gyms(name)").is("ended_at", null).limit(1).maybeSingle(),
    viewer.supabase.from("training_sessions").select("id, title").eq("status", "IN_PROGRESS").limit(1).maybeSingle(),
    viewer.supabase.from("training_plans").select("id", { count: "exact", head: true }),
    viewer.supabase.from("training_day_checks").select("outcome").eq("check_date", today).limit(1).maybeSingle(),
    viewer.supabase.from("training_sessions").select("id, title, status, scheduled_date, scheduled_time, planned_minutes")
      .gte("scheduled_date", week[0]).lte("scheduled_date", week[6]).order("scheduled_time", { ascending: true }),
    viewer.supabase.from("sessions").select("id, started_at").gte("started_at", since).not("ended_at", "is", null),
  ]);
  // The duel, only while a pact is open.
  const rival = await loadOpenRival(viewer.supabase);
  const duel = rival ? await (async () => {
    const [work, avatar] = await Promise.all([loadClimberWork(viewer.supabase), loadAvatar(viewer.supabase)]);
    return { standing: rivalStanding(rival.pact, rival.settings, work, today), avatar: avatar.level,
      week: pactWeek(rival.pact, pactClock(rival.pact, today)) + 1 };
  })() : null;
  const outcome = dayCheck?.outcome;
  const plannedToday = (weekTraining ?? []).filter((s) => s.scheduled_date === today && s.status === "PLANNED");
  const days = week.map((date) => {
    const training = (weekTraining ?? []).filter((s) => s.scheduled_date === date);
    const planned = training.filter((s) => s.status === "PLANNED").length;
    const done = training.filter((s) => s.status === "COMPLETED").length
      + (weekClimbs ?? []).filter((s) => localDate_(new Date(s.started_at)) === date).length;
    return { date, planned, done };
  });
  const count = (n: number, one: string, many: string) => (n === 1 ? one : fmt(many, { n }));

  return <div className="space-y-8">
    <div>
      <p className="leblond-eyebrow mb-3 text-accent">LEBLOND · ROAD TO 7A</p>
      <PageHeader icon={<AREA_ICONS.today />} title={fmt(t.home.hello, { name: viewer.profile.display_name })}
        subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} />
    </div>

    {live || training ? <section aria-label={fr ? "Activité en cours" : "Activity in progress"} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {live ? <Link href={`/session/${live.id}`}
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-accent hover:border-accent">
        <span><span className="block text-xs font-bold uppercase tracking-[0.12em]"><LiveDot /> {t.home.liveSession}</span>
          <strong className="block text-base text-ink">{live.gyms?.name ?? (fr ? "Séance de grimpe" : "Climbing session")}</strong></span>
        <span className="shrink-0 whitespace-nowrap text-sm font-bold">{fr ? "Reprendre" : "Resume"} <IconNext /></span>
      </Link> : null}
      {training ? <Link href={`/train/sessions/${training.id}`}
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-accent hover:border-accent">
        <span><span className="block text-xs font-bold uppercase tracking-[0.12em]"><LiveDot /> {fr ? "Entraînement en cours" : "Training in progress"}</span>
          <strong className="block text-base text-ink">{training.title}</strong></span>
        <span className="shrink-0 whitespace-nowrap text-sm font-bold">{fr ? "Reprendre" : "Resume"} <IconNext /></span>
      </Link> : null}
    </section> : null}

    <div className="space-y-2">
      <Link href="/session/new" className={buttonClass("primary", "xl", "w-full")}>
        <PAGE_ICONS.newSession aria-hidden="true" /> {a.newSession}
      </Link>
      <p className="text-center text-sm">
        <Link href="/session/board-plan" className={linkClass}>{boardsDictionary(locale).plan.homeLink} <IconNext /></Link>
      </p>
    </div>

    {rival && duel ? <DuelBanner locale={locale} name={rival.pact.displayName} standing={duel.standing}
      week={duel.week} total={rival.pact.horizonWeeks} portrait={rival.settings.portrait} avatar={duel.avatar}
      paused={rival.pact.status === "PAUSED"} /> : null}

    <section aria-labelledby="your-day" className="space-y-4">
      <h2 id="your-day" className="text-lg font-bold tracking-tight text-ink-2">{t.home.yourDay}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AreaCard href="/train/today" icon={<PAGE_ICONS.dayCheck />} title={t.nav.dayCheck}
          description={t.home.dayCheckText} emphasis={!outcome}
          note={outcome ? fmt(j.hub.dayDone, { outcome: j.outcomes[outcome].toLowerCase() }) : j.hub.dayBadge} />
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="flex items-center gap-2 text-base font-bold"><PAGE_ICONS.calendar aria-hidden="true" className="size-6 text-accent" />{a.planned}</h3>
          {plannedToday.length ? <ul className="mt-3 space-y-2">
            {plannedToday.map((s) => <li key={s.id}>
              <Link href={`/train/sessions/${s.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 hover:bg-accent-soft">
                <span className="min-w-0">
                  <strong className="line-clamp-2 text-sm">{s.title}</strong>
                  <span className="text-xs text-ink-2">{[s.scheduled_time, s.planned_minutes ? `${s.planned_minutes} min` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-sm font-bold text-accent">{a.open} <IconNext /></span>
              </Link>
            </li>)}
          </ul> : <p className="mt-2 text-sm text-ink-2">{a.nothingPlanned}</p>}
        </div>
      </div>
    </section>

    <section aria-labelledby="week-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="week-heading" className="text-lg font-bold tracking-tight text-ink-2">{a.week}</h2>
        <Link href="/calendar" className={cn(linkClass, "text-sm")}>{a.openAgenda} <IconNext /></Link>
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = d.date === today;
          const label = formatDate(d.date + "T12:00:00", locale, { weekday: "long", day: "numeric" });
          const detail = [d.planned ? count(d.planned, a.plannedOne, a.plannedMany) : null,
            d.done ? count(d.done, a.doneOne, a.doneMany) : null].filter(Boolean).join(", ") || a.rest;
          return <li key={d.date}>
            <Link href={`/calendar?month=${d.date.slice(0, 7)}`} aria-current={isToday ? "date" : undefined}
              className={cn("flex min-h-18 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition-colors hover:border-accent",
                isToday ? "border-accent bg-accent-soft" : "border-line bg-surface")}>
              <span aria-hidden="true" className="text-xs font-semibold uppercase text-ink-3">
                {formatDate(d.date + "T12:00:00", locale, { weekday: "narrow" })}
              </span>
              <span aria-hidden="true" className={cn("leblond-number text-lg", isToday ? "text-accent" : "text-ink")}>{Number(d.date.slice(8))}</span>
              <span aria-hidden="true" className="flex h-2 items-center gap-1">
                {d.done ? <span className="size-2 rounded-full bg-accent" /> : null}
                {d.planned ? <span className="size-2 rounded-full border-2 border-accent" /> : null}
              </span>
              <span className="sr-only">{label} : {detail}</span>
            </Link>
          </li>;
        })}
      </ol>
    </section>

    {(plans ?? 0) === 0 ? <section aria-labelledby="follow-heading"
      className="leblond-premium-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 id="follow-heading" className="flex items-center gap-2 text-lg font-bold"><AREA_ICONS.programmes aria-hidden="true" className="size-5 text-accent" />{a.followTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{a.followText}</p>
      </div>
      <Link href="/programmes" className={buttonClass("secondary", "md", "shrink-0")}>{a.followCta} <IconNext /></Link>
    </section> : null}

    <section className="leblond-hero-panel grid grid-cols-1 gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center sm:p-7">
      <div className="space-y-3">
        <p className="leblond-eyebrow text-blue-200">LEBLOND</p>
        <p className="max-w-lg text-2xl font-extrabold tracking-tight sm:text-3xl">
          {fr ? "Ton escalade. Ton rythme." : "Your climbing. Your pace."}
        </p>
        <p className="max-w-lg text-sm leading-relaxed text-blue-100">
          {fr ? "Tes séances de grimpe alimentent tes progrès, avec ou sans programme. Tu peux passer d’un parcours à l’autre à tout moment."
              : "Your climbing sessions feed your progress, with or without a plan. Switch between journeys whenever you like."}
        </p>
        <Link href="/follow-up" className="inline-block text-sm font-bold text-white underline underline-offset-4">
          {t.home.progressLink} <IconNext />
        </Link>
      </div>
      <Image src="/brand/leblond-approved-hero.svg" width={480} height={480}
        alt={fr ? "LeBlond, grimpeur suspendu au-dessus d’un paysage bleu" : "LeBlond climber above a blue landscape"}
        unoptimized priority className="leblond-hero-art mx-auto aspect-square h-auto w-full max-w-[200px]" />
    </section>
  </div>;
}
