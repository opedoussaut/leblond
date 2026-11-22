"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assessmentCadence, measuredHistory, selfRatedHistory } from "@/lib/analytics/fitness";
import { CurrentLevelPanel, FitnessCharts, type CurrentLevels } from "./fitness-charts";
import { WorkingGradeChart } from "./grade-progress";
import type { ObservedWorkingGrade } from "@/lib/training/grade-history";
import { deleteTrainingAssessment, resetTrainingAssessments, saveTrainingCheckin } from "@/lib/actions/training-assessments";
import { fmt, type Locale } from "@/lib/i18n";
import { assessmentDictionary } from "@/lib/i18n/assessment";
import { trainingDictionary } from "@/lib/i18n/training";
import { DEFAULT_SKILLS, RATING_ANCHORS, SKILL_PROMPTS, elapsedWeeks, expectedRatingsAtWeek, type SavedAssessment, type SavedCheckin, type SkillRatings } from "@/lib/training/assessment";
import { METHODS_FOR_PLANS, TRAINING_AXES, type TrainingAxis } from "@/lib/training/catalogue";
import { OBSERVED_LABELS, PROTOCOL_TESTS, compareMeasurements, parseContext, parseMeasurements, type ObservedEvidence } from "@/lib/training/assessment-protocol";
import { EvidenceBadge, StructuredAssessment } from "./structured-assessment";
import { buttonClass, dangerLinkClass } from "@/components/ui/button";
import { IconNext, LiveDot } from "@/components/ui/icons";
import { Calculator, ChevronDown, ChevronRight, CircleCheck, CircleDashed, ClipboardCheck, History, ListChecks, MessageCircle, RotateCcw, Ruler } from "lucide-react";
import { HeadingMark, ToneIcon } from "@/components/ui/hero-figure";
import { assessmentOverview, historyFacts, ratingTrend, trendFromDirection } from "@/lib/training/assessment-overview";
import { AssessmentHero, CHECKIN_SYMBOLS, StatusPill, TREND_SYMBOLS, TrendPill, heroButton } from "./assessment-overview";

const LINE_COLORS = { baseline: "#8093a8", expected: "#297cc8", actual: "#173e66" } as const;

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
      <h3 className="text-base font-bold">{a.radar}</h3>
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

export function SkillSliders({ locale, ratings, onChange, columns = false }: {
  locale: Locale; ratings: SkillRatings; onChange: (ratings: SkillRatings) => void;
  /** Two columns from tablet width up, for the weekly check-in. */
  columns?: boolean;
}) {
  const t = trainingDictionary(locale);
  const a = assessmentDictionary(locale);
  return <div className="space-y-4">
    <div className={columns ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "space-y-4"}>
    {TRAINING_AXES.map((axis) => <label key={axis} className="block rounded-xl border border-line bg-surface px-4 py-3">
      <span className="flex items-center justify-between gap-3">
        <strong className="text-sm">{t.axis[axis]}</strong>
        <span className="rounded-xl bg-accent-soft px-3 py-1 font-black tabular-nums text-accent">{ratings[axis].toFixed(1)} / 5</span>
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-ink-2">{SKILL_PROMPTS[axis][locale]}</span>
      <input type="range" className="mt-3 w-full accent-accent" min="1" max="5" step="0.5" value={ratings[axis]}
        aria-label={t.axis[axis]}
        onChange={e=>onChange({...ratings,[axis]:Number(e.target.value)})}/>
      <span className="flex justify-between gap-2 text-xs text-ink-3">
        <span>{RATING_ANCHORS[locale][0]}</span>
        <span>{RATING_ANCHORS[locale][4]}</span>
      </span>
    </label>)}
    </div>
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
    <h3 className="font-bold">{a.timeline}</h3>
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
      <span style={{color:LINE_COLORS.actual}}><LiveDot /> {a.actual}</span>
    </div>
  </div>;
}

export function AssessmentWorkspace({ locale, initialAssessments, initialCheckins, levels, gradeHistory, gradeSystem, gradeTarget, today, observedEvidence, defaults, startInForm = false }: {
  locale: Locale;
  today: string;
  observedEvidence: ObservedEvidence[];
  defaults: { discipline: "BOULDER" | "ROUTE" | "BOTH"; sessionsPerWeekNow: number };
  startInForm?: boolean;
  initialAssessments: SavedAssessment[];
  initialCheckins: SavedCheckin[];
  levels: CurrentLevels;
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
  const [formMode,setFormMode]=useState(startInForm || initialAssessments.length===0);
  const [working,setWorking]=useState<SkillRatings>(() => {
    const first = initialAssessments[0];
    if (!first) return { ...DEFAULT_SKILLS };
    const last = initialCheckins.filter(c => c.assessmentId === first.id).sort((a,b) => b.week - a.week)[0];
    return { ...(last?.ratings ?? first.ratings) };
  });
  const [notes,setNotes]=useState("");
  const [checkinProtocolConfirmed,setCheckinProtocolConfirmed]=useState(false);
  const [week,setWeek]=useState(() => {
    const first = initialAssessments[0];
    return first ? Math.max(1,Math.min(first.horizonWeeks,elapsedWeeks(first.createdAt,new Date()))) : 1;
  });
  const [axis,setAxis]=useState<TrainingAxis>("technique");
  const [notice,setNotice]=useState("");
  const [confirmingReset,setConfirmingReset]=useState(false);
  const [pending,startTransition]=useTransition();
  const chosen=assessments.find(e=>e.id===selectedId);
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

  function selectWeek(targetWeek: number) {
    setWeek(targetWeek);
    setWorking({ ...(related.find(c=>c.week===targetWeek)?.ratings ?? latest?.ratings ?? chosen?.ratings ?? DEFAULT_SKILLS) });
    setNotes(related.find(c=>c.week===targetWeek)?.notes??"");setCheckinProtocolConfirmed(false);
  }

  function startNew() {
    setFormMode(true);setNotice("");
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

  function reset() {
    setNotice("");
    startTransition(async()=>{
      const result=await resetTrainingAssessments("RESET");
      if(!result.ok){setNotice(a.problem);return;}
      setAssessments([]);setCheckins([]);setSelectedId("");setWorking({...DEFAULT_SKILLS});
      setConfirmingReset(false);setFormMode(true);setNotice(a.resetDone);router.refresh();
    });
  }

  const o=a.overview;
  const current=assessments[0];
  const overviewOf=(record: SavedAssessment)=>assessmentOverview(record,
    checkins.filter(c=>c.assessmentId===record.id).map(c=>c.week),new Date(),today);
  const currentOverview=current?overviewOf(current):null;
  const showingCurrent=!formMode && !!current && chosen?.id===current.id;
  const chosenTimeline=chosen?(chosen.id===current?.id && currentOverview ? currentOverview.timeline : overviewOf(chosen).timeline):[];
  const shownWeek=Math.max(1,Math.min(week,now));
  const weekState=chosenTimeline.find(w=>w.week===shownWeek)?.state;
  const reassessButton=(primary: boolean)=><button type="button" onClick={startNew}
    className={showingCurrent ? heroButton(primary) : buttonClass(primary ? "primary" : "secondary", "md")}>{assessments.length ? a.reassess : a.add} +</button>;
  const dateLabel=(iso: string)=>new Date(iso).toLocaleDateString(locale==="fr"?"fr-FR":"en-GB",{day:"numeric",month:"long",year:"numeric"});
  const nextStep=currentOverview?.next;

  return <div className="mt-7 space-y-10">
    {/* 1 · The current assessment: status, week, what to do now. */}
    {showingCurrent && currentOverview && current ? <AssessmentHero locale={locale} overview={currentOverview}
      method={METHODS_FOR_PLANS.find(m=>m.id===current.methodId)?.title??a.noMethod}
      actions={<>
        {nextStep?.kind==="checkin"
          ? <a href="#checkin" onClick={()=>selectWeek(nextStep.week)} className={heroButton(true)}>
            {fmt(o.checkinCta,{week:nextStep.week})} <IconNext /></a> : null}
        {reassessButton(nextStep?.kind!=="checkin")}
      </>}/>
    : !formMode && chosen ? <div className="leblond-premium-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink"><History aria-hidden="true" className="size-4 shrink-0 text-ink-3"/>{fmt(o.viewing,{date:dateLabel(chosen.createdAt)})}</p>
      <div className="leblond-actions">
        {current ? <button type="button" onClick={()=>openAssessment(current)} className={buttonClass("secondary","md")}>{o.backToCurrent}</button> : null}
        {reassessButton(false)}
      </div>
    </div> : null}

    {formMode ? <StructuredAssessment locale={locale} today={today} observed={observedEvidence} defaults={defaults}
      previous={assessments[0] ?? null}
      onCancel={assessments.length ? () => setFormMode(false) : undefined}
      onSaved={(record, info) => {
        setAssessments(curr=>[record,...curr]);setSelectedId(record.id);setFormMode(false);
        setWorking({...record.ratings});setWeek(1);setNotes("");setNotice(info.planSaved ? a.savedWithProgramme : a.programmeLimit);router.refresh();
      }}/> : null}

    {/* 2 · Where I stand: observed level per discipline, beside declared and goal. */}
    <CurrentLevelPanel locale={locale} levels={levels} cadence={showingCurrent ? null : assessmentCadence(assessments, today)}/>

    {/* 3 · Results: measured first, then observed and self-reported, never one score. */}
    <section aria-labelledby="results-heading" className="space-y-4">
      <SectionTitle id="results-heading" title={o.results} hint={!formMode && chosen ? o.resultsHint : undefined}/>
      {!formMode && chosen ? <EvidencePanel locale={locale} record={chosen} baseline={assessments[assessments.length-1]}/> : null}
      {!formMode && assessments.length ? <FitnessCharts locale={locale} measured={measuredHistory(assessments)}
        selfRated={selfRatedHistory(assessments, checkins)}/> : null}
      {!formMode && chosen ? <WorkingGradeChart locale={locale} points={gradeHistory[chosen.id] ?? []}
        target={gradeTarget} horizonWeeks={chosen.horizonWeeks} system={gradeSystem}/> : null}
      {!formMode && chosen && scenario ? <details className="leblond-premium-surface group p-4 sm:p-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
          <ToneIcon icon={Calculator} tone="violet" size="sm"/>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">{o.scenario}</span>
            <span className="block text-xs text-ink-3">{o.scenarioHint}</span>
          </span>
          <span className="hidden sm:inline-flex"><EvidenceBadge level="estimated" locale={locale}/></span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180"/>
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface-2 p-4"><p className="text-xs font-semibold text-ink-3">{a.selected}</p>
              <p className="mt-1 font-black">{chosenMethod?.title??a.noMethod}</p></div>
            <div className="rounded-xl bg-surface-2 p-4"><p className="text-xs font-semibold text-ink-3">{a.period}</p>
              <p className="mt-1 font-black">{chosen.horizonWeeks} {a.wk.toLowerCase()}</p></div>
            <div className="rounded-xl bg-surface-2 p-4"><p className="text-xs font-semibold text-ink-3">{a.sessionsLabel}</p>
              <p className="mt-1 font-black">{chosen.sessionsPerWeek}</p></div>
          </div>
          {chosen.goal ? <p className="rounded-xl border border-line p-4 text-sm"><strong>{a.goal}:</strong> {chosen.goal}</p> : null}
          <ProfileRadar locale={locale} baseline={chosen.ratings} expected={scenario} actual={observed}/>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <p className="rounded-xl bg-surface-2 p-4 text-xs leading-relaxed text-ink-2">{a.formula} {a.limits}</p>
        </div>
      </details> : null}
      {!formMode && !chosen ? <p className="text-sm text-ink-2">{a.none}</p> : null}
    </section>

    {/* The weekly check-in, where the hero's "Check in" button lands. */}
    {!formMode && chosen && scenario ? <section id="checkin" aria-labelledby="checkin-heading" className="leblond-premium-surface leblond-elevated scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ToneIcon icon={ListChecks} tone="green"/>
          <div className="min-w-0">
            <h2 id="checkin-heading" className="text-lg font-bold">{a.checkin}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{a.checkinHint}</p>
          </div>
        </div>
        {now>=1 && weekState ? <StatusPill symbol={CHECKIN_SYMBOLS[weekState]}
          label={fmt(o.checkinState,{week:shownWeek,state:o.checkinStates[weekState]})}/> : null}
      </div>
      {now<1 ? <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2"><CircleDashed aria-hidden="true" className="mt-0.5 size-4 shrink-0"/>{a.notYet}</p> : <>
        <details className="mt-3 text-xs leading-relaxed text-ink-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold text-accent">{a.protocolTitle}</summary>
          {a.protocolText}
        </details>
        <label className="mt-2 block text-sm font-bold">{a.chooseWeek}
          <select value={shownWeek} onChange={e=>selectWeek(Number(e.target.value))}
            className="mt-2 block w-full rounded-xl border border-line bg-surface p-3 sm:max-w-xs">
            {Array.from({length:now},(_,i)=>i+1).map(n=>{ const state=chosenTimeline.find(w=>w.week===n)?.state;
              return <option key={n} value={n}>{a.wk} {n}{state ? " · "+o.checkinStates[state] : ""}</option>; })}
          </select>
        </label>
        <div className="mt-5"><SkillSliders locale={locale} ratings={working} onChange={setWorking} columns/></div>
        <label className="mt-4 block text-sm font-bold">{a.notes}
          <textarea rows={3} maxLength={800} value={notes} onChange={e=>setNotes(e.target.value)}
            className="mt-2 block w-full rounded-xl border border-line bg-surface p-3"/>
        </label>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed">
          <input type="checkbox" checked={checkinProtocolConfirmed}
            onChange={e=>setCheckinProtocolConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 accent-accent"/>
          <span>{a.protocolConfirm}</span>
        </label>
        <button type="button" onClick={saveWeek} disabled={pending || !checkinProtocolConfirmed}
          className={buttonClass("primary", "md", "mt-4")}>{a.save}</button>
      </>}
    </section> : null}
    {notice ? <p role="status" className="text-sm font-bold text-ink-2">{notice}</p> : null}

    {/* 4 · History: every assessment, newest first, by kind of evidence. */}
    {assessments.length ? <section aria-labelledby="history-heading" className="space-y-3">
      <SectionTitle id="history-heading" title={o.history}/>
      <ul aria-label={a.history} className="leblond-premium-surface divide-y divide-line overflow-hidden">
        {assessments.map((item,i)=>{ const facts=historyFacts(item); const selected=!formMode && selectedId===item.id;
          return <li key={item.id}>
            <button type="button" onClick={()=>openAssessment(item)} aria-pressed={selected}
              className={"flex min-h-[4.25rem] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:px-5 "+(selected?"bg-accent-soft":"")}>
              <ToneIcon icon={ClipboardCheck} tone={i===0?"blue":"sky"} size="sm"/>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[15px] font-semibold text-ink">{dateLabel(item.createdAt)}</span>
                  {i===0 ? <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">{o.historyCurrent}</span> : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">{METHODS_FOR_PLANS.find(m=>m.id===item.methodId)?.title??a.noMethod}</span>
              </span>
              <span className="hidden shrink-0 items-center gap-3 text-xs font-semibold text-ink-2 sm:flex" aria-hidden="true">
                <span className="flex items-center gap-1"><Ruler className="size-3.5" strokeWidth={2.25}/>{facts.measured}</span>
                <span className="flex items-center gap-1"><MessageCircle className="size-3.5" strokeWidth={2.25}/>{facts.selfRated}</span>
              </span>
              <span className="sr-only">{fmt(o.historyFacts,{measured:facts.measured,self:facts.selfRated})}</span>
              {selected ? <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-accent" strokeWidth={2.5}/> : <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" strokeWidth={2.25}/>}
            </button>
          </li>; })}
      </ul>
      {!formMode && chosen ? <button type="button" disabled={pending} onClick={remove}
        className={dangerLinkClass}>{a.delete}</button> : null}
    </section> : null}

    {assessments.length ? <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5">
        <ToneIcon icon={RotateCcw} tone="rose" size="sm"/>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{a.resetTitle}</span>
          <span className="block text-xs text-ink-3">{a.resetSummary}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180"/>
      </summary>
      <div className="border-t border-line px-4 pb-4 pt-3 sm:px-5">
        <p className="text-sm leading-relaxed text-ink-2">{a.resetHint}</p>
        {confirmingReset ? <>
          <p role="alert" className="mt-3 text-sm font-bold">{fmt(a.resetConfirm,{count:assessments.length})}</p>
          <div className="leblond-actions mt-3">
            <button type="button" disabled={pending} onClick={reset} className={buttonClass("danger", "md")}>{a.resetYes}</button>
            <button type="button" disabled={pending} onClick={()=>setConfirmingReset(false)} className={buttonClass("secondary", "md")}>{a.resetNo}</button>
          </div>
        </> : <button type="button" onClick={()=>setConfirmingReset(true)} className={buttonClass("danger", "md", "mt-3")}>{a.resetLabel}</button>}
      </div>
    </details> : null}
  </div>;
}

/** A section's title on the page: small caps with the accent bar, as on Progrès. */
function SectionTitle({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return <div className="px-1">
    <h2 id={id} className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-3"><HeadingMark />{title}</h2>
    {hint ? <p className="mt-1 text-sm text-ink-2">{hint}</p> : null}
  </div>;
}

/** Evidence-separated profile of one assessment, compared with the first (baseline) one. */
function EvidencePanel({ locale, record, baseline }: { locale: Locale; record: SavedAssessment; baseline?: SavedAssessment }) {
  const t = trainingDictionary(locale);
  const fr = locale === "fr";
  const measurements = parseMeasurements(record.measurements);
  const context = parseContext(record.context);
  const isBaseline = !baseline || baseline.id === record.id;
  const changes = !isBaseline ? compareMeasurements(parseMeasurements(baseline!.measurements), measurements) : [];
  const a = assessmentDictionary(locale);
  const ratingDelta = (axis: TrainingAxis) => isBaseline ? null : record.ratings[axis] - baseline!.ratings[axis];
  return <section aria-labelledby="evidence-heading" className="leblond-premium-surface leblond-elevated space-y-5 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id="evidence-heading" className="text-lg font-bold">{fr ? "Profil par niveau de preuve" : "Profile by evidence level"}</h2>
        <p className="mt-0.5 text-xs font-semibold text-ink-3">
          {record.kind === "STRUCTURED" ? (fr ? "Évaluation structurée" : "Structured assessment") : record.kind === "BASIC" ? (fr ? "Évaluation de base" : "Basic assessment") : (fr ? "Auto-évaluation (v1)" : "Self-assessment (v1)")}
          {!isBaseline ? (fr ? " · comparée à l’évaluation initiale du " : " · compared with baseline of ") + new Date(baseline!.createdAt).toLocaleDateString(fr ? "fr-FR" : "en-GB") : ""}
        </p>
      </div>
      <ul aria-label={fr ? "Niveaux de preuve" : "Evidence levels"} className="flex flex-wrap gap-1.5">
        {(["measured","observed","self"] as const).map(l=><li key={l}><EvidenceBadge level={l} locale={locale}/></li>)}
      </ul>
    </div>
    {measurements.length ? <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {measurements.map(m=>{ const def=PROTOCOL_TESTS.find(d=>d.id===m.id)!; const c=changes.find(x=>x.id===m.id);
        return <li key={m.id} className="rounded-2xl bg-surface-2 p-4 text-sm">
          <div className="flex items-start justify-between gap-2"><strong className="min-w-0">{def.name[locale]}</strong><EvidenceBadge level="measured" locale={locale}/></div>
          <p className="mt-2"><span className="leblond-number text-3xl">{m.value} {m.unit}</span></p>
          {c ? <p className="mt-2 flex flex-wrap items-center gap-2">
            <TrendPill trend={trendFromDirection(c.direction)} locale={locale}/>
            <span className="text-xs font-bold tabular-nums text-ink-2">{c.delta>0?"+":""}{c.delta} {fr?"vs initial":"vs baseline"}</span>
          </p> : null}
          <p className="mt-2 text-xs text-ink-3">{m.date} · {fr?"protocole":"protocol"} v{m.protocolVersion} · {m.quality==="complete"?(fr?"conditions complètes":"complete conditions"):(fr?"conditions partielles":"partial conditions")}{m.conditions?" · "+m.conditions:""}</p>
          {c && !c.comparable ? <p className="mt-1 text-xs font-semibold text-ink-2">{fr?"Comparaison indicative : conditions ou version différentes.":"Indicative comparison: conditions or version differ."}</p> : null}
        </li>;})}
    </ul> : <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line p-4 text-sm text-ink-2"><EvidenceBadge level="insufficient" locale={locale}/> {fr ? "Aucun test mesuré dans cette évaluation." : "No measured test in this assessment."}</p>}
    {context?.observed.length ? <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {context.observed.map(o=><li key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
        <span className="min-w-0">{OBSERVED_LABELS[o.id]?.[locale] ?? o.id}<span className="block text-xs text-ink-3">n = {o.sample}</span></span>
        <span className="flex shrink-0 items-center gap-2"><strong className="tabular-nums">{o.value}</strong><EvidenceBadge level={o.evidence} locale={locale}/></span>
      </li>)}
    </ul> : null}
    <div>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">
        {fr ? "Ton ressenti, de 1 à 5" : "How you rate yourself, 1 to 5"} <EvidenceBadge level="self" locale={locale}/>
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TRAINING_AXES.map(axis=>{ const d=ratingDelta(axis); const trend=d===null ? null : ratingTrend(baseline!.ratings[axis], record.ratings[axis]);
          const TrendIcon=trend ? TREND_SYMBOLS[trend].icon : null;
          return <li key={axis} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
            <span className="min-w-0">{t.axis[axis]}</span>
            <span className="flex shrink-0 items-center gap-1.5 tabular-nums font-bold">
              {TrendIcon && trend ? <span className="flex items-center" title={a.overview.trends[trend]}>
                <TrendIcon aria-hidden="true" className={"size-3.5 "+(trend==="improving"?"text-tone-green":trend==="declining"?"text-tone-amber":"text-ink-3")} strokeWidth={2.5}/>
                <span className="sr-only">{a.overview.trends[trend]}</span></span> : null}
              {record.ratings[axis].toFixed(1)}{d!==null && d!==0 ? <span className="text-xs font-semibold text-ink-3">({d>0?"+":""}{d.toFixed(1)})</span> : null}
            </span>
          </li>;})}
      </ul>
      <p className="mt-2 text-xs text-ink-3">{fr ? "Notes 1–5 : déclaratives. Les écarts entre évaluations reflètent aussi un changement de perception." : "1–5 ratings: self-reported. Differences between assessments also reflect changes in perception."}</p>
    </div>
  </section>;
}
