"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  emptyDetails, emptySite, isNewSite, OutdoorDetailsFields, OutdoorSitePicker, siteInput,
  type DetailsValue, type SiteOptions,
} from "@/components/climbing/outdoor-project-fields";
import { createRouteProject } from "@/lib/actions/route-projects";
import { ROUTE_STYLES, type RouteStyle } from "@/lib/climbing/routes";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { outdoorProjectsDictionary } from "@/lib/i18n/outdoor-projects";
import { routeDictionary } from "@/lib/i18n/routes";
import { buttonClass, segmentClass } from "@/components/ui/button";
import { fieldClass as field } from "@/components/ui/field";

/** Create a route project in a gym that offers routes, or outdoors at a crag. */
export function RouteProjectForm({ gyms, sites }: { gyms: Array<{ id: string; name: string }>; sites: SiteOptions }) {
  const { t, locale } = useI18n();
  const r = routeDictionary(locale);
  const d = outdoorProjectsDictionary(locale);
  const router = useRouter();
  const [outdoor, setOutdoor] = useState(gyms.length === 0);
  const [gymId, setGymId] = useState(gyms[0]?.id ?? "");
  const [site, setSite] = useState(() => emptySite(sites));
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("6c");
  const [goal, setGoal] = useState<RouteStyle>("LEAD");
  const [details, setDetails] = useState<DetailsValue>(emptyDetails);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const missingSite = outdoor ? isNewSite(site) && site.newName.trim().length < 2 : !gymId;

  return <form aria-label={r.newProject} className="space-y-3" onSubmit={(e) => {
    e.preventDefault(); setError("");
    start(async () => {
      const where = outdoor ? { site: siteInput(site), ...details } : { gymId };
      const res = await createRouteProject({ ...where, routeName: name, grade, goalStyle: goal, notes });
      if (!res.ok || !res.data) { setError(d.errors[res.ok ? "unknownError" : res.error] ?? t.common.unknownError); return; }
      router.push("/projects/routes/" + res.data.id);
    });
  }}>
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{d.venue}</legend>
      <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
        <button type="button" aria-pressed={!outdoor} onClick={() => setOutdoor(false)} className={segmentClass(!outdoor)}>{d.indoor}</button>
        <button type="button" aria-pressed={outdoor} onClick={() => setOutdoor(true)} className={segmentClass(outdoor)}>{d.outdoor}</button>
      </div>
    </fieldset>
    {outdoor
      ? <OutdoorSitePicker id="rp-site" sites={sites} value={site} onChange={setSite} />
      : gyms.length ? <label className="block text-sm font-semibold">{r.gym}
        <select className={field} value={gymId} onChange={(e) => setGymId(e.target.value)}>
          {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label> : <p className="text-sm text-ink-2">{r.noRouteGyms}</p>}
    <label className="block text-sm font-semibold">{outdoor ? d.routeName : r.routeName.replace(/ \(.*\)$/, "")}
      <input className={field} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
    </label>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm font-semibold">{outdoor ? d.gradeFrench : r.grade}
        <select className={field} value={grade} onChange={(e) => setGrade(e.target.value)}>
          {FRENCH_ROUTE_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">{r.goalStyle}
        <select className={field} value={goal} onChange={(e) => setGoal(e.target.value as RouteStyle)}>
          {ROUTE_STYLES.map((s) => <option key={s} value={s}>{r.styles[s]}</option>)}
        </select>
      </label>
    </div>
    {outdoor ? <>
      <p className="text-xs text-ink-3">{d.gradeNote}</p>
      <OutdoorDetailsFields id="rp" value={details} onChange={setDetails} />
    </> : null}
    <label className="block text-sm font-semibold">{r.notes}
      <textarea className={field} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </label>
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <button type="submit" disabled={pending || !name.trim() || missingSite}
      className={buttonClass("primary", "md")}>{r.create}</button>
  </form>;
}
