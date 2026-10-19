"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteTrainingPlan, saveTrainingPlan } from "@/lib/actions/training-plans";
import type { Locale } from "@/lib/i18n";
import { trainingDictionary } from "@/lib/i18n/training";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { PlanSessionControls } from "./session-actions";
import { DEFAULT_PLAN, type PlanSession, type SavedTrainingPlan, type TrainingPlanInput } from "@/lib/training/plans";

function blankPlan(locale: Locale): TrainingPlanInput {
  return { ...DEFAULT_PLAN, name: locale === "fr" ? "Ma semaine escalade" : DEFAULT_PLAN.name, sessions: DEFAULT_PLAN.sessions.map((s) => ({ ...s })) };
}

export function PlanEditor({ initialPlans, locale, addMethod = "", today, monday }: {
  initialPlans: SavedTrainingPlan[]; locale: Locale; addMethod?: string; today: string; monday: string;
}) {
  const t = trainingDictionary(locale);
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
        <button type="button" onClick={() => selectPlan("")} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink">{t.newPlan} +</button>
        {plans.map((plan) => (
          <button
            type="button"
            key={plan.id}
            onClick={() => selectPlan(plan.id)}
            aria-pressed={draft.id === plan.id}
            className={"rounded-xl border px-4 py-2.5 text-sm font-semibold " + (draft.id === plan.id ? "border-accent bg-surface-2" : "border-line bg-surface")}
          >{plan.name}</button>
        ))}
      </div>
      {draft.id && plans.some((p) => p.id === draft.id) ? (
        <PlanSessionControls locale={locale} planId={draft.id} today={today} monday={monday}
          sessions={(plans.find((p) => p.id === draft.id)?.sessions ?? []).map(({ day, methodId, minutes }) => ({ day, methodId, minutes }))} />
      ) : null}
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <label className="block text-sm font-semibold">
          {t.planName}
          <input type="text" maxLength={100} value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            className="mt-2 block w-full rounded-xl border border-line bg-bg px-3 py-2.5" />
        </label>
        <label className="block text-sm font-semibold">
          {t.planGoal}
          <input type="text" maxLength={300} value={draft.goal} onChange={(e) => setDraft((p) => ({ ...p, goal: e.target.value }))}
            className="mt-2 block w-full rounded-xl border border-line bg-bg px-3 py-2.5" />
        </label>
        <label className="block text-sm font-semibold">
          {t.planWeeks}
          <input type="number" min={1} max={52} value={draft.weeks}
            onChange={(e) => setDraft((p) => ({ ...p, weeks: Number(e.target.value) }))}
            className="mt-2 block w-28 rounded-xl border border-line bg-bg px-3 py-2.5" />
        </label>
      </div>

      <div className="space-y-3">
        {draft.sessions.map((session, index) => (
          <div key={index} className="rounded-2xl border border-line bg-surface p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-ink-2">
                {t.planDay}
                <select value={session.day} onChange={(e) => updateSession(index, { day: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-lg border border-line bg-bg px-2 py-2.5 text-sm text-ink">
                  {t.days.map((day, d) => <option key={d} value={d}>{day}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-ink-2">
                {t.planMinutes}
                <input type="number" min={10} max={240} step={5} value={session.minutes}
                  onChange={(e) => updateSession(index, { minutes: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-lg border border-line bg-bg px-2 py-2.5 text-sm text-ink" />
              </label>
            </div>
            <label className="mt-3 block text-xs font-bold text-ink-2">
              {t.planMethod}
              <select value={session.methodId} onChange={(e) => updateSession(index, { methodId: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-line bg-bg px-2 py-2.5 text-sm text-ink">
                {METHODS_FOR_PLANS.map((method) => <option key={method.id} value={method.id}>{method.title}</option>)}
              </select>
            </label>
            <Link className="mt-2 inline-block text-xs font-bold text-accent underline underline-offset-4"
              href={"/atlas/" + session.methodId}>
              {locale === "fr" ? "Voir la fiche complète de cette méthode" : "Open full method guide"} ↗
            </Link>
            <label className="mt-3 block text-xs font-bold text-ink-2">
              {t.planNotes}
              <textarea value={session.notes} maxLength={500} rows={2} onChange={(e) => updateSession(index, { notes: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-line bg-bg px-2 py-2.5 text-sm text-ink" />
            </label>
            <div className="mt-2 text-right">
              <button type="button" disabled={draft.sessions.length <= 1 || pending} onClick={() => setDraft((p) => ({ ...p, sessions: p.sessions.filter((_, i) => i !== index) }))}
                className="text-xs font-bold text-danger underline disabled:opacity-40">{t.delete}</button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" disabled={draft.sessions.length >= 14 || pending} onClick={() => setDraft((p) => ({
        ...p, sessions: [...p.sessions, { day: 0, methodId: "technique", minutes: 45, notes: "" }],
      }))} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold disabled:opacity-40">
        + {t.add}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <button type="button" disabled={pending || !draft.name.trim() || draft.sessions.length < 1} onClick={save}
          className="rounded-xl bg-accent px-6 py-3 font-bold text-accent-ink disabled:opacity-50">{t.save}</button>
        {draft.id ? <button type="button" disabled={pending} onClick={remove} className="text-sm font-bold text-danger underline">{t.delete}</button> : null}
      </div>
      {notice ? <p role="status" className="text-sm font-semibold text-ink-2">{notice}</p> : null}
      <p className="text-xs leading-relaxed text-ink-3">{t.safety}</p>
    </div>
  );
}
