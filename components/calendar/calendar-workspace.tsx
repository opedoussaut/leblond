"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { addCalendarEntry, changeCalendarStatus, removeCalendarEntry } from "@/lib/actions/calendar";
import { calendarDictionary } from "@/lib/i18n/calendar";
import type { Locale } from "@/lib/i18n";
import type { CalendarEvent, CalendarInput, LoggedSession } from "@/lib/calendar/schema";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { CalendarEntrySessionButton } from "@/components/training/session-actions";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import type { TrainingStatus } from "@/lib/training/sessions";

export type CalendarTraining = {
  id: string; title: string; status: TrainingStatus; eventDate: string; startTime: string;
  minutes: number | null; calendarEntryId: string | null;
};

const pad=(n:number)=>String(n).padStart(2,"0");
function shiftMonth(month:string, delta:number) {
  const [y,m]=month.split("-").map(Number);
  const d=new Date(Date.UTC(y,m-1+delta,1));
  return d.getUTCFullYear()+"-"+pad(d.getUTCMonth()+1);
}
function monthDays(month:string) {
  const [y,m]=month.split("-").map(Number);
  const start=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7;
  const size=new Date(Date.UTC(y,m,0)).getUTCDate();
  return { start,size };
}
const field="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink";
const kinds=["CLIMB","TRAIN","REST","ASSESS","OTHER"] as const;
const disciplines=["BOULDER","ROUTE","BOTH","NONE"] as const;

export function CalendarWorkspace({
  month, locale, events, sessions, trainings = [], presetMethod = "",
}: { month:string; locale:Locale; events:CalendarEvent[]; sessions:LoggedSession[]; trainings?:CalendarTraining[]; presetMethod?:string }) {
  const t=calendarDictionary(locale);
  const ts=trainingSessionDictionary(locale);
  const router=useRouter();
  const now=new Date();
  const today=now.getFullYear()+"-"+pad(now.getMonth()+1)+"-"+pad(now.getDate());
  const [selected,setSelected]=useState(month===today.slice(0,7)?today:month+"-01");
  const safeSelected=selected.startsWith(month)?selected:month+"-01";
  const [kind,setKind]=useState<CalendarInput["kind"]>("CLIMB");
  const [discipline,setDiscipline]=useState<CalendarInput["discipline"]>("BOULDER");
  const [title,setTitle]=useState("");
  const [time,setTime]=useState("");
  const [minutes,setMinutes]=useState("");
  const [method,setMethod]=useState(presetMethod);
  const [notes,setNotes]=useState("");
  const [date,setDate]=useState(safeSelected);
  const [feedback,setFeedback]=useState("");
  const [pending,start]=useTransition();
  const detailsRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const {start:firstGap,size}=useMemo(()=>monthDays(month),[month]);
  const dates=Array.from({length:Math.ceil((size+firstGap)/7)*7},(_,i)=>{
    const d=i-firstGap+1;return d>0&&d<=size?month+"-"+pad(d):null;
  });
  const selectedEvents=events.filter(e=>e.eventDate===safeSelected);
  const selectedSessions=sessions.filter(s=>s.eventDate===safeSelected);
  const linkedByEntry=new Map(trainings.filter(x=>x.calendarEntryId).map(x=>[x.calendarEntryId!,x]));
  const selectedTrainings=trainings.filter(x=>x.eventDate===safeSelected&&!(x.calendarEntryId&&events.some(e=>e.id===x.calendarEntryId)));
  function goMonth(delta:number) {
    const next=shiftMonth(month,delta);
    if(next<"2020-01"||next>"2100-12")return;
    setSelected(next+"-01");setDate(next+"-01");router.push("/calendar?month="+next);
  }
  function choose(day:string){
    setSelected(day); setDate(day); setFeedback("");
    // Selecting a day should make the corresponding details the user's focus,
    // especially on mobile where the details live below the month grid.
    requestAnimationFrame(() => detailsRef.current?.focus());
  }
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setFeedback("");
    start(async()=>{
      const result=await addCalendarEntry({
        eventDate:date,startTime:time,title,kind,discipline,
        minutes:minutes?Number(minutes):null,methodId:method||null,notes,
      });
      if(result.ok){setTitle("");setNotes("");setMethod("");setMinutes("");setFeedback(t.saved);
        setSelected(date);
        if (date.slice(0,7)!==month) router.push("/calendar?month="+date.slice(0,7)); else router.refresh();}
      else setFeedback(t.error);
    });
  }
  function change(id:string,status:CalendarEvent["status"]){
    start(async()=>{const r=await changeCalendarStatus(id,status);if(!r.ok)setFeedback(t.error);else router.refresh();});
  }
  function remove(id:string){
    start(async()=>{const r=await removeCalendarEntry(id);if(!r.ok)setFeedback(t.error);else router.refresh();});
  }
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
    <section className="leblond-premium-surface p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label={t.previous} onClick={()=>goMonth(-1)} className="min-h-11 rounded-full border border-line px-4 text-lg">‹</button>
        <h2 className="text-lg font-extrabold capitalize">{new Date(month+"-01T12:00:00Z").toLocaleDateString(t.locale,{month:"long",year:"numeric",timeZone:"UTC"})}</h2>
        <button type="button" aria-label={t.next} onClick={()=>goMonth(1)} className="min-h-11 rounded-full border border-line px-4 text-lg">›</button>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-3">
        {t.weekdays.map((day,i)=><div key={i}>{day}</div>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1" role="grid" aria-label={t.title}>
        {dates.map((day,i)=>day?(
          <button key={day} type="button" aria-label={day}
            aria-pressed={safeSelected===day} onClick={()=>choose(day)}
            className={"relative flex min-h-12 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-colors " +
              (safeSelected===day?"border-accent bg-accent text-accent-ink":
               day===today?"border-accent text-accent":"border-transparent hover:border-line hover:bg-surface-2")}>
            {Number(day.slice(-2))}
            {events.some(e=>e.eventDate===day)||sessions.some(e=>e.eventDate===day)||trainings.some(e=>e.eventDate===day)
              ? <span aria-hidden="true" className={"mt-1 h-1.5 w-1.5 rounded-full "+(safeSelected===day?"bg-white":"bg-accent")}/> : null}
          </button>
        ):<div key={"gap"+i}/>)}
      </div>
      <p className="mt-4 text-xs text-ink-3">{t.private} {t.planNote}</p>
    </section>
    <div className="space-y-5">
    <section ref={detailsRef} tabIndex={-1} aria-label={safeSelected}
      className="space-y-3 rounded-[1.5rem] border border-line bg-surface p-5 focus:outline-none">
      <h2 className="text-xl font-extrabold">{new Date(safeSelected+"T12:00:00Z").toLocaleDateString(t.locale,{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"})}</h2>
      {selectedEvents.length===0&&selectedSessions.length===0&&selectedTrainings.length===0?<p className="text-sm text-ink-3">{t.empty}</p>:null}
      <button type="button" onClick={() => titleRef.current?.focus()}
        className="inline-flex min-h-10 items-center rounded-full border border-accent/30 bg-accent-soft px-4 text-xs font-bold text-accent hover:border-accent">
        + {t.add}
      </button>
      {selectedSessions.map(s=><Link key={s.id} href={"/session/"+s.id} className="flex justify-between gap-3 rounded-xl border border-line bg-surface p-4 hover:border-accent">
        <span><strong className="block">{s.title}</strong><span className="text-xs text-ink-2">{t.logged}</span></span>
        <span className="text-sm font-semibold text-accent">↗</span>
      </Link>)}
      {selectedTrainings.map(x=><Link key={x.id} href={"/train/sessions/"+x.id} className="flex justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4 hover:border-accent">
        <span><strong className="block">{x.title}</strong><span className="text-xs text-ink-2">{t.TRAIN} · {ts.status[x.status]}{x.startTime?" · "+x.startTime:""}{x.minutes?" · "+x.minutes+" min":""}</span></span>
        <span className="text-sm font-semibold text-accent">{x.status==="PLANNED"?ts.open:x.status==="IN_PROGRESS"?ts.resume:ts.review} →</span>
      </Link>)}
      {selectedEvents.map(e=><div key={e.id} className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div><strong className="block">{e.title}</strong><p className="mt-1 text-xs text-ink-2">{t[e.kind]} · {t[e.discipline]}{e.startTime?" · "+e.startTime:""}{e.minutes?" · "+e.minutes+" min":""}</p></div>
          <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-bold text-accent">{t[e.status]}</span>
        </div>
        {e.notes?<p className="mt-3 text-sm text-ink-2">{e.notes}</p>:null}
        {e.methodId?<Link className="mt-2 inline-block text-sm font-semibold text-accent underline" href={"/atlas/"+e.methodId}>{t.methodDetail} ↗</Link>:null}
        {e.kind==="TRAIN"?<div className="mt-3 flex flex-wrap items-center gap-2">
          {linkedByEntry.get(e.id)?<span className="text-xs font-semibold text-ink-2">{ts.status[linkedByEntry.get(e.id)!.status]}</span>:null}
          <CalendarEntrySessionButton locale={locale} entryId={e.id} sessionId={linkedByEntry.get(e.id)?.id ?? null}/>
        </div>:null}
        <div className="mt-4 flex flex-wrap gap-2">
          {e.status!=="DONE"&&!(e.kind==="TRAIN")?<button disabled={pending} onClick={()=>change(e.id,"DONE")} className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold">{t.markDone}</button>:null}
          {e.status!=="PLANNED"?<button disabled={pending} onClick={()=>change(e.id,"PLANNED")} className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold">{t.markPlanned}</button>:null}
          {e.status!=="SKIPPED"?<button disabled={pending} onClick={()=>change(e.id,"SKIPPED")} className="min-h-9 rounded-lg border border-line px-3 text-xs font-semibold">{t.markSkipped}</button>:null}
          <button disabled={pending} onClick={()=>remove(e.id)} className="min-h-9 rounded-lg border border-line px-3 text-xs text-danger">{t.delete}</button>
        </div>
      </div>)}
    </section>
    <section className="leblond-premium-surface p-5">
      <h2 className="text-xl font-extrabold">{t.add}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">{t.day}<input className={field} type="date" required min="2020-01-01" max="2100-12-31" value={date} onChange={e=>setDate(e.target.value)}/></label>
          <label className="text-sm font-semibold">{t.time}<input className={field} type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
        </div>
        <label className="block text-sm font-semibold">{t.titleField}<input ref={titleRef} className={field} type="text" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">{t.kind}<select className={field} value={kind} onChange={e=>setKind(e.target.value as CalendarInput["kind"])}>{kinds.map(k=><option key={k} value={k}>{t[k]}</option>)}</select></label>
          <label className="text-sm font-semibold">{t.discipline}<select className={field} value={discipline} onChange={e=>setDiscipline(e.target.value as CalendarInput["discipline"])}>{disciplines.map(d=><option key={d} value={d}>{t[d]}</option>)}</select></label>
        </div>
        <label className="block text-sm font-semibold">{t.minutes}<input className={field} type="number" min={10} max={480} value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
        <label className="block text-sm font-semibold">{t.method}<select className={field} value={method} onChange={e=>setMethod(e.target.value)}>
          <option value="">{t.noMethod}</option>{METHODS_FOR_PLANS.map(m=><option value={m.id} key={m.id}>{m.title}</option>)}
        </select></label>
        <label className="block text-sm font-semibold">{t.notes}<textarea className={field} rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        {feedback?<p role="status" className="text-sm text-ink-2">{feedback}</p>:null}
        <button type="submit" disabled={pending} className="w-full rounded-xl bg-accent px-5 py-3 font-bold text-accent-ink disabled:opacity-50">{pending?t.saving:t.save}</button>
      </form>
    </section>
    </div>
  </div>;
}
