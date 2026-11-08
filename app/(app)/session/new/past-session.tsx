"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GymPicker } from "@/components/climbing/gym-picker";
import { OutdoorPicker, type AreaItem } from "@/components/climbing/outdoor";
import { useI18n } from "@/components/i18n-provider";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { createPastSession } from "@/lib/actions/sessions";
import { sessionEditDictionary } from "@/lib/i18n/session-edit";
import type { Tables } from "@/lib/supabase/database.types";
import { utcToZoned } from "@/lib/time";
import { loggingDictionary } from "@/lib/i18n/logging";
import { buttonClass } from "@/components/ui/button";
import { DurationField } from "@/components/ui/duration-field";
import { fieldClass as field } from "@/components/ui/field";

type Place = { id: string; name: string; hasBouldering: boolean; hasRoutes: boolean };

/** Create a finished session after the fact, then fill it in on the edit page. */
export function PastSession({ gyms, favouriteIds, areas, sites }: {
  gyms: Tables<"gyms">[]; favouriteIds: string[]; areas: AreaItem[]; sites: Tables<"gyms">[];
}) {
  const { t, locale } = useI18n();
  const e = sessionEditDictionary(locale);
  const router = useRouter();
  const [where, setWhere] = useState<"gym" | "outdoor">("gym");
  const [place, setPlace] = useState<Place | null>(null);
  const now = utcToZoned(new Date());
  // Default start: two hours ago, rounded down to the quarter-hour (always in the past).
  const [defaults] = useState(() => {
    const d = new Date(Date.now() - 2 * 3_600_000);
    d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
    return utcToZoned(d);
  });
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [minutes, setMinutes] = useState(90);
  const [discipline, setDiscipline] = useState<"BOULDER" | "ROUTE">("BOULDER");
  const [title, setTitle] = useState("");
  const L = loggingDictionary(locale);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function choose(p: Place) {
    setPlace(p);
    setDiscipline(p.hasBouldering ? "BOULDER" : "ROUTE");
    setError("");
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!place) return;
    setError("");
    start(async () => {
      const res = await createPastSession({ gymId: place.id, discipline, date, time, minutes, title });
      if (!res.ok || !res.data) { setError(res.ok ? t.common.unknownError : res.error === "invalidDate" ? e.invalidDate : t.common.unknownError); return; }
      router.push(`/session/${res.data.sessionId}/edit`);
    });
  }

  return <div className="space-y-4">
    <div>
      <h2 className="text-lg font-extrabold">{e.pastTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{e.pastHint}</p>
    </div>
    {place ? (
      <form onSubmit={submit} aria-label={e.pastTitle} className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p><span className="block text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{e.chosen}</span>
            <strong className="text-lg">{place.name}</strong></p>
          <button type="button" onClick={() => setPlace(null)} className="min-h-11 rounded-full border border-line px-4 text-sm font-bold text-accent">{e.change}</button>
        </div>
        {place.hasBouldering && place.hasRoutes ? <fieldset>
          <legend className="text-sm font-semibold">{e.discipline}</legend>
          <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
            {(["BOULDER", "ROUTE"] as const).map((d) => <button key={d} type="button" aria-pressed={discipline === d} onClick={() => setDiscipline(d)}
              className={cn("min-h-11 rounded-xl text-sm font-bold", discipline === d ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
              {d === "BOULDER" ? e.boulder : e.route}</button>)}
          </div>
        </fieldset> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold">{e.date}
            <input className={field} type="date" required max={now.date} min="2015-01-01" value={date} onChange={(ev) => setDate(ev.target.value)} />
          </label>
          <label className="text-sm font-semibold">{e.time}
            <input className={field} type="time" required value={time} onChange={(ev) => setTime(ev.target.value)} />
          </label>
          <DurationField className="col-span-2 sm:col-span-1" label={e.minutes} value={minutes}
            onChange={(v) => setMinutes(v ?? 0)} min={10} max={720} step={5} />
        </div>
        <label className="block text-sm font-semibold">{L.sessionName}
          <input className={field} maxLength={80} value={title} placeholder={L.sessionNamePlaceholder} onChange={(ev) => setTitle(ev.target.value)} />
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button type="submit" disabled={pending}
          className={buttonClass("primary", "md", "w-full")}>
          {pending ? e.creating : e.create}
        </button>
      </form>
    ) : <>
      <div role="group" aria-label={e.where} className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
        {(["gym", "outdoor"] as const).map((w) => <button key={w} type="button" aria-pressed={where === w} onClick={() => setWhere(w)}
          className={cn("min-h-11 rounded-xl text-sm font-bold", where === w ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
          {w === "gym" ? e.gymTab : e.outdoorTab}</button>)}
      </div>
      {where === "gym"
        ? <GymPicker mode="pick" gyms={gyms} favouriteIds={favouriteIds}
          onPick={(g) => choose({ id: g.id, name: g.name, hasBouldering: g.has_bouldering, hasRoutes: g.has_routes })} />
        : <OutdoorPicker sites={sites} areas={areas} favouriteGymIds={favouriteIds}
          onPickSite={(s) => choose({ id: s.id, name: s.name, hasBouldering: s.has_bouldering, hasRoutes: s.has_routes })}
          onPickArea={(a) => choose({ id: a.gym_id, name: a.name, hasBouldering: true, hasRoutes: false })} />}
    </>}
  </div>;
}
