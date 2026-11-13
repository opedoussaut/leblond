"use client";

import { useEffect, useRef } from "react";
import { positionAt, timelineSeconds, type Phase } from "@/lib/analytics/alter-ego";
import { raceMargin, type RivalPortrait as RivalPortraitId } from "@/lib/analytics/rival";
import { rivalDictionary } from "@/lib/i18n/rival";
import { scheduleBeeps } from "@/lib/training/beeper";
import { RivalPortrait } from "./rival-portrait";
import { AvatarPortrait } from "./avatar-portrait";
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
export function AlterEgoLane({ locale, name, phases, exerciseNames, elapsed, youFraction, portrait, avatar }: {
  locale: Locale; name: string; phases: Phase[]; exerciseNames: string[];
  elapsed: number; youFraction: number; portrait?: RivalPortraitId; avatar?: number;
}) {
  const t = alterEgoDictionary(locale);
  const s = trainingSessionDictionary(locale);
  const r = rivalDictionary(locale);
  const total = timelineSeconds(phases);
  const at = positionAt(phases, elapsed);
  const phase = at.phase;
  const lead = youFraction - at.fraction;
  const leader = lead > LEAD_MARGIN ? "you" : lead < -LEAD_MARGIN ? "ego" : "level";
  const verdict = leader === "you" ? t.laneYouAhead : leader === "ego" ? fmt(t.laneEgoAhead, { name }) : t.laneLevel;

  // Its own sound when it passes you. Set ends stay
  // silent so they are never mistaken for the player's own timer beeps.
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = leader;
    if (before === null || !total) return;
    if (leader === "ego" && before !== "ego") scheduleBeeps([{ at: Date.now(), tone: "rival" }]);
  }, [leader, total]);

  if (!total) return null;
  const finished = youFraction >= 1;
  const margin = raceMargin(total, elapsed);
  const doing = !phase ? t.laneDone
    : phase.kind === "REST" ? fmt(t.laneRest, { time: formatClock(at.remaining) })
    : [exerciseNames[phase.exercise], `${s.set} ${phase.set}/${phase.sets}`,
      phase.reps === null ? formatClock(at.remaining) : fmt(t.laneReps, { done: at.repsDone ?? 0, total: phase.reps })].join(" · ");
  return <div aria-label={fmt(t.laneLabel, { name })} role="group" className="mt-2 rounded-xl bg-surface-2 px-3 py-2">
    <div className="flex items-center justify-between gap-3 text-xs">
      <strong className="flex min-w-0 items-center gap-2 truncate">{portrait ? <RivalPortrait portrait={portrait} size={28} /> : null}{name}</strong>
      <span className="shrink-0 font-semibold text-ink-2">{verdict}</span>
    </div>
    {finished ? <p role="status" className="mt-1 text-sm font-bold">
      {margin >= 0 ? fmt(r.laneBeat, { name, d: formatClock(margin) }) : fmt(r.laneLost, { name, d: formatClock(-margin) })}
    </p> : null}
    <p className="mt-0.5 truncate text-xs tabular-nums text-ink-2">{doing}</p>
    <div className="mt-1.5 grid grid-cols-[minmax(0,5rem)_1fr] items-center gap-x-2 gap-y-1 text-xs text-ink-2" aria-hidden="true">
      <span className="flex min-w-0 items-center gap-1.5 truncate">{avatar !== undefined ? <AvatarPortrait level={avatar} size={16} /> : null}{t.you}</span>
      <div className="h-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(youFraction * 100)}%` }} /></div>
      <span className="truncate">{name}</span>
      <div className="h-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-ink-3" style={{ width: `${Math.round(at.fraction * 100)}%` }} /></div>
    </div>
  </div>;
}
