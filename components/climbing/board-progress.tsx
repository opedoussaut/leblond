import type { BoardPyramid } from "@/lib/analytics/boards";
import { BOARD_NAMES } from "@/lib/climbing/boards";
import { fmt, type Locale } from "@/lib/i18n";
import { boardsDictionary } from "@/lib/i18n/boards";
import { boulderGrade } from "@/lib/grading/display";

/** Board progress: one pyramid per board, angle and scale (figures from lib/analytics/boards). */
export function BoardProgress({ locale, pyramids, title }: { locale: Locale; pyramids: BoardPyramid[]; title?: string }) {
  const b = boardsDictionary(locale);
  if (!pyramids.length) return null;
  return <section aria-labelledby="board-progress-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
    <h2 id="board-progress-heading" className="text-lg font-bold">{title ?? b.progressTitle}</h2>
    <p className="mt-1 text-sm text-ink-2">{b.progressHint}</p>
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {pyramids.map((p) => {
        const max = Math.max(...p.rows.map((r) => r.sends));
        return <figure key={`${p.board}|${p.angle}|${p.scale}`} className="rounded-xl bg-surface-2 p-4">
          <figcaption>
            <strong className="block">{fmt(b.pyramidTitle, { board: BOARD_NAMES[p.board], angle: p.angle, scale: b.scales[p.scale] })}</strong>
            <span className="text-xs text-ink-2">{fmt(b.pyramidCount, { n: p.climbs, top: p.top })}</span>
          </figcaption>
          <ul className="mt-3 space-y-1.5">
            {p.rows.map((r) => <li key={r.grade} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 text-sm">
              <span className="font-display font-black tabular-nums">{boulderGrade(r.grade)}</span>
              <span className="flex justify-center" aria-hidden="true">
                <span className="h-3 rounded-full bg-accent" style={{ width: `${Math.max(8, Math.round((r.sends / max) * 100))}%` }} />
              </span>
              <span className="tabular-nums text-ink-2">{r.sends} {b.sends}{r.flashes ? ` · ${r.flashes} flash` : ""}</span>
            </li>)}
          </ul>
        </figure>;
      })}
    </div>
  </section>;
}
