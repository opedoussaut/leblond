import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/card";
import { Fold } from "@/components/ui/fold";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { GradeCorrespondenceEditor, type CorrespondenceRow } from "@/components/settings/grade-correspondence-editor";
import { requireViewer } from "@/lib/auth/viewer";
import { loadCorrespondenceOverrides } from "@/lib/data/grade-correspondences";
import { DEFAULT_BOULDER_TABLE, TABLE_SOURCES, conversionTable, convertibleSystems, formatSpan } from "@/lib/grading/harmonise";
import { listGrades } from "@/lib/grading/ordering";
import { gradeHarmoniseDictionary } from "@/lib/i18n/grade-harmonise";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Correspondance des cotations" };

/** Réglages › Cotations: the native grade → Font table Progrès uses, one scale per fold, each line adjustable. */
export default async function GradeCorrespondencePage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const h = gradeHarmoniseDictionary(locale);
  const table = conversionTable(await loadCorrespondenceOverrides(viewer.supabase));
  const systemNames = t.grades.systems as Record<string, string>;
  const scales = convertibleSystems().map((system) => {
    const defaults = DEFAULT_BOULDER_TABLE[system]!;
    const rows: CorrespondenceRow[] = listGrades(system).filter((g) => defaults[g.id]).map((g) => {
      const def = defaults[g.id], line = table.get(`${system}:${g.id}`) ?? def;
      return { grade: g.id, from: line.from, to: line.to, defaultFrom: def.from, defaultTo: def.to, defaultSpan: formatSpan(def), defaultSource: def.source };
    });
    return { system, rows, custom: rows.filter((r) => r.from !== r.defaultFrom || r.to !== r.defaultTo).length };
  });
  return (
    <div>
      <PageHeader icon={<PAGE_ICONS.settings />} title={h.settings.title} />
      <p className="mb-3"><Link href="/settings" className="inline-flex min-h-11 items-center text-sm font-bold text-accent underline underline-offset-2">← {h.settings.back}</Link></p>
      <Card className="space-y-2">
        <p className="text-sm text-ink-2">{h.settings.intro}</p>
        <p className="text-sm text-ink-2">{h.settings.routesNote}</p>
      </Card>
      <div className="mt-3 space-y-3">
        {scales.map(({ system, rows, custom }) => {
          const src = TABLE_SOURCES[system];
          return <Fold key={system} variant="card" title={systemNames[system] ?? system}
            hint={`${src ? h.source[src.source] : ""}${custom ? ` · ${custom} ${h.settings.custom}` : ""}`} testId={`scale-${system}`}>
            <Card>
              {src?.url ? <p className="mb-2 text-xs text-ink-3"><a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{h.settings.sourceLink}</a></p> : null}
              <GradeCorrespondenceEditor locale={locale} system={system} rows={rows} />
            </Card>
          </Fold>;
        })}
      </div>
    </div>
  );
}
