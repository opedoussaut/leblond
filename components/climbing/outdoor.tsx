"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Input, Select } from "@/components/ui/field";
import { compareGrades } from "@/lib/grading";
import {
  BOOLDER_ATTRIBUTION,
  CIRCUIT_SWATCHES,
  filterProblems,
  isCircuitColor,
  searchable,
} from "@/lib/integrations/outdoor/boolder";
import { fmt, type Dictionary } from "@/lib/i18n";

export interface AreaItem {
  id: number;
  gym_id: string;
  name: string;
  cluster_name: string | null;
  tags: string[];
  warning_fr: string | null;
  warning_en: string | null;
  problems_count: number;
}

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

export function circuitColorName(t: Dictionary, color: string | null) {
  if (!color) return "";
  return isCircuitColor(color) ? t.outdoor.colors[color] : color;
}

/** Circuit colour + number, always as text next to the swatch. */
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
                  "flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left",
                  open ? "border-danger bg-surface-2" : "border-line bg-surface hover:bg-surface-2",
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
                      ⚠ {t.outdoor.warning} : {warning}
                    </span>
                  ) : null}
                </span>
                {favouriteGymIds.includes(a.gym_id) ? <span aria-hidden className="text-accent">★</span> : null}
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

const MAX_RESULTS = 60;

/** Picks a boulder from the area's Boolder topo; falls back to a plain grade grid. */
export function BoolderProblemPicker({
  problems,
  pending,
  onPick,
  onCancel,
  onNotInTopo,
}: {
  problems: CatalogueItem[];
  pending: boolean;
  onPick: (p: CatalogueItem) => void;
  onCancel?: () => void;
  onNotInTopo: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [circuit, setCircuit] = useState<string | null>(null); // colour, "none", or null = all
  const [grade, setGrade] = useState<string | null>(null);

  const colors = useMemo(
    () => [...new Set(problems.map((p) => p.circuit_color).filter((c): c is string => Boolean(c)))].sort(),
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

  return (
    <section className="space-y-3 rounded-3xl border border-line bg-surface p-4" aria-label={t.outdoor.pickTitle}>
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
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm",
              circuit === c ? "border-accent bg-accent-soft font-semibold" : "border-line text-ink-2",
            )}
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
      {results.length === 0 ? (
        <p className="text-sm text-ink-2">{t.outdoor.noProblems}</p>
      ) : (
        <>
          <p className="text-xs text-ink-3">
            {fmt(t.outdoor.results, { shown: Math.min(results.length, MAX_RESULTS), total: results.length })}
          </p>
          <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
            {results.slice(0, MAX_RESULTS).map((p) => (
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
                  </span>
                  <span className="shrink-0 font-black tabular-nums">{p.grade}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onNotInTopo} className="text-sm text-accent underline-offset-2 hover:underline">
          {t.outdoor.notInTopo}
        </button>
        <BoolderAttribution />
      </div>
    </section>
  );
}
