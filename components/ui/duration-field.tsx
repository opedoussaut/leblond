"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { durationProblem, hourChoices, joinDuration, minuteChoices, splitMinutes } from "@/lib/duration";
import { cn } from "./cn";
import { Select } from "./field";

/**
 * Hours + minutes picker for a duration stored in minutes. Two selects, no
 * typing. `value` null means "not set" (only offered when `optional`).
 */
export function DurationField({ label, value, onChange, min = 0, max = 1440, step = 5, optional = false, className }: {
  label: string;
  value: number | null;
  onChange: (minutes: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  optional?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const minutesRef = useRef<HTMLSelectElement>(null);
  const parts = value == null ? null : splitMinutes(value);
  const problem = value == null ? null : durationProblem(value, min, max);

  // Native validation blocks the submit and names the problem on the field.
  useEffect(() => {
    minutesRef.current?.setCustomValidity(
      problem === "tooShort" ? fmt(t.common.durationTooShort, { n: min })
        : problem === "tooLong" ? fmt(t.common.durationTooLong, { n: max }) : "",
    );
  }, [problem, min, max, t]);

  function set(part: "hours" | "minutes", raw: string) {
    if (raw === "") { onChange(null); return; }
    const n = Number(raw);
    const hours = part === "hours" ? n : parts?.hours ?? 0;
    const minutes = part === "minutes" ? n : parts?.minutes ?? 0;
    onChange(joinDuration(hours, minutes));
  }

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1.5">
          <Select aria-label={t.common.hours} required={!optional}
            value={parts ? String(parts.hours) : ""} onChange={(e) => set("hours", e.target.value)}>
            {optional ? <option value="">{t.common.none}</option> : null}
            {hourChoices(max).map((h) => <option key={h} value={h}>{h}</option>)}
          </Select>
          <span aria-hidden="true" className="text-sm font-semibold text-ink-2">h</span>
        </label>
        <label className="flex items-center gap-1.5">
          <Select ref={minutesRef} aria-label={t.common.minutes} required={!optional}
            value={parts ? String(parts.minutes) : ""} onChange={(e) => set("minutes", e.target.value)}>
            {optional ? <option value="">{t.common.none}</option> : null}
            {minuteChoices(step, parts?.minutes).map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
          </Select>
          <span aria-hidden="true" className="text-sm font-semibold text-ink-2">min</span>
        </label>
      </div>
      {problem ? <p className="mt-1 text-xs font-semibold text-danger">
        {problem === "tooShort" ? fmt(t.common.durationTooShort, { n: min }) : fmt(t.common.durationTooLong, { n: max })}
      </p> : null}
    </fieldset>
  );
}
