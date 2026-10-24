"use client";

import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { createGym } from "@/lib/actions/gyms";
import { allowedSystemsForBrand, GYM_BRANDS, type GradeSystem, type GymBrand } from "@/lib/climbing/types";
import { fmt } from "@/lib/i18n";
import type { Tables } from "@/lib/supabase/database.types";

type Gym = Tables<"gyms">;
type DisciplineFilter = "all" | "boulder" | "routes" | "both";

function normalize(value: string) {
  return value.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’\-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Alphabetical, French collation, ignoring case, accents and apostrophes (Block'Out, Vertical'Art). */
const byGymName = (a: Gym, b: Gym) =>
  a.name.localeCompare(b.name, "fr", { sensitivity: "base", ignorePunctuation: true });

/** The venue directory shows the disciplines the facility actually offers. */
export function GymPicker({
  gyms: initialGyms, favouriteIds, mode, selected = [], onPick, onToggle, pending,
}: {
  gyms: Gym[];
  favouriteIds: string[];
  mode: "pick" | "multi";
  selected?: string[];
  onPick?: (gym: Gym) => void;
  onToggle?: (gym: Gym) => void;
  pending?: boolean;
}) {
  const { t } = useI18n();
  const [gyms, setGyms] = useState(initialGyms);
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<DisciplineFilter>("all");
  const [brand, setBrand] = useState<"all" | GymBrand>("all");
  const [adding, setAdding] = useState(false);
  const chosen = useMemo(() => gyms.filter((g) => selected.includes(g.id)), [gyms, selected]);
  const filtered = useMemo(() => {
    const q = normalize(query);
    return gyms.filter((g) =>
      (brand === "all" || g.brand === brand) &&
      (discipline === "all" ||
        (discipline === "boulder" && g.has_bouldering) ||
        (discipline === "routes" && g.has_routes) ||
        (discipline === "both" && g.has_bouldering && g.has_routes)) &&
      (!q || normalize(g.name + " " + (g.city ?? "") + " " + t.brands[g.brand]).includes(q))
    ).sort(byGymName);
  }, [gyms, query, discipline, brand, t]);

  const disciplineLabel = (g: Gym) =>
    g.has_bouldering && g.has_routes ? t.gyms.both : g.has_bouldering ? t.gyms.boulder : t.gyms.routes;

  // A missing venue is a genuinely unmatched name, not just hidden by a filter.
  const absent = normalize(query).length >= 3 && !gyms.some((g) =>
    normalize(g.name + " " + (g.city ?? "") + " " + t.brands[g.brand]).includes(normalize(query))
  );

  const onCreated = (gym: Gym) => {
    setGyms((prev) => [...prev, gym]);
    setAdding(false);
    setQuery("");
    setBrand("all");
    setDiscipline("all");
    if (mode === "pick") onPick?.(gym);
    else if (mode === "multi") onToggle?.(gym);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <p className="font-bold text-ink">{t.gyms.directory}</p>
          <p className="mt-1 text-xs text-ink-2">{t.gyms.catalogueHelp}</p>
        </div>
        <div>
          <Label htmlFor={"gym-query-" + mode}>{t.gyms.search}</Label>
          <Input id={"gym-query-" + mode} type="search" placeholder={t.gyms.search}
            value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={"gym-filter-brand-" + mode}>{t.gyms.network}</Label>
            <Select id={"gym-filter-brand-" + mode} value={brand}
              onChange={(e) => setBrand(e.target.value as "all" | GymBrand)}>
              <option value="all">{t.gyms.all}</option>
              {GYM_BRANDS.filter((b) => gyms.some((g) => g.brand === b)).map((b) =>
                <option key={b} value={b}>{t.brands[b]}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor={"gym-filter-discipline-" + mode}>{t.gyms.discipline}</Label>
            <Select id={"gym-filter-discipline-" + mode} value={discipline}
              onChange={(e) => setDiscipline(e.target.value as DisciplineFilter)}>
              <option value="all">{t.gyms.allDisciplines}</option>
              <option value="boulder">{t.gyms.boulder}</option>
              <option value="routes">{t.gyms.routes}</option>
              <option value="both">{t.gyms.both}</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor={"gym-directory-" + mode}>{t.gyms.choose}</Label>
          <Select id={"gym-directory-" + mode} aria-label={t.gyms.choose}
            value="" disabled={pending || filtered.length === 0}
            onChange={(e) => {
              const gym = gyms.find((g) => g.id === e.target.value);
              if (!gym) return;
              if (mode === "pick") onPick?.(gym);
              else if (!selected.includes(gym.id)) onToggle?.(gym);
            }}>
            <option value="">{fmt(t.gyms.directoryCount, { count: filtered.length })}</option>
            {filtered.map((g) => (
              <option key={g.id} value={g.id}>
                {(selected.includes(g.id) && mode === "multi" ? "✓ " : "") +
                  (favouriteIds.includes(g.id) ? "★ " : "") +
                  g.name + " · " + (g.city ?? "IDF") + " · " + disciplineLabel(g)}
              </option>
            ))}
          </Select>
          {filtered.length === 0 ? <p className="mt-2 text-sm text-ink-2">{t.gyms.none}</p> : null}
        </div>
      </div>

      {mode === "multi" && chosen.length > 0 ? (
        <section aria-label={t.gyms.selectedGyms} className="space-y-2">
          <h3 className="text-sm font-bold">{t.gyms.selectedGyms} ({chosen.length})</h3>
          <ul className="space-y-2">
            {chosen.map((g) => (
              <li key={g.id} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  <p className="text-xs text-ink-2">{g.city ? g.city + " · " : ""}{disciplineLabel(g)}</p>
                </div>
                <button type="button" disabled={pending} onClick={() => onToggle?.(g)}
                  aria-label={t.gyms.remove + " " + g.name}
                  className="min-h-10 shrink-0 rounded-lg px-3 text-xs font-bold text-accent hover:bg-surface">
                  {t.gyms.remove}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {adding ? (
        <NewGymForm nameHint={query} allowRouteOnly={mode === "multi"}
          onCreated={onCreated} onCancel={() => setAdding(false)} />
      ) : absent ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-4">
          <p className="mb-2 text-sm text-ink-2">{t.gyms.missingGym}</p>
          <Button type="button" variant="secondary" className="w-full" onClick={() => setAdding(true)}>
            + {t.gyms.addMissing}
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-ink-3">{t.gyms.searchFirst}</p>
      )}
    </div>
  );
}

function NewGymForm({
  nameHint, allowRouteOnly, onCreated, onCancel,
}: {
  nameHint: string;
  allowRouteOnly: boolean;
  onCreated: (g: Gym) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [brand, setBrand] = useState<GymBrand>("OTHER");
  const [system, setSystem] = useState<GradeSystem>("FONT");
  const [hasBouldering, setHasBouldering] = useState(true);
  const [hasRoutes, setHasRoutes] = useState(false);
  const systems = allowedSystemsForBrand(brand);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-3 rounded-2xl border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (!hasBouldering && !hasRoutes) { setError(t.common.unknownError); return; }
        setError(null);
        start(async () => {
          const result = await createGym({
            name: String(fd.get("name") ?? ""),
            brand,
            city: String(fd.get("city") ?? ""),
            gradingSystem: system,
            hasBouldering,
            hasRoutes,
          });
          if (result.ok && result.data) onCreated(result.data);
          else setError(result.ok ? null : result.error === "duplicate" ? t.gyms.duplicate : t.common.unknownError);
        });
      }}>
      <h3 className="font-bold">{t.gyms.addTitle}</h3>
      <div>
        <Label htmlFor="gym-brand">{t.gyms.network}</Label>
        <Select id="gym-brand" value={brand} onChange={(e) => {
          const b = e.target.value as GymBrand;
          setBrand(b);
          setSystem(allowedSystemsForBrand(b)[0]);
        }}>
          {GYM_BRANDS.map((b) => <option key={b} value={b}>{t.brands[b]}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="gym-name">{t.gyms.name}</Label>
        <Input id="gym-name" name="name" required minLength={2} maxLength={120}
          defaultValue={nameHint} placeholder={t.gyms.namePlaceholder} />
      </div>
      <div>
        <Label htmlFor="gym-city" hint={t.common.optional}>{t.gyms.city}</Label>
        <Input id="gym-city" name="city" maxLength={120} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t.gyms.discipline}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasBouldering}
            disabled={!allowRouteOnly}
            onChange={(e) => setHasBouldering(e.target.checked)} />
          {t.gyms.boulder}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasRoutes} onChange={(e) => setHasRoutes(e.target.checked)}/>
          {t.gyms.routes}
        </label>
      </fieldset>
      {hasBouldering ? (
        <div>
          <Label htmlFor="gym-system">{t.gyms.grading}</Label>
          {systems.length === 1 ? (
            <p id="gym-system" className="text-sm text-ink-2">{t.grades.systems[systems[0]]} — {t.gyms.gradingLocked}</p>
          ) : (
            <Select id="gym-system" value={system} onChange={(e) => setSystem(e.target.value as GradeSystem)}>
              {systems.map((s) => <option key={s} value={s}>{t.grades.systems[s]}</option>)}
            </Select>
          )}
        </div>
      ) : null}
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
