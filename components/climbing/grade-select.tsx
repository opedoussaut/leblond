"use client";

import { useI18n } from "@/components/i18n-provider";
import { Label, Select } from "@/components/ui/field";
import type { GradeSystem } from "@/lib/climbing/types";
import { listGrades } from "@/lib/grading";
import { gradeLabel } from "@/lib/grading/labels";

/** Systems that can express a level or target (ordered scales only). */
export const TARGET_SYSTEMS: GradeSystem[] = ["FONT", "ARKOSE_COLOR", "CLIMBING_DISTRICT_COLOR"];

export function orderedGrades(system: GradeSystem) {
  return listGrades(system).filter((g) => g.ordinal !== null);
}

/** System + grade pair of selects, limited to ordered grades. */
export function GradeSelect({
  idPrefix,
  system,
  grade,
  onChange,
  allowEmpty,
  emptyLabel,
  systemName,
  gradeName,
}: {
  idPrefix: string;
  system: GradeSystem;
  grade: string;
  onChange: (system: GradeSystem, grade: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  systemName?: string;
  gradeName?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor={`${idPrefix}-system`}>{t.onboarding.levelSystem}</Label>
        <Select
          id={`${idPrefix}-system`}
          name={systemName}
          value={system}
          onChange={(e) => {
            const s = e.target.value as GradeSystem;
            const grades = orderedGrades(s);
            onChange(s, allowEmpty ? "" : (grades[Math.floor(grades.length / 2)]?.id ?? ""));
          }}
        >
          {TARGET_SYSTEMS.map((s) => (
            <option key={s} value={s}>
              {t.grades.systems[s]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-grade`}>{t.onboarding.levelGrade}</Label>
        <Select
          id={`${idPrefix}-grade`}
          name={gradeName}
          value={grade}
          onChange={(e) => onChange(system, e.target.value)}
        >
          {allowEmpty ? <option value="">{emptyLabel}</option> : null}
          {orderedGrades(system).map((g) => (
            <option key={g.id} value={g.id}>
              {gradeLabel(t, system, g.id)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
