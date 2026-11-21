import { TOP_LEVEL_MIN, type TopLevelSeries, type TopLevelWindow } from "@/lib/analytics/charts";
import { gradeLabel } from "@/lib/grading/labels";
import { fmt, intlLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { chartsDictionary } from "@/lib/i18n/charts";
import { cn } from "@/components/ui/cn";

const DIRECTION_TONE = {
  up: "bg-ok/15 text-ok", down: "bg-danger/15 text-danger", flat: "bg-surface text-ink-2", insufficient: "bg-surface text-ink-3",
} as const;
const DIRECTION_MARK = { up: "↗", flat: "→", down: "↘", insufficient: "…" } as const;

/**
 * The send rate at the climber's two hardest grades, one small card per native
 * scale (never merged, never converted): the last four weeks against the four
 * before, a direction only when both windows hold enough boulders, and the
 * weeks as bars (sent, then tried but not sent). Figures come from
 * topLevelRates in lib/analytics/charts; this only draws them.
 */
export function TopLevelRates({ t, locale, series }: { t: Dictionary; locale: Locale; series: readonly TopLevelSeries[] }) {
  const c = chartsDictionary(locale);
  const pct = new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 0 });
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const full = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
  const at = (d: string) => new Date(d + "T00:00:00Z");
  const systemName = (s: TopLevelSeries) => (t.grades.systems as Record<string, string>)[s.system] ?? s.system;
  const counts = (w: TopLevelWindow) => (w.rate === null ? c.tlNoTries : fmt(c.tlRate, { sent: w.sent, tried: w.tried }));

  return <section aria-labelledby="top-level-heading" className="space-y-3">
    <div>
      <h3 id="top-level-heading" className="text-base font-bold">{c.tlTitle}</h3>
      <p className="mt-1 text-sm text-ink-2">{c.tlHint}</p>
    </div>
    {series.length === 0 ? <p className="text-sm text-ink-3">{c.tlEmpty}</p>
      : <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {series.map((s) => {
          const levels = s.levels.map((g) => gradeLabel(t, s.system, g));
          const max = Math.max(1, ...s.weeks.map((w) => w.tried));
          const n = s.weeks.length;
          // About four dates under the bars, counted back from the current week (always shown).
          const every = Math.max(1, Math.ceil(n / 4));
          return <li key={s.system} className="rounded-2xl bg-surface-2 p-4" data-testid="top-level-scale">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold">{systemName(s)}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                  <span>{c.tlLevels}</span>
                  {levels.map((l) => <span key={l} className="rounded-full border border-line bg-surface px-2 py-0.5 font-bold text-ink">{l}</span>)}
                </p>
              </div>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", DIRECTION_TONE[s.direction])}>
                <span aria-hidden="true">{DIRECTION_MARK[s.direction]} </span>{c.tlDirection[s.direction]}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-semibold text-ink-3">{c.tlRecent}</dt>
                <dd className="leblond-number mt-1 text-3xl leading-none">{s.recent.rate === null ? "—" : pct.format(s.recent.rate)}</dd>
                <dd className="mt-1 text-xs text-ink-2">{counts(s.recent)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-3">{c.tlPrevious}</dt>
                <dd className="leblond-number mt-1 text-xl leading-none text-ink-2">{s.previous.rate === null ? "—" : pct.format(s.previous.rate)}</dd>
                <dd className="mt-1 text-xs text-ink-2">{counts(s.previous)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-ink-3">{s.direction === "insufficient" ? fmt(c.tlInsufficient, { n: TOP_LEVEL_MIN }) : c.tlRule}</p>

            <ul aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-2">
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-accent" />{c.tlSentLegend}</li>
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-accent/25" />{c.tlTriedLegend}</li>
            </ul>
            <div aria-hidden="true" className="mt-2 grid items-end gap-x-[3px]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
              {s.weeks.map((w) => <div key={w.weekStart} className="flex h-20 flex-col justify-end"
                title={fmt(c.tlWeekPoint, { date: full.format(at(w.weekStart)), sent: w.sent, tried: w.tried })}>
                {w.tried > 0 ? <div className="flex w-full flex-col overflow-hidden rounded-t-sm" style={{ height: `${(w.tried / max) * 100}%` }}>
                  <span className="w-full flex-1 bg-accent/25" style={{ flexGrow: w.tried - w.sent }} />
                  <span className="w-full bg-accent" style={{ flexGrow: w.sent, flexBasis: 0 }} />
                </div> : <span className="h-px w-full bg-line" />}
              </div>)}
              {s.weeks.map((w, i) => <span key={w.weekStart} className={cn("mt-1 whitespace-nowrap text-[11px] tabular-nums text-ink-3",
                (n - 1 - i) % every !== 0 && "invisible", i === n - 1 ? "justify-self-end" : i === 0 ? "justify-self-start" : "justify-self-center")}>
                {short.format(at(w.weekStart))}
              </span>)}
            </div>

            <div className="sr-only"><table>
              <caption>{fmt(c.tlCaption, { levels: levels.join(", ") })} · {systemName(s)}</caption>
              <thead><tr><th scope="col">{c.week}</th><th scope="col">{c.tlTriedCol}</th><th scope="col">{c.tlSentCol}</th></tr></thead>
              <tbody>{s.weeks.map((w) => <tr key={w.weekStart}>
                <th scope="row">{full.format(at(w.weekStart))}</th><td>{w.tried}</td><td>{w.sent}</td>
              </tr>)}</tbody>
            </table></div>
          </li>;
        })}
      </ul>}
  </section>;
}
