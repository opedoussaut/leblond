"use client";

import { useState } from "react";
import { fmt, type Locale } from "@/lib/i18n";
import { trainingDictionary } from "@/lib/i18n/training";
import { planModesDictionary } from "@/lib/i18n/training-plans";
import type { PlanRequest, ProposalAdjustment } from "@/lib/training/plan-proposal";
import { DURATION_MAX, DURATION_UNITS, durationWeeks, type DurationUnit, type TrainingPlanInput } from "@/lib/training/plans";
import { buttonClass } from "@/components/ui/button";
import { DurationField } from "@/components/ui/duration-field";
import { cn } from "@/components/ui/cn";
import { fieldClass as field } from "@/components/ui/field";

type ProposalResponse = { plan?: TrainingPlanInput; adjustments?: ProposalAdjustment[]; error?: string };

/** Patrick mode: what the climber tells Patrick before he proposes a plan. Nothing is saved here. */
export function PatrickPlanForm({ locale, onProposal }: {
  locale: Locale;
  onProposal: (plan: TrainingPlanInput, adjustments: ProposalAdjustment[]) => void;
}) {
  const t = trainingDictionary(locale);
  const m = planModesDictionary(locale);
  const p = m.patrick;
  const [request, setRequest] = useState<PlanRequest>({
    goal: "", duration: { value: 3, unit: "MONTHS" }, climbingPerWeek: 3, offWallPerWeek: 1, minutesPerSession: 90,
    availableDays: [], outdoorDays: [], target: "", notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (update: Partial<PlanRequest>) => setRequest((r) => ({ ...r, ...update }));
  const shortDays = t.days.map((d) => d.slice(0, 3));

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/coach/plan", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
      });
      const body = (await res.json().catch(() => ({}))) as ProposalResponse;
      if (!res.ok || !body.plan) {
        setError(p.errors[(body.error ?? "default") as keyof typeof p.errors] ?? p.errors.default);
        return;
      }
      onProposal(body.plan, body.adjustments ?? []);
    } catch {
      setError(p.errors.default);
    } finally {
      setBusy(false);
    }
  }

  function dayChips(label: string, key: "availableDays" | "outdoorDays", hint?: string) {
    const chosen = request[key];
    return (
      <fieldset>
        <legend className="text-sm font-semibold">{label}</legend>
        {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {shortDays.map((d, i) => {
            const on = chosen.includes(i);
            return (
              <button key={i} type="button" aria-pressed={on} aria-label={t.days[i]}
                onClick={() => set({ [key]: on ? chosen.filter((x) => x !== i) : [...chosen, i].sort() } as Partial<PlanRequest>)}
                className={cn("min-h-11 min-w-12 rounded-full border px-3 text-sm font-semibold",
                  on ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink-2")}>
                {d}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const count = (label: string, key: "climbingPerWeek" | "offWallPerWeek") => (
    <label className="text-sm font-semibold">{label}
      <select className={field} value={request[key]} onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<PlanRequest>)}>
        {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );

  return (
    <form onSubmit={ask} className="space-y-4 rounded-2xl border border-line bg-surface p-4" aria-busy={busy}>
      <h2 className="text-lg font-bold">{p.title}</h2>
      <label className="block text-sm font-semibold">{p.goal}
        <input type="text" required minLength={3} maxLength={300} placeholder={p.goalPlaceholder} className={field}
          value={request.goal} onChange={(e) => set({ goal: e.target.value })} />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">{m.duration}</legend>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input type="number" min={1} max={DURATION_MAX[request.duration.unit]} required aria-label={m.duration}
            className={field + " !mt-0 max-w-28"} value={request.duration.value}
            onChange={(e) => { const value = Math.trunc(Number(e.target.value)); if (Number.isFinite(value)) set({ duration: { ...request.duration, value } }); }} />
          <select aria-label={m.durationUnit} className={field + " !mt-0 max-w-40"} value={request.duration.unit}
            onChange={(e) => {
              const unit = e.target.value as DurationUnit;
              set({ duration: { unit, value: Math.min(request.duration.value, DURATION_MAX[unit]) } });
            }}>
            {DURATION_UNITS.map((u) => <option key={u} value={u}>{m.durationUnits[u]}</option>)}
          </select>
          {request.duration.unit !== "WEEKS" && request.duration.value >= 1
            ? <span className="text-sm text-ink-2">{fmt(m.durationWeeks, { n: durationWeeks(request.duration.value, request.duration.unit) })}</span> : null}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold">{p.target}
        <input type="text" maxLength={300} placeholder={p.targetPlaceholder} className={field}
          value={request.target} onChange={(e) => set({ target: e.target.value })} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {count(p.climbingPerWeek, "climbingPerWeek")}
        {count(p.offWallPerWeek, "offWallPerWeek")}
        <DurationField label={p.minutesPerSession} value={request.minutesPerSession}
          onChange={(v) => set({ minutesPerSession: v ?? 90 })} min={20} max={240} />
      </div>
      {dayChips(p.availableDays, "availableDays", p.availableDaysHint)}
      {dayChips(p.outdoorDays, "outdoorDays")}
      <label className="block text-sm font-semibold">{p.notes}
        <textarea rows={2} maxLength={500} placeholder={p.notesPlaceholder} className={field}
          value={request.notes} onChange={(e) => set({ notes: e.target.value })} />
      </label>
      <button type="submit" disabled={busy || request.climbingPerWeek + request.offWallPerWeek < 1 || request.climbingPerWeek + request.offWallPerWeek > 7}
        className={buttonClass("primary")}>{busy ? p.asking : p.ask}</button>
      {busy ? <p role="status" className="text-sm text-ink-2">{p.asking}</p> : null}
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    </form>
  );
}
