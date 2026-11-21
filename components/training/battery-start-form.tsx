"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startBattery } from "@/lib/actions/mobility-battery";
import type { Locale } from "@/lib/i18n";
import { batteryDictionary } from "@/lib/i18n/mobility-battery";
import type { Conditions } from "@/lib/training/mobility-battery/results";
import { safetyScreen, type SafetyAnswers } from "@/lib/training/mobility-battery/safety";
import { buttonClass, toggleClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { IconNext } from "@/components/ui/icons";

const QUESTIONS = ["newNeuro", "bladderBowel", "saddleNumbness", "recentFallSpinalPain"] as const;
type Answers = Partial<Record<keyof SafetyAnswers, boolean>>;

/**
 * The safety screen, then today's conditions. A red flag shows the medical advice at once
 * and hides the start button; the answers never leave the page except to be checked again
 * by the server, which writes nothing when one is ticked.
 */
export function BatteryStartForm({ locale, today, previous, clinicalReviewOn }: {
  locale: Locale; today: string; previous: Conditions | null; clinicalReviewOn: string | null;
}) {
  const t = batteryDictionary(locale);
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [kneePain, setKneePain] = useState(false);
  const [review, setReview] = useState(clinicalReviewOn ?? "");
  const [c, setC] = useState<Conditions>(previous ?? { chairHeightCm: null, shoes: null, warmUp: null, timeOfDay: null, framing: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answered = QUESTIONS.every((q) => answers[q] !== undefined);
  const outcome = answered ? safetyScreen(answers as SafetyAnswers) : QUESTIONS.some((q) => answers[q]) ? safetyScreen({
    newNeuro: !!answers.newNeuro, bladderBowel: !!answers.bladderBowel, saddleNumbness: !!answers.saddleNumbness, recentFallSpinalPain: !!answers.recentFallSpinalPain,
  }) : null;
  const blocked = outcome !== null && outcome !== "CLEAR";

  function submit() {
    setError(null);
    if (!answered) { setError(t.answerAll); return; }
    start(async () => {
      const r = await startBattery({ safety: answers, kneePainToday: kneePain, clinicalReviewOn: review || null, conditions: c });
      if (r.ok) router.push(`/train/mobility/battery/${r.data.id}`);
      else setError(t.errors[r.error]);
    });
  }

  return <div className="space-y-5">
    <section aria-labelledby="safety-heading" className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 id="safety-heading" className="text-lg font-bold">{t.safetyTitle}</h2>
      <p className="text-sm text-ink-2">{t.safetyIntro}</p>
      {QUESTIONS.map((q) => <div key={q} role="radiogroup" aria-label={t.safety[q]} className="space-y-2 border-t border-line pt-3">
        <p className="text-sm font-semibold">{t.safety[q]}</p>
        <div className="flex gap-2">
          {([true, false] as const).map((v) => <button key={String(v)} type="button" role="radio" aria-checked={answers[q] === v}
            onClick={() => setAnswers({ ...answers, [q]: v })} className={toggleClass(answers[q] === v, v && answers[q] === v ? "border-danger bg-danger" : undefined)}>
            {v ? t.yes : t.no}
          </button>)}
        </div>
      </div>)}
    </section>

    {blocked ? <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-5">
      <h2 className="text-base font-bold text-danger">{outcome === "URGENT_MEDICAL" ? t.urgentTitle : t.fallTitle}</h2>
      <p className="mt-1 text-sm text-ink">{outcome === "URGENT_MEDICAL" ? t.urgentText : t.fallText}</p>
      <p className="mt-2 text-xs text-ink-2">{t.nothingSaved}</p>
    </div> : <section aria-labelledby="setup-heading" className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <h2 id="setup-heading" className="text-lg font-bold">{t.setupTitle}</h2>
      {previous ? <p className="text-xs text-ink-3">{t.previousConditions}</p> : null}
      <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" checked={kneePain} onChange={(e) => setKneePain(e.target.checked)} />
        <span>{t.kneePain}<span className="block font-normal text-ink-3">{t.kneePainHint}</span></span>
      </label>
      <label className="block text-sm font-semibold">{t.clinicalReview}
        <input type="date" className={fieldClass} max={today} value={review} onChange={(e) => setReview(e.target.value)} />
        <span className="mt-1 block text-xs font-normal text-ink-3">{t.clinicalReviewHint}</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">{t.chairHeight}
          <input type="number" inputMode="decimal" min={20} max={100} className={fieldClass} value={c.chairHeightCm ?? ""}
            onChange={(e) => setC({ ...c, chairHeightCm: e.target.value === "" ? null : Number(e.target.value) })} />
        </label>
        <label className="block text-sm font-semibold">{t.shoes}
          <select className={fieldClass} value={c.shoes ?? ""} onChange={(e) => setC({ ...c, shoes: (e.target.value || null) as Conditions["shoes"] })}>
            <option value="">—</option>
            {(Object.keys(t.shoesOptions) as (keyof typeof t.shoesOptions)[]).map((k) => <option key={k} value={k}>{t.shoesOptions[k]}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">{t.warmUp}
          <select className={fieldClass} value={c.warmUp ?? ""} onChange={(e) => setC({ ...c, warmUp: (e.target.value || null) as Conditions["warmUp"] })}>
            <option value="">—</option>
            {(Object.keys(t.warmUpOptions) as (keyof typeof t.warmUpOptions)[]).map((k) => <option key={k} value={k}>{t.warmUpOptions[k]}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">{t.timeOfDay}
          <select className={fieldClass} value={c.timeOfDay ?? ""} onChange={(e) => setC({ ...c, timeOfDay: (e.target.value || null) as Conditions["timeOfDay"] })}>
            <option value="">—</option>
            {(Object.keys(t.timeOptions) as (keyof typeof t.timeOptions)[]).map((k) => <option key={k} value={k}>{t.timeOptions[k]}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold">{t.framing}
        <input className={fieldClass} maxLength={200} value={c.framing} onChange={(e) => setC({ ...c, framing: e.target.value })} />
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <button type="button" disabled={pending} onClick={submit} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {pending ? t.starting : t.start} <IconNext />
      </button>
    </section>}
  </div>;
}
