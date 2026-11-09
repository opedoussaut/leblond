"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDayCheck } from "@/lib/actions/day-checks";
import { createTrainingSession } from "@/lib/actions/training-sessions";
import { fmt, type Locale } from "@/lib/i18n";
import { journeyDictionary, type JourneyDictionary } from "@/lib/i18n/training-journey";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { DAY_PLACES, MINUTE_CHOICES, type DayCheckInput, type DayRecommendation } from "@/lib/training/day-check";
import { BODY_AREAS, PAIN_LEVELS, type BodyArea } from "@/lib/training/health";
import { buttonClass } from "@/components/ui/button";
import { Choice } from "./structured-assessment";

/** Human sentence for a stored reason code such as `pain:shoulder`. */
export function reasonText(code: string, j: JourneyDictionary): string | null {
  const [key, area] = code.split(":") as [keyof JourneyDictionary["reasons"], BodyArea | undefined];
  const template = j.reasons[key];
  if (!template) return null;
  return area && area in j.areas ? fmt(template, { area: j.areas[area] }) : template;
}

function DayResult({ locale, rec, today, scheduledId, hasProgramme }: {
  locale: Locale; rec: DayRecommendation; today: string; scheduledId: string | null; hasProgramme: boolean;
}) {
  const j = journeyDictionary(locale);
  const d = j.day;
  const router = useRouter();
  const [error, setError] = useState<{ msg: string; liveId?: string } | null>(null);
  const [pending, start] = useTransition();
  const method = METHODS_FOR_PLANS.find((m) => m.id === rec.methodId)?.title;
  const what = rec.outcome === "MOBILITY" ? j.programme.mobilityTitle : rec.outcome === "REST" ? null : method;
  const openScheduled = scheduledId && rec.reasons.includes("scheduled") && (rec.outcome === "AS_PLANNED" || rec.outcome === "REDUCED");
  const reasons = rec.reasons.map((r) => reasonText(r, j)).filter((r): r is string => !!r);
  const injured = rec.reasons.some((r) => /^(acute|pain|painAdapt):/.test(r));

  function startSession() {
    setError(null);
    start(async () => {
      const r = await createTrainingSession({
        source: "quick", methodId: rec.methodId, title: rec.methodId ? "" : j.programme.mobilityTitle,
        minutes: Math.max(10, Math.min(240, rec.minutes)), date: today, time: "", startNow: true,
      });
      if (!r.ok) { setError({ msg: r.error === "live" ? d.liveSession : d.startError, liveId: r.liveId }); return; }
      router.push("/train/sessions/" + r.data.id);
    });
  }

  return <section aria-labelledby="day-result-heading" className="space-y-4 rounded-2xl border border-accent/30 bg-accent-soft p-5">
    <h2 id="day-result-heading" className="text-xs font-extrabold uppercase tracking-[0.12em] text-accent">{d.resultTitle}</h2>
    <div>
      <p className="text-2xl font-extrabold tracking-tight text-ink">{j.outcomes[rec.outcome]}</p>
      {what ? <p className="mt-1 text-base font-bold text-ink">{what} · {fmt(d.duration, { minutes: rec.minutes })} · {j.places[rec.place]}</p> : null}
      {rec.planned && rec.outcome !== "AS_PLANNED" ? <p className="mt-1 text-sm text-ink-2">{fmt(d.basedOn, { title: rec.planned.title, minutes: rec.planned.minutes })}</p> : null}
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{j.outcomeHints[rec.outcome]}</p>
      {rec.outcome === "MOBILITY" ? <p className="mt-2 text-sm"><Link href="/atlas/mobility" className="font-bold text-accent underline underline-offset-4">{d.stretchRoutine} →</Link></p> : null}
    </div>
    {reasons.length ? <div>
      <h3 className="text-sm font-bold">{d.why}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
    </div> : null}
    {injured ? <p role="note" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs leading-relaxed">{j.safety}</p> : null}
    {openScheduled ? <Link href={"/train/sessions/" + scheduledId} className={buttonClass("primary", "md")}>{d.openScheduled} →</Link>
      : rec.outcome !== "REST" ? <button type="button" disabled={pending} onClick={startSession} className={buttonClass("primary", "md")}>{pending ? "…" : d.start} →</button>
      : null}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error.msg}
      {error.liveId ? <> <Link className="underline" href={"/train/sessions/" + error.liveId}>{j.hub.open} →</Link></> : null}</p> : null}
    {!hasProgramme ? <p className="text-sm text-ink-2">{d.noProgramme} <Link href="/train/assess" className="font-bold text-accent underline underline-offset-4">{j.hub.fullCta} →</Link></p> : null}
  </section>;
}

export function DayCheck({ locale, today, initial, saved, hasProgramme, prefilledPain, scheduledId }: {
  locale: Locale; today: string; initial: DayCheckInput; saved: DayRecommendation | null;
  hasProgramme: boolean; prefilledPain: boolean; scheduledId: string | null;
}) {
  const j = journeyDictionary(locale);
  const d = j.day;
  const [answers, setAnswers] = useState<DayCheckInput>(initial);
  const [hasPain, setHasPain] = useState(initial.pain.length > 0);
  const [result, setResult] = useState<DayRecommendation | null>(saved);
  const [editing, setEditing] = useState(!saved);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = <K extends keyof DayCheckInput>(k: K, v: DayCheckInput[K]) => setAnswers((a) => ({ ...a, [k]: v }));

  function submit() {
    setError("");
    start(async () => {
      const r = await saveDayCheck({ ...answers, pain: hasPain ? answers.pain : [] });
      if (!r.ok) { setError(d.saveError); return; }
      setResult(r.recommendation);
      setEditing(false);
    });
  }

  if (!editing && result) {
    return <div className="space-y-4">
      <DayResult locale={locale} rec={result} today={today} scheduledId={scheduledId} hasProgramme={hasProgramme} />
      <p className="text-sm text-ink-2">{d.doneToday}</p>
      <button type="button" onClick={() => setEditing(true)} className={buttonClass("secondary", "md")}>{d.redo}</button>
    </div>;
  }

  const three = "grid-cols-3";
  return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label={d.title}>
    <Choice name="sleep" legend={d.sleepLegend} value={answers.sleep} onChange={(v) => set("sleep", v)} layout={three}
      options={[1, 2, 3].map((n) => ({ value: n, label: d.sleep[n - 1] }))} />
    <Choice name="fatigue" legend={d.fatigueLegend} value={answers.fatigue} onChange={(v) => set("fatigue", v)} layout={three}
      options={[1, 2, 3].map((n) => ({ value: n, label: d.fatigue[n - 1] }))} />
    <Choice name="soreness" legend={d.sorenessLegend} value={answers.soreness} onChange={(v) => set("soreness", v)} layout={three}
      options={[0, 1, 2].map((n) => ({ value: n, label: d.soreness[n] }))} />
    <Choice name="pain" legend={d.painLegend} value={hasPain} onChange={setHasPain} layout="grid-cols-2"
      hint={prefilledPain ? d.painPrefilled : undefined}
      options={[{ value: false, label: d.painNone }, { value: true, label: d.painSome }]} />
    {hasPain ? <div className="space-y-3">
      <fieldset className="rounded-xl border border-line bg-surface p-3">
        <legend className="px-1 text-sm font-semibold">{j.full.areasLegend}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BODY_AREAS.map((area) => { const on = answers.pain.some((p) => p.area === area); return <label key={area}
            className={"flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold " + (on ? "border-accent bg-accent-soft" : "border-line")}>
            <input type="checkbox" className="h-4 w-4 accent-accent" checked={on}
              onChange={(e) => set("pain", e.target.checked ? [...answers.pain, { area, level: "DISCOMFORT" }] : answers.pain.filter((p) => p.area !== area))} />
            {j.areas[area]}
          </label>; })}
        </div>
      </fieldset>
      {answers.pain.map((p) => <Choice key={p.area} name={"pain-" + p.area} legend={fmt(j.full.levelLegend, { area: j.areas[p.area] })}
        value={p.level} onChange={(level) => set("pain", answers.pain.map((x) => x.area === p.area ? { ...x, level } : x))}
        options={PAIN_LEVELS.map((l) => ({ value: l, label: j.levels[l].label, hint: j.levels[l].hint }))} />)}
    </div> : null}
    <Choice name="minutes" legend={d.minutesLegend} value={answers.minutes} onChange={(v) => set("minutes", v)} layout="grid-cols-4"
      options={MINUTE_CHOICES.map((n) => ({ value: n, label: n === 0 ? d.minutesZero : fmt(d.minutesOption, { n }) }))} />
    <Choice name="place" legend={d.placeLegend} value={answers.place} onChange={(v) => set("place", v)} layout="grid-cols-2 sm:grid-cols-3"
      options={DAY_PLACES.map((p) => ({ value: p, label: j.places[p] }))} />
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <button type="submit" disabled={pending || (hasPain && answers.pain.length === 0)} className={buttonClass("primary", "md", "w-full sm:w-auto")}>
      {pending ? "…" : d.submit}
    </button>
  </form>;
}
