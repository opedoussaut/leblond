"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GymPicker } from "@/components/climbing/gym-picker";
import { OutdoorPicker, type AreaItem, type OutdoorSite } from "@/components/climbing/outdoor";
import { useI18n } from "@/components/i18n-provider";
import { buttonClass, segmentClass, segmentGroupClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { updateSessionPlace } from "@/lib/actions/sessions";
import { sessionEditDictionary } from "@/lib/i18n/session-edit";
import type { Tables } from "@/lib/supabase/database.types";

type Place = { id: string; name: string; hasBouldering: boolean; hasRoutes: boolean };
type Discipline = "BOULDER" | "ROUTE";

/** Where a finished séance happened and its discipline: correctable while nothing is logged in it. */
export function SessionPlaceForm({ sessionId, current, discipline: initialDiscipline, locked, fromWatch, gyms, favouriteIds, areas, sites }: {
  sessionId: string; current: Place; discipline: Discipline; locked: boolean; fromWatch: boolean;
  gyms: Tables<"gyms">[]; favouriteIds: string[]; areas: AreaItem[]; sites: OutdoorSite[];
}) {
  const { t, locale } = useI18n();
  const e = sessionEditDictionary(locale);
  const router = useRouter();
  const [place, setPlace] = useState<Place>(current);
  const [discipline, setDiscipline] = useState<Discipline>(initialDiscipline);
  const [picking, setPicking] = useState(false);
  const [where, setWhere] = useState<"gym" | "outdoor">("gym");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = place.id !== current.id || discipline !== initialDiscipline;

  function choose(p: Place) {
    setPlace(p);
    if (discipline === "BOULDER" ? !p.hasBouldering : !p.hasRoutes) setDiscipline(p.hasBouldering ? "BOULDER" : "ROUTE");
    setPicking(false); setMessage(null);
  }

  return <section aria-label={e.placeTitle} data-testid="session-place" className="space-y-3 rounded-2xl border border-line bg-surface p-4">
    <h2 className="font-bold">{e.placeTitle}</h2>
    <div className="flex items-center justify-between gap-3">
      <p><span className="block text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{e.chosen}</span>
        <strong className="text-lg">{place.name}</strong>
        <span className="text-sm text-ink-2"> · {discipline === "BOULDER" ? e.boulder : e.route}</span></p>
      {locked ? null : <button type="button" onClick={() => setPicking((v) => !v)} aria-expanded={picking}
        className={buttonClass("secondary", "sm")}>{e.change}</button>}
    </div>
    {locked ? <p className="text-xs text-ink-3">{e.placeLocked}</p>
      : fromWatch && !changed ? <p className="text-xs font-semibold text-ink-2">⌚ {e.placeFromWatch}</p> : null}
    {!locked && picking ? <div className="space-y-3">
      <div role="group" aria-label={e.where} className={cn(segmentGroupClass, "grid-cols-2")}>
        {(["gym", "outdoor"] as const).map((w) => <button key={w} type="button" aria-pressed={where === w} onClick={() => setWhere(w)}
          className={segmentClass(where === w)}>{w === "gym" ? e.gymTab : e.outdoorTab}</button>)}
      </div>
      {where === "gym"
        ? <GymPicker mode="pick" gyms={gyms} favouriteIds={favouriteIds}
          onPick={(g) => choose({ id: g.id, name: g.name, hasBouldering: g.has_bouldering, hasRoutes: g.has_routes })} />
        : <OutdoorPicker sites={sites} areas={areas} favouriteGymIds={favouriteIds}
          onPickSite={(s) => choose({ id: s.id, name: s.name, hasBouldering: s.has_bouldering, hasRoutes: s.has_routes })}
          onPickArea={(a) => choose({ id: a.gym_id, name: a.name, hasBouldering: true, hasRoutes: false })} />}
    </div> : null}
    {!locked && place.hasBouldering && place.hasRoutes ? <fieldset>
      <legend className="text-sm font-semibold">{e.discipline}</legend>
      <div className={cn(segmentGroupClass, "mt-1 grid-cols-2")}>
        {(["BOULDER", "ROUTE"] as const).map((d) => <button key={d} type="button" aria-pressed={discipline === d}
          onClick={() => { setDiscipline(d); setMessage(null); }} className={segmentClass(discipline === d)}>
          {d === "BOULDER" ? e.boulder : e.route}</button>)}
      </div>
    </fieldset> : null}
    {message ? (message.ok ? <p role="status" className="text-sm font-semibold text-ink-2">{message.text}</p>
      : <Notice tone="error">{message.text}</Notice>) : null}
    {!locked && changed ? <button type="button" disabled={pending} className={buttonClass("primary", "md")} onClick={() => {
      setMessage(null);
      start(async () => {
        const res = await updateSessionPlace({ sessionId, gymId: place.id, discipline });
        if (res.ok) { setMessage({ ok: true, text: e.saved }); router.refresh(); return; }
        setMessage({ ok: false, text: res.error === "placeLocked" ? e.placeLocked : res.error === "placeInvalid" ? e.placeInvalid : t.common.unknownError });
      });
    }}>{e.placeSave}</button> : null}
  </section>;
}
