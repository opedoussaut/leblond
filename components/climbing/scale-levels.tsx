import { RatioBars } from "@/components/charts/ratio-bars";
import { GradeChip } from "@/components/climbing/grade-chip";
import { Card, SectionTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Explain } from "@/components/ui/stat";
import type { ScaleRow } from "@/lib/analytics/scale-rows";
import type { Dictionary } from "@/lib/i18n";

type Trend = NonNullable<ScaleRow["trend"]>;

const trendTone: Record<Trend, string> = {
  improving: "bg-ok/10 text-ok",
  stable: "bg-surface text-ink-2",
  declining: "bg-warn/10 text-warn",
  insufficient_data: "bg-surface text-ink-3",
};

function TrendPill({ t, trend }: { t: Dictionary; trend: ScaleRow["trend"] }) {
  if (!trend || trend === "insufficient_data") return null;
  return <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", trendTone[trend])}>{t.trend[trend]}</span>;
}

/**
 * The Progrès page's levels: one row per grading scale (working level, hardest
 * top, flash, tried, trend), the per-grade detail folded away. Replaces the
 * three separate lists and the trend card that repeated every scale.
 */
export function ScaleLevels({ t, rows, font }: {
  t: Dictionary; rows: ScaleRow[];
  /** The Font estimate's row; left out when the rows are already on Font (Progrès converts every boulder). */
  font?: { level: string | null; trend: ScaleRow["trend"] };
}) {
  const p = t.progress;
  const cell = (label: string, grade: string | null, system: ScaleRow["system"]) => (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-1 min-h-6">{grade ? <GradeChip t={t} system={system} grade={grade} /> : <span className="text-sm text-ink-3">—</span>}</dd>
    </div>
  );
  return <Card aria-labelledby="scale-levels">
    <SectionTitle><span id="scale-levels">{p.levelsTitle}</span></SectionTitle>
    <p className="mt-1 text-sm text-ink-2">{p.levelsIntro}</p>
    <ul className="mt-4 space-y-3">
      {rows.map((r) => <li key={r.system} className="rounded-2xl bg-surface-2 p-4" data-testid="scale-row">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-2">{t.grades.systems[r.system]}</h3>
          <TrendPill t={t} trend={r.trend} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <dt className="text-xs text-ink-3">{p.cellWorking}</dt>
            <dd className="mt-1">
              {r.working
                ? <GradeChip t={t} system={r.system} grade={r.working} showFont size="xl" />
                : <span className="text-sm text-ink-3">{p.notEnoughShort}</span>}
            </dd>
          </div>
          {cell(p.cellTop, r.top, r.system)}
          {cell(p.cellFlash, r.flash, r.system)}
          {cell(p.cellTried, r.tried, r.system)}
        </dl>
        {r.levels.length ? <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-accent">{p.gradeDetail}</summary>
          <div className="mt-1">
            <RatioBars rows={r.levels.map((l) => ({
              key: l.grade, label: <GradeChip t={t} system={r.system} grade={l.grade} size="sm" />, sent: l.sent, attempted: l.attempted,
            }))} />
          </div>
        </details> : null}
      </li>)}
    </ul>
    {font ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
      <p className="text-sm">
        <span className="text-ink-2">{t.home.workingGradeFont} : </span>
        {font.level
          ? <span className="font-bold">{font.level} <span className="font-normal text-ink-3">({t.common.estimate})</span></span>
          : <span className="text-ink-3">{p.notEnoughShort}</span>}
      </p>
      <TrendPill t={t} trend={font.trend} />
    </div> : null}
    <Explain summary={t.common.howCalculated}>{p.workingRule} {p.trendExplain}</Explain>
  </Card>;
}
