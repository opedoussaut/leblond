"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TRAINING_CATALOGUE, type TrainingCategory, type TrainingGoal } from "@/lib/training/catalogue";
import { trainingDictionary } from "@/lib/i18n/training";
import { areasDictionary } from "@/lib/i18n/areas";
import type { Locale } from "@/lib/i18n";
import { libraryHref } from "@/lib/navigation/library-tabs";
import { IconExternal, IconNext } from "@/components/ui/icons";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

const GOALS: Array<TrainingGoal | "all"> = ["all", "boulder", "sport", "technique", "strength"];

/** One catalogue section of the Bibliothèque (methods, coaching or tools): search, goal filter, sheets. */
export function LibraryCatalogue({ locale, category, heading }: { locale: Locale; category: TrainingCategory; heading: string }) {
  const t = trainingDictionary(locale);
  const a = areasDictionary(locale).library;
  const [goal, setGoal] = useState<TrainingGoal | "all">("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase(locale);
    return TRAINING_CATALOGUE.filter((entry) => {
      if (entry.category !== category || (goal !== "all" && !entry.goals.includes(goal))) return false;
      return !text || (entry.title + " " + entry.description[locale]).toLocaleLowerCase(locale).includes(text);
    });
  }, [category, goal, query, locale]);

  return <section aria-label={heading} className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row">
      <input type="search" placeholder={t.search} aria-label={t.search} value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-ink placeholder:text-ink-3" />
      <select value={goal} onChange={(event) => setGoal(event.target.value as TrainingGoal | "all")} aria-label={t.goals.all}
        className="min-h-12 rounded-xl border border-line bg-surface px-4 text-ink">
        {GOALS.map((item) => <option key={item} value={item}>{t.goals[item]}</option>)}
      </select>
    </div>
    {visible.length === 0 ? <p className="rounded-2xl border border-line p-8 text-center text-ink-3">{t.noResults}</p> : null}
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((entry) => <li key={entry.id} className="leblond-premium-surface flex flex-col p-5">
        <span className="self-start rounded-full bg-surface-2 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-2">
          {t.evidence[entry.evidence]}
        </span>
        <h3 className="mt-4 text-lg font-bold">
          <Link href={"/atlas/" + entry.id} className={cn(linkClass, "text-ink hover:text-accent")}>{entry.title}</Link>
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">{entry.description[locale]}</p>
        {entry.caution ? <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">{entry.caution[locale]}</p> : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3">
          <span className="text-xs font-semibold text-ink-3">{t.goals[entry.goals[0]]}</span>
          <div className="flex flex-wrap items-center gap-x-3">
            <Link href={"/atlas/" + entry.id} className={cn(linkClass, "min-h-11 content-center text-xs")} aria-label={a.compareSeeAll + " : " + entry.title}>
              {locale === "fr" ? "Fiche détaillée" : "Full guide"} <IconNext />
            </Link>
            <Link href={libraryHref("compare", [entry.id])} className={cn(linkClass, "min-h-11 content-center text-xs")} aria-label={a.compareAdd + " : " + entry.title}>
              {a.compareAdd}
            </Link>
            <a href={entry.source.url} target="_blank" rel="noopener noreferrer" className={cn(linkClass, "min-h-11 content-center text-xs")} title={entry.source.label}>
              {t.sources} <IconExternal />
            </a>
          </div>
        </div>
      </li>)}
    </ul>
  </section>;
}
