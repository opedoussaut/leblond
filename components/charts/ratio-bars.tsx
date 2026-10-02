/** Horizontal sent/attempted bars. The label and counts are always visible as text. */
export function RatioBars({
  rows,
}: {
  rows: Array<{ key: string; label: React.ReactNode; sent: number; attempted: number; note?: string }>;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = r.attempted ? (r.sent / r.attempted) * 100 : 0;
        return (
          <li key={r.key} className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3">
            <span className="min-w-0 truncate text-sm">{r.label}</span>
            <span className="h-3 rounded-full bg-surface-2" aria-hidden>
              <span className="block h-3 rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-right text-sm tabular-nums">
              {r.sent}/{r.attempted}
              {r.note ? <span className="block text-[11px] text-ink-3">{r.note}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
