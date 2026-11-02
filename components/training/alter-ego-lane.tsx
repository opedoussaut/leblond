import { positionAt, timelineSeconds, type Phase } from "@/lib/analytics/alter-ego";
import { fmt, type Locale } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { formatClock } from "@/lib/training/sessions";

/** Margin before the lane calls a leader, so it does not flip with every set. */
const LEAD_MARGIN = 0.05;

/**
 * The ego training through the same session, live. It is driven by the player's
 * own clock, so it pauses with the player and needs no network.
 */
export function AlterEgoLane({ locale, name, phases, exerciseNames, elapsed, youFraction, easeOff }: {
  locale: Locale; name: string; phases: Phase[]; exerciseNames: string[];
  elapsed: number; youFraction: number; easeOff: boolean;
}) {
  const t = alterEgoDictionary(locale);
  const s = trainingSessionDictionary(locale);
  if (!timelineSeconds(phases)) return null;
  const at = positionAt(phases, elapsed);
  const phase = at.phase;
  const lead = youFraction - at.fraction;
  const verdict = lead > LEAD_MARGIN ? t.laneYouAhead : lead < -LEAD_MARGIN ? fmt(t.laneEgoAhead, { name }) : t.laneLevel;
  const doing = !phase ? t.laneDone
    : phase.kind === "REST" ? fmt(t.laneRest, { time: formatClock(at.remaining) })
    : [exerciseNames[phase.exercise], `${s.set} ${phase.set}/${phase.sets}`,
      phase.reps === null ? formatClock(at.remaining) : fmt(t.laneReps, { done: at.repsDone ?? 0, total: phase.reps })].join(" · ");
  return <div aria-label={fmt(t.laneLabel, { name })} role="group" className="mt-2 rounded-xl bg-surface-2 px-3 py-2">
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <strong className="truncate">{name}</strong>
      {easeOff ? null : <span className="shrink-0 font-semibold text-ink-2">{verdict}</span>}
    </div>
    <p className="mt-0.5 truncate text-xs tabular-nums text-ink-2">{doing}</p>
    <div className="mt-1.5 grid grid-cols-[minmax(0,5rem)_1fr] items-center gap-x-2 gap-y-1 text-xs text-ink-2" aria-hidden="true">
      <span className="truncate">{t.you}</span>
      <div className="h-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(youFraction * 100)}%` }} /></div>
      <span className="truncate">{name}</span>
      <div className="h-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-ink-3" style={{ width: `${Math.round(at.fraction * 100)}%` }} /></div>
    </div>
  </div>;
}
