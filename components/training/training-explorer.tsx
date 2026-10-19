"use client";

import { useMemo, useState } from "react";
import { TRAINING_AXES, TRAINING_CATALOGUE, type TrainingCategory, type TrainingEntry, type TrainingGoal } from "@/lib/training/catalogue";
import { trainingDictionary } from "@/lib/i18n/training";
import type { Locale } from "@/lib/i18n";

const COLORS = ["#2677c8", "#708ca7", "#17436b"] as const;
const DEFAULT_SELECTION: Record<TrainingCategory, string[]> = {
  methods: ["technique", "max-hangs"],
  programs: ["lattice", "power-company"],
  tools: ["hangboard", "video-tool"],
};

const CATEGORY_ORDER: TrainingCategory[] = ["methods", "programs", "tools"];
const GOALS: Array<TrainingGoal | "all"> = ["all", "boulder", "sport", "technique", "strength"];

function radarPoint(index: number, radius: number) {
  const angle = -Math.PI / 2 + (index * Math.PI) / 3;
  return { x: 360 + Math.cos(angle) * radius, y: 245 + Math.sin(angle) * radius };
}

function polygon(values: readonly number[]) {
  return values.map((value, index) => {
    const { x, y } = radarPoint(index, (value / 5) * 163);
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
}

function Radar({ entries, locale }: { entries: TrainingEntry[]; locale: Locale }) {
  const t = trainingDictionary(locale);
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface p-3 sm:p-5">
      <h2 className="text-lg font-black">{t.compare}</h2>
      <svg viewBox="0 0 720 495" role="img" aria-label={t.compare} className="mt-2 w-full" xmlns="http://www.w3.org/2000/svg">
        {[1, 2, 3, 4, 5].map((level) => (
          <polygon key={level} points={polygon([level, level, level, level, level, level])} fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth={level === 5 ? 2 : 1} />
        ))}
        {TRAINING_AXES.map((axis, i) => {
          const end = radarPoint(i, 163);
          const label = radarPoint(i, 223);
          return (
            <g key={axis}>
              <line x1="360" y1="245" x2={end.x} y2={end.y} stroke="currentColor" strokeOpacity=".18" />
              <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize="14" fontWeight="650" fill="currentColor">{t.axis[axis]}</text>
            </g>
          );
        })}
        {entries.map((entry, n) => (
          <g key={entry.id}>
            <polygon points={polygon(entry.scores)} fill={COLORS[n]} fillOpacity=".15" stroke={COLORS[n]} strokeWidth="3" strokeLinejoin="round" />
            {entry.scores.map((score, index) => {
              const p = radarPoint(index, (score / 5) * 163);
              return <circle key={index} cx={p.x} cy={p.y} r="4.5" fill={COLORS[n]} />;
            })}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap justify-center gap-4">
        {entries.map((entry, n) => (
          <span key={entry.id} className="inline-flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[n] }} />
            {entry.title}
          </span>
        ))}
      </div>
      <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">{t.warning}</p>
    </div>
  );
}

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
      <Radar entries={selectedEntries} locale={locale} />
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
              <h3 className="mt-4 text-lg font-black">{entry.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">{entry.description[locale]}</p>
              {entry.caution ? <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">{entry.caution[locale]}</p> : null}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="text-xs font-semibold text-ink-3">{t.goals[entry.goals[0]]}</span>
                <a href={entry.source.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-accent underline underline-offset-4" title={entry.source.label}>
                  {t.sources} ↗
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
