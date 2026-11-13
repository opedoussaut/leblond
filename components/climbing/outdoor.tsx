"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button, linkClass, segmentClass, tileClass, toggleClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Input, Label, Select } from "@/components/ui/field";
import { createGym } from "@/lib/actions/gyms";
import { compareGrades } from "@/lib/grading";
import { plural } from "@/lib/i18n";
import { loggingDictionary } from "@/lib/i18n/logging";
import {
  BOOLDER_ATTRIBUTION,
  CIRCUIT_SWATCHES,
  circuitOrder,
  filterProblems,
  isCircuitColor,
  searchable,
} from "@/lib/integrations/outdoor/boolder";
import { osmUrl } from "@/lib/integrations/outdoor/osm";
import { fmt, type Dictionary } from "@/lib/i18n";
import type { Tables } from "@/lib/supabase/database.types";
import type { MapPin } from "./topo-map";
import { IconCheck, IconExternal, IconStar, IconWarn } from "@/components/ui/icons";

/** Leaflet and the OpenStreetMap tiles load only when a map is asked for. */
const TopoMap = dynamic(() => import("./topo-map"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-80 w-full animate-pulse rounded-2xl bg-surface-2" />,
});

export interface AreaItem {
  id: number;
  gym_id: string;
  name: string;
  cluster_name: string | null;
  tags: string[];
  warning_fr: string | null;
  warning_en: string | null;
  problems_count: number;
  /** BOOLDER (Fontainebleau catalogue) or LEBLOND (a topo made by the beta team). */
  source?: string;
  credit?: string | null;
}

/** An outdoor site outside the Boolder catalogue; topo_problems is set when it has a team topo. */
export type OutdoorSite = Tables<"gyms"> & { topo_problems?: number | null };

export interface CatalogueItem {
  id: number;
  name: string;
  name_searchable: string;
  grade: string;
  circuit_color: string | null;
  circuit_number: string | null;
  steepness: string;
  sit_start: boolean;
  popularity: number | null;
  parent_id: number | null;
  bleau_info_id: string | null;
  /** Position on the map; absent for lists loaded without it. */
  latitude?: number | null;
  longitude?: number | null;
}

type Located = CatalogueItem & { latitude: number; longitude: number };
const located = (p: CatalogueItem): p is Located => p.latitude != null && p.longitude != null;

/** A boulder as a map pin: circuit colour and number (grade off-circuit), with a spoken label. */
function toPin(t: Dictionary, p: Located): MapPin {
  const sw = p.circuit_color
    ? isCircuitColor(p.circuit_color) ? CIRCUIT_SWATCHES[p.circuit_color] : { bg: "#8A8A8A", fg: "#111111" }
    : { bg: "#3F3F46", fg: "#ffffff" };
  const circuit = p.circuit_color ? `${circuitColorName(t, p.circuit_color)} ${p.circuit_number ?? ""}`.trim() : t.outdoor.offCircuit;
  return {
    id: p.id,
    lat: p.latitude,
    lon: p.longitude,
    bg: sw.bg,
    fg: sw.fg,
    text: p.circuit_color && p.circuit_number ? p.circuit_number : p.grade,
    label: `${circuit} · ${p.name} · ${p.grade}`,
  };
}

/** "© Boolder, CC BY 4.0" — required wherever catalogue data is shown. */
export function BoolderAttribution({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={cn("text-xs text-ink-3", className)}>
      <a href={BOOLDER_ATTRIBUTION.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        {t.outdoor.attributionText}
      </a>
      {" · "}
      <a href={BOOLDER_ATTRIBUTION.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        CC BY 4.0
      </a>
    </p>
  );
}

/** Who the topo comes from: Boolder's licence notice, or the credit of a topo made by the beta team. */
export function TopoAttribution({ source, credit, className }: { source?: string | null; credit?: string | null; className?: string }) {
  const { t } = useI18n();
  if (source !== "LEBLOND") return <BoolderAttribution className={className} />;
  return <p className={cn("text-xs text-ink-3", className)}>{credit ? fmt(t.outdoor.teamTopoCredit, { credit }) : t.outdoor.teamTopo}</p>;
}

export function circuitColorName(t: Dictionary, color: string | null) {
  if (!color) return "";
  return isCircuitColor(color) ? t.outdoor.colors[color] : color;
}

/** Circuit colour + number, always as text next to the swatch. */
/**
 * Where a logged boulder sits: its circuit (colour + number), "Off circuit" for a
 * topo boulder on no circuit, or "Not in topo" for one logged by grade only.
 */
export function CircuitTag({ color, number, inTopo, className }: {
  color: string | null; number: string | null; inTopo: boolean; className?: string;
}) {
  const { t } = useI18n();
  if (color) return <CircuitBadge color={color} number={number} className={className} />;
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md border border-line px-1.5 py-0.5 text-xs font-bold text-ink-3", className)}>
      {inTopo ? t.outdoor.offCircuit : t.outdoor.offTopo}
    </span>
  );
}

export function CircuitBadge({ color, number, className }: { color: string | null; number: string | null; className?: string }) {
  const { t } = useI18n();
  if (!color) return null;
  const sw = isCircuitColor(color) ? CIRCUIT_SWATCHES[color] : { bg: "#8A8A8A", fg: "#111111" };
  const name = circuitColorName(t, color);
  return (
    <span
      className={cn("inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-black tabular-nums ring-1 ring-black/20", className)}
      style={{ backgroundColor: sw.bg, color: sw.fg }}
      title={name}
    >
      <span className="sr-only">{name} </span>
      {number ?? "—"}
    </span>
  );
}

export function areaWarning(area: Pick<AreaItem, "warning_fr" | "warning_en">, locale: string) {
  return locale === "en" ? (area.warning_en ?? area.warning_fr) : (area.warning_fr ?? area.warning_en);
}

function siteHint(t: Dictionary, site: Pick<OutdoorSite, "has_bouldering" | "has_routes" | "topo_problems">) {
  if (site.topo_problems) return fmt(t.outdoor.siteHintTopo, { n: site.topo_problems });
  if (site.has_bouldering && site.has_routes) return t.outdoor.siteHintBoth;
  return site.has_routes ? t.outdoor.siteHintRoutes : t.outdoor.siteHint;
}

/** A crag or bouldering spot without a built-in topo, added by a climber (shared with other testers). */
function NewOutdoorSiteForm({ onCreated, onCancel }: { onCreated: (site: Tables<"gyms">) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [hasBouldering, setHasBouldering] = useState(true);
  const [hasRoutes, setHasRoutes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      aria-label={t.outdoor.addSiteTitle}
      className="space-y-3 rounded-2xl border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await createGym({
            name: String(fd.get("name") ?? ""),
            brand: "OUTDOOR",
            city: String(fd.get("city") ?? ""),
            gradingSystem: "FONT",
            hasBouldering,
            hasRoutes,
            sourceUrl: String(fd.get("sourceUrl") ?? "").trim(),
          });
          if (res.ok && res.data) onCreated(res.data);
          else setError(!res.ok && res.error === "duplicate" ? t.outdoor.siteDuplicate : t.common.unknownError);
        });
      }}
    >
      <h3 className="font-bold">{t.outdoor.addSiteTitle}</h3>
      <p className="text-xs text-ink-3">{t.outdoor.addSiteHint}</p>
      <div>
        <Label htmlFor="site-name">{t.outdoor.siteName}</Label>
        <Input id="site-name" name="name" required minLength={2} maxLength={120} placeholder={t.outdoor.siteNamePlaceholder} />
      </div>
      <div>
        <Label htmlFor="site-city" hint={t.common.optional}>{t.outdoor.siteRegion}</Label>
        <Input id="site-city" name="city" maxLength={120} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t.gyms.discipline}</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={hasBouldering} onChange={(e) => setHasBouldering(e.target.checked)} />
          {t.gyms.boulder}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={hasRoutes} onChange={(e) => setHasRoutes(e.target.checked)} />
          {t.gyms.routes}
        </label>
      </fieldset>
      <div>
        <Label htmlFor="site-link" hint={t.common.optional}>{t.outdoor.siteLink}</Label>
        <Input id="site-link" name="sourceUrl" type="url" inputMode="url" maxLength={500} pattern={String.raw`https://\S+`} placeholder="https://" />
        <p className="mt-1 text-xs text-ink-3">{t.outdoor.siteLinkHint}</p>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || (!hasBouldering && !hasRoutes)} className="flex-1">
          {pending ? t.common.saving : t.common.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t.common.cancel}</Button>
      </div>
    </form>
  );
}

/** Sites without a topo (with a form to add one), then the Fontainebleau areas. Each list works without the other. */
export function OutdoorPicker({ sites, areas, favouriteGymIds, pending, onPickSite, onPickArea }: {
  sites: OutdoorSite[];
  areas: AreaItem[];
  favouriteGymIds: string[];
  pending?: boolean;
  onPickSite: (site: Tables<"gyms">) => void;
  onPickArea: (area: AreaItem) => void;
}) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-5">
      <section aria-labelledby="outdoor-sites" className="space-y-2">
        <h2 id="outdoor-sites" className="text-sm font-bold">{t.outdoor.otherSites}</h2>
        {sites.length ? (
          <ul className="space-y-2">
            {sites.map((site) => (
              <li key={site.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onPickSite(site)}
                  className={tileClass(false, "flex min-h-16 min-w-0 flex-1 flex-col justify-center")}
                >
                  <span className="block truncate font-semibold">{site.name}</span>
                  <span className="block text-xs text-ink-3">{site.city ? `${site.city} · ` : ""}{siteHint(t, site)}</span>
                </button>
                {site.source_url ? (
                  <a
                    href={site.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={fmt(t.outdoor.siteGuide, { name: site.name })}
                    className="flex shrink-0 items-center rounded-2xl border border-line bg-surface px-3 text-xs font-bold text-accent hover:bg-surface-2"
                  >
                    {t.outdoor.siteGuideShort}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {adding ? (
          <NewOutdoorSiteForm onCancel={() => setAdding(false)} onCreated={(site) => { setAdding(false); onPickSite(site); }} />
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            className={cn(linkClass, "min-h-11 text-sm hover:underline")}>
            {t.outdoor.addSite}
          </button>
        )}
      </section>
      <section aria-labelledby="outdoor-areas" className="space-y-2">
        <h2 id="outdoor-areas" className="text-sm font-bold">{t.outdoor.areasTitle}</h2>
        <AreaPicker areas={areas} favouriteGymIds={favouriteGymIds} pending={pending} onPick={onPickArea} />
      </section>
    </div>
  );
}

/** Fontainebleau area list (Boolder catalogue) with search and closure warnings. */
export function AreaPicker({
  areas,
  favouriteGymIds,
  pending,
  onPick,
}: {
  areas: AreaItem[];
  favouriteGymIds: string[];
  pending?: boolean;
  onPick: (area: AreaItem) => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = searchable(query);
    const fav = new Set(favouriteGymIds);
    const list = q
      ? areas.filter((a) => searchable(`${a.name} ${a.cluster_name ?? ""}`).includes(q))
      : areas;
    return [...list].sort((a, b) => Number(fav.has(b.gym_id)) - Number(fav.has(a.gym_id)));
  }, [areas, query, favouriteGymIds]);

  if (areas.length === 0) return <Notice tone="info">{t.outdoor.notImported}</Notice>;

  return (
    <div className="space-y-3">
      <Input
        type="search"
        aria-label={t.outdoor.searchAreas}
        placeholder={t.outdoor.searchAreas}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered.length === 0 ? <p className="text-sm text-ink-2">{t.outdoor.noAreas}</p> : null}
      <ul className="space-y-2">
        {filtered.map((a) => {
          const warning = areaWarning(a, locale);
          const open = confirming === a.id;
          return (
            <li key={a.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => (warning && !open ? setConfirming(a.id) : onPick(a))}
                aria-expanded={warning ? open : undefined}
                className={cn(
                  "flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left transition-colors", open ? "border-danger bg-surface-2" : "border-line bg-surface hover:border-ink-3",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="block text-xs text-ink-3">
                    {[a.cluster_name !== a.name ? a.cluster_name : null, fmt(t.outdoor.problemsCount, { count: a.problems_count })]
                      .filter(Boolean)
                      .join(" · ")}
                    {a.tags.length
                      ? ` · ${a.tags.map((tag) => (t.outdoor.tags as Record<string, string>)[tag] ?? tag).join(", ")}`
                      : ""}
                  </span>
                  {warning ? (
                    <span className="mt-1 block text-xs font-semibold text-danger">
                      <IconWarn /> {t.outdoor.warning} : {warning}
                    </span>
                  ) : null}
                </span>
                {favouriteGymIds.includes(a.gym_id) ? <span className="text-accent"><IconStar /></span> : null}
              </button>
              {open ? (
                <div className="mt-2 flex gap-2">
                  <Button variant="danger" className="flex-1" disabled={pending} onClick={() => onPick(a)}>
                    {t.outdoor.startAnyway}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(null)}>
                    {t.common.cancel}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <BoolderAttribution />
    </div>
  );
}

/** Rows listed at a time; "show more" adds as many again. */
const MAX_RESULTS = 60;
/** Enough for any Fontainebleau sector; beyond that, filter by circuit or grade. */
const MAX_PINS = 1500;

/** Picks a boulder from the area's topo (Boolder or the team's); falls back to a plain grade grid. */
export function BoolderProblemPicker({
  problems,
  pending,
  onPick,
  onCancel,
  onNotInTopo,
  source,
  credit,
  inSession,
  offline = false,
}: {
  problems: CatalogueItem[];
  /** No signal: the map (its tiles come from the network) is hidden; the list works. */
  offline?: boolean;
  /** Topo boulders already in the session being logged → tries logged there. */
  inSession?: ReadonlyMap<number, number>;
  /** The area's source (BOOLDER by default) and, for a team topo, its credit. */
  source?: string;
  credit?: string | null;
  pending: boolean;
  onPick: (p: CatalogueItem) => void;
  onCancel?: () => void;
  onNotInTopo: () => void;
}) {
  const { t, locale } = useI18n();
  const L = loggingDictionary(locale);
  const inSessionLabel = (id: number) => {
    const n = inSession?.get(id);
    if (n === undefined) return null;
    return n > 0 ? fmt(plural(locale, n, { one: L.inSessionTriesOne, other: L.inSessionTriesOther }), { n }) : L.inSessionBadge;
  };
  const [query, setQuery] = useState("");
  const [circuit, setCircuit] = useState<string | null>(null); // colour, "none", or null = all
  const [grade, setGrade] = useState<string | null>(null);
  const [chosenView, setView] = useState<"list" | "map">("list");
  const view = offline ? "list" : chosenView;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // How many rows are listed, for the current search and filters (back to one page when they change).
  const filterKey = `${query}|${circuit}|${grade}`;
  const [more, setMore] = useState({ key: "", count: MAX_RESULTS });
  const limit = more.key === filterKey ? more.count : MAX_RESULTS;
  const hasMap = useMemo(() => problems.some(located), [problems]);

  const colors = useMemo(
    () => [...new Set(problems.map((p) => p.circuit_color).filter((c): c is string => Boolean(c)))].sort((a, b) => circuitOrder(a) - circuitOrder(b)),
    [problems],
  );
  const grades = useMemo(
    () => [...new Set(problems.map((p) => p.grade))].sort((a, b) => compareGrades("FONT", a, b) ?? 0),
    [problems],
  );
  const results = useMemo(() => {
    const base = circuit === "none" ? problems.filter((p) => !p.circuit_color) : problems;
    return filterProblems(base, { query, circuitColor: circuit === "none" ? null : circuit, grade });
  }, [problems, query, circuit, grade]);
  const onMap = useMemo(
    () => (view === "map" ? results.filter(located).slice(0, MAX_PINS) : []),
    [view, results],
  );
  const pins = useMemo(() => onMap.map((p) => toPin(t, p)), [onMap, t]);
  const chosen = onMap.find((p) => p.id === selectedId) ?? null;

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-label={t.outdoor.pickTitle}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{t.outdoor.pickTitle}</h2>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        ) : null}
      </div>
      <Input
        type="search"
        inputMode="search"
        aria-label={t.outdoor.searchProblems}
        placeholder={t.outdoor.searchProblems}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.outdoor.circuitFilter}>
        {[null, ...colors, "none"].map((c) => (
          <button
            key={c ?? "all"}
            type="button"
            aria-pressed={circuit === c}
            onClick={() => setCircuit(c)}
            className={toggleClass(circuit === c)}
          >
            {c && c !== "none" ? (
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full ring-1 ring-black/20"
                style={{ backgroundColor: isCircuitColor(c) ? CIRCUIT_SWATCHES[c].bg : "#8A8A8A" }}
              />
            ) : null}
            {c === null ? t.outdoor.allCircuits : c === "none" ? t.outdoor.offCircuit : circuitColorName(t, c)}
          </button>
        ))}
      </div>
      <Select aria-label={t.outdoor.gradeFilter} value={grade ?? ""} onChange={(e) => setGrade(e.target.value || null)}>
        <option value="">{t.outdoor.anyGrade}</option>
        {grades.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </Select>
      {hasMap && offline ? <p className="text-xs text-ink-3">{L.mapNeedsNetwork}</p> : null}
      {hasMap && !offline ? (
        <div className="inline-flex rounded-full border border-line p-0.5" role="group" aria-label={t.outdoor.viewAs}>
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={segmentClass(view === v, "px-4")}
            >
              {v === "list" ? t.outdoor.viewList : t.outdoor.viewMap}
            </button>
          ))}
        </div>
      ) : null}
      {results.length === 0 ? (
        <p className="text-sm text-ink-2">{t.outdoor.noProblems}</p>
      ) : view === "map" ? (
        <div className="space-y-2">
          <p className="text-xs text-ink-3">{fmt(t.outdoor.mapCount, { n: onMap.length })}</p>
          <TopoMap pins={pins} selectedId={selectedId} onSelect={setSelectedId} label={t.outdoor.mapLabel} />
          {chosen ? (
            <div className="space-y-2 rounded-2xl border border-accent bg-accent-soft p-3">
              <div className="flex items-center gap-3">
                <span className="w-10 shrink-0">
                  <CircuitBadge color={chosen.circuit_color} number={chosen.circuit_number} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{chosen.name}</span>
                  <span className="block text-xs text-ink-3">
                    {(t.outdoor.steepness as Record<string, string>)[chosen.steepness] ?? chosen.steepness}
                    {chosen.sit_start ? ` · ${t.outdoor.sitStart}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-black tabular-nums">{chosen.grade}</span>
              </div>
              {inSessionLabel(chosen.id) ? <p className="text-xs font-bold text-ok"><IconCheck /> {inSessionLabel(chosen.id)}</p> : null}
              <Button className="w-full" disabled={pending} onClick={() => onPick(chosen)}>
                {t.outdoor.mapPick}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-2">{t.outdoor.mapHint}</p>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-3">
            {fmt(t.outdoor.results, { shown: Math.min(results.length, limit), total: results.length })}
          </p>
          <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
            {results.slice(0, limit).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onPick(p)}
                  className="flex min-h-14 w-full items-center gap-3 px-3 text-left hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="w-10 shrink-0">
                    <CircuitBadge color={p.circuit_color} number={p.circuit_number} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block text-xs text-ink-3">
                      {(t.outdoor.steepness as Record<string, string>)[p.steepness] ?? p.steepness}
                      {p.sit_start ? ` · ${t.outdoor.sitStart}` : ""}
                      {p.parent_id ? ` · ${t.outdoor.variantOf}` : ""}
                    </span>
                    {inSessionLabel(p.id) ? <span className="mt-0.5 block text-xs font-bold text-ok"><IconCheck /> {inSessionLabel(p.id)}</span> : null}
                  </span>
                  <span className="shrink-0 font-black tabular-nums">{p.grade}</span>
                </button>
              </li>
            ))}
          </ul>
          {results.length > limit ? (
            <Button variant="secondary" className="w-full" onClick={() => setMore({ key: filterKey, count: limit + MAX_RESULTS })}>
              {fmt(t.outdoor.showMore, { n: Math.min(MAX_RESULTS, results.length - limit) })}
            </Button>
          ) : null}
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onNotInTopo} className={cn(linkClass, "min-h-11 text-sm hover:underline")}>
          {t.outdoor.notInTopo}
        </button>
        <TopoAttribution source={source} credit={credit} />
      </div>
    </section>
  );
}

/** On the boulder page: the map only when asked for, and a link to openstreetmap.org. */
export function ProblemOnMap({ problem }: { problem: CatalogueItem }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!located(problem)) return null;
  return (
    <div className="space-y-2">
      {open ? (
        <TopoMap pins={[toPin(t, problem)]} selectedId={problem.id} label={t.outdoor.mapLabel} className="h-56 w-full overflow-hidden rounded-2xl border border-line" />
      ) : null}
      <p className="flex flex-wrap items-center gap-4">
        {open ? null : (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t.outdoor.showMap}
          </Button>
        )}
        <a href={osmUrl(problem.latitude, problem.longitude)} target="_blank" rel="noopener noreferrer" className={cn(linkClass, "hover:underline")}>
          {t.outdoor.openInOsm} <IconExternal />
        </a>
      </p>
    </div>
  );
}
