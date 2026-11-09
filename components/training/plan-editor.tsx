"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteTrainingPlan, saveTrainingPlan } from "@/lib/actions/training-plans";
import type { Locale } from "@/lib/i18n";
import { trainingDictionary } from "@/lib/i18n/training";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { PlanSessionControls } from "./session-actions";
import { DEFAULT_PLAN, PLAN_PLACES, type PlanPlace, type PlanSession, type SavedTrainingPlan, type TrainingPlanInput } from "@/lib/training/plans";
import { buttonClass } from "@/components/ui/button";
import { DurationField } from "@/components/ui/duration-field";
import { fieldClass as field } from "@/components/ui/field";

function blankPlan(locale: Locale): TrainingPlanInput {
  return { ...DEFAULT_PLAN, name: locale === "fr" ? "Ma semaine escalade" : DEFAULT_PLAN.name, sessions: DEFAULT_PLAN.sessions.map((s) => ({ ...s })) };
}

export function PlanEditor({ initialPlans, locale, addMethod = "", today, monday }: {
  initialPlans: SavedTrainingPlan[]; locale: Locale; addMethod?: string; today: string; monday: string;
}) {
  const t = trainingDictionary(locale);
  const j = journeyDictionary(locale);
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  // Arriving from an Atlas sheet ("Add to a plan") appends that method to the current plan draft.
  const [draft, setDraft] = useState<TrainingPlanInput>(() => {
    const base = initialPlans[0] ? { ...initialPlans[0], sessions: initialPlans[0].sessions.map((s) => ({ ...s })) } : blankPlan(locale);
    if (!addMethod || base.sessions.length >= 14) return base;
    const used = new Set(base.sessions.map((s) => s.day));
    const day = [0, 1, 2, 3, 4, 5, 6].find((d) => !used.has(d)) ?? 0;
    return { ...base, sessions: [...base.sessions, { day, methodId: addMethod, minutes: 60, notes: "" }] };
  });
  const [notice, setNotice] = useState(addMethod
    ? (locale === "fr" ? "Méthode ajoutée au programme ci-dessous — enregistre pour confirmer." : "Method added to the plan below — save to confirm.")
    : "");
  const [pending, startTransition] = useTransition();

  function selectPlan(id: string) {
    setNotice("");
    const plan = plans.find((p) => p.id === id);
    setDraft(plan ? { id: plan.id, name: plan.name, goal: plan.goal, weeks: plan.weeks, sessions: plan.sessions.map((s) => ({ ...s })) } : blankPlan(locale));
  }

  function updateSession(index: number, update: Partial<PlanSession>) {
    setDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session, i) => i === index ? { ...session, ...update } : session),
    }));
  }

  function save() {
    setNotice("");
    startTransition(async () => {
      const result = await saveTrainingPlan(draft);
      if (!result.ok) {
        setNotice(t.error);
        return;
      }
      setDraft((old) => ({ ...old, id: result.id }));
      setNotice(t.saved);
      const updated: SavedTrainingPlan = { ...draft, id: result.id, updatedAt: new Date().toISOString() };
      setPlans((current) => [updated, ...current.filter((p) => p.id !== result.id)]);
      router.refresh();
    });
  }

  function remove() {
    if (!draft.id) return;
    setNotice("");
    startTransition(async () => {
      const result = await deleteTrainingPlan(draft.id!);
      if (!result.ok) {
        setNotice(t.error);
        return;
      }
      setPlans((current) => current.filter((p) => p.id !== draft.id));
      setDraft(blankPlan(locale));
      setNotice("");
      router.refresh();
    });
  }

  return (
    <div className="mt-7 space-y-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => selectPlan("")} className={buttonClass("primary", "md")}>{t.newPlan} +</button>
        {plans.map((plan) => (
          <button
            type="button"
            key={plan.id}
            onClick={() => selectPlan(plan.id)}
            aria-pressed={draft.id === plan.id}
            className={"min-h-12 rounded-full border px-5 py-2 text-sm font-semibold " + (draft.id === plan.id ? "border-accent bg-surface-2" : "border-line bg-surface")}
          >{plan.name}</button>
        ))}
      </div>
      {draft.id && plans.some((p) => p.id === draft.id) ? (
        <PlanSessionControls locale={locale} planId={draft.id} today={today} monday={monday}
          sessions={(plans.find((p) => p.id === draft.id)?.sessions ?? []).map(({ day, methodId, minutes, title }) => ({ day, methodId, minutes, title }))} />
      ) : null}
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <label className="block text-sm font-semibold">
          {t.planName}
          <input type="text" maxLength={100} value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            className={field} />
        </label>
        <label className="block text-sm font-semibold">
          {t.planGoal}
          <input type="text" maxLength={300} value={draft.goal} onChange={(e) => setDraft((p) => ({ ...p, goal: e.target.value }))}
            className={field} />
        </label>
        <label className="block text-sm font-semibold">
          {t.planWeeks}
          <input type="number" min={1} max={52} value={draft.weeks}
            onChange={(e) => setDraft((p) => ({ ...p, weeks: Number(e.target.value) }))}
            className={field + " max-w-28"} />
        </label>
      </div>

      <div className="space-y-3">
        {draft.sessions.map((session, index) => (
          <div key={index} className="rounded-2xl border border-line bg-surface p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">
                {t.planDay}
                <select value={session.day} onChange={(e) => updateSession(index, { day: Number(e.target.value) })}
                  className={field}>
                  {t.days.map((day, d) => <option key={d} value={d}>{day}</option>)}
                </select>
              </label>
              <DurationField label={t.planMinutes} value={session.minutes}
                onChange={(v) => updateSession(index, { minutes: v ?? 0 })} min={10} max={240} step={5} />
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
              <textarea value={session.notes} maxLength={500} rows={2} onChange={(e) => updateSession(index, { notes: e.target.value })}
                className={field} />
            </label>
            <div className="mt-2 text-right">
              <button type="button" disabled={draft.sessions.length <= 1 || pending} onClick={() => setDraft((p) => ({ ...p, sessions: p.sessions.filter((_, i) => i !== index) }))}
                className="inline-flex min-h-11 items-center text-sm font-bold text-danger underline disabled:opacity-40">{t.delete}</button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" disabled={draft.sessions.length >= 14 || pending} onClick={() => setDraft((p) => ({
        ...p, sessions: [...p.sessions, { day: 0, methodId: "technique", minutes: 45, notes: "" }],
      }))} className={buttonClass("secondary", "md")}>
        + {t.add}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <button type="button" disabled={pending || !draft.name.trim() || draft.sessions.length < 1} onClick={save}
          className={buttonClass("primary")}>{t.save}</button>
        {draft.id ? <button type="button" disabled={pending} onClick={remove} className="inline-flex min-h-11 items-center text-sm font-bold text-danger underline">{t.delete}</button> : null}
      </div>
      {notice ? <p role="status" className="text-sm font-semibold text-ink-2">{notice}</p> : null}
      <p className="text-xs leading-relaxed text-ink-3">{t.safety}</p>
    </div>
  );
}
