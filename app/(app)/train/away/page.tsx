import Link from "next/link";
import { CalendarClock, Clock3, History, Luggage, Sparkles } from "lucide-react";
import { AwayActions } from "@/components/training/away-actions";
import { AwayCard, AwayCatalogue } from "@/components/training/away-catalogue";
import { HeadingMark, HeroFigure, ToneIcon } from "@/components/ui/hero-figure";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { linkClass } from "@/components/ui/button";
import { IconNext } from "@/components/ui/icons";
import { requireViewer } from "@/lib/auth/viewer";
import { lastDoneByKey, loadAwayHistory, loadHipStage, loadRecentWork } from "@/lib/data/away";
import { formatDuration } from "@/lib/duration";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { awayDictionary } from "@/lib/i18n/away";
import { getI18n } from "@/lib/i18n/server";
import { AWAY_SESSIONS, AWAY_SESSION_BY_KEY, recoveryAdvice, suggestAway } from "@/lib/training/away";
import { awaySessionView } from "@/lib/training/away/view";
import { localDate_ } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Away Training" };

/**
 * En déplacement (Away Training): the eight permanent séances, with bodyweight
 * and bands. Started or planned like any séance; they land in the training
 * history and the calendar.
 */
export default async function AwayTrainingPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const a = awayDictionary(locale);
  const today = localDate_(new Date());
  const [hipStage, history] = await Promise.all([loadHipStage(viewer.supabase), loadAwayHistory(viewer.supabase)]);
  const recent = await loadRecentWork(viewer.supabase, today, history);

  const labels = { perSide: a.perSide, reps: a.repsShort, restBetween: a.restBetween, restAfter: a.restAfter };
  const views = AWAY_SESSIONS.map((s) => awaySessionView(s, locale, hipStage, labels));
  const lastDone = lastDoneByKey(history);
  const doneCount: Record<string, number> = {};
  for (const h of history) if (h.status === "COMPLETED" || h.status === "INTERRUPTED") doneCount[h.key] = (doneCount[h.key] ?? 0) + 1;
  const advice = AWAY_SESSIONS.map((s) => ({ key: s.key, ...recoveryAdvice(s, recent, today) }));
  const caution = advice.filter((x) => x.status === "CAUTION").map((x) => x.key);
  const reason = advice.find((x) => x.reason)?.reason ?? null;
  const suggestion = suggestAway({ recent, today, hipStage, lastDone });
  const suggested = views.find((v) => v.key === suggestion.key)!;
  const done = history.filter((h) => h.status === "COMPLETED" || h.status === "INTERRUPTED");
  const dateLabel = (d: string) => formatDate(d + "T12:00:00", locale, { weekday: "short", day: "numeric", month: "short" });

  return <div className="space-y-8">
    <div>
      <PageHeader icon={<PAGE_ICONS.away />} title={a.title} subtitle={a.subtitle} />
      <HeroFigure variant="panel" size="page" art={Luggage} eyebrow={a.eyebrow} value="8" label={a.heroLabel} note={a.heroNote}
      stats={[
        { label: a.statShort, value: formatDuration(60), hint: a.statFour, icon: Clock3, tone: "sky" },
        { label: a.statLong, value: formatDuration(90), hint: a.statFour, icon: CalendarClock, tone: "violet" },
        { label: a.statDone, value: done.length, hint: done[0] ? dateLabel(done[0].date) : a.neverDone, icon: History, tone: "teal" },
      ]} />
    </div>

    <div className="space-y-2 text-sm">
      {reason ? <p role="status" className="rounded-2xl border border-warn/40 bg-warn/10 p-4 font-semibold text-ink">{a.recovery[reason]}</p> : null}
      <p className="text-ink-2">{hipStage === null
        ? <>{a.hipUntested} <Link href="/train/mobility" className={linkClass}>{a.hipTest} <IconNext /></Link></>
        : fmt(a.hipStage, { n: hipStage })}</p>
    </div>

    <section aria-labelledby="away-suggestion" className="space-y-3">
      <h2 id="away-suggestion" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">
        <HeadingMark />{a.suggestion}</h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="leblond-premium-surface flex items-start gap-3 p-5">
          <ToneIcon icon={Sparkles} tone="gold" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-ink">{suggested.title} · {formatDuration(suggested.minutes)}</p>
            <p className="mt-1 text-ink-2">{a.suggestionReasons[suggestion.reason]}</p>
            <p className="mt-2 text-xs text-ink-3">{a.patrickHint} <Link href="/patrick" className={linkClass}>Patrick <IconNext /></Link></p>
          </div>
        </div>
        <AwayCard locale={locale} s={suggested} today={today} last={lastDone[suggested.key] ?? null} count={doneCount[suggested.key] ?? 0}
          caution={caution.includes(suggested.key)} highlight={a.suggestion} />
      </div>
    </section>

    <AwayCatalogue locale={locale} sessions={views} today={today} lastDone={lastDone} doneCount={doneCount} caution={caution} />

    <section aria-labelledby="away-history" className="space-y-3">
      <h2 id="away-history" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-3"><HeadingMark />{a.history}</h2>
      {history.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-2">{a.historyEmpty}</p>
        : <ul className="leblond-premium-surface divide-y divide-line overflow-hidden">
          {history.slice(0, 12).map((h) => { const s = AWAY_SESSION_BY_KEY.get(h.key)!; return <li key={h.sessionId}
            className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
            <span className="min-w-0 flex-1">
              <Link href={"/train/sessions/" + h.sessionId} className="block font-semibold hover:underline">{s.title[locale]}</Link>
              <span className="block text-xs text-ink-3">{dateLabel(h.date)} · {a.status[h.status]}
                {h.minutes ? " · " + formatDuration(h.minutes) : ""}{h.rpe ? ` · RPE ${h.rpe}` : ""}</span>
            </span>
            {h.status === "COMPLETED" || h.status === "INTERRUPTED"
              ? <AwayActions locale={locale} awayKey={h.key} title={s.title[locale]} today={today} redo /> : null}
          </li>; })}
        </ul>}
      <p className="text-xs text-ink-3"><Link href="/follow-up/training" className={linkClass}>{a.allHistory} <IconNext /></Link></p>
    </section>

    <footer className="space-y-1 text-xs text-ink-3">
      <p>{a.bandRule}</p>
      <p>{a.noFingers}</p>
    </footer>
  </div>;
}
