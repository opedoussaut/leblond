"use client";

import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Input, Label, Select } from "@/components/ui/field";
import { createGym } from "@/lib/actions/gyms";
import { allowedSystemsForBrand, GYM_BRANDS, type GradeSystem, type GymBrand } from "@/lib/climbing/types";
import type { Tables } from "@/lib/supabase/database.types";

type Gym = Tables<"gyms">;

/**
 * Gym list with search and inline creation.
 * - mode "pick": tapping a gym calls onPick (start a session there)
 * - mode "multi": tapping toggles membership in `selected` (favourites)
 */
export function GymPicker({
  gyms: initialGyms,
  favouriteIds,
  mode,
  selected = [],
  onPick,
  onToggle,
  pending,
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
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? gyms.filter((g) => `${g.name} ${g.city ?? ""}`.toLowerCase().includes(q)) : gyms;
    const fav = new Set(favouriteIds);
    return [...list].sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)) || a.name.localeCompare(b.name));
  }, [gyms, query, favouriteIds]);

  const onCreated = (gym: Gym) => {
    setGyms((g) => [...g, gym]);
    setAdding(false);
    if (mode === "pick") onPick?.(gym);
    else onToggle?.(gym);
  };

  return (
    <div className="space-y-3">
      {gyms.length > 6 ? (
        <Input
          type="search"
          aria-label={t.gyms.search}
          placeholder={t.gyms.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}
      {filtered.length === 0 && !adding ? <p className="text-sm text-ink-2">{t.gyms.none}</p> : null}
      <ul className="space-y-2">
        {filtered.map((g) => {
          const isSelected = mode === "multi" && selected.includes(g.id);
          return (
            <li key={g.id}>
              <button
                type="button"
                disabled={pending}
                aria-pressed={mode === "multi" ? isSelected : undefined}
                onClick={() => (mode === "pick" ? onPick?.(g) : onToggle?.(g))}
                className={cn(
                  "flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left",
                  isSelected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{g.name}</span>
                  <span className="block text-xs text-ink-3">
                    {t.brands[g.brand]}
                    {g.city ? ` · ${g.city}` : ""} · {t.grades.systems[g.grading_system]}
                  </span>
                </span>
                {mode === "multi" ? (
                  <span aria-hidden className={cn("text-xl", isSelected ? "text-accent" : "text-ink-3")}>
                    {isSelected ? "✓" : "+"}
                  </span>
                ) : favouriteIds.includes(g.id) ? (
                  <span aria-hidden className="text-accent">★</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <NewGymForm onCreated={onCreated} onCancel={() => setAdding(false)} />
      ) : (
        <Button type="button" variant="secondary" className="w-full" onClick={() => setAdding(true)}>
          + {t.gyms.add}
        </Button>
      )}
    </div>
  );
}

function NewGymForm({ onCreated, onCancel }: { onCreated: (g: Gym) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [brand, setBrand] = useState<GymBrand>("ARKOSE");
  const systems = allowedSystemsForBrand(brand);
  const [system, setSystem] = useState<GradeSystem>(systems[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3 rounded-2xl border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await createGym({
            name: String(fd.get("name") ?? ""),
            brand,
            city: String(fd.get("city") ?? ""),
            gradingSystem: system,
          });
          if (res.ok && res.data) onCreated(res.data);
          else setError(res.ok ? null : res.error === "duplicate" ? t.gyms.duplicate : t.common.unknownError);
        });
      }}
    >
      <h3 className="font-bold">{t.gyms.addTitle}</h3>
      <div>
        <Label htmlFor="gym-brand">{t.gyms.network}</Label>
        <Select
          id="gym-brand"
          value={brand}
          onChange={(e) => {
            const b = e.target.value as GymBrand;
            setBrand(b);
            setSystem(allowedSystemsForBrand(b)[0]);
          }}
        >
          {GYM_BRANDS.map((b) => (
            <option key={b} value={b}>
              {t.brands[b]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="gym-name">{t.gyms.name}</Label>
        <Input id="gym-name" name="name" required minLength={2} maxLength={120} placeholder={t.gyms.namePlaceholder} />
      </div>
      <div>
        <Label htmlFor="gym-city" hint={t.common.optional}>
          {t.gyms.city}
        </Label>
        <Input id="gym-city" name="city" maxLength={120} />
      </div>
      <div>
        <Label htmlFor="gym-system">{t.gyms.grading}</Label>
        {systems.length === 1 ? (
          <p id="gym-system" className="text-sm text-ink-2">
            {t.grades.systems[systems[0]]} — {t.gyms.gradingLocked}
          </p>
        ) : (
          <Select id="gym-system" value={system} onChange={(e) => setSystem(e.target.value as GradeSystem)}>
            {systems.map((s) => (
              <option key={s} value={s}>
                {t.grades.systems[s]}
              </option>
            ))}
          </Select>
        )}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? t.common.saving : t.common.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
