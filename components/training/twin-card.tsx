import type { TwinGrade, TwinState } from "@/lib/analytics/twin";
import { boulderGrade } from "@/lib/grading/display";
import { fmt, type Locale } from "@/lib/i18n";
import { rivalDictionary } from "@/lib/i18n/rival";

/**
 * The twin explained: where it is, where the same model puts the climber,
 * where the climber measured, and why they differ. It states the gap and
 * never prescribes work to close it.
 */
export function TwinCard({ locale, name, twin, measured }: {
  locale: Locale; name: string; twin: TwinState; measured: { boulder: string | null; route: string | null };
}) {
  const t = rivalDictionary(locale).twin;
  const rows = [
    { label: t.boulder, rival: twin.boulder, you: twin.youModel.boulder, measured: measured.boulder, show: boulderGrade, source: twin.startSource.boulder, start: twin.start.boulder },
    { label: t.route, rival: twin.route, you: twin.youModel.route, measured: measured.route, show: (g: string) => g, source: twin.startSource.route, start: twin.start.route },
  ].filter((r) => r.rival);
  if (!rows.length) return null;
  const grade = (g: TwinGrade | null, show: (g: string) => string) => (g ? show(g.grade) : "—");
  const towards = (g: TwinGrade, show: (g: string) => string) =>
    g.next ? fmt(t.towards, { pct: Math.round(g.towardsNext * 100), next: show(g.next) }) : "";
  const gapLine = twin.gap === null ? null : twin.gap >= 0.1 ? fmt(t.gap, { gap: twin.gap.toLocaleString(locale) }) : twin.gap <= -0.1 ? t.ahead : t.even;

  return <section aria-labelledby="twin-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6" data-testid="twin-card">
    <div>
      <h2 id="twin-heading" className="text-lg font-bold">{fmt(t.title, { name })}</h2>
      <p className="mt-1 text-sm text-ink-2">{t.intro}</p>
    </div>
    <div className="space-y-3">
      {rows.map((r) => <div key={r.label} className="rounded-xl bg-surface-2 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-3">{r.label}</p>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div className="min-w-0">
            <dt className="min-h-8 text-xs text-ink-3">{fmt(t.rivalNow, { name })}</dt>
            <dd className="text-xl font-black tabular-nums">{grade(r.rival, r.show)}</dd>
            {r.rival ? <dd className="text-xs text-ink-3">{towards(r.rival, r.show)}</dd> : null}
          </div>
          <div className="min-w-0">
            <dt className="min-h-8 text-xs text-ink-3">{t.youModel}</dt>
            <dd className="text-xl font-black tabular-nums text-ink-2">{grade(r.you, r.show)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="min-h-8 text-xs text-ink-3">{t.youMeasured}</dt>
            <dd className="text-xl font-black tabular-nums text-ink-2">{r.measured ? r.show(r.measured) : "—"}</dd>
          </div>
        </dl>
        {r.start ? <p className="mt-2 text-xs text-ink-3">
          {fmt(r.source === "measured" ? t.startMeasured : t.startPact, { grade: r.show(r.start) })}
        </p> : null}
      </div>)}
    </div>
    {gapLine ? <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm font-semibold">{gapLine}</p> : null}
    <ul className="space-y-1 text-sm text-ink-2">
      <li>{fmt(t.adherence, { planned: twin.adherence.planned, done: twin.adherence.done })}</li>
      <li>{fmt(t.load, { name, twin: twin.adherence.twinLoad, you: twin.adherence.youLoad })}</li>
      <li>{fmt(t.formLine, { name, form: t.form[twin.form.twin] })}</li>
      <li>{twin.calibration.factor !== 1
        ? fmt(t.calibrated, { factor: twin.calibration.factor.toLocaleString(locale, { maximumFractionDigits: 2 }), weeks: twin.calibration.weeks })
        : t.notCalibrated}</li>
    </ul>
    <p className="text-xs leading-relaxed text-ink-3">{t.model}</p>
  </section>;
}
