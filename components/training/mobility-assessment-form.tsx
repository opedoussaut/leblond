"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveMobilityAssessment } from "@/lib/actions/mobility";
import { fmt, type Locale } from "@/lib/i18n";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import {
  DISCOMFORT_AREAS, MOBILITY_TESTS, SUPPORTS, TIMES_OF_DAY, WARNING_FLAGS,
  type MobilityConditions, type MobilityResult, type TestDefinition,
} from "@/lib/training/hip-mobility/assessment";
import { LEVEL_LABELS, NOT_CLINICAL, type Level } from "@/lib/training/hip-mobility/content";
import { pick } from "@/lib/training/sessions";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { MobilityIllustration } from "./mobility-illustrations";

type SideKey = "LEFT" | "RIGHT";
type SideDraft = Omit<MobilityResult, "test" | "side">;

const blankSide = (): SideDraft => ({
  done: true, skipReason: null, level: null, value: null, support: "HANDS", discomfort: 0, discomfortArea: null, active: true, flags: [],
});

function chip(on: boolean, danger = false) {
  return "min-h-11 rounded-full border px-3 text-sm font-bold " +
    (on ? (danger ? "border-danger bg-danger text-surface" : "border-accent bg-accent text-accent-ink") : "border-line bg-surface text-ink");
}
const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function SideFields({ locale, test, side, draft, onChange }: {
  locale: Locale; test: TestDefinition; side: SideKey; draft: SideDraft; onChange: (d: SideDraft) => void;
}) {
  const m = mobilityDictionary(locale);
  const set = (patch: Partial<SideDraft>) => onChange({ ...draft, ...patch });
  const idp = `t${test.id}-${side}`;
  return <fieldset className="space-y-3 rounded-2xl border border-line bg-surface p-4">
    <legend className="px-1 text-base font-extrabold">{m.sides[side]}</legend>
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
      <input type="checkbox" className="h-5 w-5 accent-accent" checked={!draft.done}
        onChange={(e) => set(e.target.checked ? { done: false, level: null, skipReason: "NOT_POSSIBLE" } : { done: true, skipReason: null })} />
      {m.notDone}
    </label>
    {!draft.done ? <div className="flex flex-wrap gap-2" role="group" aria-label={m.notDone}>
      {(["PAIN", "NOT_POSSIBLE"] as const).map((r) => <button key={r} type="button" aria-pressed={draft.skipReason === r}
        onClick={() => set({ skipReason: r })} className={chip(draft.skipReason === r)}>{m.skipReasons[r]}</button>)}
    </div> : <>
      <div role="radiogroup" aria-label={m.levelLabel} className="space-y-2">
        <p className="text-sm font-semibold">{m.levelLabel}</p>
        {test.levels.map((l, i) => <label key={i} className={"flex cursor-pointer gap-3 rounded-xl border p-3 text-sm " + (draft.level === i ? "border-accent bg-accent-soft" : "border-line")}>
          <input type="radio" name={idp + "-level"} className="mt-0.5 h-5 w-5 shrink-0 accent-accent" checked={draft.level === i} onChange={() => set({ level: i })} />
          <span><strong className="tabular-nums">{i}</strong> · {pick(l, locale)}</span>
        </label>)}
      </div>
      <label className="block text-sm font-semibold">{m.measured} — {pick(test.value.label, locale)} <span className="font-normal text-ink-3">({m.measuredHint})</span>
        <input className={fieldClass} inputMode="decimal" type="number" min={test.value.min} max={test.value.max}
          value={draft.value ?? ""} onChange={(e) => set({ value: num(e.target.value) })} />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label={m.support}>
        <p className="w-full text-sm font-semibold">{m.support}</p>
        {SUPPORTS.map((s) => <button key={s} type="button" aria-pressed={draft.support === s} onClick={() => set({ support: s })} className={chip(draft.support === s)}>{m.supports[s]}</button>)}
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
        {m.active}
      </label>
    </>}
    <label className="block text-sm font-semibold">{m.discomfort}
      <input type="range" min={0} max={10} value={draft.discomfort} className="mt-2 w-full accent-accent"
        onChange={(e) => set({ discomfort: Number(e.target.value), discomfortArea: Number(e.target.value) > 0 ? draft.discomfortArea ?? "hip" : null })} />
      <span className="text-sm font-bold tabular-nums">{draft.discomfort} / 10</span>
    </label>
    {draft.discomfort > 0 ? <label className="block text-sm font-semibold">{m.discomfortArea}
      <select className={fieldClass} value={draft.discomfortArea ?? "hip"} onChange={(e) => set({ discomfortArea: e.target.value as SideDraft["discomfortArea"] })}>
        {DISCOMFORT_AREAS.map((a) => <option key={a} value={a}>{m.areas[a]}</option>)}
      </select>
    </label> : null}
    <div className="flex flex-wrap gap-2" role="group" aria-label={m.flags}>
      <p className="w-full text-sm font-semibold">{m.flags}</p>
      {WARNING_FLAGS.map((f) => <button key={f} type="button" aria-pressed={draft.flags.includes(f)} className={chip(draft.flags.includes(f), true)}
        onClick={() => set({ flags: draft.flags.includes(f) ? draft.flags.filter((x) => x !== f) : [...draft.flags, f] })}>{m.flagNames[f]}</button>)}
    </div>
  </fieldset>;
}

/**
 * The beginner assessment, one test per step, each side recorded separately.
 * Levels are the described levels of each test; the stage is computed on the server.
 */
export function MobilityAssessmentForm({ locale, today, previous }: {
  locale: Locale; today: string; previous: MobilityConditions | null;
}) {
  const m = mobilityDictionary(locale);
  const router = useRouter();
  const steps = ["conditions", ...MOBILITY_TESTS.map((t) => t.id), "review"] as const;
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(today);
  const [conditions, setConditions] = useState<MobilityConditions>(previous ? { ...previous, notes: "" }
    : { warmedUp: false, timeOfDay: "EVENING", cushionCm: 0, wall: null, notes: "" });
  const [doD, setDoD] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Record<SideKey, SideDraft>>>(() =>
    Object.fromEntries(MOBILITY_TESTS.map((t) => [t.id, { LEFT: blankSide(), RIGHT: blankSide() }])));
  const [stance, setStance] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Level | null>(null);
  const [pending, start] = useTransition();
  const current = steps[step];
  const test = MOBILITY_TESTS.find((t) => t.id === current);

  function results(): MobilityResult[] {
    return MOBILITY_TESTS.flatMap((t) => {
      if (t.id === "D" && !doD) return [];
      const sides = (["LEFT", "RIGHT"] as const).map((side) => ({ test: t.id, side, ...drafts[t.id][side] }));
      const both = t.id === "B" && num(stance) !== null
        ? [{ test: t.id, side: "BOTH" as const, ...blankSide(), level: null, support: "NONE" as const, value: num(stance) }] : [];
      return [...sides, ...both];
    });
  }

  function save() {
    setError("");
    start(async () => {
      const r = await saveMobilityAssessment({
        assessedOn: date,
        conditions: { ...conditions, wall: doD ? conditions.wall ?? { kind: "WALL", angleDeg: 0, spacingCm: 40 } : null },
        results: results(), notes: "",
      });
      if (!r.ok) { setError(r.error === "limit" ? m.limit : r.error === "invalid" ? m.invalid : m.problem); return; }
      setSaved(r.data.stage);
      router.refresh();
    });
  }

  if (saved !== null) return <section role="status" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
    <h2 className="text-xl font-black">{m.resultTitle}</h2>
    <p className="text-lg font-bold">{fmt(m.resultStage, { level: pick(LEVEL_LABELS[saved].name, locale) })}</p>
    <p className="text-sm text-ink-2">{pick(LEVEL_LABELS[saved].detail, locale)}</p>
    <p className="text-xs text-ink-3">{pick(NOT_CLINICAL, locale)}</p>
    <Link href="/train/mobility" className={buttonClass("primary", "md")}>{m.backToProgramme} →</Link>
  </section>;

  return <div className="space-y-5">
    <ol className="flex gap-1" aria-hidden="true">
      {steps.map((s, i) => <li key={s} className={"h-1.5 flex-1 rounded-full " + (i <= step ? "bg-accent" : "bg-line")} />)}
    </ol>

    {current === "conditions" ? <section className="leblond-premium-surface space-y-4 p-5 sm:p-6" aria-labelledby="cond-title">
      <h2 id="cond-title" className="text-lg font-extrabold">{m.conditionsTitle}</h2>
      <p className="text-sm text-ink-2">{m.assessIntro}</p>
      <label className="block text-sm font-semibold">{m.date}
        <input type="date" className={fieldClass} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="h-5 w-5 accent-accent" checked={conditions.warmedUp} onChange={(e) => setConditions({ ...conditions, warmedUp: e.target.checked })} />
        {m.warmedUp}
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label={m.timeOfDay}>
        <p className="w-full text-sm font-semibold">{m.timeOfDay}</p>
        {TIMES_OF_DAY.map((x) => <button key={x} type="button" aria-pressed={conditions.timeOfDay === x}
          onClick={() => setConditions({ ...conditions, timeOfDay: x })} className={chip(conditions.timeOfDay === x)}>{m.times[x]}</button>)}
      </div>
      <label className="block text-sm font-semibold">{m.cushion}
        <input className={fieldClass} inputMode="numeric" type="number" min={0} max={40} value={conditions.cushionCm}
          onChange={(e) => setConditions({ ...conditions, cushionCm: Math.max(0, Math.min(40, Math.round(num(e.target.value) ?? 0))) })} />
      </label>
    </section> : null}

    {test ? <section className="space-y-4" aria-labelledby={"test-" + test.id}>
      <div className="leblond-premium-surface space-y-3 p-5 sm:p-6">
        <h2 id={"test-" + test.id} className="text-lg font-extrabold">{pick(test.name, locale)}</h2>
        {test.optional ? <p className="text-sm font-semibold text-accent">{m.optionalTest}</p> : null}
        <MobilityIllustration test={test.id} title={pick(test.name, locale)} />
        <p className="text-sm font-semibold">{pick(test.question, locale)}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-2">{test.setup.map((s, i) => <li key={i}>{pick(s, locale)}</li>)}</ol>
        <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm"><strong>{m.stopRule} :</strong> {pick(test.stop, locale)}</p>
        {test.id === "D" ? <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!doD} onClick={() => setDoD(false)} className={chip(!doD)}>{m.skipD}</button>
          <button type="button" aria-pressed={doD} onClick={() => { setDoD(true); setConditions((c) => ({ ...c, wall: c.wall ?? { kind: "WALL", angleDeg: 0, spacingCm: 40 } })); }} className={chip(doD)}>{m.doD}</button>
        </div> : null}
      </div>
      {test.id === "D" && doD && conditions.wall ? <div className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3">
        <label className="block text-sm font-semibold">{m.wallKind}
          <select className={fieldClass} value={conditions.wall.kind} onChange={(e) => setConditions({ ...conditions, wall: { ...conditions.wall!, kind: e.target.value as "WALL" | "BOARD" } })}>
            <option value="WALL">{m.wallKinds.WALL}</option><option value="BOARD">{m.wallKinds.BOARD}</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">{m.wallAngle}
          <input className={fieldClass} type="number" min={-20} max={60} value={conditions.wall.angleDeg}
            onChange={(e) => setConditions({ ...conditions, wall: { ...conditions.wall!, angleDeg: Math.max(-20, Math.min(60, Math.round(num(e.target.value) ?? 0))) } })} />
        </label>
        <label className="block text-sm font-semibold">{m.spacing}
          <input className={fieldClass} type="number" min={10} max={200} value={conditions.wall.spacingCm}
            onChange={(e) => setConditions({ ...conditions, wall: { ...conditions.wall!, spacingCm: Math.max(10, Math.min(200, Math.round(num(e.target.value) ?? 40))) } })} />
        </label>
      </div> : null}
      {test.id !== "D" || doD ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(["LEFT", "RIGHT"] as const).map((side) => <SideFields key={side} locale={locale} test={test} side={side} draft={drafts[test.id][side]}
          onChange={(d) => setDrafts((all) => ({ ...all, [test.id]: { ...all[test.id], [side]: d } }))} />)}
      </div> : null}
      {test.both ? <label className="block rounded-2xl border border-line bg-surface p-4 text-sm font-semibold">
        {pick(test.both.name, locale)} <span className="font-normal text-ink-3">({m.measuredHint})</span>
        <span className="mt-1 block text-xs font-normal text-ink-2">{pick(test.both.how, locale)}</span>
        <input className={fieldClass} inputMode="numeric" type="number" min={test.both.min} max={test.both.max} value={stance} onChange={(e) => setStance(e.target.value)} />
      </label> : null}
    </section> : null}

    {current === "review" ? <section className="leblond-premium-surface space-y-4 p-5 sm:p-6" aria-labelledby="review-title">
      <h2 id="review-title" className="text-lg font-extrabold">{m.saveAssessment}</h2>
      <ul className="space-y-1 text-sm">
        {results().filter((r) => r.side !== "BOTH").map((r) => <li key={r.test + r.side} className="flex justify-between gap-3">
          <span>{r.test} · {m.sides[r.side]}</span>
          <span className="font-bold tabular-nums">{r.done ? (r.level ?? "?") : m.skipReasons[r.skipReason ?? "NOT_POSSIBLE"]}</span>
        </li>)}
      </ul>
      <label className="block text-sm font-semibold">{m.notesLabel}
        <textarea rows={2} maxLength={300} className={fieldClass} value={conditions.notes} onChange={(e) => setConditions({ ...conditions, notes: e.target.value })} />
      </label>
      <p className="text-xs text-ink-3">{pick(NOT_CLINICAL, locale)}</p>
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
      <button type="button" disabled={pending} onClick={save} className={buttonClass("primary", "md", "w-full")}>{pending ? m.saving : m.saveAssessment}</button>
    </section> : null}

    <div className="flex justify-between gap-3">
      <button type="button" disabled={step === 0} onClick={() => { setStep((s) => s - 1); window.scrollTo({ top: 0 }); }}
        className="min-h-12 rounded-2xl border border-line bg-surface px-5 text-sm font-bold disabled:opacity-40">← {m.previous}</button>
      {step < steps.length - 1 ? <button type="button" onClick={() => { setStep((s) => s + 1); window.scrollTo({ top: 0 }); }}
        className={buttonClass("primary", "md")}>{m.next} →</button> : null}
    </div>
  </div>;
}
