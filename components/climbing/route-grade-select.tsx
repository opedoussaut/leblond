"use client";

import { Label, Select } from "@/components/ui/field";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";

export function RouteGradeSelect({
  id, grade, onChange, emptyLabel, label, name,
}: {
  id: string;
  grade: string;
  onChange: (grade: string) => void;
  emptyLabel: string;
  label: string;
  name?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} name={name} value={grade} onChange={(e) => onChange(e.target.value)}>
        <option value="">{emptyLabel}</option>
        {FRENCH_ROUTE_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
      </Select>
    </div>
  );
}
