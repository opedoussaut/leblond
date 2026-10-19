"use client";

import Link from "next/link";
import { useState } from "react";
import { ProfileRadar, SkillSliders } from "./assessment-workspace";
import type { Locale } from "@/lib/i18n";
import { assessmentDictionary } from "@/lib/i18n/assessment";
import { trainingDictionary } from "@/lib/i18n/training";
import { DEFAULT_SKILLS, expectedRatingsAtWeek, methodMatches, type SkillRatings } from "@/lib/training/assessment";
import { METHODS_FOR_PLANS, TRAINING_AXES } from "@/lib/training/catalogue";

export function PublicAssessment({ locale }: { locale: Locale }) {
  const a = assessmentDictionary(locale);
  const t = trainingDictionary(locale);
  const [ratings, setRatings] = useState<SkillRatings>({ ...DEFAULT_SKILLS });
  const [methodId, setMethodId] = useState("technique");
  const [weeks, setWeeks] = useState(12);
  const [frequency, setFrequency] = useState(2);
  const [followup, setFollowup] = useState<SkillRatings>({ ...DEFAULT_SKILLS });
  const [tryFollowup, setTryFollowup] = useState(false);
  const method = METHODS_FOR_PLANS.find(m => m.id === methodId) ?? METHODS_FOR_PLANS[0];
  const expected = expectedRatingsAtWeek(ratings, method, weeks, weeks, frequency);
  const recommended = methodMatches(ratings);

  return <div className="space-y-7">
    <div className="rounded-2xl border border-line bg-surface-2 p-5">
      <h2 className="text-xl font-black">{a.current}</h2>
      <p className="mt-2 text-sm text-ink-2">{a.rateHint}</p>
      <div className="mt-5">
        <SkillSliders locale={locale} ratings={ratings} onChange={updated => {
          setRatings(updated);
          if (!tryFollowup) setFollowup({ ...updated });
        }} />
      </div>
    </div>
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-xl font-black">{a.suggested}</h2>
      <p className="mt-2 text-sm text-ink-2">{a.suggestedWhy}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {recommended.map(({ method:item, priority })=><button
          type="button" key={item.id} aria-pressed={methodId===item.id}
          onClick={()=>setMethodId(item.id)}
          className={"rounded-xl border p-4 text-left text-sm font-semibold "+(methodId===item.id?"border-accent bg-accent-soft":"border-line")}>
          {item.title}
          <span className="mt-1 block text-xs text-ink-3">{t.axis[priority]}</span>
        </button>)}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-bold">{a.method}
          <select value={methodId} onChange={e=>setMethodId(e.target.value)}
            className="mt-2 block w-full rounded-xl border border-line bg-bg p-3 text-sm">
            {METHODS_FOR_PLANS.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">{a.weeks}
          <select value={weeks} onChange={e=>setWeeks(Number(e.target.value))}
            className="mt-2 block w-full rounded-xl border border-line bg-bg p-3">
            {[4,8,12,16,24].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">{a.sessions}
          <select value={frequency} onChange={e=>setFrequency(Number(e.target.value))}
            className="mt-2 block w-full rounded-xl border border-line bg-bg p-3">
            {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </section>
    <ProfileRadar locale={locale} baseline={ratings} expected={expected} actual={tryFollowup?followup:null}/>
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-black">{a.expectedEnd}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {TRAINING_AXES.map(axis=><div className="flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm" key={axis}>
          <span>{t.axis[axis]}</span><strong className="tabular-nums">{ratings[axis].toFixed(1)} → {expected[axis].toFixed(2)}</strong>
        </div>)}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-3">{a.formula}</p>
    </section>
    <section className="rounded-xl border border-line bg-surface p-5">
      <label className="flex items-center gap-3 text-sm font-bold">
        <input type="checkbox" checked={tryFollowup} onChange={e=>{
          setTryFollowup(e.target.checked);if(e.target.checked)setFollowup({...ratings});
        }} className="h-5 w-5 accent-accent" />
        {a.publicTry}
      </label>
      {tryFollowup ? <div className="mt-5">
        <p className="mb-4 text-sm text-ink-2">{a.publicTryHelp}</p>
        <SkillSliders locale={locale} ratings={followup} onChange={setFollowup}/>
      </div>:null}
    </section>
    <p className="text-sm leading-relaxed text-ink-2">{a.publicPrivacy}</p>
    <Link href="/login?next=%2Ftraining-assessment"
      className="inline-flex rounded-xl bg-accent px-5 py-3 font-bold text-accent-ink">{a.privateTracking} →</Link>
  </div>;
}
