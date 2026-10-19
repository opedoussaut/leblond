"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AtlasRadar } from "@/components/training/atlas-radar";
import { TRAINING_CATALOGUE, type TrainingCategory, type TrainingEntry, type TrainingGoal } from "@/lib/training/catalogue";
import { trainingDictionary } from "@/lib/i18n/training";
import type { Locale } from "@/lib/i18n";

const DEFAULT_SELECTION: Record<TrainingCategory, string[]> = {
  methods: ["technique", "max-hangs"],
  programs: ["lattice", "power-company"],
  tools: ["hangboard", "video-tool"],
};

const CATEGORY_ORDER: TrainingCategory[] = ["methods", "programs", "tools"];
const GOALS: Array<TrainingGoal | "all"> = ["all", "boulder", "sport", "technique", "strength"];

export function TrainingExplorer({ locale }: { locale: Locale }) {
  const t = trainingDictionary(locale);
  const [category, setCategory] = useState<TrainingCategory>("methods");
  const [goal, setGoal] = useState<TrainingGoal | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTION.methods);

  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase(locale);
    return TRAINING_CATALOGUE.filter((entry) => {
      if (entry.category !== category || (goal !== "all" && !entry.goals.includes(goal))) return false;
      return !text || (entry.title + " " + entry.description[locale]).toLocaleLowerCase(locale).includes(text);
    });
  }, [category, goal, query, locale]);
  const selectedEntries = selected
    .map((id) => TRAINING_CATALOGUE.find((entry) => entry.id === id))
    .filter((entry): entry is TrainingEntry => Boolean(entry));

  function pickCategory(next: TrainingCategory) {
    setCategory(next);
    setSelected(DEFAULT_SELECTION[next]);
    setGoal("all");
    setQuery("");
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : current.length < 3 ? [...current, id] : current);
  }

  return (
    <section id="atlas" aria-label={t.browse}>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label={t.browse}>
        {CATEGORY_ORDER.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => pickCategory(item)}
            aria-pressed={category === item}
            className={"rounded-full border px-5 py-2.5 text-sm font-bold transition-colors " + (category === item ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2 hover:border-accent")}
          >
            {t.groups[item]} <span className="opacity-70">({TRAINING_CATALOGUE.filter((entry) => entry.category === item).length})</span>
          </button>
        ))}
      </div>
      <AtlasRadar entries={selectedEntries} locale={locale} heading={t.compare} />
      <div className="mt-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-black">{t.groups[category]}</h2>
          <p className="text-sm text-ink-3">{selected.length}/3 {t.selected} · {t.max}</p>
        </div>
        <button type="button" className="text-sm font-semibold text-accent underline underline-offset-4" onClick={() => setSelected([])}>{t.clear}</button>
      </div>
      <div className="my-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          placeholder={t.search}
          aria-label={t.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-ink placeholder:text-ink-3"
        />
        <select
          value={goal}
          onChange={(event) => setGoal(event.target.value as TrainingGoal | "all")}
          aria-label={t.goals.all}
          className="min-h-12 rounded-xl border border-line bg-surface px-4 text-ink"
        >
          {GOALS.map((item) => <option key={item} value={item}>{t.goals[item]}</option>)}
        </select>
      </div>
      {visible.length === 0 ? <p className="rounded-2xl border border-line p-8 text-center text-ink-3">{t.noResults}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((entry) => {
          const active = selected.includes(entry.id);
          const disabled = !active && selected.length >= 3;
          return (
            <article key={entry.id} className={"flex flex-col rounded-2xl border bg-surface p-5 " + (active ? "border-accent" : "border-line")}>
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-2">
                  {t.evidence[entry.evidence]}
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-accent"
                    checked={active}
                    disabled={disabled}
                    onChange={() => toggle(entry.id)}
                    aria-label={t.select + " " + entry.title}
                  />
                  {t.select}
                </label>
              </div>
              <h3 className="mt-4 text-lg font-black">
                <Link href={"/atlas/" + entry.id} className="underline-offset-4 hover:text-accent hover:underline">
                  {entry.title} ↗
                </Link>
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">{entry.description[locale]}</p>
              {entry.caution ? <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">{entry.caution[locale]}</p> : null}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="text-xs font-semibold text-ink-3">{t.goals[entry.goals[0]]}</span>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={"/atlas/" + entry.id} className="text-xs font-bold text-accent underline underline-offset-4">
                    {locale === "fr" ? "Fiche détaillée" : "Full guide"} →
                  </Link>
                  <a href={entry.source.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-accent underline underline-offset-4" title={entry.source.label}>
                    {t.sources} ↗
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
