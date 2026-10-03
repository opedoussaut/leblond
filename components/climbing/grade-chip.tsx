import type { GradeSystem } from "@/lib/climbing/types";
import { getGradeDefinition, isMysteryGrade } from "@/lib/grading";
import { gradeLabel } from "@/lib/grading/labels";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/components/ui/cn";

/**
 * A grade is ALWAYS shown as text; the swatch is decorative support only
 * (accessibility: grade never conveyed by colour alone).
 */
export function GradeChip({
  t,
  system,
  grade,
  size = "md",
  className,
}: {
  t: Dictionary;
  system: GradeSystem;
  grade: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const def = getGradeDefinition(system, grade);
  const label = gradeLabel(t, system, grade);
  const mystery = isMysteryGrade(system, grade);
  const dims = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" }[size];
  const text = { sm: "text-xs", md: "text-sm", lg: "text-base" }[size];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-bold uppercase tracking-wide", text, className)}>
      {def?.swatch ? (
        <span
          aria-hidden
          className={cn(dims, "inline-block shrink-0 rounded-full ring-1 ring-black/20 dark:ring-white/25")}
          style={{ backgroundColor: def.swatch }}
        />
      ) : null}
      <span>{label}</span>
      {mystery ? <span className="font-medium normal-case text-ink-3">({t.grades.mystery})</span> : null}
    </span>
  );
}
