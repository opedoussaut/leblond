"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteTrainingPlan, saveTrainingPlan } from "@/lib/actions/training-plans";
import { fmt, type Locale } from "@/lib/i18n";
import { trainingDictionary } from "@/lib/i18n/training";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { planModesDictionary } from "@/lib/i18n/training-plans";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import type { Health } from "@/lib/training/health";
import { planHints, type PlanHint } from "@/lib/training/plan-hints";
import type { ProposalAdjustment } from "@/lib/training/plan-proposal";
import {
  DEFAULT_PLAN, DURATION_MAX, DURATION_UNITS, durationWeeks, editablePlan, MAX_PHASES, PHASE_KINDS, phasesOf, phaseWeeks,
  PLAN_PLACES, planDuration, type DurationUnit, type PhaseKind, type PlanDuration, type PlanMode, type PlanPhase,
  type PlanPlace, type PlanSession, type SavedTrainingPlan, type TrainingPlanInput,
} from "@/lib/training/plans";
import { PlanSessionControls } from "./session-actions";
import { PatrickPlanForm } from "./patrick-plan-form";
import { buttonClass } from "@/components/ui/button";
import { DurationField } from "@/components/ui/duration-field";
import { fieldClass as field } from "@/components/ui/field";

/** The editor works on phases always; a one-phase plan is saved as before (a weekly template). */
type Draft = { id?: string; name: string; goal: string; mode: PlanMode; duration: PlanDuration; phases: PlanPhase[] };

function toDraft(plan: TrainingPlanInput, phaseName: string): Draft {
  return {
    ...(plan.id ? { id: plan.id } : {}),
    name: plan.name, goal: plan.goal, mode: plan.mode ?? "MANUAL", duration: planDuration(plan),
    phases: phasesOf(plan, phaseName).map((p) => ({ ...p, sessions: p.sessions.map((s) => ({ ...s })) })),
  };
}

function toPlan(d: Draft): TrainingPlanInput {
  const weeks = durationWeeks(d.duration.value, d.duration.unit);
  const phases = d.phases.length === 1 ? [{ ...d.phases[0], weeks }] : d.phases;
  return {
    ...(d.id ? { id: d.id } : {}),
    name: d.name, goal: d.goal, mode: d.mode, duration: d.duration, weeks,
    sessions: phases[0].sessions, ...(phases.length > 1 ? { phases } : {}),
  };
}

function blankDraft(locale: Locale, mode: PlanMode, phaseName: string): Draft {
  return toDraft({
    ...DEFAULT_PLAN, mode, name: locale === "fr" ? "Ma semaine escalade" : DEFAULT_PLAN.name,
    sessions: DEFAULT_PLAN.sessions.map((s) => ({ ...s })),
  }, phaseName);
}

export function PlanEditor({ initialPlans, locale, addMethod = "", today, monday, health }: {
  initialPlans: SavedTrainingPlan[]; locale: Locale; addMethod?: string; today: string; monday: string; health: Health;
}) {
  const t = trainingDictionary(locale);
  const j = journeyDictionary(locale);
  const m = planModesDictionary(locale);
  const phaseName = (n: number) => fmt(m.newPhaseName, { n });
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  // No plan yet and no method to add: start by choosing how to build it.
  const [choosing, setChoosing] = useState(initialPlans.length === 0 && !addMethod);
  const [patrickForm, setPatrickForm] = useState(false);
  const [adjustments, setAdjustments] = useState<ProposalAdjustment[] | null>(null);
  // Arriving from an Atlas sheet ("Add to a plan") appends that method to the current plan draft.
  const [draft, setDraft] = useState<Draft>(() => {
    const base = initialPlans[0] ? toDraft(editablePlan(initialPlans[0]), phaseName(1)) : blankDraft(locale, "MANUAL", phaseName(1));
    const first = base.phases[0];
    if (!addMethod || first.sessions.length >= 14) return base;
    const used = new Set(first.sessions.map((s) => s.day));
    const day = [0, 1, 2, 3, 4, 5, 6].find((d) => !used.has(d)) ?? 0;
    return { ...base, phases: [{ ...first, sessions: [...first.sessions, { day, methodId: addMethod, minutes: 60, notes: "" }] }, ...base.phases.slice(1)] };
  });
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [notice, setNotice] = useState(addMethod
    ? (locale === "fr" ? "Méthode ajoutée au programme ci-dessous — enregistre pour confirmer." : "Method added to the plan below — save to confirm.")
    : "");
  const [pending, startTransition] = useTransition();

  const current = draft.phases[Math.min(phaseIndex, draft.phases.length - 1)];
  const totalWeeks = durationWeeks(draft.duration.value, draft.duration.unit);
  const hints = useMemo(() => draft.mode === "MANUAL" ? [] : planHints(toPlan(draft), health), [draft, health]);
  const saved = draft.id ? plans.find((p) => p.id === draft.id) : undefined;
  const savedPhases = saved ? phasesOf(saved, phaseName(1)) : [];

  function open(next: Draft, message = "") {
    setDraft(next);
    setPhaseIndex(0);
    setNotice(message);
    setChoosing(false);
    setPatrickForm(false);
  }

  function selectPlan(id: string) {
    const plan = plans.find((p) => p.id === id);
    if (plan) { setAdjustments(null); open(toDraft(editablePlan(plan), phaseName(1))); }
  }

  function startNew(mode: PlanMode) {
    setAdjustments(null);
    if (mode === "PATRICK") { setChoosing(false); setPatrickForm(true); setNotice(""); return; }
    open(blankDraft(locale, mode, phaseName(1)));
  }

  function setPhase(index: number, update: Partial<PlanPhase>) {
    setDraft((d) => ({ ...d, phases: d.phases.map((p, i) => i === index ? { ...p, ...update } : p) }));
  }

  function updateSession(index: number, update: Partial<PlanSession>) {
    setPhase(phaseIndex, { sessions: current.sessions.map((s, i) => i === index ? { ...s, ...update } : s) });
  }

  function addPhase() {
    setDraft((d) => {
      if (d.phases.length >= MAX_PHASES) return d;
      const total = durationWeeks(d.duration.value, d.duration.unit);
      let phases = d.phases;
      // Splitting a one-phase plan: the first phase gives up four weeks to the new one.
      if (phases.length === 1) phases = [{ ...phases[0], weeks: Math.max(1, total - 4) }];
      const left = total - phaseWeeks(phases);
      const next: PlanPhase = {
        name: phaseName(phases.length + 1), weeks: Math.max(1, left),
        sessions: phases[phases.length - 1].sessions.map((s) => ({ ...s })),
      };
      setPhaseIndex(phases.length);
      return { ...d, phases: [...phases, next] };
    });
  }

  function removePhase(index: number) {
    setDraft((d) => d.phases.length <= 1 ? d : { ...d, phases: d.phases.filter((_, i) => i !== index) });
    setPhaseIndex((i) => Math.max(0, i >= index ? i - 1 : i));
  }

  function save() {
    setNotice("");
    const plan = toPlan(draft);
    startTransition(async () => {
      const result = await saveTrainingPlan(plan);
      if (!result.ok) { setNotice(t.error); return; }
      setDraft((old) => ({ ...old, id: result.id }));
      setAdjustments(null);
      setNotice(t.saved);
      const updated: SavedTrainingPlan = { ...plan, id: result.id, updatedAt: new Date().toISOString() };
      setPlans((list) => [updated, ...list.filter((p) => p.id !== result.id)]);
      router.refresh();
    });
  }

  function remove() {
    if (!draft.id) return;
    setNotice("");
    startTransition(async () => {
      const result = await deleteTrainingPlan(draft.id!);
      if (!result.ok) { setNotice(t.error); return; }
      setPlans((list) => list.filter((p) => p.id !== draft.id));
      setChoosing(true);
      setNotice("");
      router.refresh();
    });
  }

  function hintText(h: PlanHint): string {
    const method = METHODS_FOR_PLANS.find((x) => x.id === h.methodId)?.title ?? "";
    const text = fmt(m.hints[h.code], {
      planned: h.planned ?? "", total: h.total ?? "", method,
      areas: (h.areas ?? []).map((a) => j.areas[a].toLowerCase()).join(", "),
      days: (h.days ?? []).map((d) => t.days[d]).join(" → "),
    });
    return h.phase != null && draft.phases[h.phase] ? fmt(m.inPhase, { phase: draft.phases[h.phase].name }) + text : text;
  }

  const planTabs = (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => { setChoosing(true); setPatrickForm(false); setNotice(""); }}
        className={buttonClass("primary", "md")}>{t.newPlan} +</button>
      {plans.map((plan) => (
        <button type="button" key={plan.id} onClick={() => selectPlan(plan.id)}
          aria-pressed={!choosing && !patrickForm && draft.id === plan.id}
          className={"min-h-12 rounded-full border px-5 py-2 text-sm font-semibold " + (!choosing && !patrickForm && draft.id === plan.id ? "border-accent bg-surface-2" : "border-line bg-surface")}
        >{plan.name}</button>
      ))}
    </div>
  );

  if (choosing) {
    return (
      <div className="mt-7 space-y-5">
        {planTabs}
        <fieldset className="space-y-3">
          <legend className="text-lg font-bold">{m.modeQuestion}</legend>
          {(["MANUAL", "ASSISTED", "PATRICK"] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => startNew(mode)}
              className="block w-full rounded-2xl border border-line bg-surface p-4 text-left hover:border-accent focus-visible:border-accent">
              <span className="block font-bold">{m.modes[mode].title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-2">{m.modes[mode].text}</span>
            </button>
          ))}
        </fieldset>
        <p className="text-xs leading-relaxed text-ink-3">{t.safety}</p>
      </div>
    );
  }

  if (patrickForm) {
    return (
      <div className="mt-7 space-y-5">
        {planTabs}
        <PatrickPlanForm locale={locale} onProposal={(plan, adj) => {
          setAdjustments(adj);
          open(toDraft(plan, phaseName(1)), m.patrick.proposal);
        }} />
        <p className="text-xs leading-relaxed text-ink-3">{t.safety}</p>
      </div>
    );
  }

  return (
    <div className="mt-7 space-y-5">
      {planTabs}
      {saved && savedPhases[phaseIndex] ? (
        <PlanSessionControls locale={locale} planId={saved.id} today={today} monday={monday} phaseIndex={phaseIndex}
          sessions={savedPhases[phaseIndex].sessions.map(({ day, methodId, minutes, title }) => ({ day, methodId, minutes, title }))} />
      ) : null}

      <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">{m.modeBadge[draft.mode]}</p>
        <label className="block text-sm font-semibold">
          {t.planName}
          <input type="text" maxLength={100} value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} className={field} />
        </label>
        <label className="block text-sm font-semibold">
          {t.planGoal}
          <input type="text" maxLength={300} value={draft.goal} onChange={(e) => setDraft((p) => ({ ...p, goal: e.target.value }))} className={field} />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">{m.duration}</legend>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input type="number" min={1} max={DURATION_MAX[draft.duration.unit]} required aria-label={m.duration}
              value={draft.duration.value} className={field + " !mt-0 max-w-28"}
              onChange={(e) => {
                const value = Math.trunc(Number(e.target.value));
                if (Number.isFinite(value)) setDraft((p) => ({ ...p, duration: { ...p.duration, value } }));
              }} />
            <select aria-label={m.durationUnit} value={draft.duration.unit} className={field + " !mt-0 max-w-40"}
              onChange={(e) => {
                const unit = e.target.value as DurationUnit;
                setDraft((p) => ({ ...p, duration: { unit, value: Math.min(p.duration.value, DURATION_MAX[unit]) } }));
              }}>
              {DURATION_UNITS.map((u) => <option key={u} value={u}>{m.durationUnits[u]}</option>)}
            </select>
            {draft.duration.unit !== "WEEKS" ? <span className="text-sm text-ink-2">{fmt(m.durationWeeks, { n: totalWeeks })}</span> : null}
          </div>
        </fieldset>
        {draft.mode !== "PATRICK" ? (
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-accent" checked={draft.mode === "ASSISTED"}
              onChange={(e) => setDraft((p) => ({ ...p, mode: e.target.checked ? "ASSISTED" : "MANUAL" }))} />
            {m.showHints}
          </label>
        ) : null}
      </div>

      {adjustments && adjustments.length ? (
        <ul className="list-disc space-y-1 rounded-2xl border border-line bg-surface-2 p-4 pl-8 text-sm text-ink-2">
          {adjustments.map((a) => <li key={a}>{m.patrick.adjustments[a]}</li>)}
        </ul>
      ) : null}

      {draft.mode !== "MANUAL" ? (
        <section aria-label={m.hintsTitle} className="rounded-2xl border border-accent/25 bg-accent-soft p-4">
          <h2 className="text-sm font-bold">{m.hintsTitle}</h2>
          {hints.length ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {hints.map((h, i) => (
                <li key={i} className={h.level === "warn" ? "font-semibold text-ink" : "text-ink-2"}>
                  <span aria-hidden="true">{h.level === "warn" ? "⚠ " : "• "}</span>{hintText(h)}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-ink-2">{m.hintsNone}</p>}
          <p className="mt-2 text-xs text-ink-3">{m.hintsNote}</p>
        </section>
      ) : null}

      <section aria-label={m.phases} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{m.phases}</h2>
          <button type="button" disabled={draft.phases.length >= MAX_PHASES || pending} onClick={addPhase}
            className={buttonClass("secondary", "sm")}>{m.addPhase}</button>
        </div>
        {draft.phases.length === 1 ? <p className="text-sm text-ink-2">{m.phasesHint}</p> : (
          <>
            <p className="text-sm text-ink-2">{fmt(m.phasesCover, { planned: phaseWeeks(draft.phases), total: totalWeeks })}</p>
            <div className="flex flex-wrap gap-2" role="tablist">
              {draft.phases.map((p, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === phaseIndex} onClick={() => setPhaseIndex(i)}
                  className={"min-h-11 rounded-full border px-4 text-sm font-semibold " + (i === phaseIndex ? "border-accent bg-surface-2" : "border-line bg-surface")}>
                  {p.name} · {fmt(m.weeksShort, { n: p.weeks })}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3">
              <label className="text-sm font-semibold sm:col-span-2">{m.phaseName}
                <input type="text" maxLength={60} value={current.name} className={field}
                  onChange={(e) => setPhase(phaseIndex, { name: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">{m.phaseWeeks}
                <input type="number" min={1} max={260} value={current.weeks} className={field}
                  onChange={(e) => { const w = Math.trunc(Number(e.target.value)); if (Number.isFinite(w)) setPhase(phaseIndex, { weeks: w }); }} />
              </label>
              <label className="text-sm font-semibold">{m.phaseKind}
                <select value={current.kind ?? ""} className={field}
                  onChange={(e) => setPhase(phaseIndex, { kind: (e.target.value || undefined) as PhaseKind | undefined })}>
                  <option value="">{m.phaseKindAny}</option>
                  {PHASE_KINDS.map((k) => <option key={k} value={k}>{m.phaseKinds[k]}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold sm:col-span-2">{m.phaseObjective}
                <input type="text" maxLength={200} value={current.objective ?? ""} placeholder={m.phaseObjectivePlaceholder} className={field}
                  onChange={(e) => setPhase(phaseIndex, { objective: e.target.value || undefined })} />
              </label>
              <div className="sm:col-span-3 text-right">
                <button type="button" disabled={pending} onClick={() => removePhase(phaseIndex)}
                  className="inline-flex min-h-11 items-center text-sm font-bold text-danger underline">{m.removePhase}</button>
              </div>
            </div>
            <h3 className="font-bold">{fmt(m.phaseSessions, { name: current.name })}</h3>
          </>
        )}
      </section>

      <div className="space-y-3">
        {current.sessions.map((session, index) => (
          <div key={`${phaseIndex}-${index}`} className="rounded-2xl border border-line bg-surface p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">
                {t.planDay}
                <select value={session.day} onChange={(e) => updateSession(index, { day: Number(e.target.value) })} className={field}>
                  {t.days.map((day, d) => <option key={d} value={d}>{day}</option>)}
                </select>
              </label>
              <DurationField label={t.planMinutes} value={session.minutes}
                onChange={(v) => updateSession(index, { minutes: v ?? 0 })} min={10} max={240} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                {t.planMethod}
                <select value={session.methodId ?? ""} className={field}
                  onChange={(e) => updateSession(index, e.target.value
                    ? { methodId: e.target.value, title: undefined }
                    : { methodId: null, title: session.title ?? j.programme.mobilityTitle, place: "HOME" })}>
                  {METHODS_FOR_PLANS.map((method) => <option key={method.id} value={method.id}>{method.title}</option>)}
                  <option value="">{j.planEditor.outsideAtlas}</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">
                {j.planEditor.place}
                <select value={session.place ?? ""} className={field}
                  onChange={(e) => updateSession(index, { place: (e.target.value || undefined) as PlanPlace | undefined })}>
                  <option value="">{j.planEditor.placeAny}</option>
                  {PLAN_PLACES.map((p) => <option key={p} value={p}>{j.places[p]}</option>)}
                </select>
              </label>
            </div>
            {session.methodId ? <Link className="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-accent underline underline-offset-4"
              href={"/atlas/" + session.methodId}>
              {locale === "fr" ? "Voir la fiche complète de cette méthode" : "Open full method guide"} ↗
            </Link> : <label className="mt-3 block text-sm font-semibold">
              {j.planEditor.title}
              <input type="text" maxLength={80} value={session.title ?? ""} className={field}
                onChange={(e) => updateSession(index, { title: e.target.value })} />
            </label>}
            <label className="mt-3 block text-sm font-semibold">
              {t.planNotes}
              <textarea value={session.notes} maxLength={500} rows={2} onChange={(e) => updateSession(index, { notes: e.target.value })} className={field} />
            </label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="size-5 accent-accent" checked={session.optional === true}
                  onChange={(e) => updateSession(index, { optional: e.target.checked || undefined })} />
                {m.optional}
              </label>
              <button type="button" disabled={current.sessions.length <= 1 || pending}
                onClick={() => setPhase(phaseIndex, { sessions: current.sessions.filter((_, i) => i !== index) })}
                className="inline-flex min-h-11 items-center text-sm font-bold text-danger underline disabled:opacity-40">{t.delete}</button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" disabled={current.sessions.length >= 14 || pending}
        onClick={() => setPhase(phaseIndex, { sessions: [...current.sessions, { day: 0, methodId: "technique", minutes: 45, notes: "" }] })}
        className={buttonClass("secondary", "md")}>
        + {t.add}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <button type="button" disabled={pending || !draft.name.trim() || draft.phases.some((p) => !p.name.trim() || p.sessions.length < 1)}
          onClick={save} className={buttonClass("primary")}>{t.save}</button>
        {draft.id ? <button type="button" disabled={pending} onClick={remove} className="inline-flex min-h-11 items-center text-sm font-bold text-danger underline">{t.delete}</button> : null}
      </div>
      {notice ? <p role="status" className="text-sm font-semibold text-ink-2">{notice}</p> : null}
      <p className="text-xs leading-relaxed text-ink-3">{t.safety}</p>
    </div>
  );
}
