"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GradeChip } from "@/components/climbing/grade-chip";
import { useI18n } from "@/components/i18n-provider";
import { Select } from "@/components/ui/field";
import { resetGradeCorrespondences, saveGradeCorrespondence } from "@/lib/actions/grade-correspondences";
import type { GradeSystem } from "@/lib/climbing/types";
import { boulderGrade } from "@/lib/grading/display";
import { FONT_SCALE, type FontGrade } from "@/lib/grading/systems";
import { fmt, type Locale } from "@/lib/i18n";
import { gradeHarmoniseDictionary } from "@/lib/i18n/grade-harmonise";
import type { ConversionSource } from "@/lib/grading/harmonise";

export type CorrespondenceRow = {
  grade: string;
  from: FontGrade; to: FontGrade;
  defaultFrom: FontGrade; defaultTo: FontGrade;
  defaultSpan: string;
  defaultSource: ConversionSource;
};

/** Font grades offered in the pickers: 3a → 8C+ (gym circuits stay inside). */
const OPTIONS = FONT_SCALE.slice(FONT_SCALE.indexOf("3a"), FONT_SCALE.indexOf("9A"));

/** One scale's correspondence lines, each editable on its own; saved as soon as it changes. */
export function GradeCorrespondenceEditor({ locale, system, rows }: { locale: Locale; system: GradeSystem; rows: CorrespondenceRow[] }) {
  const { t } = useI18n();
  const h = gradeHarmoniseDictionary(locale).settings;
  const sources = gradeHarmoniseDictionary(locale).source;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ grade: string; ok: boolean } | null>(null);
  const [lines, setLines] = useState(() => Object.fromEntries(rows.map((r) => [r.grade, { from: r.from, to: r.to }])));
  const anyCustom = rows.some((r) => lines[r.grade].from !== r.defaultFrom || lines[r.grade].to !== r.defaultTo);

  function save(grade: string, from: FontGrade, to: FontGrade) {
    // Keep the span ordered: moving one end past the other moves both.
    const fi = FONT_SCALE.indexOf(from), ti = FONT_SCALE.indexOf(to);
    const next = fi <= ti ? { from, to } : { from, to: from };
    setLines((l) => ({ ...l, [grade]: next }));
    start(async () => {
      const r = await saveGradeCorrespondence({ system, grade, from: next.from, to: next.to });
      setStatus({ grade, ok: r.ok });
      if (r.ok) router.refresh();
    });
  }
  function resetAll() {
    start(async () => {
      const r = await resetGradeCorrespondences(system);
      if (r.ok) {
        setLines(Object.fromEntries(rows.map((row) => [row.grade, { from: row.defaultFrom, to: row.defaultTo }])));
        router.refresh();
      }
      setStatus({ grade: "*", ok: r.ok });
    });
  }

  return <div className="space-y-2" data-testid={`correspondence-${system}`}>
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const line = lines[r.grade];
        const custom = line.from !== r.defaultFrom || line.to !== r.defaultTo;
        const id = `corr-${system}-${r.grade}`;
        return <li key={r.grade} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="min-w-0">
            <GradeChip t={t} system={system} grade={r.grade} size="sm" />
            <p className="mt-1 text-xs text-ink-3">
              {fmt(h.defaultLine, { span: r.defaultSpan })} · {sources[r.defaultSource]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${id}-from`} className="text-sm text-ink-2">{h.from}</label>
            <div className="w-28">
            <Select id={`${id}-from`} value={line.from} disabled={pending}
              onChange={(e) => save(r.grade, e.target.value as FontGrade, line.to)}>
              {OPTIONS.map((g) => <option key={g} value={g}>{boulderGrade(g)}</option>)}
            </Select></div>
            <label htmlFor={`${id}-to`} className="text-sm text-ink-2">{h.to}</label>
            <div className="w-28">
            <Select id={`${id}-to`} value={line.to} disabled={pending}
              onChange={(e) => save(r.grade, line.from, e.target.value as FontGrade)}>
              {OPTIONS.map((g) => <option key={g} value={g}>{boulderGrade(g)}</option>)}
            </Select></div>
            {custom ? <button type="button" disabled={pending} onClick={() => save(r.grade, r.defaultFrom, r.defaultTo)}
              className="min-h-11 px-2 text-sm font-bold text-accent underline underline-offset-2">{h.reset}</button> : null}
            <span aria-live="polite" className="text-xs font-semibold text-ink-3">
              {status?.grade === r.grade ? (status.ok ? h.saved : h.error) : custom ? h.custom : ""}
            </span>
          </div>
        </li>;
      })}
    </ul>
    {anyCustom ? <button type="button" disabled={pending} onClick={resetAll}
      className="min-h-11 text-sm font-bold text-accent underline underline-offset-2">{h.resetScale}</button> : null}
    {status?.grade === "*" && !status.ok ? <p role="alert" className="text-sm text-danger">{h.error}</p> : null}
  </div>;
}
