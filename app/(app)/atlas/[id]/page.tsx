import Link from "next/link";
import { notFound } from "next/navigation";
import { AtlasIllustration } from "@/components/training/atlas-illustration";
import { AtlasRadar } from "@/components/training/atlas-radar";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { atlasDetail } from "@/lib/training/atlas";
import { TRAINING_CATALOGUE } from "@/lib/training/catalogue";
import { trainingDictionary } from "@/lib/i18n/training";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { templateFor } from "@/lib/training/session-templates";

export async function generateMetadata({params}:PageProps<"/atlas/[id]">){
  const {id}=await params; const entry=TRAINING_CATALOGUE.find(e=>e.id===id);
  return {title:entry?"LEBLOND Atlas — "+entry.title:"Training Atlas"};
}
export default async function AtlasDetailPage({params}:PageProps<"/atlas/[id]">){
  const viewer=await requireViewer();
  const {locale}=await getI18n(viewer.profile.preferred_language);
  const {id}=await params;
  const entry=TRAINING_CATALOGUE.find(item=>item.id===id);
  if(!entry)notFound();
  const info=atlasDetail(entry),t=trainingDictionary(locale),ts=trainingSessionDictionary(locale);
  const executable=METHODS_FOR_PLANS.some(m=>m.id===entry.id);
  return <div className="space-y-6 pb-10">
    <Link className="text-sm font-semibold text-accent underline" href="/atlas">← Training Atlas</Link>
    <div>
      <p className="leblond-eyebrow text-accent">{t.groups[entry.category]} · {t.evidence[entry.evidence]}</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{entry.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{info.summary[locale]}</p>
    </div>
    <AtlasRadar entries={[entry]} locale={locale} heading={t.compare}/>
    <AtlasIllustration type={info.drawing} locale={locale}/>
    <section className="leblond-premium-surface p-5">
      <h2 className="text-xl font-extrabold">{locale==="fr"?"Préparation et matériel":"Setup and equipment"}</h2>
      <p className="mt-3 leading-relaxed text-ink-2">{info.preparation[locale]}</p>
      <p className="mt-3 text-sm text-ink-3">{locale==="fr"?"Niveau conseillé":"Suitable experience"} : {info.level[locale]}</p>
    </section>
    <section className="leblond-premium-surface p-5">
      <h2 className="text-xl font-extrabold">{locale==="fr"?"Comment pratiquer":"How to use it"}</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-ink-2">{info.steps.map((step,i)=><li key={i}>{step[locale]}</li>)}</ol>
    </section>
    <section className="leblond-premium-surface p-5">
      <h2 className="text-xl font-extrabold">{locale==="fr"?"Quoi mesurer ?":"What to track"}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{info.observe[locale]}</p>
    </section>
    {entry.caution?<p className="rounded-xl border border-warn p-4 text-sm text-ink-2">{entry.caution[locale]}</p>:null}
    <section className="leblond-premium-surface p-5">
      <h2 className="text-xl font-extrabold">{locale==="fr"?"Ressources et vidéos":"Resources and videos"}</h2>
      <div className="mt-3 space-y-3">
        {[entry.source,...(info.reference?[info.reference]:[]),...(info.video?[info.video]:[])].map((source,i)=>
          <a key={i} href={source.url} rel="noopener noreferrer" target="_blank"
            className="block rounded-xl border border-line p-3 text-sm font-semibold text-accent underline underline-offset-2 hover:bg-surface-2">
            {"title" in source ? source.title[locale] : source.label} ↗
          </a>
        )}
      </div>
      {!info.video?<p className="mt-3 text-xs text-ink-3">{locale==="fr"
        ?"Aucune vidéo spécifique n’a encore été vérifiée pour cette fiche ; consulter les sources officielles ci-dessus."
        :"No specific video was verified for this entry yet; consult its official resources above."}</p>:null}
    </section>
    {executable?<section className="leblond-premium-surface p-5" aria-labelledby="workload-heading">
      <h2 id="workload-heading" className="text-xl font-extrabold">{locale==="fr"?"Séance type et charge de départ":"Sample session and starting workload"}</h2>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">{locale==="fr"
        ?"Valeurs de départ prudentes issues de pratiques d’entraînement courantes, et non des prescriptions individuelles ou des optimums démontrés. Ajuste-les à ton expérience, ta récupération et l’absence de douleur."
        :"Conservative starting values from common coaching practice — not individual prescriptions or proven optima. Adjust to your experience, recovery and the absence of pain."}</p>
      <ol className="mt-4 space-y-3">
        {templateFor(entry.id,60).map((ex)=><li key={ex.key} className="rounded-xl border border-line p-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-3">{ts.block[ex.block]}</p>
          <p className="mt-1 font-extrabold">{ex.name[locale]}</p>
          <p className="mt-1 font-semibold text-ink">{[ex.targetSets?ex.targetSets+" "+(ex.targetSets>1?ts.sets:ts.set.toLowerCase()):null,ex.targetReps?ex.targetReps+" "+ts.reps:null,
            ex.targetSeconds?(ex.modality==="TIME"||ex.modality==="FREE"?Math.round(ex.targetSeconds/60)+" min":ex.targetSeconds+" s"):null,
            ex.restSeconds?ts.rest+" "+ex.restSeconds+" s":null].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-ink-2">{ts.intensity} : {ex.intensity[locale]}</p>
          {ex.adaptation?<p className="mt-1 text-ink-2"><strong>{locale==="fr"?"Progression / régression":"Progression / regression"} :</strong> {ex.adaptation[locale]}</p>:null}
          {ex.safety?<p className="mt-1 text-ink-2"><strong>{ts.safety} :</strong> {ex.safety[locale]}</p>:null}
        </li>)}
      </ol>
    </section>:null}
    <section aria-label={locale==="fr"?"Utiliser cette méthode":"Use this method"} className="grid gap-3 sm:grid-cols-3">
      {executable?<Link href={"/train/sessions?method="+encodeURIComponent(entry.id)}
        className="flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 py-3 text-center text-sm font-bold text-accent-ink">
        ▶ {ts.startFromAtlas}
      </Link>:null}
      {executable?<Link href={"/training-plans?add="+encodeURIComponent(entry.id)}
        className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-accent">
        + {ts.addToPlan}
      </Link>:null}
      <Link href={"/calendar?method="+encodeURIComponent(entry.id)}
        className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-5 py-3 text-center text-sm font-bold text-accent">
        {locale==="fr"?"Planifier dans mon calendrier":"Schedule in my calendar"} ↗
      </Link>
    </section>
    <p className="text-xs text-ink-3">{t.warning}</p>
  </div>;
}
