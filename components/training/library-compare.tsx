"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtlasRadar } from "@/components/training/atlas-radar";
import { TRAINING_CATALOGUE, type TrainingCategory, type TrainingEntry } from "@/lib/training/catalogue";
import { trainingDictionary } from "@/lib/i18n/training";
import { areasDictionary } from "@/lib/i18n/areas";
import type { Locale } from "@/lib/i18n";
import { MAX_COMPARED, libraryHref } from "@/lib/navigation/library-tabs";
import { linkClass, toggleClass } from "@/components/ui/button";
import { IconNext } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

const CATEGORY_ORDER: TrainingCategory[] = ["methods", "programs", "tools"];

/** The radar section: pick up to three entries; the choice lives in the URL so a comparison can be shared. */
export function LibraryCompare({ locale, initial }: { locale: Locale; initial: string[] }) {
  const t = trainingDictionary(locale);
  const a = areasDictionary(locale).library;
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initial);

  function update(next: string[]) {
    setSelected(next);
    router.replace(libraryHref("compare", next), { scroll: false });
  }
  function toggle(id: string) {
    if (selected.includes(id)) update(selected.filter((x) => x !== id));
    else if (selected.length < MAX_COMPARED) update([...selected, id]);
  }

  const entries = selected
    .map((id) => TRAINING_CATALOGUE.find((e) => e.id === id))
    .filter((e): e is TrainingEntry => Boolean(e));

  return <section aria-label={a.tabs.compare} className="space-y-5">
    <AtlasRadar entries={entries} locale={locale} heading={t.compare} />
    {entries.length ? <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {entries.map((e) => <li key={e.id}><Link href={"/atlas/" + e.id} className={cn(linkClass, "min-h-11 content-center")}>{e.title} <IconNext /></Link></li>)}
    </ul> : null}
    <div className="leblond-premium-surface space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">{a.comparePick}</h3>
          <p className="text-sm text-ink-3" aria-live="polite">{selected.length}/{MAX_COMPARED} {t.selected}</p>
        </div>
        <button type="button" className={cn(linkClass, "min-h-11 text-sm")} onClick={() => update([])} disabled={!selected.length}>{t.clear}</button>
      </div>
      {CATEGORY_ORDER.map((category) => <fieldset key={category}>
        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{t.groups[category]}</legend>
        <div className="flex flex-wrap gap-2">
          {TRAINING_CATALOGUE.filter((e) => e.category === category).map((e) => {
            const on = selected.includes(e.id);
            return <button key={e.id} type="button" aria-pressed={on} onClick={() => toggle(e.id)}
              disabled={!on && selected.length >= MAX_COMPARED} className={toggleClass(on, "disabled:opacity-45")}>
              {e.title}
            </button>;
          })}
        </div>
      </fieldset>)}
    </div>
  </section>;
}
