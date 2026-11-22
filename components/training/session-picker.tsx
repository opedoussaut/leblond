"use client";

import { useId, useMemo, useState } from "react";
import {
  Brain, CalendarRange, Dumbbell, Hand, Layers, Luggage, Moon, PencilLine, PersonStanding, Repeat, Search, X, Zap, type LucideIcon,
} from "lucide-react";
import { formatDuration } from "@/lib/duration";
import { fmt, type Locale } from "@/lib/i18n";
import { sessionPickerDictionary } from "@/lib/i18n/session-picker";
import type { SessionCategory } from "@/lib/training/coach-sessions";
import {
  buildPickerEntries, defaultVariant, filterPickerEntries, locateValue, pickerCategories, pickerDurations, variantFor,
  type PickerEntry, type PickerFamily, type PickerLevel, type PickerSession,
} from "@/lib/training/session-picker";
import { chipClass, segmentClass, segmentGroupClass, toggleClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { fieldClass } from "@/components/ui/field";

export const CATEGORY_ICONS: Record<SessionCategory, LucideIcon> = {
  MOBILITY: PersonStanding, STRENGTH: Dumbbell, AWAY: Luggage, FINGERS: Hand, POWER: Zap, ENDURANCE: Repeat,
  TECHNIQUE: Brain, PREP: Moon, PLANNING: CalendarRange,
};

const card = "w-full rounded-2xl border bg-surface text-left transition-colors";
const cardState = (on: boolean) => (on ? "border-accent ring-1 ring-accent" : "border-line hover:border-ink-3");
const icon = "mt-0.5 size-5 shrink-0 text-accent";
// One swipeable line of chips on a phone, wrapped lines from the tablet up.
const chipRow = "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&>button]:shrink-0";

/** One segmented choice written with real radio inputs, so arrows and screen readers work as usual. */
export function Segments<T extends string | number>({ name, label, options, value, onChange }: {
  name: string; label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return <fieldset className="min-w-0">
    <legend className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{label}</legend>
    <div className={segmentGroupClass} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => <label key={String(o.value)}
        className={segmentClass(o.value === value, "flex cursor-pointer items-center justify-center text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent")}>
        <input type="radio" className="sr-only" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
        {o.label}
      </label>)}
    </div>
  </fieldset>;
}

/** Level, then duration, of a family; shared by the picker and the templates list. */
export function FamilyChoice({ locale, family, level, minutes, onChange }: {
  locale: Locale; family: PickerFamily; level: PickerLevel; minutes: number;
  onChange: (value: string, level: PickerLevel, minutes: number) => void;
}) {
  const p = sessionPickerDictionary(locale);
  const id = useId();
  const variant = variantFor(level, minutes);
  const multi = family.levels.some((l) => l.variants.length > 1);
  return <div className="space-y-3">
    <Segments name={id + "-level"} label={p.axes[family.axis]} value={level.key}
      options={family.levels.map((l) => ({ value: l.key, label: l.label }))}
      onChange={(k) => { const l = family.levels.find((x) => x.key === k)!; const v = variantFor(l, minutes); onChange(v.value, l, v.minutes); }} />
    {multi && level.variants.length > 1
      ? <Segments name={id + "-minutes"} label={p.duration} value={variant.minutes}
        options={level.variants.map((v) => ({ value: v.minutes, label: formatDuration(v.minutes) }))}
        onChange={(m) => onChange(variantFor(level, m).value, level, m)} />
      : <p className="text-sm font-semibold text-ink-2">{family.axis === "TOMORROW"
        ? fmt(p.durationForTomorrow, { d: formatDuration(variant.minutes) })
        : `${p.duration} : ${formatDuration(variant.minutes)}`}</p>}
  </div>;
}

function familyMeta(locale: Locale, f: PickerFamily) {
  const p = sessionPickerDictionary(locale);
  // One duration per level (the day-before families): say which, "Normale 30 min · Dure 1 h".
  if (f.levels.length > 1 && f.levels.every((l) => l.variants.length === 1)) {
    return f.levels.map((l) => `${l.label} ${formatDuration(l.variants[0].minutes)}`).join(" · ");
  }
  const durations = f.minutes.map(formatDuration).join(" · ");
  return f.levels.length > 1 ? fmt(p.levelsAndDurations, { n: f.levels.length, d: durations }) : durations;
}

/**
 * The séance picker of the one-off session form. `value` is "" (free session),
 * "coach:<id>", "away:<key>" (Away Training) or an Atlas method id.
 */
export function SessionPicker({ locale, sessions, value, onChange }: {
  locale: Locale; sessions: PickerSession[]; value: string; onChange: (value: string) => void;
}) {
  const p = sessionPickerDictionary(locale);
  const entries = useMemo(() => buildPickerEntries(sessions, locale, p.categories, { away: true }), [sessions, locale, p.categories]);
  const categories = useMemo(() => pickerCategories(entries), [entries]);
  const durations = useMemo(() => pickerDurations(entries), [entries]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SessionCategory | "ALL">("ALL");
  const [minutes, setMinutes] = useState<number | null>(null);
  const selected = locateValue(entries, value);
  const [atlasOpen, setAtlasOpen] = useState(selected?.entry.kind === "atlas");
  // The level and duration last chosen on each family, kept when the climber looks at another card.
  const [memory, setMemory] = useState<Record<string, { level: string; minutes: number }>>({});

  const filtering = query.trim() !== "" || category !== "ALL" || minutes !== null;
  const shown = filterPickerEntries(entries, { query, category, minutes });
  // The chosen séance stays in view (first) even when a filter would hide it.
  const pinned = selected && !shown.includes(selected.entry) ? selected.entry : null;
  const coach = [...(pinned && pinned.kind !== "atlas" ? [pinned] : []), ...shown.filter((e) => e.kind !== "atlas")];
  const atlas = [...(pinned && pinned.kind === "atlas" ? [pinned] : []), ...shown.filter((e) => e.kind === "atlas")];
  const showAtlas = filtering || atlasOpen;
  const count = shown.length;

  function chooseFamily(f: PickerFamily) {
    const kept = memory[f.key];
    const level = (kept && f.levels.find((l) => l.key === kept.level)) || defaultVariant(f, minutes).level;
    onChange(variantFor(level, kept?.minutes ?? minutes ?? 60).value);
  }

  function entryCard(e: PickerEntry) {
    if (e.kind === "family") {
      const on = selected?.entry === e && "level" in selected;
      const Icon = CATEGORY_ICONS[e.category];
      return <li key={"f:" + e.key} className={cn(card, cardState(on))}>
        <button type="button" aria-pressed={on} onClick={() => (on ? null : chooseFamily(e))}
          className="flex min-h-11 w-full items-start gap-3 p-4 text-left">
          <Icon aria-hidden="true" className={icon} />
          <span className="min-w-0 flex-1">
            <strong className="block">{e.title}</strong>
            {e.summary ? <span className="mt-0.5 block text-sm text-ink-2">{e.summary}</span> : null}
            <span className="mt-1 block text-xs font-semibold text-ink-3">{familyMeta(locale, e)}</span>
          </span>
          <span className="hidden shrink-0 sm:block"><span className={chipClass("neutral")}>{p.categories[e.category]}</span></span>
        </button>
        {on && "level" in selected! ? <div className="space-y-3 border-t border-line px-4 pb-4 pt-3">
          <FamilyChoice locale={locale} family={e} level={selected.level} minutes={selected.variant.minutes}
            onChange={(v, l, m) => { setMemory((x) => ({ ...x, [e.key]: { level: l.key, minutes: m } })); onChange(v); }} />
          <p className="text-sm text-ink-2"><strong className="text-ink">{selected.variant.title}</strong> · {fmt(p.exercises, { n: selected.variant.exercises })}</p>
        </div> : null}
      </li>;
    }
    const on = selected?.entry === e;
    if (e.kind === "away") {
      return <li key={e.value}><button type="button" aria-pressed={on} onClick={() => onChange(e.value)}
        className={cn(card, cardState(on), "flex min-h-11 items-start gap-3 p-4")}>
        <Luggage aria-hidden="true" className={icon} />
        <span className="min-w-0 flex-1">
          <strong className="block">{e.title}</strong>
          <span className="mt-0.5 line-clamp-2 block text-sm text-ink-2">{e.summary}</span>
          <span className="mt-1 block text-xs font-semibold text-ink-3">{formatDuration(e.minutes)} · {fmt(p.exercises, { n: e.exercises })}</span>
        </span>
        <span className="hidden shrink-0 sm:block"><span className={chipClass("neutral")}>{p.categories.AWAY}</span></span>
      </button></li>;
    }
    if (e.kind === "coach") {
      return <li key={e.value}><button type="button" aria-pressed={on} onClick={() => onChange(e.value)}
        className={cn(card, cardState(on), "flex min-h-11 items-start gap-3 p-4")}>
        <Layers aria-hidden="true" className={icon} />
        <span className="min-w-0 flex-1">
          <strong className="block">{e.title}</strong>
          {e.summary ? <span className="mt-0.5 line-clamp-2 block text-sm text-ink-2">{e.summary}</span> : null}
          <span className="mt-1 block text-xs font-semibold text-ink-3">{formatDuration(e.minutes)} · {fmt(p.exercises, { n: e.exercises })}</span>
        </span>
      </button></li>;
    }
    const Icon = CATEGORY_ICONS[e.category];
    return <li key={e.value}><button type="button" aria-pressed={on} onClick={() => onChange(e.value)}
      className={cn(card, cardState(on), "flex min-h-11 items-start gap-3 px-4 py-3")}>
      <Icon aria-hidden="true" className={icon} />
      <span className="min-w-0 flex-1">
        <strong className="block text-sm">{e.title}</strong>
        <span className="mt-0.5 line-clamp-2 block text-xs text-ink-2">{e.summary}</span>
      </span>
      <span className="hidden shrink-0 sm:block"><span className={chipClass("neutral")}>{p.categories[e.category]}</span></span>
    </button></li>;
  }

  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold">{p.legend}</legend>
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 mt-0.5 size-5 -translate-y-1/2 text-ink-3" />
      <input type="search" aria-label={p.search} placeholder={p.searchPlaceholder} value={query}
        onChange={(e) => setQuery(e.target.value)} className={cn(fieldClass, "pl-10 pr-11 [&::-webkit-search-cancel-button]:appearance-none")} />
      {query ? <button type="button" aria-label={p.clearSearch} onClick={() => setQuery("")}
        className="absolute right-1 top-1/2 mt-0.5 flex size-11 -translate-y-1/2 items-center justify-center text-ink-3 hover:text-ink">
        <X aria-hidden="true" className="size-5" /></button> : null}
    </div>
    <div role="group" aria-label={p.categoriesLabel} className={chipRow}>
      <button type="button" aria-pressed={category === "ALL"} onClick={() => setCategory("ALL")} className={toggleClass(category === "ALL")}>{p.all}</button>
      {categories.map((c) => { const Icon = CATEGORY_ICONS[c]; return <button key={c} type="button" aria-pressed={category === c}
        onClick={() => setCategory(category === c ? "ALL" : c)} className={toggleClass(category === c)}>
        <Icon aria-hidden="true" />{p.categories[c]}</button>; })}
    </div>
    {durations.length > 1 ? <div role="group" aria-label={p.durationsLabel} className={chipRow}>
      <button type="button" aria-pressed={minutes === null} onClick={() => setMinutes(null)} className={toggleClass(minutes === null)}>{p.allDurations}</button>
      {durations.map((m) => <button key={m} type="button" aria-pressed={minutes === m} onClick={() => setMinutes(minutes === m ? null : m)}
        className={toggleClass(minutes === m)}>{formatDuration(m)}</button>)}
    </div> : null}
    <p aria-live="polite" className="sr-only">{filtering ? (count === 1 ? p.oneResult : fmt(p.results, { n: count })) : ""}</p>

    <ul className="space-y-2">
      {!filtering ? <li><button type="button" aria-pressed={value === ""} onClick={() => onChange("")}
        className={cn(card, cardState(value === ""), "flex min-h-11 items-start gap-3 px-4 py-3")}>
        <PencilLine aria-hidden="true" className={icon} />
        <span><strong className="block text-sm">{p.free}</strong><span className="block text-xs text-ink-2">{p.freeHint}</span></span>
      </button></li> : null}
      {coach.map(entryCard)}
    </ul>

    {count === 0 ? <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-2">
      <p>{p.empty}</p>
      <button type="button" className="mt-2 min-h-11 font-semibold text-accent underline-offset-4 hover:underline"
        onClick={() => { setQuery(""); setCategory("ALL"); setMinutes(null); }}>{p.resetFilters}</button>
    </div> : null}

    {atlas.length ? <section aria-label={p.atlasSection} className="space-y-2">
      {filtering ? <h3 className="pt-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{p.atlasSection} · {p.atlasHint}</h3>
        : <button type="button" aria-expanded={atlasOpen} onClick={() => setAtlasOpen(!atlasOpen)}
          className="min-h-11 text-sm font-semibold text-accent underline-offset-4 hover:underline">
          {atlasOpen ? p.hideAtlas : fmt(p.showAtlas, { n: atlas.length })}</button>}
      {showAtlas ? <ul className="grid gap-2 sm:grid-cols-2">{atlas.map(entryCard)}</ul> : null}
    </section> : null}
  </fieldset>;
}
