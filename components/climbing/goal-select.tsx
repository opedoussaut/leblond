"use client";

import { GradeSelect } from "@/components/climbing/grade-select";
import { RouteGradeSelect } from "@/components/climbing/route-grade-select";
import type { GradeSystem } from "@/lib/climbing/types";
import { includesBoulder, includesRoute, type TargetDiscipline } from "@/lib/climbing/goals";

type Labels = {
  discipline: string;
  boulder: string;
  route: string;
  both: string;
  boulderTarget: string;
  routeTarget: string;
  selectRouteGrade: string;
};

export function GoalSelect({
  idPrefix, discipline, onDisciplineChange,
  boulderSystem, boulderGrade, onBoulderChange,
  routeGrade, onRouteChange, labels, named = false,
}: {
  idPrefix: string;
  discipline: TargetDiscipline;
  onDisciplineChange: (d: TargetDiscipline) => void;
  boulderSystem: GradeSystem;
  boulderGrade: string;
  onBoulderChange: (system: GradeSystem, grade: string) => void;
  routeGrade: string;
  onRouteChange: (grade: string) => void;
  labels: Labels;
  /** When in an HTML form, submit both preserved target values even if hidden. */
  named?: boolean;
}) {
  const options = [
    { id: "BOULDER", label: labels.boulder, symbol: "◧" },
    { id: "ROUTE", label: labels.route, symbol: "↗" },
    { id: "BOTH", label: labels.both, symbol: "◈" },
  ] as const;
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-3 text-sm font-bold">{labels.discipline}</legend>
        <div className="grid grid-cols-3 gap-2">
          {options.map((option) => {
            const active = option.id === discipline;
            return (
              <label key={option.id} className={[
                "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center",
                "transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
                active ? "border-accent bg-accent-soft text-ink shadow-sm" : "border-line bg-surface text-ink-2 hover:border-accent",
              ].join(" ")}>
                <input className="sr-only" type="radio" name={named ? "targetDiscipline" : idPrefix + "-discipline"}
                  checked={active} value={option.id} onChange={() => onDisciplineChange(option.id)}/>
                <span className="text-xl text-accent" aria-hidden="true">{option.symbol}</span>
                <span className="text-xs font-bold sm:text-sm">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {includesBoulder(discipline) ? (
        <fieldset className="rounded-2xl border border-line bg-surface p-4">
          <legend className="px-2 font-bold">{labels.boulderTarget}</legend>
          <GradeSelect idPrefix={idPrefix + "-boulder"}
            system={boulderSystem} grade={boulderGrade}
            systemName={named ? "targetSystem" : undefined}
            gradeName={named ? "targetGrade" : undefined}
            onChange={onBoulderChange}/>
        </fieldset>
      ) : named ? (
        <>
          <input type="hidden" name="targetSystem" value={boulderSystem}/>
          <input type="hidden" name="targetGrade" value={boulderGrade}/>
        </>
      ) : null}
      {includesRoute(discipline) ? (
        <fieldset className="rounded-2xl border border-line bg-surface p-4">
          <legend className="px-2 font-bold">{labels.routeTarget}</legend>
          <RouteGradeSelect id={idPrefix + "-route"} grade={routeGrade} onChange={onRouteChange}
            label={labels.routeTarget} emptyLabel={labels.selectRouteGrade}
            name={named ? "targetRouteGrade" : undefined}/>
        </fieldset>
      ) : named ? (
        <input type="hidden" name="targetRouteGrade" value={routeGrade}/>
      ) : null}
    </div>
  );
}
