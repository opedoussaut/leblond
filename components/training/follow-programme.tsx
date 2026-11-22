"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { followCatalogueProgramme, followTrainingPlan } from "@/lib/actions/training-plans";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { areasDictionary } from "@/lib/i18n/areas";
import { buttonClass, linkClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

/** A catalogue programme as the picker shows it (texts already in the viewer's language). */
export type CatalogueChoice = {
  id: string; title: string; summary: string; facts: string; source: { label: string; url: string };
};

const PLAN = "plan:";
const CATALOGUE = "catalogue:";

/** Choose which programme is the one in progress (one of the climber's own, or a suggested one), or none. */
export function FollowProgramme({ locale, plans, catalogue, followed, today }: {
  locale: Locale;
  plans: { id: string; name: string }[];
  catalogue: CatalogueChoice[];
  followed: { id: string; since: string } | null;
  today: string;
}) {
  const a = areasDictionary(locale).programmes;
  const router = useRouter();
  const initial = followed ? PLAN + followed.id : plans[0] ? PLAN + plans[0].id : catalogue[0] ? CATALOGUE + catalogue[0].id : "";
  const [choice, setChoice] = useState(initial);
  const [error, setError] = useState<"" | "unknown" | "limit">("");
  const [pending, start] = useTransition();
  const picked = choice.startsWith(CATALOGUE) ? catalogue.find((c) => CATALOGUE + c.id === choice) ?? null : null;

  function run(value: string | null) {
    if (value && followed && !window.confirm(a.followConfirm)) return;
    setError("");
    start(async () => {
      if (value?.startsWith(CATALOGUE)) {
        const r = await followCatalogueProgramme(value.slice(CATALOGUE.length), today);
        if (!r.ok) { setError(r.error === "limit" ? "limit" : "unknown"); return; }
        setChoice(PLAN + r.id);
      } else {
        const r = await followTrainingPlan(value ? value.slice(PLAN.length) : null, today);
        if (!r.ok) { setError("unknown"); return; }
      }
      router.refresh();
    });
  }

  const empty = !plans.length && !catalogue.length;
  return <section aria-labelledby="follow-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
    <h2 id="follow-heading" className="text-base font-bold">{a.followTitle}</h2>
    <p className="mt-1 text-sm text-ink-2">{a.followHint}</p>
    {followed ? <p className="mt-2 text-sm font-semibold" data-testid="followed-since">
      {fmt(a.followCurrent, { date: formatDate(followed.since + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" }) })}
    </p> : null}
    {!empty ? <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (choice) run(choice); }}>
      <label className="min-w-56 flex-1 text-sm font-semibold">{a.followPick}
        <select className={fieldClass} value={choice} onChange={(e) => setChoice(e.target.value)}>
          {plans.length ? <optgroup label={a.groupMine}>
            {plans.map((p) => <option key={p.id} value={PLAN + p.id}>{p.name}</option>)}
          </optgroup> : null}
          {catalogue.length ? <optgroup label={a.groupCatalogue}>
            {catalogue.map((c) => <option key={c.id} value={CATALOGUE + c.id}>{c.title}</option>)}
          </optgroup> : null}
        </select>
      </label>
      <button type="submit" disabled={pending || !choice || choice === (followed ? PLAN + followed.id : "")} className={buttonClass("primary", "md")}>{a.follow}</button>
      {followed ? <button type="button" disabled={pending} onClick={() => run(null)} className={buttonClass("ghost", "md")}>{a.followStop}</button> : null}
    </form> : <p className="mt-3 text-sm text-ink-3">{a.followEmpty}</p>}
    {picked ? <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm" data-testid="catalogue-detail">
      <p className="font-bold text-ink">{picked.title}</p>
      <p className="mt-1 font-semibold text-accent" data-testid="catalogue-facts">{picked.facts}</p>
      <p className="mt-2 leading-relaxed text-ink-2">{picked.summary}</p>
      <p className="mt-2 text-xs text-ink-3">{a.catalogueSource} : <a className={linkClass} href={picked.source.url} target="_blank" rel="noopener noreferrer">{picked.source.label}</a></p>
      <p className="mt-2 text-xs text-ink-3">{a.catalogueNote}</p>
    </div> : null}
    {error ? <p role="alert" className="mt-2 text-sm font-semibold text-danger">{error === "limit" ? a.followLimit : a.followError}</p> : null}
  </section>;
}
