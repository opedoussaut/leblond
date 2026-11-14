import type { PyramidRow } from "@/lib/analytics/charts";
import type { GradeSystem } from "@/lib/climbing/types";
import { gradeLabel } from "@/lib/grading/labels";
import type { Dictionary, Locale } from "@/lib/i18n";
import { chartsDictionary } from "@/lib/i18n/charts";

/**
 * Boulders tried in the period by grade, hardest on top, centred like a
 * pyramid: flashed, sent, and still being worked (figures from lib/analytics/charts).
 */
export function GradePyramid({ t, locale, system, rows }: { t: Dictionary; locale: Locale; system: GradeSystem; rows: PyramidRow[] }) {
  if (!rows.length) return null;
  const c = chartsDictionary(locale);
  const max = Math.max(...rows.map((r) => r.sent + r.tried));
  const pct = (n: number) => `${(n / max) * 100}%`;
  const legend = [
    { label: c.flashed, swatch: "bg-accent" },
    { label: c.sent, swatch: "bg-accent/55" },
    { label: c.tried, swatch: "border-2 border-accent/45 bg-surface" },
  ];
  return <section aria-labelledby="grade-pyramid-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
    <h2 id="grade-pyramid-heading" className="text-lg font-bold">{c.pyramidTitle}</h2>
    <p className="mt-1 text-sm text-ink-2">{c.pyramidHint}</p>
    <ul aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {legend.map((l) => <li key={l.label} className="flex items-center gap-1.5"><span className={`size-3 rounded-sm ${l.swatch}`} />{l.label}</li>)}
    </ul>
    <ul aria-hidden="true" className="mt-4 space-y-1.5">
      {rows.map((r) => <li key={r.grade} className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-sm"
        title={`${gradeLabel(t, system, r.grade)} : ${r.flashed} ${c.flashed.toLowerCase()}, ${r.sent - r.flashed} ${c.sent.toLowerCase()}, ${r.tried} ${c.tried.toLowerCase()}`}>
        <span className="truncate font-display font-black tabular-nums">{gradeLabel(t, system, r.grade)}</span>
        <span className="flex h-4 justify-center gap-0.5">
          {r.flashed ? <span className="rounded-l bg-accent" style={{ width: pct(r.flashed) }} /> : null}
          {r.sent - r.flashed ? <span className="bg-accent/55" style={{ width: pct(r.sent - r.flashed) }} /> : null}
          {r.tried ? <span className="rounded-r border-2 border-accent/45" style={{ width: pct(r.tried) }} /> : null}
        </span>
        <span className="text-right tabular-nums text-ink-2">{r.sent}<span className="text-ink-3">/{r.sent + r.tried}</span></span>
      </li>)}
    </ul>
    <table className="sr-only">
      <caption>{c.pyramidTitle}</caption>
      <thead><tr><th scope="col">{c.grade}</th><th scope="col">{c.flashed}</th><th scope="col">{c.sent}</th><th scope="col">{c.tried}</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.grade}>
        <td>{gradeLabel(t, system, r.grade)}</td><td>{r.flashed}</td><td>{r.sent}</td><td>{r.tried}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}
