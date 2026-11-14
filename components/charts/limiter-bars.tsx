import type { LimiterCount } from "@/lib/analytics/notebook";
import { fmt, type Locale } from "@/lib/i18n";
import { notebookDictionary } from "@/lib/i18n/notebook";

/** How often each limiter was ticked in the period's climbing sessions (self-reported). */
export function LimiterBars({ locale, rows, sessions }: { locale: Locale; rows: LimiterCount[]; sessions: number }) {
  const n = notebookDictionary(locale);
  const max = Math.max(1, ...rows.map((r) => r.sessions));
  return <div className="space-y-2">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-base font-bold">{n.limitTitle}</h3>
      {sessions ? <p className="text-xs text-ink-3">{fmt(n.limitOf, { n: sessions })}</p> : null}
    </div>
    <p className="text-sm text-ink-2">{rows.length ? n.limitHint : n.limitEmpty}</p>
    {rows.length ? <>
      <ul aria-hidden="true" className="space-y-2 pt-1">
        {rows.map((r) => <li key={r.limiter} className="grid grid-cols-[7.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
          <span className="truncate font-semibold">{n.limiters[r.limiter]}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.sessions / max) * 100}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{r.sessions}</span>
        </li>)}
      </ul>
      <div className="sr-only"><table>
        <caption>{n.limitTitle}</caption>
        <tbody>{rows.map((r) => <tr key={r.limiter}><td>{n.limiters[r.limiter]}</td><td>{r.sessions}</td></tr>)}</tbody>
      </table></div>
    </> : null}
  </div>;
}
