import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { atlasDictionary, diagramFacts, formatDuration } from "@/lib/i18n/atlas";
import {
  continuousSegments, forceTestBars, intervalSegments, ladderMoves, niceTicks, phaseLayout, scale, wrapLabel, zoomSegments,
} from "@/lib/training/atlas-diagram";
import type {
  AnglesDiagram, AtlasDiagram, CameraDiagram, CircuitDiagram, ConstraintMark, ContinuousDiagram, EdgesDiagram,
  ForceTestDiagram, IntervalsDiagram, LadderDiagram, LoopDiagram, PhasesDiagram, RoundsDiagram, SetsDiagram,
  StaircaseDiagram,
} from "@/lib/training/atlas-types";

/**
 * Method-specific Atlas diagrams. Original LEBLOND schematics drawn from the
 * protocol numbers (see lib/training/atlas-diagram.ts). Colours come from the
 * theme tokens only, and every meaning is also carried by a shape, a pattern
 * or a text label, never by colour alone.
 */

const W = 360;
const X0 = 10;
const XW = 340;

type Swatch = "work" | "rest" | "reserve" | "band" | "ceiling" | "left" | "right" | "volume" | "intensity" | "counted";
type Drawing = { height: number; body: ReactNode; legend: { swatch: Swatch; label: string }[] };
type Ctx = { locale: Locale; uid: string; t: ReturnType<typeof atlasDictionary> };

const hatch = (uid: string) => `url(#hatch-${uid})`;
const stripes = (uid: string) => `url(#stripes-${uid})`;
const arrow = (uid: string) => `url(#arrow-${uid})`;

function Defs({ uid }: { uid: string }) {
  return <defs>
    <pattern id={`hatch-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="5" className="stroke-ink-3" strokeWidth="1.6"/>
    </pattern>
    <pattern id={`stripes-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="4" height="4" className="fill-accent"/>
      <line x1="0" y1="0" x2="0" y2="4" className="stroke-surface" strokeWidth="1.4"/>
    </pattern>
    <marker id={`arrow-${uid}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 10 5 0 10Z" className="fill-ink-2"/>
    </marker>
  </defs>;
}

function Label({ x, y, children, size = 10, anchor = "middle", tone = "ink-2", weight }: {
  x: number; y: number; children: ReactNode; size?: number; anchor?: "start" | "middle" | "end";
  tone?: "ink" | "ink-2" | "ink-3" | "accent" | "accent-ink"; weight?: number;
}) {
  const cls = { ink: "fill-ink", "ink-2": "fill-ink-2", "ink-3": "fill-ink-3", accent: "fill-accent", "accent-ink": "fill-accent-ink" }[tone];
  return <text x={x} y={y} fontSize={size} textAnchor={anchor} className={cls} fontWeight={weight}>{children}</text>;
}

function Lines({ x, y, lines, size = 10, anchor = "middle", tone = "ink", weight, lineHeight }: {
  x: number; y: number; lines: string[]; size?: number; anchor?: "start" | "middle" | "end";
  tone?: "ink" | "ink-2" | "ink-3" | "accent-ink"; weight?: number; lineHeight?: number;
}) {
  const lh = lineHeight ?? size * 1.2;
  return <>{lines.map((line, i) => <Label key={i} x={x} y={y + i * lh} size={size} anchor={anchor} tone={tone} weight={weight}>{line}</Label>)}</>;
}

/** Horizontal time axis with nice ticks, in minutes when the span is long. */
function TimeAxis({ total, y, ctx, x0 = X0, width = XW }: { total: number; y: number; ctx: Ctx; x0?: number; width?: number }) {
  const inMinutes = total >= 150;
  const ticks = inMinutes ? niceTicks(total, 7, [60, 120, 180, 300, 600, 900, 1200, 1800, 3600]) : niceTicks(total, 7);
  return <g>
    <line x1={x0} x2={x0 + width} y1={y} y2={y} className="stroke-ink-3" strokeWidth="1"/>
    {ticks.map((v) => {
      const x = scale(v, total, x0, width);
      return <g key={v}>
        <line x1={x} x2={x} y1={y} y2={y + 4} className="stroke-ink-3"/>
        <Label x={x} y={y + 14} size={9}>{inMinutes ? v / 60 : v}</Label>
      </g>;
    })}
    <Label x={x0 + width} y={y + 25} size={9} anchor="end" tone="ink-3">{inMinutes ? ctx.t.d.timeMin : ctx.t.d.timeSec}</Label>
  </g>;
}

/* ── Intervals: max hangs, repeaters, limit attempts ─────────────────────── */
function intervals(spec: IntervalsDiagram, ctx: Ctx): Drawing {
  const { t, locale, uid } = ctx;
  const full = intervalSegments(spec);
  const sx = (v: number) => scale(v, full.total, X0, XW);
  const top = 32, base = 88;
  const setSpans = Array.from({ length: spec.sets }, (_, i) => {
    const inSet = full.segments.filter((s) => s.set === i + 1 && s.type !== "setRest");
    const start = inSet[0].start, end = inSet[inSet.length - 1].start + inSet[inSet.length - 1].duration;
    return { start, end };
  });
  const bracketable = setSpans.every((s) => sx(s.end) - sx(s.start) >= 30);
  const row1 = <g>
    <Label x={X0} y={11} size={10.5} anchor="start" tone="ink" weight={700}>{t.d.session}</Label>
    {setSpans.map((s, i) => {
      const x1 = sx(s.start), x2 = sx(s.end);
      return bracketable
        ? <g key={i}>
          <path d={`M${x1} ${top - 3}v-4H${x2}v4`} fill="none" className="stroke-ink-3"/>
          <Label x={(x1 + x2) / 2} y={top - 10} size={8.5}>{spec.setLabel[locale] + " " + (i + 1)}</Label>
        </g>
        : <Label key={i} x={(x1 + x2) / 2} y={top - 6} size={9} tone="ink">{i + 1}</Label>;
    })}
    {full.segments.map((s, i) => {
      const x = sx(s.start), w = Math.max(1.5, sx(s.start + s.duration) - x);
      if (s.type === "work") return <rect key={i} x={x} y={top} width={w} height={base - top} className="fill-accent"/>;
      const h = s.type === "setRest" ? 14 : 9;
      return <g key={i}>
        <rect x={x} y={base - h} width={w} height={h} fill={hatch(uid)} className="stroke-ink-3" strokeWidth="0.5"/>
        {w >= 26 ? <Label x={x + w / 2} y={base - h - 4} size={9}>{formatDuration(s.duration, locale)}</Label> : null}
      </g>;
    })}
    <TimeAxis total={full.total} y={base + 4} ctx={ctx}/>
  </g>;
  if (!spec.zoom) {
    return { height: 124, body: row1, legend: [{ swatch: "work", label: t.d.legendWork + t.sep + spec.workLabel[locale] }, { swatch: "rest", label: t.d.legendRest }] };
  }
  const zoom = zoomSegments(spec);
  const zx = (v: number) => scale(v, zoom.total, X0, XW);
  const zTop = 146, zBase = 196;
  let pauseLabelled = false;
  const row2 = <g>
    <Label x={X0} y={134} size={10.5} anchor="start" tone="ink" weight={700}>{spec.reps > 1 ? t.d.zoomSet : t.d.zoomRep}</Label>
    {zoom.segments.map((s, i) => {
      const x = zx(s.start), w = zx(s.start + s.duration) - x;
      if (s.type === "work") return <g key={i}>
        <rect x={x} y={zTop} width={w} height={zBase - zTop} className="fill-accent"/>
        {w >= 20 ? <Label x={x + w / 2} y={zTop + 29} size={10} tone="accent-ink" weight={700}>{formatDuration(s.duration, locale)}</Label> : null}
      </g>;
      if (s.type === "reserve") return <g key={i}>
        <rect x={x} y={zTop} width={w} height={zBase - zTop} fill="none" className="stroke-accent" strokeWidth="1.5" strokeDasharray="4 3"/>
        <Lines x={x + w / 2} y={zTop + 22} lines={[t.d.reserve, formatDuration(s.duration, locale)]} size={9.5} tone="ink-2"/>
      </g>;
      const show = !pauseLabelled;
      pauseLabelled = true;
      return <g key={i}>
        <rect x={x} y={zBase - 12} width={w} height={12} fill={hatch(uid)} className="stroke-ink-3" strokeWidth="0.5"/>
        {show ? <Label x={x + w / 2} y={zBase - 16} size={9}>{formatDuration(s.duration, locale)}</Label> : null}
      </g>;
    })}
    <TimeAxis total={zoom.total} y={zBase + 4} ctx={ctx}/>
  </g>;
  const legend: Drawing["legend"] = [{ swatch: "work", label: t.d.legendWork + t.sep + spec.workLabel[locale] }, { swatch: "rest", label: t.d.legendRest }];
  if (spec.reserve) legend.push({ swatch: "reserve", label: t.d.legendReserve });
  return { height: 232, body: <>{row1}{row2}</>, legend };
}

/* ── Continuous: ARC ─────────────────────────────────────────────────────── */
function continuous(spec: ContinuousDiagram, ctx: Ctx): Drawing {
  const { t, locale, uid } = ctx;
  const { totalMinutes, segments } = continuousSegments(spec);
  const x0 = 34, width = 316, top = 26, bottom = 150;
  const sy = (rpe: number) => bottom - (rpe / 10) * (bottom - top);
  const sx = (m: number) => scale(m, totalMinutes, x0, width);
  return {
    height: 186,
    legend: [{ swatch: "band", label: t.d.targetZone + " (" + spec.rpe[0] + "–" + spec.rpe[1] + "/10)" }, { swatch: "rest", label: t.d.legendRest }, { swatch: "ceiling", label: t.d.ceiling }],
    body: <g>
      <Label x={0} y={12} size={10} anchor="start" tone="ink" weight={700}>{t.d.effortAxis}</Label>
      {[0, 2, 4, 6, 8, 10].map((v) => <g key={v}>
        <line x1={x0} x2={x0 + width} y1={sy(v)} y2={sy(v)} className="stroke-line" strokeWidth="0.8"/>
        <Label x={x0 - 6} y={sy(v) + 3} size={9} anchor="end">{v}</Label>
      </g>)}
      {segments.map((s, i) => {
        const x = sx(s.start), w = sx(s.start + s.minutes) - x;
        return s.type === "block"
          ? <g key={i}>
            <rect x={x} y={sy(spec.rpe[1])} width={w} height={sy(spec.rpe[0]) - sy(spec.rpe[1])} className="fill-accent" rx="3"/>
            <Label x={x + w / 2} y={sy(spec.rpe[1]) - 5} size={9.5} tone="ink">{formatDuration(s.minutes * 60, locale)}</Label>
          </g>
          : <g key={i}>
            <rect x={x} y={sy(0.8)} width={w} height={sy(0) - sy(0.8)} fill={hatch(uid)} className="stroke-ink-3" strokeWidth="0.5"/>
            <Label x={x + w / 2} y={sy(0.8) - 4} size={9}>{t.d.rest + " " + formatDuration(s.minutes * 60, locale)}</Label>
          </g>;
      })}
      <line x1={x0} x2={x0 + width} y1={sy(spec.ceiling)} y2={sy(spec.ceiling)} className="stroke-ink" strokeWidth="1.4" strokeDasharray="6 4"/>
      <Label x={x0 + width} y={sy(spec.ceiling) - 4} size={9} anchor="end" tone="ink">{t.d.ceiling}</Label>
      <TimeAxis total={totalMinutes * 60} y={bottom} ctx={ctx} x0={x0} width={width}/>
    </g>,
  };
}

/* ── Circuit: 4×4 ────────────────────────────────────────────────────────── */
function circuit(spec: CircuitDiagram, ctx: Ctx): Drawing {
  const { t, locale, uid } = ctx;
  const left = 62, cellW = (W - 8 - left - (spec.problems - 1) * 12) / spec.problems, cellH = 26, gap = 22, top = 26;
  const rowY = (r: number) => top + r * (cellH + gap);
  const height = rowY(spec.rounds - 1) + cellH + 12;
  return {
    height,
    legend: [{ swatch: "work", label: t.d.problem + " (" + t.d.linked + ")" }, { swatch: "rest", label: t.d.legendRest }],
    body: <g>
      {Array.from({ length: spec.problems }, (_, p) =>
        <Label key={p} x={left + p * (cellW + 12) + cellW / 2} y={14} size={10} tone="ink" weight={700}>{t.d.problem + " " + (p + 1)}</Label>)}
      {Array.from({ length: spec.rounds }, (_, r) => <g key={r}>
        <Label x={4} y={rowY(r) + 17} size={10} anchor="start" tone="ink" weight={700}>{t.d.round + " " + (r + 1)}</Label>
        {Array.from({ length: spec.problems }, (_, p) => {
          const x = left + p * (cellW + 12);
          return <g key={p}>
            <rect x={x} y={rowY(r)} width={cellW} height={cellH} rx="6" className="fill-accent"/>
            <Label x={x + cellW / 2} y={rowY(r) + 17} size={10} tone="accent-ink" weight={700}>{t.d.problemShort + (p + 1)}</Label>
            {p < spec.problems - 1 ? <line x1={x + cellW + 1} x2={x + cellW + 11} y1={rowY(r) + cellH / 2} y2={rowY(r) + cellH / 2} className="stroke-ink-2" strokeWidth="1.4" markerEnd={arrow(uid)}/> : null}
          </g>;
        })}
        {r < spec.rounds - 1 ? <g>
          <rect x={left} y={rowY(r) + cellH + 5} width={W - 8 - left} height={gap - 10} fill={hatch(uid)} className="stroke-ink-3" strokeWidth="0.5" rx="3"/>
          <rect x={left + (W - 8 - left) / 2 - 40} y={rowY(r) + cellH + 4} width="80" height={gap - 8} rx="3" className="fill-surface"/>
          <Label x={left + (W - 8 - left) / 2} y={rowY(r) + cellH + 15} size={9.5} tone="ink">{t.d.rest + " " + formatDuration(spec.roundRest, locale)}</Label>
        </g> : null}
      </g>)}
    </g>,
  };
}

/* ── Rounds: constraints-led practice ────────────────────────────────────── */
const HOLDS: readonly (readonly [number, number])[] = [[0.3, 0.82], [0.62, 0.66], [0.35, 0.48], [0.68, 0.3], [0.45, 0.12]];
const FEET: readonly (readonly [number, number])[] = [[0.25, 0.95], [0.7, 0.86], [0.4, 0.7]];

function ConstraintGlyph({ mark, x, y }: { mark: ConstraintMark; x: number; y: number }) {
  if (mark === "slowHands") return <g>
    <circle cx={x} cy={y} r="9" className="fill-surface stroke-ink" strokeWidth="1.4"/>
    <path d={`M${x} ${y}V${y - 6}M${x} ${y}h4`} className="stroke-ink" strokeWidth="1.4" strokeLinecap="round"/>
  </g>;
  if (mark === "noRegrip") return <g>
    <circle cx={x} cy={y} r="9" className="fill-surface stroke-ink" strokeWidth="1.4"/>
    <path d={`M${x - 4} ${y - 4}l8 8m0-8-8 8`} className="stroke-ink" strokeWidth="1.6" strokeLinecap="round"/>
  </g>;
  if (mark === "setFeet") return <g>
    <rect x={x - 9} y={y - 9} width="18" height="18" rx="3" className="fill-surface stroke-ink" strokeWidth="1.4"/>
    <path d={`M${x - 4} ${y + 4}c0-6 3-9 5-9s3 3 1 6l-2 3Z`} className="fill-ink"/>
  </g>;
  return <g>
    <circle cx={x} cy={y} r="9" className="fill-surface stroke-ink" strokeWidth="1.4"/>
    <path d={`M${x - 4} ${y}l3 3 5-6`} fill="none" className="stroke-ink" strokeWidth="1.6" strokeLinecap="round"/>
  </g>;
}

function rounds(spec: RoundsDiagram, ctx: Ctx): Drawing {
  const { t, locale, uid } = ctx;
  const n = spec.rounds.length, gap = 10, pw = (XW - (n - 1) * gap) / n, ph = 112, top = 6;
  return {
    height: 206,
    legend: [{ swatch: "rest", label: t.d.legendRest }],
    body: <g>
      {spec.rounds.map((round, i) => {
        const x = X0 + i * (pw + gap);
        const px = (u: number) => x + 8 + u * (pw - 16), py = (v: number) => top + 8 + v * (ph - 16);
        return <g key={i}>
          <rect x={x} y={top} width={pw} height={ph} rx="8" className="fill-surface-2 stroke-line"/>
          <polyline points={HOLDS.map(([u, v]) => px(u) + "," + py(v)).join(" ")} fill="none" className="stroke-ink-3" strokeDasharray="3 3"/>
          {HOLDS.map(([u, v], k) => <circle key={k} cx={px(u)} cy={py(v)} r="4.5" className="fill-ink-2"/>)}
          {FEET.map(([u, v], k) => {
            const allowed = round.mark !== "setFeet" || k !== 2;
            return <g key={k}>
              <rect x={px(u) - 3.5} y={py(v) - 3.5} width="7" height="7" rx="1" className={allowed ? "fill-ink-3" : "fill-surface stroke-ink-3"}/>
              {allowed ? null : <path d={`M${px(u) - 4} ${py(v) - 4}l8 8`} className="stroke-ink" strokeWidth="1.2"/>}
            </g>;
          })}
          <ConstraintGlyph mark={round.mark} x={x + pw - 14} y={top + 14}/>
          <Lines x={x + pw / 2} y={top + ph + 15} lines={wrapLabel((i + 1) + ". " + round.label[locale], 13, 2)} size={9.5} weight={700}/>
          <Label x={x + pw / 2} y={top + ph + 41} size={9}>{spec.attempts + " " + t.d.attempts}</Label>
        </g>;
      })}
      <rect x={X0} y={top + ph + 52} width={XW} height="10" rx="3" fill={hatch(uid)} className="stroke-ink-3" strokeWidth="0.5"/>
      <rect x={W / 2 - 110} y={top + ph + 50} width="220" height="14" rx="3" className="fill-surface"/>
      <Label x={W / 2} y={top + ph + 61} size={9.5} tone="ink">{formatDuration(spec.rest, locale) + " " + t.d.restBetween}</Label>
    </g>,
  };
}

/* ── Loop: a practice cycle ──────────────────────────────────────────────── */
function loop(spec: LoopDiagram, ctx: Ctx): Drawing {
  const { locale, uid } = ctx;
  const cx = 180, cy = 112, rx = 112, ry = 80, nw = 132, nh = 46;
  const positions = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]] as const;
  const arcs = [
    `M${cx + nw / 2 + 2} ${cy - ry} Q${cx + rx} ${cy - ry} ${cx + rx} ${cy - nh / 2 - 4}`,
    `M${cx + rx} ${cy + nh / 2 + 2} Q${cx + rx} ${cy + ry} ${cx + nw / 2 + 4} ${cy + ry}`,
    `M${cx - nw / 2 - 2} ${cy + ry} Q${cx - rx} ${cy + ry} ${cx - rx} ${cy + nh / 2 + 4}`,
    `M${cx - rx} ${cy - nh / 2 - 2} Q${cx - rx} ${cy - ry} ${cx - nw / 2 - 4} ${cy - ry}`,
  ];
  return {
    height: 222,
    legend: [],
    body: <g>
      {arcs.slice(0, spec.steps.length).map((d, i) => <path key={i} d={d} fill="none" className="stroke-ink-2" strokeWidth="1.5" markerEnd={arrow(uid)}/>)}
      {spec.steps.slice(0, 4).map((step, i) => {
        const [x, y] = positions[i];
        const lines = wrapLabel(step[locale], 19, 3);
        return <g key={i}>
          <rect x={x - nw / 2} y={y - nh / 2} width={nw} height={nh} rx="10" className="fill-surface stroke-accent" strokeWidth="1.6"/>
          <circle cx={x - nw / 2 + 13} cy={y} r="9" className="fill-accent"/>
          <Label x={x - nw / 2 + 13} y={y + 3.5} size={10} tone="accent-ink" weight={700}>{i + 1}</Label>
          <Lines x={x + 10} y={y + 4 - ((lines.length - 1) * 11) / 2} lines={lines} size={9.5} weight={600}/>
        </g>;
      })}
      <Lines x={cx} y={cy + 4 - ((spec.center.length - 1) * 13) / 2} lines={spec.center.map((c) => c[locale])} size={10} tone="ink-2" lineHeight={13}/>
    </g>,
  };
}

/* ── Ladder: campus board ────────────────────────────────────────────────── */
function ladder(spec: LadderDiagram, ctx: Ctx): Drawing {
  const { t } = ctx;
  const n = spec.ladders.length, colW = XW / n, top = 34, bottom = 196;
  const ry = (rung: number) => bottom - ((rung - 1) / (spec.rungs - 1)) * (bottom - top);
  return {
    height: 208,
    legend: [{ swatch: "left", label: t.d.leftHandFull }, { swatch: "right", label: t.d.rightHandFull }],
    body: <g>
      {spec.ladders.map((moves, li) => {
        const c = X0 + colW * li + colW / 2, handX = { L: c - 22, R: c + 22 };
        const placed = ladderMoves(moves);
        return <g key={li}>
          <Label x={c} y={14} size={10.5} tone="ink" weight={700}>{t.d.ladder + " " + moves.join("-")}</Label>
          <rect x={c - 58} y={top - 12} width="116" height={bottom - top + 24} rx="6" className="fill-surface-2 stroke-line"/>
          {Array.from({ length: spec.rungs }, (_, r) => <g key={r}>
            <rect x={c - 48} y={ry(r + 1) - 2.5} width="96" height="5" rx="2" className="fill-ink-3"/>
            <Label x={c - 66} y={ry(r + 1) + 3} size={8.5} anchor="end">{r + 1}</Label>
          </g>)}
          {(["L", "R"] as const).map((hand) => {
            const path = placed.filter((m) => m.hand === hand);
            return path.slice(1).map((m, k) => <line key={hand + k} x1={handX[hand]} x2={handX[hand]} y1={ry(path[k].rung) - 9} y2={ry(m.rung) + 10}
              className="stroke-ink-2" strokeWidth="1.4" markerEnd={arrow(ctx.uid)}/>);
          })}
          {placed.map((m, k) => {
            const x = handX[m.hand], y = ry(m.rung);
            return <g key={k}>
              {m.hand === "L"
                ? <circle cx={x} cy={y} r="8" className="fill-surface stroke-accent" strokeWidth="2"/>
                : <rect x={x - 8} y={y - 8} width="16" height="16" rx="2" className="fill-accent"/>}
              <Label x={x} y={y + 3.5} size={9} tone={m.hand === "L" ? "accent" : "accent-ink"} weight={700}>{m.hand === "L" ? t.d.leftHand : t.d.rightHand}</Label>
              {m.order > 0 ? <Label x={x + (m.hand === "L" ? -14 : 14)} y={y + 3} size={8.5} anchor={m.hand === "L" ? "end" : "start"}>{"#" + m.order}</Label> : null}
            </g>;
          })}
        </g>;
      })}
    </g>,
  };
}

/* ── Sets: strength & conditioning ───────────────────────────────────────── */
function sets(spec: SetsDiagram, ctx: Ctx): Drawing {
  const { t, locale, uid } = ctx;
  const rowH = 44;
  return {
    height: spec.exercises.length * rowH + 6,
    legend: [{ swatch: "work", label: t.d.legendWork }, { swatch: "rest", label: t.d.legendRest }],
    body: <g>
      {spec.exercises.map((e, i) => {
        const y = i * rowH + 14;
        let x = X0;
        const groups: ReactNode[] = [];
        for (let s = 0; s < e.sets; s++) {
          if (e.reps) {
            for (let r = 0; r < e.reps; r++) groups.push(<rect key={s + "-" + r} x={x + r * 5} y={y + 8} width="3.2" height="14" rx="1" className="fill-accent"/>);
            x += e.reps * 5;
          } else {
            const w = (e.seconds ?? 0) * 1.6;
            groups.push(<g key={s}><rect x={x} y={y + 8} width={w} height="14" rx="2" className="fill-accent"/>
              <Label x={x + w / 2} y={y + 18.5} size={8.5} tone="accent-ink" weight={700}>{formatDuration(e.seconds ?? 0, locale)}</Label></g>);
            x += w;
          }
          if (s < e.sets - 1) {
            groups.push(<rect key={"rest" + s} x={x + 4} y={y + 12} width="14" height="10" fill={hatch(uid)} className="stroke-ink-3" strokeWidth="0.5"/>);
            x += 22;
          }
        }
        return <g key={i}>
          <Label x={X0} y={y} size={10.5} anchor="start" tone="ink" weight={700}>{e.name[locale]}</Label>
          {groups}
          <Label x={x + 8} y={y + 19} size={9.5} anchor="start" tone="ink">
            {e.sets + " × " + (e.reps ?? formatDuration(e.seconds ?? 0, locale)) + " · " + t.d.rest + " " + formatDuration(e.rest, locale)}
          </Label>
        </g>;
      })}
    </g>,
  };
}

/* ── Staircase: graded exposure or a plan ladder ─────────────────────────── */
function staircase(spec: StaircaseDiagram, ctx: Ctx): Drawing {
  const { locale } = ctx;
  const n = spec.steps.length, w = XW / n, base = 196, textSpace = 46, maxH = base - 12 - textSpace, stepH = maxH / n;
  const chars = Math.max(8, Math.floor((w - 4) / 5.2));
  return {
    height: 216,
    legend: [],
    body: <g>
      {spec.steps.map((step, i) => {
        const x = X0 + i * w, h = stepH * (i + 1), top = base - h;
        const lines = wrapLabel(step.label[locale], chars, 3);
        return <g key={i}>
          <rect x={x + 1} y={top} width={w - 3} height={h} rx="4" className="fill-accent" opacity={0.25 + 0.75 * ((i + 1) / n)}/>
          <rect x={x + 1} y={top} width={w - 3} height={h} rx="4" fill="none" className="stroke-accent" strokeWidth="1.2"/>
          <circle cx={x + w / 2 - 1} cy={top + 12} r="8" className="fill-surface stroke-accent"/>
          <Label x={x + w / 2 - 1} y={top + 15.5} size={9.5} tone="ink" weight={700}>{i + 1}</Label>
          <Lines x={x + w / 2 - 1} y={top - 8 - (lines.length - 1) * 10.5} lines={lines} size={9} weight={600} lineHeight={10.5}/>
          {step.detail && h > 40 ? <Lines x={x + w / 2 - 1} y={top + 32} lines={wrapLabel(step.detail[locale], chars, 2)} size={8} tone="ink" lineHeight={9.5}/> : null}
        </g>;
      })}
      <line x1={X0} x2={X0 + XW} y1={base + 1} y2={base + 1} className="stroke-ink-3"/>
      <Label x={X0 + XW} y={base + 14} size={9} anchor="end" tone="ink-3">{spec.axis[locale]}</Label>
    </g>,
  };
}

/* ── Phases: a training cycle ────────────────────────────────────────────── */
function phases(spec: PhasesDiagram, ctx: Ctx): Drawing {
  const { t, locale } = ctx;
  const { totalWeeks, placed } = phaseLayout(spec);
  const top = 22, bottom = 150, maxV = Math.max(...spec.phases.map((p) => p.volume));
  const maxI = Math.max(1, ...spec.phases.map((p) => p.intensity ?? 0));
  const hasIntensity = spec.phases.some((p) => p.intensity !== undefined);
  const sx = (wk: number) => scale(wk, totalWeeks, X0, XW);
  const iy = (v: number) => bottom - (v / maxI) * (bottom - top - 10);
  const legend: Drawing["legend"] = [{ swatch: "volume", label: t.d.volume }];
  if (hasIntensity) legend.push({ swatch: "intensity", label: t.d.intensity });
  return {
    height: 186,
    legend,
    body: <g>
      {placed.map((p) => {
        const phase = spec.phases[p.index], x = sx(p.start), w = sx(p.end) - x - 2, h = (phase.volume / maxV) * (bottom - top - 10);
        const lines = wrapLabel(phase.label[locale], Math.max(5, Math.floor(w / 5.4)), 3);
        return <g key={p.index}>
          <rect x={x + 1} y={bottom - h} width={w} height={h} rx="4" className="fill-accent" opacity="0.28"/>
          <rect x={x + 1} y={bottom - h} width={w} height={h} rx="4" fill="none" className="stroke-accent" strokeWidth="1.4"/>
          <Lines x={x + 1 + w / 2} y={h < 34 ? bottom - h - 6 - (lines.length - 1) * 11 : bottom - h + 14} lines={lines} size={9} weight={700}/>
          {phase.weeks > 1 ? <Label x={x + 1 + w / 2} y={bottom - 6} size={8.5} tone="ink-2">{phase.weeks + " " + t.units.weeks}</Label> : null}
        </g>;
      })}
      {hasIntensity ? <polyline fill="none" className="stroke-ink" strokeWidth="1.6" strokeDasharray="5 3"
        points={placed.flatMap((p) => {
          const y = iy(spec.phases[p.index].intensity ?? 0);
          return [sx(p.start) + 2 + "," + y, sx(p.end) - 2 + "," + y];
        }).join(" ")}/> : null}
      {hasIntensity ? placed.map((p) => <circle key={p.index} cx={(sx(p.start) + sx(p.end)) / 2} cy={iy(spec.phases[p.index].intensity ?? 0)} r="3.2" className="fill-ink"/>) : null}
      <line x1={X0} x2={X0 + XW} y1={bottom} y2={bottom} className="stroke-ink-3"/>
      {Array.from({ length: totalWeeks }, (_, i) => <Label key={i} x={sx(i + 0.5)} y={bottom + 13} size={8.5}>{t.d.weekShort + (i + 1)}</Label>)}
      <Label x={X0 + XW} y={bottom + 27} size={9} anchor="end" tone="ink-3">{t.d.weeks}</Label>
    </g>,
  };
}

/* ── Edges: hangboard edge depths to scale ───────────────────────────────── */
function edges(spec: EdgesDiagram, ctx: Ctx): Drawing {
  const { t, locale } = ctx;
  const k = 8, x0 = 44, rowH = 28, top = 40;
  const maxMm = Math.max(25, ...spec.edges.map((e) => e.mm));
  return {
    height: top + spec.edges.length * rowH + 4,
    legend: [],
    body: <g>
      <Label x={x0} y={11} size={10} anchor="start" tone="ink" weight={700}>{t.d.edgeAxis}</Label>
      <line x1={x0} x2={x0 + maxMm * k} y1={24} y2={24} className="stroke-ink-3"/>
      {Array.from({ length: maxMm + 1 }, (_, mm) => <g key={mm}>
        <line x1={x0 + mm * k} x2={x0 + mm * k} y1={24} y2={mm % 5 === 0 ? 30 : 27} className="stroke-ink-3"/>
        {mm % 5 === 0 ? <Label x={x0 + mm * k} y={38} size={8.5}>{mm}</Label> : null}
      </g>)}
      {spec.edges.map((e, i) => {
        const y = top + 8 + i * rowH;
        return <g key={i}>
          <rect x={x0 - 8} y={y - 4} width="8" height="22" className="fill-ink-3"/>
          <path d={`M${x0} ${y}H${x0 + e.mm * k - 3}q3 0 3 3v4H${x0}Z`} className="fill-accent"/>
          <Label x={x0 - 12} y={y + 8} size={10} anchor="end" tone="ink" weight={700}>{e.mm + " mm"}</Label>
          <Label x={x0 + e.mm * k + 6} y={y + 8} size={9} anchor="start">{e.note[locale]}</Label>
        </g>;
      })}
    </g>,
  };
}

/* ── Angles: board steepness to scale ────────────────────────────────────── */
function angles(spec: AnglesDiagram, ctx: Ctx): Drawing {
  const { t, locale } = ctx;
  const px = 70, py = 192, L = 160;
  const dashes = ["", "6 3", "2 3", "8 3 2 3"];
  return {
    height: 208,
    legend: [],
    body: <g>
      <Label x={X0} y={11} size={10} anchor="start" tone="ink" weight={700}>{t.d.angleAxis}</Label>
      <line x1={X0} x2={X0 + XW} y1={py} y2={py} className="stroke-ink-3" strokeWidth="1.4"/>
      <Label x={X0 + XW} y={py + 13} size={9} anchor="end" tone="ink-3">{t.d.floor}</Label>
      {spec.angles.map((a, i) => {
        const rad = (a.deg * Math.PI) / 180, ex = px + L * Math.sin(rad), ey = py - L * Math.cos(rad);
        const r = 30 + i * 12, ny = 44 + i * 44;
        return <g key={i}>
          <line x1={px} y1={py} x2={ex} y2={ey} className="stroke-accent" strokeWidth={a.deg === 0 ? 2 : 3} strokeDasharray={dashes[i % dashes.length]} strokeLinecap="round"/>
          {a.deg > 0 ? <path d={`M${px} ${py - r}A${r} ${r} 0 0 1 ${px + r * Math.sin(rad)} ${py - r * Math.cos(rad)}`} fill="none" className="stroke-ink-3"/> : null}
          <Label x={ex + 6} y={ey + 4} size={10.5} anchor="start" tone="ink" weight={700}>{a.deg + "°"}</Label>
          {/* Notes sit in a column, keyed to each line by its dash pattern and degree label. */}
          <line x1={226} x2={250} y1={ny - 4} y2={ny - 4} className="stroke-accent" strokeWidth={a.deg === 0 ? 2 : 3} strokeDasharray={dashes[i % dashes.length]} strokeLinecap="round"/>
          <Label x={256} y={ny} size={10} anchor="start" tone="ink" weight={700}>{a.deg + "°"}</Label>
          <Lines x={226} y={ny + 13} lines={wrapLabel(a.note[locale], 25, 2)} size={8.5} anchor="start" tone="ink-2"/>
        </g>;
      })}
    </g>,
  };
}

/* ── Force test: critical force all-out test ─────────────────────────────── */
function forceTest(spec: ForceTestDiagram, ctx: Ctx): Drawing {
  const { t, locale, uid } = ctx;
  const { total, bars, plateau } = forceTestBars(spec);
  const x0 = 14, width = 336, top = 30, bottom = 150;
  const sx = (s: number) => scale(s, total, x0, width), sy = (v: number) => bottom - v * (bottom - top);
  const counted = bars.filter((b) => b.counted);
  const cx1 = sx(counted[0]?.start ?? 0), cx2 = sx((counted[counted.length - 1]?.start ?? 0) + spec.on);
  return {
    height: 186,
    legend: [{ swatch: "work", label: t.d.pull + " " + formatDuration(spec.on, locale) }, { swatch: "counted", label: t.d.lastN + " " + spec.lastN }, { swatch: "ceiling", label: t.d.criticalForce }],
    body: <g>
      <Label x={X0} y={11} size={10} anchor="start" tone="ink" weight={700}>{t.d.forceAxis}</Label>
      {bars.map((b, i) => {
        const x = sx(b.start), w = sx(b.start + b.duration) - x;
        return <rect key={i} x={x} y={sy(b.relative)} width={w} height={bottom - sy(b.relative)} fill={b.counted ? stripes(uid) : undefined} className={b.counted ? "stroke-accent" : "fill-accent"} strokeWidth="0.8"/>;
      })}
      <line x1={x0} x2={x0 + width} y1={sy(plateau)} y2={sy(plateau)} className="stroke-ink" strokeWidth="1.4" strokeDasharray="6 4"/>
      <path d={`M${cx1} ${sy(plateau) - 30}v-5H${cx2}v5`} fill="none" className="stroke-ink-2"/>
      <Label x={(cx1 + cx2) / 2} y={sy(plateau) - 40} size={9} anchor="middle" tone="ink">{t.d.lastN + " " + spec.lastN}</Label>
      <Label x={sx(spec.on) + 4} y={sy(bars[0].relative) + 2} size={9} anchor="start">{formatDuration(spec.on, locale) + " / " + formatDuration(spec.off, locale)}</Label>
      <TimeAxis total={total} y={bottom} ctx={ctx} x0={x0} width={width}/>
    </g>,
  };
}

/* ── Camera: filming setup ───────────────────────────────────────────────── */
function camera(spec: CameraDiagram, ctx: Ctx): Drawing {
  const { t } = ctx;
  const wallX = 300, floor = 196, lensX = 78, lensY = 132;
  const badge = (n: number, x: number, y: number) => <g key={n}>
    <circle cx={x} cy={y} r="9" className="fill-accent"/>
    <Label x={x} y={y + 3.5} size={10} tone="accent-ink" weight={700}>{n}</Label>
  </g>;
  return {
    height: 206,
    legend: [],
    body: <g>
      <path d={`M${lensX} ${lensY}L${wallX} 20V${floor}Z`} className="fill-accent" opacity="0.1"/>
      <path d={`M${lensX} ${lensY}L${wallX} 20M${lensX} ${lensY}L${wallX} ${floor}`} className="stroke-accent" strokeDasharray="5 4"/>
      <line x1={lensX} x2={wallX} y1={lensY} y2={lensY} className="stroke-ink-3" strokeDasharray="2 3"/>
      <path d={`M${wallX - 10} ${lensY}v-10h10`} fill="none" className="stroke-ink-2"/>
      <rect x={wallX} y={14} width="12" height={floor - 14} fill={`url(#hatch-${ctx.uid})`} className="stroke-ink-3"/>
      {[[296, 46], [294, 78], [297, 104], [295, 150], [297, 176]].map(([x, y], i) => <rect key={i} x={x} y={y} width="5" height="6" rx="1.5" className="fill-ink-3"/>)}
      <g className="stroke-ink" strokeWidth="3.5" strokeLinecap="round" fill="none">
        <circle cx="270" cy="78" r="7" className="fill-ink" strokeWidth="0"/>
        <path d="M272 86 268 128M270 96l24-14M270 100l24 6M268 128l24 22M268 128l-8 40 22 4"/>
      </g>
      <line x1={X0} x2={wallX + 12} y1={floor} y2={floor} className="stroke-ink-3" strokeWidth="1.4"/>
      <path d={`M66 140 50 ${floor}M66 140 82 ${floor}M66 140v${floor - 140}`} className="stroke-ink-2" strokeWidth="1.6"/>
      <rect x="50" y="122" width="28" height="18" rx="3" className="fill-ink"/>
      <circle cx={lensX} cy={lensY - 1} r="4" className="fill-accent"/>
      <Label x={64} y={116} size={9}>{t.d.camera}</Label>
      <Label x={wallX + 6} y={floor + 10} size={9} anchor="middle" tone="ink-3">{t.d.wall}</Label>
      {badge(1, 214, 40)}
      {badge(2, 190, lensY - 10)}
      {spec.notes.length > 2 ? badge(3, 40, 170) : null}
    </g>,
  };
}

function draw(spec: AtlasDiagram, ctx: Ctx): Drawing {
  switch (spec.kind) {
    case "intervals": return intervals(spec, ctx);
    case "continuous": return continuous(spec, ctx);
    case "circuit": return circuit(spec, ctx);
    case "rounds": return rounds(spec, ctx);
    case "loop": return loop(spec, ctx);
    case "ladder": return ladder(spec, ctx);
    case "sets": return sets(spec, ctx);
    case "staircase": return staircase(spec, ctx);
    case "phases": return phases(spec, ctx);
    case "edges": return edges(spec, ctx);
    case "angles": return angles(spec, ctx);
    case "forceTest": return forceTest(spec, ctx);
    case "camera": return camera(spec, ctx);
  }
}

function SwatchIcon({ swatch, uid }: { swatch: Swatch; uid: string }) {
  return <svg viewBox="0 0 22 14" width="22" height="14" aria-hidden="true" className="shrink-0">
    {swatch === "work" ? <rect x="1" y="1" width="20" height="12" rx="2" className="fill-accent"/> : null}
    {swatch === "rest" ? <rect x="1" y="4" width="20" height="9" fill={hatch(uid)} className="stroke-ink-3" strokeWidth="0.6"/> : null}
    {swatch === "reserve" ? <rect x="1.5" y="1.5" width="19" height="11" fill="none" className="stroke-accent" strokeWidth="1.5" strokeDasharray="4 3"/> : null}
    {swatch === "band" ? <rect x="1" y="3" width="20" height="8" rx="2" className="fill-accent"/> : null}
    {swatch === "ceiling" ? <line x1="1" x2="21" y1="7" y2="7" className="stroke-ink" strokeWidth="1.6" strokeDasharray="5 3"/> : null}
    {swatch === "left" ? <circle cx="11" cy="7" r="5.5" className="fill-surface stroke-accent" strokeWidth="2"/> : null}
    {swatch === "right" ? <rect x="5.5" y="1.5" width="11" height="11" rx="1.5" className="fill-accent"/> : null}
    {swatch === "volume" ? <rect x="1" y="2" width="20" height="11" rx="2" className="fill-accent stroke-accent" fillOpacity="0.28"/> : null}
    {swatch === "intensity" ? <g><line x1="1" x2="21" y1="7" y2="7" className="stroke-ink" strokeWidth="1.6" strokeDasharray="5 3"/><circle cx="11" cy="7" r="2.6" className="fill-ink"/></g> : null}
    {swatch === "counted" ? <rect x="1" y="1" width="20" height="12" fill={stripes(uid)} className="stroke-accent" strokeWidth="0.8"/> : null}
  </svg>;
}

export function AtlasDiagramFigure({ spec, locale, uid, title }: { spec: AtlasDiagram; locale: Locale; uid: string; title: string }) {
  const safeUid = uid.replace(/[^a-z0-9-]/gi, "");
  const t = atlasDictionary(locale);
  const ctx: Ctx = { locale, uid: safeUid, t };
  const drawing = draw(spec, ctx);
  const facts = diagramFacts(spec, locale);
  const titleId = "atlas-diagram-title-" + safeUid, descId = "atlas-diagram-desc-" + safeUid;
  return <figure className="leblond-premium-surface p-4 sm:p-5" aria-labelledby={titleId}>
    <h2 id={titleId} className="text-lg font-extrabold">{t.diagram}</h2>
    <div className="mx-auto mt-4 max-w-[560px] text-ink">
      <svg viewBox={`0 0 ${W} ${drawing.height}`} role="img" aria-label={t.diagramFor.replace("{title}", title)} aria-describedby={descId}
        className="h-auto w-full overflow-visible" style={{ fontFamily: "inherit" }}>
        <Defs uid={safeUid}/>
        {drawing.body}
      </svg>
    </div>
    {drawing.legend.length ? <ul className="mx-auto mt-3 flex max-w-[560px] flex-wrap gap-x-4 gap-y-2 text-xs text-ink-2">
      {drawing.legend.map((item) => <li key={item.swatch} className="flex items-center gap-2"><SwatchIcon swatch={item.swatch} uid={safeUid}/>{item.label}</li>)}
    </ul> : null}
    {spec.kind === "camera" ? <ol className="mx-auto mt-3 max-w-[560px] list-decimal space-y-1 pl-5 text-sm text-ink-2">
      {spec.notes.map((note, i) => <li key={i}>{note[locale]}</li>)}
    </ol> : null}
    <dl id={descId} className="mx-auto mt-4 grid max-w-[560px] grid-cols-1 gap-x-4 gap-y-1.5 rounded-xl bg-surface-2 p-3 text-sm sm:grid-cols-2">
      {facts.map((fact) => <div key={fact.label} className={fact.value.length > 40 ? "sm:col-span-2" : undefined}>
        <dt className="inline font-semibold text-ink">{fact.label}{t.sep}</dt>
        <dd className="inline text-ink-2">{fact.value}</dd>
      </div>)}
    </dl>
    <figcaption className="mx-auto mt-3 max-w-[560px] text-xs text-ink-3">{t.diagramNote}</figcaption>
  </figure>;
}
