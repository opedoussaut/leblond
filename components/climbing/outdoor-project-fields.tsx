"use client";

import { useI18n } from "@/components/i18n-provider";
import { IconExternal } from "@/components/ui/icons";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { WALL_ANGLES, type WallAngle } from "@/lib/climbing/types";
import type { OutdoorSiteInput } from "@/lib/climbing/outdoor-projects";
import { outdoorProjectsDictionary } from "@/lib/i18n/outdoor-projects";

const URL_PATTERN = String.raw`https://\S+`;
const NEW = "__new__";

export interface SiteOption { id: string; name: string }
/** Outdoor sites offered in the project forms: climbers' / LEBLOND sites, and Fontainebleau areas (boulders only). */
export interface SiteOptions { mine: SiteOption[]; bleau: SiteOption[] }

export interface SiteValue { gymId: string; newName: string; newCity: string; newLink: string }
export const emptySite = (sites: SiteOptions): SiteValue =>
  ({ gymId: sites.mine[0]?.id ?? sites.bleau[0]?.id ?? NEW, newName: "", newCity: "", newLink: "" });
export const isNewSite = (v: SiteValue) => v.gymId === NEW;
export function siteInput(v: SiteValue): OutdoorSiteInput {
  return isNewSite(v)
    ? { newSite: { name: v.newName, city: v.newCity, sourceUrl: v.newLink.trim() } }
    : { gymId: v.gymId };
}

/** Pick an existing outdoor site, or type a new one. */
export function OutdoorSitePicker({ id, sites, value, onChange }: {
  id: string; sites: SiteOptions; value: SiteValue; onChange: (v: SiteValue) => void;
}) {
  const { locale } = useI18n();
  const d = outdoorProjectsDictionary(locale);
  const set = (patch: Partial<SiteValue>) => onChange({ ...value, ...patch });
  return <div className="space-y-3">
    <div>
      <Label htmlFor={id}>{d.site}</Label>
      <Select id={id} value={value.gymId} onChange={(e) => set({ gymId: e.target.value })}>
        {sites.mine.length ? <optgroup label={d.siteMine}>
          {sites.mine.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </optgroup> : null}
        {sites.bleau.length ? <optgroup label={d.siteBleau}>
          {sites.bleau.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </optgroup> : null}
        <option value={NEW}>{d.siteNew}</option>
      </Select>
    </div>
    {isNewSite(value) ? <div className="space-y-3 rounded-xl bg-surface-2 p-3">
      <div>
        <Label htmlFor={id + "-name"}>{d.siteName}</Label>
        <Input id={id + "-name"} required minLength={2} maxLength={120} value={value.newName} onChange={(e) => set({ newName: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={id + "-city"}>{d.siteCity}</Label>
          <Input id={id + "-city"} maxLength={120} value={value.newCity} onChange={(e) => set({ newCity: e.target.value })} />
        </div>
        <div>
          <Label htmlFor={id + "-link"}>{d.siteLink}</Label>
          <Input id={id + "-link"} type="url" inputMode="url" pattern={URL_PATTERN} placeholder="https://" maxLength={500}
            value={value.newLink} onChange={(e) => set({ newLink: e.target.value })} />
        </div>
      </div>
      <p className="text-xs text-ink-3">{d.siteNewHint}</p>
    </div> : null}
  </div>;
}

export interface DetailsValue { sector: string; wallAngle: WallAngle; beta: string; topoRef: string; topoUrl: string }
export const emptyDetails: DetailsValue = { sector: "", wallAngle: "UNKNOWN", beta: "", topoRef: "", topoUrl: "" };

/** Sector, angle, beta and topo citation of an outdoor project. */
export function OutdoorDetailsFields({ id, value, onChange }: {
  id: string; value: DetailsValue; onChange: (v: DetailsValue) => void;
}) {
  const { t, locale } = useI18n();
  const d = outdoorProjectsDictionary(locale);
  const set = (patch: Partial<DetailsValue>) => onChange({ ...value, ...patch });
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor={id + "-sector"} hint={t.common.optional}>{d.sector}</Label>
        <Input id={id + "-sector"} maxLength={80} value={value.sector} onChange={(e) => set({ sector: e.target.value })} />
      </div>
      <div>
        <Label htmlFor={id + "-angle"}>{d.angle}</Label>
        <Select id={id + "-angle"} value={value.wallAngle} onChange={(e) => set({ wallAngle: e.target.value as WallAngle })}>
          {WALL_ANGLES.map((a) => <option key={a} value={a}>{t.wallAngles[a]}</option>)}
        </Select>
      </div>
    </div>
    <div>
      <Label htmlFor={id + "-beta"} hint={t.common.optional}>{d.beta}</Label>
      <Textarea id={id + "-beta"} rows={2} maxLength={2000} placeholder={d.betaPlaceholder} value={value.beta}
        onChange={(e) => set({ beta: e.target.value })} />
    </div>
    <fieldset className="space-y-3 rounded-xl bg-surface-2 p-3">
      <legend className="px-1 text-sm font-semibold">{d.topo}</legend>
      <p className="text-xs text-ink-3">{d.topoNote}</p>
      <div>
        <Label htmlFor={id + "-topo-ref"} hint={t.common.optional}>{d.topoRef}</Label>
        <Input id={id + "-topo-ref"} maxLength={160} placeholder={d.topoRefPlaceholder} value={value.topoRef}
          onChange={(e) => set({ topoRef: e.target.value })} />
      </div>
      <div>
        <Label htmlFor={id + "-topo-url"} hint={t.common.optional}>{d.topoUrl}</Label>
        <Input id={id + "-topo-url"} type="url" inputMode="url" pattern={URL_PATTERN} placeholder="https://" maxLength={500}
          value={value.topoUrl} onChange={(e) => set({ topoUrl: e.target.value.trim() })} />
      </div>
    </fieldset>
  </div>;
}

/** Topo citation and link, read-only (project pages). */
export function TopoCitation({ topoRef, topoUrl }: { topoRef: string | null; topoUrl: string | null }) {
  const { locale } = useI18n();
  const d = outdoorProjectsDictionary(locale);
  if (!topoRef && !topoUrl) return null;
  return <p className="text-sm text-ink-2">
    {d.topo} : {topoRef ?? ""}{" "}
    {topoUrl ? <a href={topoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">{d.topoSource} <IconExternal /></a> : null}
  </p>;
}
