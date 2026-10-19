"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkingGradeChart } from "./grade-progress";
import type { ObservedWorkingGrade } from "@/lib/training/grade-history";
import { createTrainingAssessment, deleteTrainingAssessment, saveTrainingCheckin } from "@/lib/actions/training-assessments";
import type { Locale } from "@/lib/i18n";
import { assessmentDictionary } from "@/lib/i18n/assessment";
import { trainingDictionary } from "@/lib/i18n/training";
import { DEFAULT_SKILLS, RATING_ANCHORS, SKILL_PROMPTS, elapsedWeeks, expectedRatingsAtWeek, methodMatches, type SavedAssessment, type SavedCheckin, type SkillRatings } from "@/lib/training/assessment";
import { METHODS_FOR_PLANS, TRAINING_AXES, type TrainingAxis } from "@/lib/training/catalogue";

const LINE_COLORS = { baseline: "#8093a8", expected: "#297cc8", actual: "#173e66" } as const;
const OPTIONS = [4, 8, 12, 16, 24];

function radarPoint(index: number, radius: number) {
  const rad = -Math.PI / 2 + index * Math.PI / 3;
  return { x: 340 + radius * Math.cos(rad), y: 221 + radius * Math.sin(rad) };
}
function radarPolygon(ratings: SkillRatings, radius = 143) {
  return TRAINING_AXES.map((axis, i) => {
    const p = radarPoint(i, radius * ratings[axis] / 5);
    return p.x.toFixed(1) + "," + p.y.toFixed(1);
  }).join(" ");
}

export function ProfileRadar({ locale, baseline, expected, actual }: {
  locale: Locale; baseline: SkillRatings; expected: SkillRatings; actual: SkillRatings | null;
}) {
  const t = trainingDictionary(locale);
  const a = assessmentDictionary(locale);
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 sm:p-5">
      <h3 className="text-base font-black">{a.radar}</h3>
      <svg viewBox="0 0 680 462" className="mt-1 w-full" role="img" aria-label={a.radar}>
        {[1,2,3,4,5].map(n => <polygon key={n}
          points={radarPolygon(Object.fromEntries(TRAINING_AXES.map(axis => [axis,n])) as SkillRatings)}
          stroke="currentColor" strokeOpacity=".16" fill="none"/>)}
        {TRAINING_AXES.map((axis,i)=>{
          const end=radarPoint(i,143), label=radarPoint(i,188);
          return <g key={axis}>
            <line x1="340" y1="221" x2={end.x} y2={end.y} stroke="currentColor" strokeOpacity=".18"/>
            <text x={label.x} y={label.y+5} fill="currentColor" textAnchor="middle" fontSize="13" fontWeight="600">{t.axis[axis]}</text>
          </g>;
        })}
        <polygon points={radarPolygon(baseline)} fill={LINE_COLORS.baseline} fillOpacity=".06" stroke={LINE_COLORS.baseline} strokeWidth="2" strokeDasharray="6 4"/>
        <polygon points={radarPolygon(expected)} fill={LINE_COLORS.expected} fillOpacity=".14" stroke={LINE_COLORS.expected} strokeWidth="3"/>
        {actual ? <polygon points={radarPolygon(actual)} fill={LINE_COLORS.actual} fillOpacity=".1" stroke={LINE_COLORS.actual} strokeWidth="3"/> : null}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold">
        {([["baseline",a.baseline],["expected",a.estimated],...(actual ? [["actual",a.actual] as const] : [])] as Array<[keyof typeof LINE_COLORS,string]>).map(([key,label])=>
          <div className="flex items-center gap-2" key={key}><span className="h-2.5 w-2.5 rounded-full" style={{background:LINE_COLORS[key]}}/>{label}</div>)}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-3">{a.radarHelp}</p>
    </div>
  );
}

export function SkillSliders({ locale, ratings, onChange }: {
  locale: Locale; ratings: SkillRatings; onChange: (ratings: SkillRatings) => void;
}) {
  const t = trainingDictionary(locale);
  const a = assessmentDictionary(locale);
  return <div className="space-y-4">
    {TRAINING_AXES.map((axis) => <label key={axis} className="block rounded-xl border border-line bg-surface px-4 py-3">
      <span className="flex items-center justify-between gap-3">
        <strong className="text-sm">{t.axis[axis]}</strong>
        <span className="rounded-lg bg-accent-soft px-3 py-1 font-black tabular-nums text-accent">{ratings[axis].toFixed(1)} / 5</span>
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-ink-2">{SKILL_PROMPTS[axis][locale]}</span>
      <input type="range" className="mt-3 w-full accent-accent" min="1" max="5" step="0.5" value={ratings[axis]}
        aria-label={t.axis[axis]}
        onChange={e=>onChange({...ratings,[axis]:Number(e.target.value)})}/>
      <span className="flex justify-between gap-2 text-[11px] text-ink-3">
        <span>{RATING_ANCHORS[locale][0]}</span>
        <span>{RATING_ANCHORS[locale][4]}</span>
      </span>
    </label>)}
    <p className="text-xs leading-relaxed text-ink-3">{a.anchoring}</p>
  </div>;
}

export function TrendChart({ locale, axis, baseline, selected, checkins }: {
  locale: Locale; axis: TrainingAxis; baseline: SkillRatings; selected: SavedAssessment; checkins: SavedCheckin[];
}) {
  const a = assessmentDictionary(locale);
  const { horizonWeeks, sessionsPerWeek, methodId } = selected;
  const method = METHODS_FOR_PLANS.find(m=>m.id === methodId);
  if(!method) return null;
  const w=720,h=290, left=56,right=20,top=16,bottom=44;
  const width=w-left-right,height=h-top-bottom;
  const px=(week:number)=>left+(week/horizonWeeks)*width;
  const py=(value:number)=>top+(5-value)/4*height;
  const series=Array.from({length:horizonWeeks+1},(_,week)=>({
    week, expected:expectedRatingsAtWeek(baseline,method,week,horizonWeeks,sessionsPerWeek)[axis],
  }));
  const real=[{week:0,value:baseline[axis]}, ...checkins.map(c=>({week:c.week,value:c.ratings[axis]}))].sort((x,y)=>x.week-y.week);
  return <div className="rounded-2xl border border-line bg-surface p-4">
    <h3 className="font-black">{a.timeline}</h3>
    <svg viewBox={"0 0 "+w+" "+h} className="mt-3 w-full" role="img" aria-label={a.timeline}>
      {[1,2,3,4,5].map(level=><g key={level}>
        <line x1={left} x2={w-right} y1={py(level)} y2={py(level)} stroke="currentColor" strokeOpacity=".15"/>
        <text x={left-15} y={py(level)+4} fontSize="13" textAnchor="end" fill="currentColor">{level}</text>
      </g>)}
      {Array.from(new Set([0,Math.round(horizonWeeks/4),Math.round(horizonWeeks/2),Math.round(3*horizonWeeks/4),horizonWeeks])).map(week=><g key={week}>
        <text x={px(week)} y={h-15} fontSize="12" textAnchor="middle" fill="currentColor">{a.wk} {week}</text>
      </g>)}
      <polyline fill="none" stroke={LINE_COLORS.expected} strokeWidth="3" strokeDasharray="8 5"
        points={series.map(p=>px(p.week)+","+py(p.expected)).join(" ")}/>
      {real.length>1 ? <polyline fill="none" stroke={LINE_COLORS.actual} strokeWidth="3"
        points={real.map(p=>px(p.week)+","+py(p.value)).join(" ")}/> : null}
      {real.map(p=><circle key={p.week} cx={px(p.week)} cy={py(p.value)} r="5" fill={LINE_COLORS.actual}>
        <title>{a.wk} {p.week}: {p.value.toFixed(1)} / 5</title>
      </circle>)}
    </svg>
    <div className="mt-1 flex flex-wrap justify-center gap-4 text-xs font-semibold">
      <span className="text-accent">— {a.estimated}</span>
      <span style={{color:LINE_COLORS.actual}}>● {a.actual}</span>
    </div>
  </div>;
}

export function AssessmentWorkspace({ locale, initialAssessments, initialCheckins, gradeObservation, gradeHistory, gradeSystem, gradeTarget }: {
  locale: Locale;
  initialAssessments: SavedAssessment[];
  initialCheckins: SavedCheckin[];
  gradeObservation: {label:string; level:string; sampleSize:number} | null;
  gradeHistory: Record<string, ObservedWorkingGrade[]>;
  gradeSystem: string;
  gradeTarget: {grade:string; ordinal:number} | null;
}) {
  const t = trainingDictionary(locale);
  const a = assessmentDictionary(locale);
  const router = useRouter();
  const [assessments,setAssessments]=useState(initialAssessments);
  const [checkins,setCheckins]=useState(initialCheckins);
  const [selectedId,setSelectedId]=useState(initialAssessments[0]?.id || "");
  const [formMode,setFormMode]=useState(initialAssessments.length===0);
  const [methodId,setMethodId]=useState("technique");
  const [initial,setInitial]=useState<SkillRatings>({...DEFAULT_SKILLS});
  const [horizon,setHorizon]=useState(12);
  const [frequency,setFrequency]=useState(2);
  const [goal,setGoal]=useState("");
  const [working,setWorking]=useState<SkillRatings>(() => {
    const first = initialAssessments[0];
    if (!first) return { ...DEFAULT_SKILLS };
    const last = initialCheckins.filter(c => c.assessmentId === first.id).sort((a,b) => b.week - a.week)[0];
    return { ...(last?.ratings ?? first.ratings) };
  });
  const [notes,setNotes]=useState("");
  const [protocolConfirmed,setProtocolConfirmed]=useState(false);
  const [checkinProtocolConfirmed,setCheckinProtocolConfirmed]=useState(false);
  const [week,setWeek]=useState(() => {
    const first = initialAssessments[0];
    return first ? Math.max(1,Math.min(first.horizonWeeks,elapsedWeeks(first.createdAt,new Date()))) : 1;
  });
  const [axis,setAxis]=useState<TrainingAxis>("technique");
  const [notice,setNotice]=useState("");
  const [pending,startTransition]=useTransition();
  const chosen=assessments.find(e=>e.id===selectedId);
  const method=METHODS_FOR_PLANS.find(m=>m.id===methodId) || METHODS_FOR_PLANS[0];
  const related=chosen?checkins.filter(c=>c.assessmentId===chosen.id).sort((x,y)=>x.week-y.week):[];
  const latest=related[related.length-1];
  const now=chosen?Math.min(chosen.horizonWeeks,elapsedWeeks(chosen.createdAt,new Date())):0;
  const observed=latest?.ratings??null;
  const chosenMethod=METHODS_FOR_PLANS.find(m=>m.id===chosen?.methodId);
  const scenario=chosen && chosenMethod?expectedRatingsAtWeek(chosen.ratings,chosenMethod,chosen.horizonWeeks,chosen.horizonWeeks,chosen.sessionsPerWeek):null;
  const atCheckin=chosen && chosenMethod && latest?expectedRatingsAtWeek(chosen.ratings,chosenMethod,latest.week,chosen.horizonWeeks,chosen.sessionsPerWeek):null;

  function openAssessment(record: SavedAssessment) {
    setSelectedId(record.id);setFormMode(false);setNotice("");
    const entries=checkins.filter(c=>c.assessmentId===record.id);
    const latestEntry=[...entries].sort((x,y)=>y.week-x.week)[0];
    setWorking({ ...(latestEntry?.ratings ?? record.ratings) });
    setWeek(Math.max(1,Math.min(record.horizonWeeks,elapsedWeeks(record.createdAt,new Date()))));
    setNotes("");setAxis("technique");setCheckinProtocolConfirmed(false);
  }

  function startNew() {
    setFormMode(true);setNotice("");setInitial({...DEFAULT_SKILLS});setMethodId("technique");
    setGoal("");setHorizon(12);setFrequency(2);setProtocolConfirmed(false);
  }

  function saveBaseline() {
    if (!protocolConfirmed) return;
    setNotice("");
    startTransition(async()=>{
      const result=await createTrainingAssessment({
        methodId,ratings:initial,horizonWeeks:horizon,sessionsPerWeek:frequency,goal,
      });
      if(!result.ok){setNotice(a.problem);return;}
      const record:SavedAssessment={id:result.id, methodId, ratings:{...initial},horizonWeeks:horizon,sessionsPerWeek:frequency,goal,createdAt:new Date().toISOString()};
      setAssessments(curr=>[record,...curr]);setSelectedId(record.id);setFormMode(false);
      setWorking({...initial});setWeek(1);setNotes("");setNotice(a.saved);router.refresh();
    });
  }

  function saveWeek() {
    if(!chosen || now<1 || !checkinProtocolConfirmed) return;
    setNotice("");
    startTransition(async()=>{
      const result=await saveTrainingCheckin({assessmentId:chosen.id,week,ratings:working,notes});
      if(!result.ok){setNotice(a.problem);return;}
      const record:SavedCheckin={id:result.id,assessmentId:chosen.id,week,ratings:{...working},notes,createdAt:new Date().toISOString()};
      setCheckins(curr=>[...curr.filter(c=>!(c.assessmentId===chosen.id && c.week===week)),record]);
      setNotice(a.saved);router.refresh();
    });
  }

  function remove() {
    if(!chosen || !window.confirm(a.deleteConfirm))return;
    setNotice("");
    startTransition(async()=>{
      const result=await deleteTrainingAssessment(chosen.id);
      if(!result.ok){setNotice(a.problem);return;}
      setAssessments(curr=>curr.filter(record=>record.id!==chosen.id));
      setCheckins(curr=>curr.filter(c=>c.assessmentId!==chosen.id));
      const next=assessments.find(record=>record.id!==chosen.id);
      if (next) openAssessment(next);
      else startNew();
      setNotice("");router.refresh();
    });
  }

  return <div className="mt-7 space-y-6">
    <nav className="flex flex-wrap items-center gap-2" aria-label={a.history}>
      <button type="button" onClick={startNew}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink">{a.add} +</button>
      {assessments.map(item=><button type="button" key={item.id} onClick={()=>openAssessment(item)}
        aria-pressed={!formMode && selectedId===item.id}
        className={"rounded-xl border px-3 py-2 text-xs font-semibold " + (!formMode && selectedId===item.id?"border-accent bg-accent-soft text-ink":"border-line bg-surface text-ink-2")}>
        {METHODS_FOR_PLANS.find(m=>m.id===item.methodId)?.title??a.noMethod} · {new Date(item.createdAt).toLocaleDateString(locale==="fr"?"fr-FR":"en-GB")}
      </button>)}
    </nav>
    {formMode ? <>
      <section aria-labelledby="assessment-protocol-title" className="rounded-[1.5rem] border border-accent/25 bg-accent-soft p-5 sm:p-6">
        <p className="leblond-eyebrow text-accent">{locale==="fr"?"AVANT DE COMMENCER":"BEFORE YOU BEGIN"}</p>
        <h2 id="assessment-protocol-title" className="mt-2 text-xl font-extrabold">
          {locale==="fr"?"Protocole de bilan initial · 4 étapes":"Baseline assessment · four-step protocol"}
        </h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink">
          <li><strong>01 · {locale==="fr"?"Définir la période de référence":"Define your reference period"}.</strong> {locale==="fr"
            ?"Appuie-toi sur les 4 dernières semaines de grimpe. Précise mentalement ta discipline, tes salles et les types de blocs concernés."
            :"Review the last four weeks of climbing. Use the same discipline, gyms and comparable types of climbs as your reference."}</li>
          <li><strong>02 · {locale==="fr"?"Réunir des observations":"Gather observations"}.</strong> {locale==="fr"
            ?"Idéalement, consulte au moins 3 séances comparables, leurs essais et réussites. Si tu n’as pas ce recul, ce bilan est exploratoire."
            :"Ideally review at least three comparable sessions and their attempts and sends. With less evidence, treat this as exploratory."}</li>
          <li><strong>03 · {locale==="fr"?"Noter six compétences":"Rate six skills"}.</strong> {locale==="fr"
            ?"Lis chaque question, puis note de 1 (rarement) à 5 (régulièrement) ce que tu observes. Les notes décrivent ton ressenti, pas une force mesurée."
            :"Read each question, then rate the observed frequency from 1 (rarely) to 5 (reliably). These are self-reports, not force measurements."}</li>
          <li><strong>04 · {locale==="fr"?"Conserver des conditions comparables":"Keep conditions comparable"}.</strong> {locale==="fr"
            ?"Au prochain bilan (idéalement dans 4 semaines), réutilise la même grille, la même période de référence et une pratique similaire. En cas de douleur, n’effectue aucun test de charge maximale."
            :"At the next check-in (ideally in four weeks), reuse the same scale, reference period and similar climbing. Do not perform maximal loading tests if in pain."}</li>
        </ol>
        <p className="mt-4 border-t border-accent/20 pt-3 text-xs leading-relaxed text-ink-2">
          {locale==="fr"
            ?"Limite méthodologique : cette échelle à six dimensions est une auto-évaluation structurée, et non un instrument psychométrique validé ou un test de performance standardisé. Le scénario affiché ensuite est illustratif et ne prédit pas une cotation."
            :"Methodological limit: this six-dimension scale is a structured self-assessment, not a validated psychometric instrument or standardized performance test. Later scenarios are illustrative, not grade predictions."}
        </p>
      </section>
      <header>
        <h2 className="text-2xl font-black">{a.new}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{a.rateHint}</p>
      </header>
      <SkillSliders locale={locale} ratings={initial} onChange={setInitial}/>
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="font-black">{a.suggested}</h3>
        <p className="mt-1 text-xs text-ink-3">{a.suggestedWhy}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {methodMatches(initial).map(({method:item,priority})=><button key={item.id} type="button" onClick={()=>setMethodId(item.id)}
            className={"rounded-xl border px-3 py-2 text-sm font-semibold " +(methodId===item.id?"border-accent bg-accent-soft":"border-line")}>
            {item.title} · {t.axis[priority]}
          </button>)}
        </div>
      </section>
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2">
        <label className="block text-sm font-bold sm:col-span-2">{a.method}
          <select value={methodId} onChange={e=>setMethodId(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-bg p-3 text-sm">
            {METHODS_FOR_PLANS.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </label>
        <Link href={"/atlas/"+methodId}
          className="self-end text-sm font-bold text-accent underline underline-offset-4 sm:col-span-2">
          {locale==="fr"?"Ouvrir la fiche détaillée de la méthode":"View full method guide"} ↗
        </Link>
        <label className="text-sm font-bold">{a.weeks}
          <select value={horizon} onChange={e=>setHorizon(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-line bg-bg p-3">
            {OPTIONS.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">{a.sessions}
          <select value={frequency} onChange={e=>setFrequency(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-line bg-bg p-3">
            {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold sm:col-span-2">{a.goal}
          <input maxLength={300} value={goal} onChange={e=>setGoal(e.target.value)}
            placeholder={a.goalPlaceholder} className="mt-2 w-full rounded-xl border border-line bg-bg p-3"/>
        </label>
      </div>
      <ProfileRadar locale={locale} baseline={initial}
        expected={expectedRatingsAtWeek(initial,method,horizon,horizon,frequency)} actual={null}/>
      <p className="text-xs leading-relaxed text-ink-3">{a.formula}</p>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed">
        <input type="checkbox" checked={protocolConfirmed} onChange={e=>setProtocolConfirmed(e.target.checked)}
          className="mt-1 h-4 w-4 accent-accent"/>
        <span>{locale==="fr"
          ?"J’ai suivi les quatre étapes et évalué les six dimensions selon les mêmes critères. Je comprends que les valeurs sont déclaratives."
          :"I followed the four steps and reviewed all six dimensions using the same criteria. I understand these are self-reported values."}</span>
      </label>
      <button type="button" disabled={pending || !protocolConfirmed} onClick={saveBaseline}
        className="rounded-xl bg-accent px-5 py-3 font-bold text-accent-ink disabled:opacity-50">{a.create}</button>
    </> : chosen && scenario ? <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-2 p-4"><p className="text-xs font-semibold text-ink-3">{a.selected}</p>
          <p className="mt-1 font-black">{chosenMethod?.title??a.noMethod}</p></div>
        <div className="rounded-xl bg-surface-2 p-4"><p className="text-xs font-semibold text-ink-3">{a.period}</p>
          <p className="mt-1 font-black">{chosen.horizonWeeks} {a.wk.toLowerCase()}</p></div>
        <div className="rounded-xl bg-surface-2 p-4"><p className="text-xs font-semibold text-ink-3">{a.sessionsLabel}</p>
          <p className="mt-1 font-black">{chosen.sessionsPerWeek}</p></div>
      </div>
      {chosen.goal ? <p className="rounded-xl border border-line p-4 text-sm"><strong>{a.goal}:</strong> {chosen.goal}</p> : null}
      <ProfileRadar locale={locale} baseline={chosen.ratings} expected={scenario} actual={observed}/>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold text-ink-3">{a.expectedEnd}</p>
          <ul className="mt-3 space-y-2">
            {TRAINING_AXES.map(key=><li key={key} className="flex justify-between gap-2 text-sm">
              <span>{t.axis[key]}</span><strong className="tabular-nums">{chosen.ratings[key].toFixed(1)} → {scenario[key].toFixed(2)}</strong>
            </li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold text-ink-3">{a.actualNow}</p>
          {observed&&latest&&atCheckin ? <>
            <p className="mt-2 text-sm font-bold">{a.wk} {latest.week}</p>
            <ul className="mt-3 space-y-2">
              {TRAINING_AXES.map(key=>{
                const difference=observed[key]-atCheckin[key];
                return <li key={key} className="flex justify-between gap-3 text-sm">
                  <span>{t.axis[key]}</span>
                  <span className="tabular-nums font-bold">{observed[key].toFixed(1)}
                    <span className="ml-2 text-xs text-ink-3">{difference>=0?"+":""}{difference.toFixed(2)}</span>
                  </span>
                </li>;
              })}
            </ul>
            <p className="mt-3 text-xs text-ink-3">{a.departure}: {a.estimated}</p>
          </>:<p className="mt-3 text-sm text-ink-2">{a.noData}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-bold">{a.trackAxis}
          <select value={axis} onChange={e=>setAxis(e.target.value as TrainingAxis)}
            className="mt-2 w-full rounded-xl border border-line bg-surface p-3 sm:max-w-xs">
            {TRAINING_AXES.map(key=><option key={key} value={key}>{t.axis[key]}</option>)}
          </select>
        </label>
        <div className="mt-3"><TrendChart locale={locale} axis={axis} baseline={chosen.ratings}
          selected={chosen} checkins={related}/></div>
      </div>
      <WorkingGradeChart locale={locale} points={gradeHistory[chosen.id] ?? []}
        target={gradeTarget} horizonWeeks={chosen.horizonWeeks} system={gradeSystem}/>
      <p className="rounded-xl border border-line bg-surface-2 p-4 text-xs leading-relaxed text-ink-2">{a.formula} {a.limits}</p>
      <section className="rounded-2xl border border-line bg-surface-2 p-5">
        <h2 className="text-lg font-black">{a.checkin}</h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-2">{a.checkinHint}</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-2">{locale==="fr"
          ?"Protocole de répétition : compare les 4 dernières semaines avec ton bilan précédent, dans des conditions aussi similaires que possible. Pour chaque dimension, garde la même échelle de 1 à 5 ; distingue les faits enregistrés de ton ressenti."
          :"Repeat the protocol: compare the last four weeks against your previous baseline using as similar conditions as possible. Apply the same 1–5 scale for every dimension; distinguish logged evidence from your perception."}</p>
        {now<1 ? <p className="mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">{a.notYet}</p> : <>
          <label className="mt-4 block text-sm font-bold">{a.chooseWeek}
            <select value={Math.max(1,Math.min(week,now))} onChange={e=>{
              const targetWeek=Number(e.target.value);
              setWeek(targetWeek);
              setWorking({ ...(related.find(c=>c.week===targetWeek)?.ratings ?? latest?.ratings ?? chosen.ratings) });
              setNotes(related.find(c=>c.week===targetWeek)?.notes??"");setCheckinProtocolConfirmed(false);
            }} className="mt-2 block w-full rounded-xl border border-line bg-surface p-3 sm:max-w-xs">
              {Array.from({length:now},(_,i)=>i+1).map(n=><option key={n} value={n}>{a.wk} {n}</option>)}
            </select>
          </label>
          <div className="mt-5"><SkillSliders locale={locale} ratings={working} onChange={setWorking}/></div>
          <label className="mt-4 block text-sm font-bold">{a.notes}
            <textarea rows={3} maxLength={800} value={notes} onChange={e=>setNotes(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-line bg-surface p-3"/>
          </label>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed">
            <input type="checkbox" checked={checkinProtocolConfirmed}
              onChange={e=>setCheckinProtocolConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 accent-accent"/>
            <span>{locale==="fr"
              ?"J’ai repris le même protocole et signalé les changements ou limites dans mes notes."
              :"I repeated the same protocol and noted any changes or limitations."}</span>
          </label>
          <button type="button" onClick={saveWeek} disabled={pending || !checkinProtocolConfirmed}
            className="mt-4 rounded-xl bg-accent px-5 py-3 font-bold text-accent-ink disabled:opacity-50">{a.save}</button>
        </>}
      </section>
      <button type="button" disabled={pending} onClick={remove}
        className="text-sm font-bold text-danger underline underline-offset-4 disabled:opacity-50">{a.deleteLabel}</button>
    </> : <p className="text-sm text-ink-2">{a.none}</p>}
    {notice ? <p role="status" className="text-sm font-bold text-ink-2">{notice}</p> : null}
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-black">{a.objective}</h2>
      {gradeObservation ? <p className="mt-3 text-sm"><strong>{a.observedGrade}:</strong> {gradeObservation.level} · {gradeObservation.label} · {gradeObservation.sampleSize} {locale==="fr"?"blocs analysés":"analyzed problems"}</p>
        :<p className="mt-3 text-sm text-ink-2">{a.missingGrade}</p>}
      <p className="mt-2 text-xs leading-relaxed text-ink-3">{a.gradeHelp}</p>
    </section>
  </div>;
}
