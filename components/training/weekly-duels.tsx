import { season, type Duel } from "@/lib/analytics/rival";
import { formatDuration } from "@/lib/duration";
import { fmt, type Locale } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";
import { chartsDictionary } from "@/lib/i18n/charts";
import { rivalDictionary } from "@/lib/i18n/rival";
import { StandingMedal } from "./standing-medal";

const STATE = { you: "ahead", rival: "behind", level: "level" } as const;

/** Each finished week is a match (séances, minutes, reps: one point each); the pact is the season. */
export function WeeklyDuels({ locale, name, duels }: { locale: Locale; name: string; duels: Duel[] }) {
  const t = alterEgoDictionary(locale);
  const r = rivalDictionary(locale);
  const c = chartsDictionary(locale);
  const s = season(duels);
  return <section aria-labelledby="weeks-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="weeks-heading" className="text-lg font-bold">{t.weeksTitle}</h2>
      {duels.length ? <p className="text-sm font-semibold text-ink-2">{r.seasonTitle} · {fmt(r.seasonScore, { name, rival: s.rival, you: s.you })}</p> : null}
    </div>
    {duels.length ? <ul className="space-y-2">
      {[...duels].reverse().map((d) => {
        const verdict = d.winner === "you" ? r.duelWon : d.winner === "rival" ? fmt(r.duelLost, { name }) : r.duelLevel;
        return <li key={d.week} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3" data-testid="weekly-duel">
          <StandingMedal state={STATE[d.winner]} label={verdict} size={32} className="ring-2" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{fmt(t.weekMatch, { week: d.week })} · <span className="font-semibold text-ink-2">{verdict}, {d.points.you}–{d.points.rival}</span></p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-3">
              {t.you} {d.you.sessions} · {d.you.reps} {c.repsShort} · {formatDuration(d.you.minutes)}
              <span className="mx-1.5">|</span>
              {name} {d.rival.sessions} · {d.rival.reps} {c.repsShort} · {formatDuration(d.rival.minutes)}
            </p>
          </div>
        </li>;
      })}
    </ul> : <p className="text-sm text-ink-2">{t.weeksEmpty}</p>}
  </section>;
}
