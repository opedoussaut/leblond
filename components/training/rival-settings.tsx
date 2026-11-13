"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass, segmentClass, segmentGroupClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { fieldClass } from "@/components/ui/field";
import { updateRivalSettings } from "@/lib/actions/alter-ego";
import { RIVAL_LEVELS, RIVAL_PORTRAITS, RIVAL_TONES, type RivalSettings } from "@/lib/analytics/rival";
import { fmt, type Locale } from "@/lib/i18n";
import { rivalDictionary } from "@/lib/i18n/rival";
import { RivalPortrait } from "./rival-portrait";

/** Portrait, tone, level and projects. The signed terms of the pact stay as they are. */
export function RivalSettingsForm({ locale, pactId, initial, today, hasBoulderGrades }: {
  locale: Locale; pactId: string; initial: RivalSettings; today: string; hasBoulderGrades: boolean;
}) {
  const r = rivalDictionary(locale);
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const set = (patch: Partial<RivalSettings>) => { setV((x) => ({ ...x, ...patch })); setStatus("idle"); };

  function save() {
    start(async () => {
      const res = await updateRivalSettings({ id: pactId, ...v, goalDate: v.level === "GOAL" ? v.goalDate : null });
      setStatus(res.ok ? "saved" : "error");
      if (res.ok) router.refresh();
    });
  }

  return <details className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
    <summary className="min-h-11 cursor-pointer py-2 font-bold">{r.settingsTitle}</summary>
    <form className="mt-3 space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset>
        <legend className="text-sm font-semibold">{r.portrait}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RIVAL_PORTRAITS.map((p, i) => <button key={p} type="button" aria-pressed={v.portrait === p} aria-label={fmt(r.portraitN, { n: i + 1 })}
            onClick={() => set({ portrait: p })}
            className={cn("rounded-full p-1 ring-2", v.portrait === p ? "ring-accent" : "ring-transparent")}>
            <RivalPortrait portrait={p} size={48} />
          </button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{r.tone}</legend>
        <div className={cn(segmentGroupClass, "mt-2 grid-cols-3")}>
          {RIVAL_TONES.map((t) => <button key={t} type="button" aria-pressed={v.tone === t} onClick={() => set({ tone: t })} className={segmentClass(v.tone === t)}>{r.toneLabel[t]}</button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{r.level}</legend>
        <div className={cn(segmentGroupClass, "mt-2 grid-cols-3")}>
          {RIVAL_LEVELS.map((l) => <button key={l} type="button" aria-pressed={v.level === l} onClick={() => set({ level: l })} className={segmentClass(v.level === l)}>{r.levelLabel[l]}</button>)}
        </div>
        <p className="mt-2 text-xs text-ink-2">{r.levelHint[v.level]}</p>
        {v.level === "GOAL" ? <div className="mt-2 space-y-1">
          <label className="block text-sm font-semibold">{r.goalDate}
            <input type="date" required min={today} className={fieldClass} value={v.goalDate ?? ""} onChange={(e) => set({ goalDate: e.target.value || null })} />
          </label>
          {hasBoulderGrades ? null : <p className="text-xs text-ink-3">{r.goalNeedsGrades}</p>}
        </div> : null}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="size-5 accent-accent" checked={v.chaseProjects} onChange={(e) => set({ chaseProjects: e.target.checked })} />
        {r.chase}
      </label>
      <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>{r.save}</button>
      {status === "saved" ? <p role="status" className="text-sm font-semibold text-accent">{r.saved}</p> : null}
      {status === "error" ? <p role="alert" className="text-sm font-semibold text-danger">{r.error}</p> : null}
    </form>
  </details>;
}
