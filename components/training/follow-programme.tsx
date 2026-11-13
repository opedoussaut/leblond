"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { followTrainingPlan } from "@/lib/actions/training-plans";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { areasDictionary } from "@/lib/i18n/areas";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

/** Choose which programme is the one in progress (any kind), or none. */
export function FollowProgramme({ locale, plans, followed, today }: {
  locale: Locale;
  plans: { id: string; name: string }[];
  followed: { id: string; since: string } | null;
  today: string;
}) {
  const a = areasDictionary(locale).programmes;
  const router = useRouter();
  const [choice, setChoice] = useState(followed?.id ?? plans[0]?.id ?? "");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function run(planId: string | null) {
    if (planId && followed && !window.confirm(a.followConfirm)) return;
    setError(false);
    start(async () => {
      const r = await followTrainingPlan(planId, today);
      if (!r.ok) setError(true); else router.refresh();
    });
  }

  return <section aria-labelledby="follow-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
    <h2 id="follow-heading" className="text-base font-bold">{a.followTitle}</h2>
    <p className="mt-1 text-sm text-ink-2">{a.followHint}</p>
    {followed ? <p className="mt-2 text-sm font-semibold" data-testid="followed-since">
      {fmt(a.followCurrent, { date: formatDate(followed.since + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" }) })}
    </p> : null}
    {plans.length ? <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (choice) run(choice); }}>
      <label className="min-w-56 flex-1 text-sm font-semibold">{a.followPick}
        <select className={fieldClass} value={choice} onChange={(e) => setChoice(e.target.value)}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <button type="submit" disabled={pending || !choice || choice === followed?.id} className={buttonClass("primary", "md")}>{a.follow}</button>
      {followed ? <button type="button" disabled={pending} onClick={() => run(null)} className={buttonClass("ghost", "md")}>{a.followStop}</button> : null}
    </form> : <p className="mt-3 text-sm text-ink-3">{a.followEmpty}</p>}
    {error ? <p role="alert" className="mt-2 text-sm font-semibold text-danger">{a.followError}</p> : null}
  </section>;
}
