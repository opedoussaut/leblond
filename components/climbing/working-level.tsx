import { GradeChip } from "@/components/climbing/grade-chip";
import type { WorkingLevelResult } from "@/lib/analytics";
import type { GradeSystem } from "@/lib/climbing/types";
import { nextGrade } from "@/lib/grading";
import type { Dictionary } from "@/lib/i18n";

/** "RED / BLACK transition": working level, plus the next level when it is being explored. */
export function WorkingLevelLine({ t, result }: { t: Dictionary; result: WorkingLevelResult }) {
  if (result.system === "FONT_NORMALIZED") return null;
  const system = result.system as GradeSystem;
  if (!result.level) return <span className="text-sm text-ink-3">{t.home.notEnough}</span>;
  const next = nextGrade(system, result.level);
  const exploring = next ? result.levels.find((l) => l.grade === next && l.sends > 0) : undefined;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <GradeChip t={t} system={system} grade={result.level} />
      {exploring ? (
        <>
          <span className="text-ink-3">/</span>
          <GradeChip t={t} system={system} grade={exploring.grade} />
        </>
      ) : null}
    </span>
  );
}
