import type { GradeSystem } from "@/lib/climbing/types";
import { getGradeDefinition, isMysteryGrade, isNumericSystem } from "@/lib/grading";
import { gradeLabel } from "@/lib/grading/labels";
import { ChipFontRange } from "@/components/climbing/grade-ranges";
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
  showFont = false,
}: {
  t: Dictionary;
  system: GradeSystem;
  grade: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Also show the indicative Font range (the climber's correspondence, as in Progrès). */
  showFont?: boolean;
}) {
  const def = getGradeDefinition(system, grade);
  const label = gradeLabel(t, system, grade);
  const mystery = isMysteryGrade(system, grade);
  const dims = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5", xl: "h-5 w-5" }[size];
  // xl: a project card title, same type as the route grades (text-lg, black weight).
  const text = { sm: "text-xs font-bold tracking-[0.12em]", md: "text-sm font-bold tracking-[0.12em]", lg: "text-base font-bold tracking-[0.12em]", xl: "text-lg font-black tabular-nums" }[size];
  return (
    <span
      className={cn(
        // align-middle: an inline chip whose first child is the (empty) swatch would
        // otherwise sit on the swatch's baseline, a few pixels above the text around it.
        "inline-flex items-center gap-1.5 align-middle leading-none",
        // Font grades are case-sensitive (4b ≠ 4B-style notation) and numbered levels
        // read as written ("B7", "Niv. 7"): only colour names are upper-cased.
        system !== "FONT" && !isNumericSystem(system) && "uppercase",
        text,
        className,
      )}
    >
      {def?.swatch ? (
        <span
          aria-hidden
          className={cn(dims, "inline-block shrink-0 rounded-full ring-1 ring-black/20 dark:ring-white/25")}
          style={{ backgroundColor: def.swatch }}
        />
      ) : null}
      <span>{label}</span>
      {mystery ? <span className="font-medium normal-case text-ink-3">({t.grades.mystery})</span> : null}
      {showFont ? <ChipFontRange system={system} grade={grade} titles={t.grades.rangeSource} /> : null}
    </span>
  );
}
