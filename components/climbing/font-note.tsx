import Link from "next/link";
import type { ConversionSummary } from "@/lib/analytics/font-view";
import { confidenceBand } from "@/lib/grading/harmonise";
import { gradeLabel } from "@/lib/grading/labels";
import { fmt, type Dictionary, type Locale } from "@/lib/i18n";
import { gradeHarmoniseDictionary } from "@/lib/i18n/grade-harmonise";
import { cn } from "@/components/ui/cn";

/**
 * What a Font figure is made of: how many boulders were converted from which
 * gym scale and by which source (an estimate), which grades had no line and
 * were counted apart, and the rule that turns a span into one grade. Figures
 * come from conversionSummary (lib/analytics/font-view); this only words them.
 */
export function FontNote({ t, locale, summary, className }: { t: Dictionary; locale: Locale; summary: ConversionSummary; className?: string }) {
  const h = gradeHarmoniseDictionary(locale);
  const scale = (s: string) => (t.grades.systems as Record<string, string>)[s] ?? s;
  const convertedTotal = summary.convertedTotal;
  if (!convertedTotal && !summary.unconverted.length && !summary.font) return null;
  return <div className={cn("space-y-1 text-xs text-ink-3", className)} data-testid="font-note">
    <p><span className="mr-1.5 rounded-full border border-warn/40 px-2 py-0.5 font-bold text-ink-2">{h.note.label}</span>
      {convertedTotal ? fmt(h.note.converted, {
        n: convertedTotal,
        list: summary.converted.map((c) => fmt(h.note.convertedItem, { scale: scale(c.system), n: c.problems, source: h.source[c.source] })).join(" · "),
      }) : h.note.allFont}
      {convertedTotal && summary.font ? ` ${fmt(h.note.alreadyFont, { n: summary.font })}` : null}
    </p>
    {summary.unconverted.length ? <p data-testid="font-note-unconverted">{fmt(h.note.unconverted, {
      list: summary.unconverted.map((u) => fmt(h.note.unconvertedItem, { grade: gradeLabel(t, u.system, u.grade), scale: scale(u.system), n: u.problems })).join(" · "),
    })}</p> : null}
    {convertedTotal ? <p>
      {h.note.rule}
      {summary.weakestConfidence !== null ? ` ${fmt(h.note.weakest, { band: h.confidence[confidenceBand(summary.weakestConfidence)] })}` : null}{" "}
      <Link href="/settings/grades" className="font-bold text-accent underline underline-offset-2">{h.note.refine}</Link>
    </p> : null}
  </div>;
}
