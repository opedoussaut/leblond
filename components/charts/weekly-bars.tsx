import type { WeekBucket } from "@/lib/analytics";

/**
 * Weekly activity: bars = tops, dots = sessions. Values are also exposed as a
 * visually-hidden table for screen readers.
 */
export function WeeklyBars({
  weeks,
  labels,
}: {
  weeks: WeekBucket[];
  labels: { tops: string; sessions: string; caption: string };
}) {
  const max = Math.max(1, ...weeks.map((w) => w.tops));
  const W = 320;
  const H = 120;
  const bw = W / weeks.length;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={labels.caption}>
        {weeks.map((w, i) => {
          const h = (w.tops / max) * (H - 10);
          return (
            <g key={w.weekStart}>
              <rect x={i * bw + 3} y={H - h} width={bw - 6} height={Math.max(h, w.tops ? 2 : 0)} rx={3} className="fill-accent" />
              {w.sessions > 0 ? (
                <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" className="fill-ink-3 text-[9px]">
                  {"•".repeat(Math.min(w.sessions, 4))}
                </text>
              ) : null}
              {w.tops > 0 ? (
                <text x={i * bw + bw / 2} y={H - h - 3} textAnchor="middle" className="fill-ink-2 text-[9px] tabular-nums">
                  {w.tops}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H} y2={H} className="stroke-line" />
      </svg>
      <figcaption className="mt-1 text-xs text-ink-3">
        ▮ {labels.tops} · • {labels.sessions}
      </figcaption>
      <table className="sr-only">
        <caption>{labels.caption}</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart}>
              <th scope="row">{w.weekStart}</th>
              <td>
                {w.tops} {labels.tops}
              </td>
              <td>
                {w.sessions} {labels.sessions}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
