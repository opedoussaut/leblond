"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fieldClass as field } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { changePact, signPact } from "@/lib/actions/alter-ego";
import type { PactStatus } from "@/lib/analytics/alter-ego";
import type { Locale } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";

type PlanOption = { id: string; name: string; weeks: number };

function GradeSelect({ label, value, grades, empty, onChange }: {
  label: string; value: string; grades: readonly string[]; empty: string; onChange: (grade: string) => void;
}) {
  return <label className="block text-sm font-semibold">{label}
    <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
      <option value="">{empty}</option>
      {grades.map((g) => <option key={g} value={g}>{g}</option>)}
    </select>
  </label>;
}

export function SignPactForm({ locale, plans, today, boulderGrades, routeGrades, defaults }: {
  locale: Locale; plans: PlanOption[]; today: string;
  boulderGrades: readonly string[]; routeGrades: readonly string[];
  defaults: { boulderFrom: string; boulderTo: string; routeFrom: string; routeTo: string };
}) {
  const t = alterEgoDictionary(locale);
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string>(t.defaultName);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [weeks, setWeeks] = useState(String(plans[0]?.weeks ?? 12));
  const [grades, setGrades] = useState(defaults);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (key: keyof typeof grades) => (grade: string) => setGrades((g) => ({ ...g, [key]: grade }));

  if (!plans.length) return <section className="leblond-premium-surface p-5 sm:p-6">
    <h2 className="text-lg font-bold">{t.signTitle}</h2>
    <p className="mt-1 text-sm text-ink-2">{t.noPlan}</p>
    <Link href="/programmes#plans-heading" className={buttonClass("primary", "md", "mt-4")}>{t.createPlan}</Link>
  </section>;

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    start(async () => {
      const r = await signPact({
        displayName, planId, startDate, horizonWeeks: Number(weeks),
        startBoulderGrade: grades.boulderFrom || null, targetBoulderGrade: grades.boulderTo || null,
        startRouteGrade: grades.routeFrom || null, targetRouteGrade: grades.routeTo || null,
      });
      if (!r.ok) { setError(r.error === "open_pact" ? t.openPact : r.error === "grades" ? t.gradesProblem : t.problem); return; }
      router.refresh();
    });
  }

  return <form onSubmit={submit} aria-labelledby="sign-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <div>
      <h2 id="sign-heading" className="text-lg font-bold">{t.signTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{t.signHint}</p>
    </div>
    <label className="block text-sm font-semibold">{t.name}
      <input required maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={field} />
    </label>
    <label className="block text-sm font-semibold">{t.plan}
      <select value={planId} onChange={(e) => {
        setPlanId(e.target.value);
        const plan = plans.find((p) => p.id === e.target.value);
        if (plan) setWeeks(String(plan.weeks));
      }} className={field}>
        {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-sm font-semibold">{t.start}
        <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
      </label>
      <label className="block text-sm font-semibold">{t.weeks}
        <input type="number" inputMode="numeric" required min={1} max={52} value={weeks} onChange={(e) => setWeeks(e.target.value)} className={field} />
      </label>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <GradeSelect label={t.boulderFrom} value={grades.boulderFrom} grades={boulderGrades} empty={t.noGrade} onChange={set("boulderFrom")} />
      <GradeSelect label={t.boulderTo} value={grades.boulderTo} grades={boulderGrades} empty={t.noGrade} onChange={set("boulderTo")} />
      <GradeSelect label={t.routeFrom} value={grades.routeFrom} grades={routeGrades} empty={t.noGrade} onChange={set("routeFrom")} />
      <GradeSelect label={t.routeTo} value={grades.routeTo} grades={routeGrades} empty={t.noGrade} onChange={set("routeTo")} />
    </div>
    <p className="text-xs text-ink-3">{t.gradesHint}</p>
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full sm:w-auto")}>{t.sign}</button>
  </form>;
}

export function PactControls({ locale, id, status, over }: {
  locale: Locale; id: string; status: PactStatus; over: boolean;
}) {
  const t = alterEgoDictionary(locale);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function run(action: "pause" | "resume" | "finish" | "abandon") {
    setError("");
    start(async () => {
      const r = await changePact({ id, action });
      if (!r.ok) { setError(t.problem); return; }
      setConfirming(false); router.refresh();
    });
  }
  return <section className="space-y-3">
    {over ? <p className="text-sm font-bold">{t.over}</p> : null}
    <div className="leblond-actions">
      {over ? <button type="button" disabled={pending} onClick={() => run("finish")} className={buttonClass("primary", "md")}>{t.finish}</button>
        : status === "PAUSED" ? <button type="button" disabled={pending} onClick={() => run("resume")} className={buttonClass("primary", "md")}>{t.resume}</button>
        : <button type="button" disabled={pending} onClick={() => run("pause")} className={buttonClass("secondary", "md")}>{t.pause}</button>}
      {!confirming ? <button type="button" onClick={() => setConfirming(true)} className={buttonClass("danger", "md")}>{t.abandon}</button> : null}
    </div>
    {status === "ACTIVE" && !over ? <p className="text-xs text-ink-3">{t.pauseHint}</p> : null}
    {confirming ? <>
      <p role="alert" className="text-sm font-bold">{t.abandonConfirm}</p>
      <div className="leblond-actions">
        <button type="button" disabled={pending} onClick={() => run("abandon")} className={buttonClass("danger", "md")}>{t.abandonYes}</button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={buttonClass("secondary", "md")}>{t.abandonNo}</button>
      </div>
    </> : null}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
  </section>;
}
