"use client";

import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import type { GradeSystem } from "@/lib/climbing/types";
import { segmentClass, segmentGroupClass } from "@/components/ui/button";

/**
 * The scale new boulders of this session are logged in, when the gym has more
 * than one (Climbing District: levels 1–12, or its former colours). Switching
 * never touches the boulders already logged.
 */
export function ScaleSwitch({
  systems,
  value,
  onChange,
  pending,
}: {
  systems: GradeSystem[];
  value: GradeSystem;
  onChange: (system: GradeSystem) => void;
  pending?: boolean;
}) {
  const { t } = useI18n();
  if (systems.length < 2) return null;
  return (
    <div className="space-y-1.5">
      <div
        role="radiogroup"
        aria-label={t.grades.scale}
        className={cn(segmentGroupClass, systems.length === 2 ? "grid-cols-2" : "grid-cols-3")}
      >
        {systems.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            disabled={pending}
            onClick={() => value !== s && onChange(s)}
            className={segmentClass(value === s, "px-2")}
          >
            {t.grades.scaleShort[s]}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-3">{t.grades.scaleHint}</p>
    </div>
  );
}
