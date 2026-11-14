import type { RacePoint } from "@/lib/analytics/rival";
import { fmt, type Locale } from "@/lib/i18n";
import { chartsDictionary } from "@/lib/i18n/charts";
import { LinePlot } from "./line-plot";

/** Séances added up week by week, the climber against the rival at its level (figures from lib/analytics/rival). */
export function DuelRace({ locale, name, race, total }: { locale: Locale; name: string; race: RacePoint[]; total: number }) {
  if (!race.length) return null;
  const c = chartsDictionary(locale);
  const top = Math.max(1, ...race.map((r) => Math.max(r.you, r.rival)));
  const every = top > 8 ? Math.ceil(top / 4) : top > 4 ? 2 : 1;
  const ticks = Array.from({ length: Math.floor(top / every) + 1 }, (_, i) => ({ value: i * every, label: String(i * every) }));
  const columns = Math.max(2, Math.min(total, race.length + 1));
  const last = race.at(-1)!;
  const legend = [
    { label: `${c.you} · ${last.you}`, line: "border-accent" },
    { label: `${name} · ${last.rival}`, line: "border-ink-3 border-dashed" },
  ];
  return <section aria-labelledby="duel-race-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
    <h2 id="duel-race-heading" className="text-lg font-bold">{c.raceTitle}</h2>
    <p className="mt-1 text-sm text-ink-2">{c.raceHint}</p>
    <ul aria-hidden="true" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-ink-2">
      {legend.map((l) => <li key={l.label} className="flex items-center gap-2"><span className={`w-5 border-t-2 ${l.line}`} />{l.label}</li>)}
    </ul>
    <div className="mt-4">
      <LinePlot step columns={columns} yMin={0} yMax={top + every * 0.4} yTicks={ticks} height="h-36"
        xLabels={[{ x: 0, label: fmt(c.raceWeek, { n: 1 }) }, { x: columns - 1, label: fmt(c.raceWeek, { n: columns }) }]}
        series={[
          { id: "rival", label: name, tone: "muted", points: race.map((r, i) => ({ x: i, y: r.rival, title: `${fmt(c.raceWeek, { n: r.week })} · ${name} : ${r.rival}` })) },
          { id: "you", label: c.you, tone: "accent", points: race.map((r, i) => ({ x: i, y: r.you, title: `${fmt(c.raceWeek, { n: r.week })} · ${c.you} : ${r.you}` })) },
        ]} />
    </div>
    <table className="sr-only">
      <caption>{fmt(c.raceCaption, { name })}</caption>
      <thead><tr><th scope="col">{c.week}</th><th scope="col">{c.you}</th><th scope="col">{name}</th></tr></thead>
      <tbody>{race.map((r) => <tr key={r.week}><td>{r.week}</td><td>{r.you}</td><td>{r.rival}</td></tr>)}</tbody>
    </table>
  </section>;
}
