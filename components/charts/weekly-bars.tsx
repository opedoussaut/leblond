import type { WeekBucket } from "@/lib/analytics";
import { fmt, intlLocale, type Locale } from "@/lib/i18n";

const DAY_MS = 86_400_000;

/**
 * Weekly activity: one bar per week (tops), the week's Monday under it and the
 * number of sessions below. Built in HTML (not a scaled SVG) so text keeps the
 * same size on a phone and on a desktop. The values are also a visually-hidden
 * table for screen readers; each column has a tooltip with the full date.
 */
export function WeeklyBars({
  weeks,
  locale,
  labels,
}: {
  weeks: WeekBucket[];
  locale: Locale;
  labels: { tops: string; sessions: string; caption: string; range: string; help: string; weekOf: string };
}) {
  if (weeks.length === 0) return null;
  const max = Math.max(1, ...weeks.map((w) => w.tops));
  const tz = { timeZone: "UTC" } as const; // weekStart is a UTC Monday (YYYY-MM-DD)
  const short = new Intl.DateTimeFormat(intlLocale(locale), { ...tz, day: "numeric", month: "short" });
  const full = new Intl.DateTimeFormat(intlLocale(locale), { ...tz, day: "numeric", month: "long", year: "numeric" });
  const first = new Date(`${weeks[0].weekStart}T00:00:00Z`);
  const lastSunday = new Date(new Date(`${weeks.at(-1)!.weekStart}T00:00:00Z`).getTime() + 6 * DAY_MS);
  const range = new Intl.DateTimeFormat(intlLocale(locale), { ...tz, day: "numeric", month: "short", year: "numeric" })
    .formatRange(first, lastSunday);
  const columns = `auto repeat(${weeks.length}, minmax(0, 1fr))`;

  return (
    <figure>
      <figcaption className="text-xs text-ink-3">
        {fmt(labels.range, { n: weeks.length, range })}
        <span className="mt-0.5 block">{labels.help}</span>
      </figcaption>
      <div aria-hidden className="mt-3 grid items-end gap-x-1" style={{ gridTemplateColumns: columns }}>
        <span />
        {weeks.map((w) => (
          <div
            key={w.weekStart}
            title={`${fmt(labels.weekOf, { date: full.format(new Date(`${w.weekStart}T00:00:00Z`)) })} : ${w.tops} ${labels.tops} · ${w.sessions} ${labels.sessions}`}
            className="flex h-32 flex-col items-center justify-end"
          >
            {w.tops > 0 ? <span className="mb-1 text-xs font-semibold tabular-nums text-ink-2">{w.tops}</span> : null}
            <span
              className="w-full max-w-8 rounded-t bg-accent"
              style={{ height: w.tops > 0 ? `max(2px, ${(w.tops / max) * 100 * 0.8}%)` : 0 }}
            />
          </div>
        ))}

        <span />
        {weeks.map((w, i) => (
          <span
            key={w.weekStart}
            className={
              "mt-1 border-t border-line pt-1 text-center text-[11px] leading-tight text-ink-3 " +
              // Every other date on a phone; the last week always.
              (i % 2 === (weeks.length - 1) % 2 ? "" : "max-sm:invisible")
            }
          >
            {short.format(new Date(`${w.weekStart}T00:00:00Z`))}
          </span>
        ))}

        <span className="pr-1 pt-1 text-[11px] text-ink-3">{labels.sessions}</span>
        {weeks.map((w) => (
          <span key={w.weekStart} className="pt-1 text-center text-xs tabular-nums text-ink-2">
            {w.sessions > 0 ? w.sessions : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{labels.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{fmt(labels.weekOf, { date: "" }).trim()}</th>
            <th scope="col">{labels.tops}</th>
            <th scope="col">{labels.sessions}</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart}>
              <th scope="row">{full.format(new Date(`${w.weekStart}T00:00:00Z`))}</th>
              <td>{w.tops}</td>
              <td>{w.sessions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
