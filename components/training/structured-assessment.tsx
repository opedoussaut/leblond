"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { addCalendarEntry } from "@/lib/actions/calendar";
import { createTrainingAssessment } from "@/lib/actions/training-assessments";
import { fmt, type Locale } from "@/lib/i18n";
import { trainingDictionary } from "@/lib/i18n/training";
import { journeyDictionary, type JourneyDictionary } from "@/lib/i18n/training-journey";
import { DEFAULT_SKILLS, type SavedAssessment, type SkillRatings } from "@/lib/training/assessment";
import {
  EVIDENCE_LABELS, HOME_EQUIPMENT, OBSERVED_LABELS, PROTOCOL_TESTS, PROTOCOL_VERSION, measurementQuality, parseContext, reassessmentDate, testStatus,
  type AssessmentContext, type Availability, type EvidenceLevel, type Measurement, type ObservedEvidence,
} from "@/lib/training/assessment-protocol";
import { METHODS_FOR_PLANS, TRAINING_AXES } from "@/lib/training/catalogue";
import { BODY_AREAS, PAIN_LEVELS, healthFromContext, needsProfessional, type BodyArea, type Health, type Injury, type Verdict } from "@/lib/training/health";
import { methodSuggestions, proposeProgramme, sessionTitle } from "@/lib/training/programme";
import { SkillSliders } from "./assessment-workspace";
import { buttonClass, linkClass, tileClass } from "@/components/ui/button";
import { fieldClass as field } from "@/components/ui/field";
import { IconBack, IconExternal, IconNext } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

const HORIZONS = [4, 6, 8, 12, 16, 24];
const FINGER_METHODS = new Set(["max-hangs", "repeaters", "campus"]);

export function EvidenceBadge({ level, locale }: { level: EvidenceLevel; locale: Locale }) {
  const tone = level === "measured" ? "bg-accent text-accent-ink" : level === "observed" ? "bg-accent-soft text-accent"
    : level === "insufficient" ? "border border-dashed border-line text-ink-3" : "bg-surface-2 text-ink-2";
  return <span title={EVIDENCE_LABELS[level].hint[locale]} className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold " + tone}>
    {EVIDENCE_LABELS[level][locale]}
  </span>;
}

/** "épaule (gêne), doigts (douleur)" — the areas behind a health verdict. */
export function verdictAreas(verdict: Verdict, j: JourneyDictionary): string {
  const seen = new Set<BodyArea>();
  return verdict.because.filter((b) => !seen.has(b.area) && seen.add(b.area))
    .map((b) => `${j.areas[b.area].toLowerCase()} (${j.levels[b.level].label.toLowerCase()})`).join(", ");
}

type SavedInfo = { planSaved: boolean };
type Props = {
  locale: Locale; today: string; observed: ObservedEvidence[];
  defaults: { discipline: "BOULDER" | "ROUTE" | "BOTH"; sessionsPerWeekNow: number };
  /** Latest assessment, used to pre-fill a reassessment (goal, availability, health). */
  previous?: SavedAssessment | null;
  onSaved: (record: SavedAssessment, info: SavedInfo) => void; onCancel?: () => void;
};

/** Choice buttons rendered as a radio group (large touch targets). */
export function Choice<T extends string | number | boolean>({ name, legend, value, options, onChange, hint, layout }: {
  name: string; legend: string; value: T; options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (v: T) => void; hint?: string; layout?: string;
}) {
  return <fieldset className="rounded-xl border border-line bg-surface p-3">
    <legend className="px-1 text-sm font-semibold">{legend}</legend>
    {hint ? <p className="px-1 text-xs text-ink-3">{hint}</p> : null}
    <div className={"mt-2 grid gap-2 " + (layout ?? "grid-cols-1 sm:grid-flow-col sm:auto-cols-fr")}>
      {options.map((o) => <label key={String(o.value)} className={"flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 text-sm " +
        (value === o.value ? "border-accent bg-accent-soft" : "border-line")}>
        <input type="radio" className="sr-only" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
        <span className={"font-bold " + (value === o.value ? "text-accent" : "")}>{o.label}</span>
        {o.hint ? <span className="text-xs text-ink-2">{o.hint}</span> : null}
      </label>)}
    </div>
  </fieldset>;
}

export function StructuredAssessment({ locale, today, observed, defaults, previous, onSaved, onCancel }: Props) {
  const t = trainingDictionary(locale);
  const j = journeyDictionary(locale);
  const f = j.full;
  const prevCtx: AssessmentContext | null = previous ? parseContext(previous.context) : null;
  const prevHealth = healthFromContext(prevCtx);
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  // The step last focused. Comparing steps (not a "first run" flag) keeps the
  // page title focused on mount even when React StrictMode runs effects twice.
  const focusedStep = useRef(0);

  const [discipline, setDiscipline] = useState<AssessmentContext["discipline"]>(prevCtx?.discipline ?? defaults.discipline);
  const [goal, setGoal] = useState(previous?.goal ?? "");
  const [horizon, setHorizon] = useState(HORIZONS.includes(previous?.horizonWeeks ?? 0) ? previous!.horizonWeeks : 8);
  const [experienceMonths, setExperience] = useState(prevCtx?.experienceMonths ?? 24);
  const [availability, setAvailability] = useState<Availability>(prevCtx?.availability ?? {
    climbingPerWeek: Math.max(1, Math.min(6, defaults.sessionsPerWeekNow || 2)), offWallPerWeek: 0, homeEquipment: [],
  });
  const [hasIssue, setHasIssue] = useState(prevHealth.injuries.length > 0);
  const [injuries, setInjuries] = useState<Injury[]>(prevHealth.injuries);
  const [testDay, setTestDay] = useState(false);
  const [rested24h, setRested] = useState(true);
  const [warmedUp, setWarmed] = useState(false);
  const [venue, setVenue] = useState(prevCtx?.venue ?? "");
  const [notes, setNotes] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<SkillRatings>(previous ? { ...previous.ratings } : { ...DEFAULT_SKILLS });
  const [methodId, setMethodId] = useState("");
  const [addReassessment, setAddReassessment] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (focusedStep.current === step) return;
    focusedStep.current = step;
    heading.current?.focus();
  }, [step]);

  const health: Health = { injuries: hasIssue ? injuries : [], unspecifiedPain: false };
  const screening = { experienceMonths, warmedUp, injuries: health.injuries };
  const statuses = Object.fromEntries(PROTOCOL_TESTS.map((test) => [test.id, testStatus(test, screening)]));
  const measurements: Measurement[] = testDay ? PROTOCOL_TESTS.flatMap((test) => {
    const raw = values[test.id];
    if (!statuses[test.id].allowed || raw === undefined || raw.trim() === "" || !Number.isFinite(Number(raw))) return [];
    const value = Math.max(test.min, Math.min(test.max, Number(raw)));
    const cond = conditions[test.id] ?? "";
    return [{ id: test.id, value, unit: test.unit, evidence: "measured" as const, protocolVersion: PROTOCOL_VERSION,
      date: today, conditions: cond, quality: measurementQuality(cond, { warmedUp, rested24h }, statuses[test.id].verdict.status === "adapt") }];
  }) : [];
  const { suggested, setAside } = methodSuggestions(ratings, health);
  const chosen = methodId || suggested[0]?.method.id || "technique";
  const programme = proposeProgramme({ methodId: chosen, discipline, availability, health, experienceMonths, locale });
  const nextCheck = reassessmentDate(today, horizon);
  const acute = needsProfessional(health);

  function toggleArea(area: BodyArea, on: boolean) {
    setInjuries((list) => on ? [...list.filter((i) => i.area !== area), { area, level: "DISCOMFORT" }] : list.filter((i) => i.area !== area));
  }
  function toggleEquipment(item: Availability["homeEquipment"][number], on: boolean) {
    setAvailability((a) => ({ ...a, homeEquipment: on ? [...new Set([...a.homeEquipment, item])] : a.homeEquipment.filter((e) => e !== item) }));
  }

  function save() {
    if (!confirmed) return;
    setError("");
    start(async () => {
      const context: AssessmentContext = {
        discipline, experienceMonths, sessionsPerWeekNow: defaults.sessionsPerWeekNow,
        injuries: health.injuries, availability, testDay,
        rested24h: testDay ? rested24h : false, warmedUp: testDay ? warmedUp : false,
        venue: testDay ? venue : "", notes: testDay ? notes : "", observed,
      };
      const input = {
        methodId: chosen, ratings, horizonWeeks: horizon,
        sessionsPerWeek: Math.max(1, Math.min(5, availability.climbingPerWeek + availability.offWallPerWeek)), goal,
        kind: measurements.length ? "STRUCTURED" as const : "BASIC" as const, measurements, context,
        ...(programme.length ? { programme: { sessions: programme } } : {}),
      };
      const r = await createTrainingAssessment(input);
      if (!r.ok) { setError(f.saveError); return; }
      if (addReassessment) {
        await addCalendarEntry({
          eventDate: nextCheck, startTime: "", title: f.calendarTitle,
          kind: "ASSESS", discipline, minutes: 60, methodId: null, notes: f.calendarNotes,
        });
      }
      onSaved({ id: r.id, ...input, createdAt: new Date().toISOString() }, { planSaved: !programme.length || r.planId !== null });
    });
  }

  const yesNo = (name: string, value: boolean, onChange: (v: boolean) => void, legend: string) =>
    <Choice name={name} legend={legend} value={value} onChange={onChange} options={[{ value: true, label: f.yes }, { value: false, label: f.no }]} />;

  const number = (label: string, value: number, max: number, onChange: (n: number) => void) =>
    <label className="block text-sm font-semibold">{label}
      <select className={field} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {Array.from({ length: max + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>;

  return <section aria-labelledby="protocol-step" className="space-y-5">
    <div className="rounded-2xl border border-accent/25 bg-accent-soft p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-accent">{fmt(f.progress, { n: step + 1, total: f.steps.length })}</p>
      <ol className="mt-3 flex gap-1" aria-hidden="true">
        {f.steps.map((_, i) => <li key={i} className={"h-1.5 flex-1 rounded-full " + (i <= step ? "bg-accent" : "bg-accent/15")} />)}
      </ol>
    </div>
    <h2 id="protocol-step" ref={heading} tabIndex={-1} className="text-2xl font-bold tracking-tight focus:outline-none">{f.steps[step]}</h2>

    {step === 0 ? <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-2">{f.intro}</p>
      <Choice name="discipline" legend={f.disciplineLegend} value={discipline} onChange={setDiscipline}
        options={(["BOULDER", "ROUTE", "BOTH"] as const).map((d) => ({ value: d, label: j.disciplines[d].label, hint: j.disciplines[d].hint }))} />
      <label className="block text-sm font-semibold">{f.goalLabel}
        <input className={field} maxLength={300} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">{f.horizonLabel}
          <select className={field} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            {HORIZONS.map((n) => <option key={n} value={n}>{fmt(f.weeksOption, { n })}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">{f.experienceLabel}
          <input className={field} type="number" min={0} max={900} value={experienceMonths}
            onChange={(e) => setExperience(Math.max(0, Math.min(900, Math.round(Number(e.target.value)) || 0)))} />
        </label>
      </div>
    </div> : null}

    {step === 1 ? <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {number(f.climbingLabel, availability.climbingPerWeek, 6, (n) => setAvailability((a) => ({ ...a, climbingPerWeek: n })))}
        {number(f.offWallLabel, availability.offWallPerWeek, 6, (n) => setAvailability((a) => ({ ...a, offWallPerWeek: n })))}
      </div>
      <p className="text-xs text-ink-3">{fmt(f.observedNow, { n: defaults.sessionsPerWeekNow })}</p>
      <fieldset className="rounded-xl border border-line bg-surface p-3">
        <legend className="px-1 text-sm font-semibold">{f.equipmentLegend}</legend>
        <p className="px-1 text-xs text-ink-3">{f.equipmentHint}</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {HOME_EQUIPMENT.map((item) => <label key={item} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-accent" checked={availability.homeEquipment.includes(item)}
              onChange={(e) => toggleEquipment(item, e.target.checked)} />
            {j.equipment[item]}
          </label>)}
        </div>
      </fieldset>
    </div> : null}

    {step === 2 ? <div className="space-y-4">
      <Choice name="health" legend={f.healthLegend} value={hasIssue} onChange={setHasIssue}
        options={[{ value: false, label: f.healthNone }, { value: true, label: f.healthSome }]} />
      {hasIssue ? <>
        <fieldset className="rounded-xl border border-line bg-surface p-3">
          <legend className="px-1 text-sm font-semibold">{f.areasLegend}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BODY_AREAS.map((area) => <label key={area} className={"flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold " +
              (injuries.some((i) => i.area === area) ? "border-accent bg-accent-soft" : "border-line")}>
              <input type="checkbox" className="h-4 w-4 accent-accent" checked={injuries.some((i) => i.area === area)}
                onChange={(e) => toggleArea(area, e.target.checked)} />
              {j.areas[area]}
            </label>)}
          </div>
        </fieldset>
        {injuries.map((injury) => <Choice key={injury.area} name={"level-" + injury.area}
          legend={fmt(f.levelLegend, { area: j.areas[injury.area] })} value={injury.level}
          onChange={(level) => setInjuries((list) => list.map((i) => i.area === injury.area ? { ...i, level } : i))}
          options={PAIN_LEVELS.map((l) => ({ value: l, label: j.levels[l].label, hint: j.levels[l].hint }))} />)}
        {acute ? <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm font-semibold">{f.acuteWarning}</p> : null}
        {injuries.length ? <p className="text-sm text-ink-2">{f.healthEffect}</p> : null}
      </> : null}
      <p role="note" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs leading-relaxed">{j.safety}</p>
    </div> : null}

    {step === 3 ? <div className="space-y-4">
      <p className="text-sm text-ink-2">{f.testIntro}</p>
      <Choice name="test-day" legend={f.doTestsLegend} value={testDay} onChange={setTestDay}
        options={[{ value: true, label: f.doTestsYes }, { value: false, label: f.doTestsNo }]} />
      {testDay ? <>
        <section aria-labelledby="readiness-heading" className="space-y-3 rounded-2xl border border-line bg-surface-2 p-4">
          <h3 id="readiness-heading" className="text-base font-bold">{f.readinessTitle}</h3>
          {yesNo("rested", rested24h, setRested, f.rested)}
          {yesNo("warm", warmedUp, setWarmed, f.warmed)}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">{f.venue}
              <input className={field} maxLength={120} value={venue} onChange={(e) => setVenue(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">{f.conditions}
              <input className={field} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <p className="text-xs text-ink-3">{f.comparableHint}</p>
        </section>
        {PROTOCOL_TESTS.map((test) => {
          const status = statuses[test.id];
          return <article key={test.id} className={"rounded-2xl border p-4 " + (status.allowed ? "border-line bg-surface" : "border-dashed border-line bg-surface-2")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold">{test.name[locale]}</h3>
              <span className="text-xs font-semibold text-ink-3">{t.axis[test.dimension]} · {test.unit}</span>
            </div>
            <p className="mt-1 text-sm text-ink-2">{test.rationale[locale]}</p>
            <details className="mt-2"><summary className="min-h-11 cursor-pointer text-sm font-bold text-accent">{f.procedure}</summary>
              <p className="mt-1 text-xs text-ink-2"><strong>{f.equipment} :</strong> {test.equipment[locale]}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">{test.procedure.map((p, i) => <li key={i}>{p[locale]}</li>)}</ol>
              <p className="mt-2 text-sm"><strong>{f.stopRules} :</strong> {test.stopRules[locale]}</p>
              {test.reference ? <a className={cn(linkClass, "mt-2 text-xs")} href={test.reference.url} target="_blank" rel="noopener noreferrer">{test.reference.label} <IconExternal /></a> : null}
            </details>
            {status.allowed ? <>
              {status.verdict.status === "adapt" ? <p className="mt-2 rounded-xl border border-warn/40 bg-warn/10 p-2 text-sm">{fmt(f.adapted, { areas: verdictAreas(status.verdict, j) })}</p> : null}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">{f.result} ({test.unit}, {test.min}–{test.max})
                  <input className={field} type="number" inputMode="decimal" min={test.min} max={test.max} value={values[test.id] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [test.id]: e.target.value }))} />
                </label>
                <label className="text-sm font-semibold">{f.testConditions}
                  <input className={field} maxLength={300} value={conditions[test.id] ?? ""} placeholder={f.testConditionsPlaceholder}
                    onChange={(e) => setConditions((c) => ({ ...c, [test.id]: e.target.value }))} />
                </label>
              </div>
            </> : <p className="mt-3 text-sm font-semibold text-ink-2">{
              status.blockedBy === "health" ? fmt(f.blockedHealth, { areas: verdictAreas(status.verdict, j) })
                : status.blockedBy === "experience" ? fmt(f.blockedExperience, { n: test.minExperienceMonths })
                : f.blockedWarmup}</p>}
          </article>;
        })}
      </> : null}
    </div> : null}

    {step === 4 ? <div className="space-y-3">
      <p className="text-sm text-ink-2">{f.selfIntro}</p>
      <SkillSliders locale={locale} ratings={ratings} onChange={setRatings} />
    </div> : null}

    {step === 5 ? <div className="space-y-4">
      <p className="text-sm text-ink-2">{f.prioritiesIntro}</p>
      <ul className="space-y-2">
        {[...TRAINING_AXES].sort((a, b) => ratings[a] - ratings[b]).slice(0, 3).map((axis) => <li key={axis} className="rounded-xl border border-line bg-surface p-3 text-sm">
          <strong>{t.axis[axis]}</strong> — {ratings[axis].toFixed(1)} / 5
          {measurements.filter((m) => PROTOCOL_TESTS.find((d) => d.id === m.id)?.dimension === axis).map((m) =>
            <span key={m.id} className="ml-2 text-xs text-ink-2">· {PROTOCOL_TESTS.find((d) => d.id === m.id)!.name[locale]} : {m.value} {m.unit}</span>)}
        </li>)}
      </ul>
      <details className="rounded-2xl border border-line bg-surface p-3" open>
        <summary className="min-h-11 cursor-pointer text-sm font-bold text-accent">{f.dataDetails}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">{f.dataDetails}</caption>
            <thead className="text-xs uppercase tracking-[0.12em] text-ink-3"><tr>
              <th className="px-3 py-2">{f.dimension}</th><th className="px-3 py-2">{f.value}</th>
              <th className="px-3 py-2">{f.source}</th><th className="px-3 py-2">{f.quality}</th></tr></thead>
            <tbody>
              {measurements.map((m) => { const def = PROTOCOL_TESTS.find((d) => d.id === m.id)!; return <tr key={m.id} className="border-t border-line">
                <td className="px-3 py-2 font-semibold">{def.name[locale]}</td><td className="px-3 py-2 tabular-nums">{m.value} {m.unit}</td>
                <td className="px-3 py-2"><EvidenceBadge level="measured" locale={locale} /></td>
                <td className="px-3 py-2 text-xs">{m.quality === "complete" ? f.complete : f.partial}</td>
              </tr>; })}
              {observed.map((o) => <tr key={o.id} className="border-t border-line">
                <td className="px-3 py-2 font-semibold">{OBSERVED_LABELS[o.id]?.[locale] ?? o.id}</td><td className="px-3 py-2 tabular-nums">{o.value}</td>
                <td className="px-3 py-2"><EvidenceBadge level={o.evidence} locale={locale} /></td>
                <td className="px-3 py-2 text-xs">n = {o.sample}</td>
              </tr>)}
              {TRAINING_AXES.map((axis) => <tr key={axis} className="border-t border-line">
                <td className="px-3 py-2 font-semibold">{t.axis[axis]}</td><td className="px-3 py-2 tabular-nums">{ratings[axis].toFixed(1)} / 5</td>
                <td className="px-3 py-2"><EvidenceBadge level="self" locale={locale} /></td><td className="px-3 py-2 text-xs">{f.anchored}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {measurements.length === 0 ? <p className="mt-2 text-sm text-ink-2">{f.noTests}</p> : null}
        <p className="mt-2 text-xs text-ink-3">{f.notCombined}</p>
      </details>
    </div> : null}

    {step === 6 ? <div className="space-y-4">
      {acute ? <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm font-semibold">{f.acuteWarning}</p> : null}
      <p className="text-sm text-ink-2">{f.methodsIntro}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {suggested.map(({ method, priority, verdict }) => {
          const caution = FINGER_METHODS.has(method.id) && experienceMonths < 24;
          return <button type="button" key={method.id} onClick={() => setMethodId(method.id)} aria-pressed={chosen === method.id}
            className={tileClass(chosen === method.id)}>
            <strong className="block">{method.title}</strong>
            <span className="mt-1 block text-xs text-ink-2">{f.targets} : {t.axis[priority]}</span>
            {verdict.status === "adapt" ? <span className="mt-1 block text-xs font-semibold text-ink-2">{fmt(f.adaptBadge, { areas: verdictAreas(verdict, j) })}</span> : null}
            {caution ? <span className="mt-1 block text-xs font-semibold text-danger">{f.caution}</span> : null}
          </button>;
        })}
      </div>
      {setAside.length ? <p className="text-xs text-ink-2">{fmt(f.setAside, { list: setAside.map((s) => s.method.title).join(", ") })}</p> : null}
      <label className="block text-sm font-semibold">{f.otherMethod}
        <select className={field} value={chosen} onChange={(e) => setMethodId(e.target.value)}>
          {METHODS_FOR_PLANS.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      </label>
      <Link href={"/atlas/" + chosen} className={cn(linkClass, "text-sm")}>{f.readAtlas} <IconExternal /></Link>

      <section aria-labelledby="week-heading" className="rounded-2xl border border-line bg-surface p-4">
        <h3 id="week-heading" className="text-base font-bold">{f.weekTitle}</h3>
        {programme.length ? <>
          <ul className="mt-3 space-y-2">
            {programme.map((s, i) => <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="font-bold">{j.days[s.day]}</span> · {sessionTitle(s)} · {s.place ? j.places[s.place] + " · " : ""}{s.minutes} min
              {s.notes ? <span className="mt-0.5 block text-xs text-ink-2">{s.notes}</span> : null}
            </li>)}
          </ul>
          <p className="mt-2 text-xs text-ink-3">{fmt(f.weekHint, { weeks: horizon })}</p>
        </> : <p className="mt-2 text-sm text-ink-2">{f.noSession}</p>}
      </section>

      <p className="text-sm text-ink-2">{fmt(f.reassess, { date: nextCheck })}</p>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={addReassessment} onChange={(e) => setAddReassessment(e.target.checked)} />
        <span>{f.addCalendar}</span>
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>{f.confirm}</span>
      </label>
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
      <button type="button" disabled={!confirmed || pending} onClick={save} className={buttonClass("primary", "md", "w-full sm:w-auto")}>
        {pending ? "…" : f.save}
      </button>
    </div> : null}

    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className={buttonClass("secondary", "md")}><IconBack /> {f.back}</button>
        {onCancel ? <button type="button" onClick={onCancel} className={buttonClass("ghost", "md", "text-ink-2")}>{f.cancel}</button> : null}
      </div>
      {step < f.steps.length - 1 ? <button type="button" onClick={() => setStep((s) => Math.min(f.steps.length - 1, s + 1))}
        className={buttonClass("primary", "md")}>{f.next} <IconNext /></button> : null}
    </div>
  </section>;
}
