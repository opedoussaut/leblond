"use client";

import { useMemo, useState, useTransition } from "react";
import { CircuitTag, circuitColorName } from "@/components/climbing/outdoor";
import { useI18n } from "@/components/i18n-provider";
import { Button, toggleClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Input, Label, Select } from "@/components/ui/field";
import { deleteTopoProblem, saveTopoProblem, type TopoProblemRow } from "@/lib/actions/team-topo";
import { compareGrades } from "@/lib/grading";
import { FONT_SCALE, type FontGrade } from "@/lib/grading/systems";
import { fmt } from "@/lib/i18n";
import { topoEditorDictionary, type TopoEditorError } from "@/lib/i18n/topo-editor";
import { CIRCUIT_COLORS, searchable, type CircuitColor } from "@/lib/integrations/outdoor/boolder";

const STEEPNESS = ["", "slab", "wall", "overhang", "roof", "traverse", "other"] as const;
type Steepness = (typeof STEEPNESS)[number];

/** Circuit first (by colour, then number), off-circuit boulders after, by name. */
function byCircuit(a: TopoProblemRow, b: TopoProblemRow) {
  if (!!a.circuit_color !== !!b.circuit_color) return a.circuit_color ? -1 : 1;
  if (a.circuit_color && b.circuit_color && a.circuit_color !== b.circuit_color) return a.circuit_color.localeCompare(b.circuit_color);
  const na = parseInt(a.circuit_number ?? "", 10), nb = parseInt(b.circuit_number ?? "", 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return (a.circuit_number ?? a.name).localeCompare(b.circuit_number ?? b.name, "fr");
}

export function TopoEditor({ gymId, initial, logged }: { gymId: string; initial: TopoProblemRow[]; logged: Record<number, number> }) {
  const { t, locale } = useI18n();
  const e = topoEditorDictionary(locale);
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [circuit, setCircuit] = useState<string>("all");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const colors = useMemo(() => [...new Set(rows.map((r) => r.circuit_color).filter((c): c is CircuitColor => !!c))].sort(), [rows]);
  const shown = useMemo(() => {
    const q = searchable(query);
    return rows
      .filter((r) => circuit === "all" || (circuit === "none" ? !r.circuit_color : r.circuit_color === circuit))
      .filter((r) => !q || searchable(r.name).includes(q) || (r.circuit_number ?? "") === q.replace(/\s/g, ""))
      .sort(byCircuit);
  }, [rows, query, circuit]);

  const onSaved = (row: TopoProblemRow, isNew: boolean) => {
    setRows((list) => (isNew ? [...list, row] : list.map((r) => (r.id === row.id ? row : r))));
    setEditing(null);
    setStatus({ tone: "ok", text: isNew ? e.added : e.saved });
  };
  const onDeleted = (id: number) => {
    setRows((list) => list.filter((r) => r.id !== id));
    setEditing(null);
    setStatus({ tone: "ok", text: e.deleted });
  };

  return (
    <div className="space-y-3">
      <p aria-live="polite" className={cn("min-h-5 text-sm font-semibold", status?.tone === "error" ? "text-danger" : "text-ink-2")}>{status?.text}</p>
      {editing === "new" ? (
        <ProblemForm gymId={gymId} row={null} onSaved={(r) => onSaved(r, true)} onCancel={() => setEditing(null)} />
      ) : (
        <Button variant="secondary" onClick={() => setEditing("new")}>{e.add}</Button>
      )}
      <Input type="search" aria-label={e.search} placeholder={e.search} value={query} onChange={(ev) => setQuery(ev.target.value)} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={e.circuit}>
        {["all", ...colors, "none"].map((c) => (
          <button key={c} type="button" aria-pressed={circuit === c} onClick={() => setCircuit(c)}
            className={toggleClass(circuit === c)}>
            {c === "all" ? e.allCircuits : c === "none" ? e.offCircuit : circuitColorName(t, c)}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-3">{fmt(e.count, { shown: shown.length, total: rows.length })}</p>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {shown.map((r) => (
          <li key={r.id} className="p-3">
            {editing === r.id ? (
              <ProblemForm gymId={gymId} row={r} logged={logged[r.id] ?? 0}
                onSaved={(row) => onSaved(row, false)} onDeleted={() => onDeleted(r.id)} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex items-center gap-3">
                <CircuitTag color={r.circuit_color} number={r.circuit_number} inTopo />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="block text-xs text-ink-3">
                    {r.latitude === null ? e.noPosition : ""}
                    {logged[r.id] ? `${r.latitude === null ? " · " : ""}${fmt(e.logged, { n: logged[r.id] })}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-black tabular-nums">{r.grade}</span>
                <Button size="sm" variant="ghost" aria-label={`${e.edit} ${r.name}`} onClick={() => { setEditing(r.id); setStatus(null); }}>{e.edit}</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProblemForm({ gymId, row, logged = 0, onSaved, onDeleted, onCancel }: {
  gymId: string;
  row: TopoProblemRow | null;
  logged?: number;
  onSaved: (row: TopoProblemRow) => void;
  onDeleted?: () => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const e = topoEditorDictionary(locale);
  const [name, setName] = useState(row?.name ?? "");
  const [grade, setGrade] = useState<FontGrade>(row?.grade ?? "5a");
  const [color, setColor] = useState<CircuitColor | "">(row?.circuit_color ?? "");
  const [number, setNumber] = useState(row?.circuit_number ?? "");
  const [steepness, setSteepness] = useState<Steepness>(() => {
    const s = row?.steepness ?? "";
    return (STEEPNESS as readonly string[]).includes(s) ? (s as Steepness) : "";
  });
  const [sitStart, setSitStart] = useState(row?.sit_start ?? false);
  const [lat, setLat] = useState(row?.latitude?.toString() ?? "");
  const [lon, setLon] = useState(row?.longitude?.toString() ?? "");
  const [error, setError] = useState<TopoEditorError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const grades = useMemo(() => [...FONT_SCALE].sort((a, b) => compareGrades("FONT", a, b) ?? 0), []);
  const idp = `topo-${row?.id ?? "new"}`;
  const toNumber = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  function save() {
    setError(null);
    const latitude = toNumber(lat), longitude = toNumber(lon);
    if ((latitude !== null && Number.isNaN(latitude)) || (longitude !== null && Number.isNaN(longitude))) return setError("position");
    start(async () => {
      const res = await saveTopoProblem({
        gymId, id: row?.id ?? null, name, grade, circuitColor: color || null,
        circuitNumber: color ? number.trim() || null : null, steepness, sitStart, latitude, longitude,
      });
      if (!res.ok || !res.data) return setError((res.ok ? "failed" : res.error) as TopoEditorError);
      onSaved(res.data);
    });
  }

  function remove() {
    if (!row) return;
    start(async () => {
      const res = await deleteTopoProblem({ gymId, id: row.id });
      if (!res.ok) return setError(res.error as TopoEditorError);
      onDeleted?.();
    });
  }

  return (
    <form aria-label={row ? `${e.edit} ${row.name}` : e.addTitle} className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); save(); }}>
      {row ? null : <p className="font-bold">{e.addTitle}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idp}-name`}>{e.name}</Label>
          <Input id={`${idp}-name`} value={name} maxLength={160} required onChange={(ev) => setName(ev.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${idp}-grade`}>{e.grade}</Label>
          <Select id={`${idp}-grade`} value={grade} onChange={(ev) => setGrade(ev.target.value as FontGrade)}>
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${idp}-circuit`}>{e.circuit}</Label>
          <Select id={`${idp}-circuit`} value={color} onChange={(ev) => setColor(ev.target.value as CircuitColor | "")}>
            <option value="">{e.offCircuit}</option>
            {CIRCUIT_COLORS.map((c) => <option key={c} value={c}>{circuitColorName(t, c)}</option>)}
          </Select>
        </div>
        {color ? (
          <div>
            <Label htmlFor={`${idp}-number`} hint={e.numberHint}>{e.number}</Label>
            <Input id={`${idp}-number`} value={number} maxLength={4} inputMode="text" required onChange={(ev) => setNumber(ev.target.value)} />
          </div>
        ) : null}
        <div>
          <Label htmlFor={`${idp}-steep`}>{e.steepness}</Label>
          <Select id={`${idp}-steep`} value={steepness} onChange={(ev) => setSteepness(ev.target.value as Steepness)}>
            {STEEPNESS.map((s) => <option key={s} value={s}>{s ? (t.outdoor.steepness as Record<string, string>)[s] : e.none}</option>)}
          </Select>
        </div>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold">
          <input type="checkbox" checked={sitStart} onChange={(ev) => setSitStart(ev.target.checked)} className="h-5 w-5 accent-accent" />
          {e.sitStart}
        </label>
        <div>
          <Label htmlFor={`${idp}-lat`}>{e.latitude}</Label>
          <Input id={`${idp}-lat`} value={lat} inputMode="decimal" onChange={(ev) => setLat(ev.target.value)} />
        </div>
        <div>
          <Label htmlFor={`${idp}-lon`}>{e.longitude}</Label>
          <Input id={`${idp}-lon`} value={lon} inputMode="decimal" onChange={(ev) => setLon(ev.target.value)} />
        </div>
      </div>
      <p className="text-xs text-ink-3">{e.positionHint}</p>
      {error ? <Notice tone="error">{e.errors[error]}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{e.save}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{e.cancel}</Button>
        {row && !confirmDelete ? (
          <Button type="button" variant="ghost" className="ml-auto text-danger" onClick={() => setConfirmDelete(true)}>{e.delete}</Button>
        ) : null}
      </div>
      {row && confirmDelete ? (
        <div role="alertdialog" aria-labelledby={`${idp}-del`} className="space-y-2 rounded-xl border border-danger p-3">
          <p id={`${idp}-del`} className="text-sm font-semibold">{fmt(e.deleteTitle, { name: row.name })}</p>
          <p className="text-sm text-ink-2">{logged > 0 ? fmt(e.deleteLinked, { n: logged }) : e.deleteUnlinked}</p>
          <div className="flex gap-2">
            <Button type="button" variant="danger" disabled={pending} onClick={remove}>{e.delete}</Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>{e.cancel}</Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
