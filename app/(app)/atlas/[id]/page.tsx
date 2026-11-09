import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AtlasDiagramFigure } from "@/components/training/atlas-diagram";
import { AtlasRadar } from "@/components/training/atlas-radar";
import { buttonClass } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/viewer";
import { atlasDictionary } from "@/lib/i18n/atlas";
import type { Locale } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { trainingDictionary } from "@/lib/i18n/training";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { atlasDetail } from "@/lib/training/atlas";
import { METHODS_FOR_PLANS, TRAINING_CATALOGUE, type Localized } from "@/lib/training/catalogue";
import { templateFor } from "@/lib/training/session-templates";

export async function generateMetadata({ params }: PageProps<"/atlas/[id]">) {
  const { id } = await params;
  const entry = TRAINING_CATALOGUE.find((e) => e.id === id);
  return { title: entry ? "LEBLOND Atlas — " + entry.title : "Training Atlas" };
}

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className="leblond-premium-surface p-5" aria-labelledby={id}>
    <h2 id={id} className="text-lg font-extrabold">{title}</h2>
    {children}
  </section>;
}

function Bullets({ items, locale, ordered = false }: { items: readonly Localized[]; locale: Locale; ordered?: boolean }) {
  const className = "mt-3 space-y-2 pl-5 text-sm leading-relaxed text-ink-2 " + (ordered ? "list-decimal" : "list-disc");
  const children = items.map((item, i) => <li key={i}>{item[locale]}</li>);
  return ordered ? <ol className={className}>{children}</ol> : <ul className={className}>{children}</ul>;
}

export default async function AtlasDetailPage({ params }: PageProps<"/atlas/[id]">) {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const { id } = await params;
  const entry = TRAINING_CATALOGUE.find((item) => item.id === id);
  if (!entry) notFound();
  const info = atlasDetail(entry);
  if (!info) notFound();
  const a = atlasDictionary(locale), t = trainingDictionary(locale), ts = trainingSessionDictionary(locale);
  const executable = METHODS_FOR_PLANS.some((m) => m.id === entry.id);

  return <div className="space-y-6 pb-10">
    <Link className="text-sm font-semibold text-accent underline" href="/atlas">{a.back}</Link>

    <header>
      <p className="leblond-eyebrow text-accent">{t.groups[entry.category]} · {t.evidence[entry.evidence]}</p>
      <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">{entry.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{info.summary[locale]}</p>
    </header>

    <Card id="atlas-brief" title={a.inBrief}>
      <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
        {([[a.trains, info.trains], [a.suits, info.suits], [a.level, info.level]] as const).map(([label, value]) =>
          <div key={label}>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{label}</dt>
            <dd className="mt-1 leading-relaxed text-ink-2">{value[locale]}</dd>
          </div>)}
      </dl>
    </Card>

    {entry.caution ? <p className="rounded-xl border border-warn p-4 text-sm text-ink-2">{entry.caution[locale]}</p> : null}

    <AtlasDiagramFigure spec={info.diagram} locale={locale} uid={entry.id}/>

    <Card id="atlas-protocol" title={a.protocol}>
      <table className="mt-3 w-full border-collapse text-sm">
        <tbody>
          {info.protocol.map((row) => <tr key={row.key} className="border-t border-line align-top first:border-t-0">
            <th scope="row" className="w-[34%] py-2 pr-3 text-left font-bold text-ink">{a.protocolKeys[row.key]}</th>
            <td className="py-2 leading-relaxed text-ink-2">{row.value[locale]}</td>
          </tr>)}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">{a.protocolNote}</p>
    </Card>

    <Card id="atlas-prerequisites" title={a.prerequisites}>
      <Bullets items={info.prerequisites} locale={locale}/>
    </Card>

    <Card id="atlas-howto" title={a.howTo}>
      <p className="mt-3 text-sm leading-relaxed text-ink-2"><strong className="text-ink">{a.setup}{a.sep}</strong>{info.preparation[locale]}</p>
      <Bullets items={info.steps} locale={locale} ordered/>
    </Card>

    <div className="grid gap-6 md:grid-cols-2">
      <Card id="atlas-progression" title={a.progression}><Bullets items={info.progression} locale={locale}/></Card>
      <Card id="atlas-mistakes" title={a.mistakes}><Bullets items={info.mistakes} locale={locale}/></Card>
      <Card id="atlas-safety" title={a.safety}><Bullets items={info.safety} locale={locale}/></Card>
      <Card id="atlas-variants" title={a.variants}><Bullets items={info.variants} locale={locale}/></Card>
    </div>

    <Card id="atlas-observe" title={a.observe}>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{info.observe[locale]}</p>
    </Card>

    <Card id="atlas-evidence" title={a.evidence}>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-accent">{t.evidence[entry.evidence]}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{info.evidenceNote[locale]}</p>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">{a.evidenceNote}</p>
    </Card>

    <AtlasRadar entries={[entry]} locale={locale} heading={a.compare}/>

    <Card id="atlas-sources" title={a.sources}>
      <p className="mt-2 text-xs text-ink-3">{a.sourcesNote}</p>
      <ul className="mt-4 space-y-3">
        {info.sources.some((s) => s.url === entry.source.url) ? null : <li className="rounded-xl border border-line p-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{a.mainSource}</p>
          <a href={entry.source.url} rel="noopener noreferrer" target="_blank"
            className="mt-1 inline-block font-semibold text-accent underline underline-offset-2">{entry.source.label} ↗</a>
        </li>}
        {info.sources.map((source) => <li key={source.url} className="rounded-xl border border-line p-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">
            {a.sourceKinds[source.kind]}{source.url === entry.source.url ? " · " + a.mainSource : ""}
          </p>
          <a href={source.url} rel="noopener noreferrer" target="_blank"
            className="mt-1 inline-block font-semibold leading-snug text-accent underline underline-offset-2">{source.citation} ↗</a>
          <p className="mt-2 leading-relaxed text-ink-2">{source.finding[locale]}</p>
        </li>)}
      </ul>
    </Card>

    {executable ? <Card id="atlas-sample" title={a.sampleSession}>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">{a.sampleNote}</p>
      <ol className="mt-4 space-y-3">
        {templateFor(entry.id, 60).map((ex) => <li key={ex.key} className="rounded-xl border border-line p-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{ts.block[ex.block]}</p>
          <p className="mt-1 font-extrabold">{ex.name[locale]}</p>
          <p className="mt-1 font-semibold text-ink">{[
            ex.targetSets ? ex.targetSets + " " + (ex.targetSets > 1 ? ts.sets : ts.set.toLowerCase()) : null,
            ex.targetReps ? ex.targetReps + " " + ts.reps : null,
            ex.targetSeconds ? (ex.modality === "TIME" || ex.modality === "FREE" ? Math.round(ex.targetSeconds / 60) + " min" : ex.targetSeconds + " s") : null,
            ex.restSeconds ? ts.rest + " " + ex.restSeconds + " s" : null,
          ].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-ink-2">{ts.intensity}{a.sep}{ex.intensity[locale]}</p>
          {ex.adaptation ? <p className="mt-1 text-ink-2"><strong>{a.progressionRegression}{a.sep}</strong>{ex.adaptation[locale]}</p> : null}
          {ex.safety ? <p className="mt-1 text-ink-2"><strong>{ts.safety}{a.sep}</strong>{ex.safety[locale]}</p> : null}
        </li>)}
      </ol>
    </Card> : null}

    <section aria-label={a.useMethod} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {executable ? <Link href={"/train/sessions?method=" + encodeURIComponent(entry.id)} className={buttonClass("primary", "md")}>
        ▶ {ts.startFromAtlas}
      </Link> : null}
      {executable ? <Link href={"/training-plans?add=" + encodeURIComponent(entry.id)} className={buttonClass("secondary", "md")}>
        + {ts.addToPlan}
      </Link> : null}
      <Link href={"/calendar?method=" + encodeURIComponent(entry.id)} className={buttonClass("secondary", "md")}>
        {a.scheduleCalendar} ↗
      </Link>
    </section>
    <p className="text-xs text-ink-3">{t.warning}</p>
  </div>;
}
