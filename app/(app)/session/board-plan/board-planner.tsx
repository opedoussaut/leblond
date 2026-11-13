"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { AngleStepper } from "@/components/climbing/board-start";
import { buttonClass, iconButtonClass, segmentClass, segmentGroupClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { startBoardSession } from "@/lib/actions/boards";
import type { BoardAscentFact } from "@/lib/analytics/boards";
import {
  COOL_DOWN_MINUTES, MINUTES_PER_CLIMB, PLAN_FORMATS, PLAN_MINUTES, buildBoardPlan, encodePlan, type PlanBlock, type PlanFormat, type PlanSlot,
} from "@/lib/analytics/board-plan";
import { BOARD_LAYOUTS, BOARD_SHORT, BOARDS, clampAngle, type Board, type BoardResult } from "@/lib/climbing/boards";
import { boulderGrade } from "@/lib/grading/display";
import { fmt } from "@/lib/i18n";
import { boardsDictionary } from "@/lib/i18n/boards";

/** A Font climb from the climber's board log, as sent to the page. */
export type PlannerClimb = { board: string; angle: number; key: string; name: string; grade: string; result: string; tries: number; at: string };
type Project = { board: string; angle: number; climbName: string; climbKey: string; grade: string; gradeScale: string };

/** Consecutive slots of the same block (and 4×4 round) shown together. */
function groups(slots: PlanSlot[]): { block: PlanBlock; round?: number; slots: PlanSlot[] }[] {
  const out: { block: PlanBlock; round?: number; slots: PlanSlot[] }[] = [];
  for (const s of slots) {
    const last = out.at(-1);
    if (last && last.block === s.block && last.round === s.round) last.slots.push(s);
    else out.push({ block: s.block, round: s.round, slots: [s] });
  }
  return out;
}

export function BoardPlanner({ climbs, projects, target, avatarLine, initialBoard, initialAngle, initialMinutes, initialFormat, programmeTitle }: {
  climbs: PlannerClimb[]; projects: Project[]; target: string;
  avatarLine: { colour: string; climbs: number; needClimbs: number; sessions: number; needSessions: number } | null;
  initialBoard: Board; initialAngle: number; initialMinutes: number; initialFormat: PlanFormat; programmeTitle: string | null;
}) {
  const { locale } = useI18n();
  const t = boardsDictionary(locale).plan;
  const router = useRouter();
  const [board, setBoard] = useState<Board>(initialBoard);
  const [angle, setAngle] = useState(clampAngle(initialBoard, initialAngle));
  const [minutes, setMinutes] = useState(Math.max(PLAN_MINUTES.min, Math.min(PLAN_MINUTES.max, Math.round(initialMinutes / PLAN_MINUTES.step) * PLAN_MINUTES.step)));
  const [format, setFormat] = useState<PlanFormat>(initialFormat);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const history = useMemo<BoardAscentFact[]>(() => climbs.map((c, i) => ({
    id: String(i), sessionId: "", board: c.board as Board, climbKey: c.key, climbName: c.name, angle: c.angle, grade: c.grade,
    gradeScale: "FONT", tries: c.tries, result: c.result as BoardResult, isBenchmark: false, climbedAt: new Date(c.at),
  })), [climbs]);
  const plan = useMemo(() => buildBoardPlan({ board, angle, minutes, format, target, history, projects }), [board, angle, minutes, format, target, history, projects]);

  function pickBoard(next: Board) {
    setBoard(next);
    setAngle((a) => clampAngle(next, a));
  }

  function begin() {
    setError(false);
    start(async () => {
      const r = await startBoardSession({ board, layout: BOARD_LAYOUTS[board][0] ?? "", angle, gymId: null, past: null });
      if (r.ok && r.data) router.push(`/session/${r.data.sessionId}?plan=${encodePlan(plan)}`); else setError(true);
    });
  }

  return <div className="space-y-6">
    <section aria-labelledby="plan-setup" className="leblond-premium-surface space-y-5 p-5 sm:p-6">
      <h2 id="plan-setup" className="sr-only">{t.title}</h2>
      <fieldset>
        <legend className="text-sm font-semibold">{t.board}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {BOARDS.map((x) => <button key={x} type="button" aria-pressed={board === x} onClick={() => pickBoard(x)}
            className={buttonClass(board === x ? "primary" : "secondary", "sm")}>{BOARD_SHORT[x]}</button>)}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-x-10 gap-y-5">
        <fieldset>
          <legend className="text-sm font-semibold">{boardsDictionary(locale).angle}</legend>
          <div className="mt-2"><AngleStepper board={board} angle={angle} onChange={setAngle} /></div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold">{t.minutes}</legend>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" aria-label={`−${PLAN_MINUTES.step} min`} disabled={minutes <= PLAN_MINUTES.min}
              onClick={() => setMinutes((m) => Math.max(PLAN_MINUTES.min, m - PLAN_MINUTES.step))} className={iconButtonClass()}><Minus aria-hidden="true" className="size-5" /></button>
            <output aria-live="polite" className="min-w-20 text-center font-display text-2xl font-black tabular-nums" data-testid="plan-minutes">{fmt(t.minutesValue, { n: minutes })}</output>
            <button type="button" aria-label={`+${PLAN_MINUTES.step} min`} disabled={minutes >= PLAN_MINUTES.max}
              onClick={() => setMinutes((m) => Math.min(PLAN_MINUTES.max, m + PLAN_MINUTES.step))} className={iconButtonClass()}><Plus aria-hidden="true" className="size-5" /></button>
          </div>
        </fieldset>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">{t.format}</legend>
        <div className={cn(segmentGroupClass, "mt-2 grid-cols-2 sm:grid-cols-4")}>
          {PLAN_FORMATS.map((f) => <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)} className={segmentClass(format === f)}>{t.formats[f]}</button>)}
        </div>
        <p className="mt-2 text-xs text-ink-2">{t.formatHints[format]}</p>
        {programmeTitle && format === initialFormat ? <p className="mt-1 text-xs text-ink-3">{fmt(t.fromProgramme, { title: programmeTitle })}</p> : null}
      </fieldset>
    </section>

    <section aria-labelledby="plan-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="plan-heading" className="text-lg font-bold" data-testid="plan-target">{fmt(t.target, { grade: boulderGrade(plan.target) })}</h2>
        <p className="text-sm text-ink-2">{avatarLine ? fmt(t.avatarNext, { ...avatarLine, grade: boulderGrade(plan.target) }) : fmt(t.avatarTop, { grade: boulderGrade(plan.target) })}</p>
      </div>
      <ol className="space-y-3" data-testid="plan-slots">
        {groups(plan.slots).map((g, gi) => <li key={gi} className="rounded-2xl border border-line bg-surface p-4">
          <p className="flex flex-wrap items-baseline justify-between gap-2">
            <strong className="text-sm">{t.blocks[g.block]}{g.round ? " · " + fmt(t.round, { n: g.round }) : ""}</strong>
            <span className="text-xs text-ink-3">{fmt(t.perClimb, { n: MINUTES_PER_CLIMB[g.block] })}</span>
          </p>
          <ul className="mt-2 space-y-1.5">
            {g.slots.map((s, si) => <li key={si} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 rounded-lg bg-surface-2 py-1 text-center font-display font-black tabular-nums">{boulderGrade(s.grade)}</span>
              {s.suggestion
                ? <span className="min-w-0"><strong className="block truncate">{s.suggestion.name}</strong><span className="text-xs text-ink-3">{t.why[s.suggestion.why]}</span></span>
                : <span className="text-xs text-ink-2">{fmt(t.pickHint, { grade: boulderGrade(s.grade), angle, board: BOARD_SHORT[board] })}</span>}
            </li>)}
          </ul>
        </li>)}
        <li className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-2">{fmt(t.coolDown, { n: COOL_DOWN_MINUTES })}</li>
      </ol>
      <p className="text-xs text-ink-3">{fmt(t.planned, { n: plan.planned, total: plan.minutes })} · {t.noNames}</p>
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{t.error}</p> : null}
      <button type="button" disabled={pending} onClick={begin} className={buttonClass("primary", "xl", "w-full")}>{t.start}</button>
    </section>
  </div>;
}
