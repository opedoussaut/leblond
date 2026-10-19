"use client";

import type { Locale } from "@/lib/i18n";
import type { ObservedWorkingGrade } from "@/lib/training/grade-history";

export function WorkingGradeChart({ locale, points, target, horizonWeeks, system }: {
  locale: Locale;
  points: ObservedWorkingGrade[];
  target: { grade: string; ordinal: number } | null;
  horizonWeeks: number;
  system: string;
}) {
  const fr=locale==="fr";
  const heading=fr?"Progression réelle des cotations enregistrées":"Observed logged-grade progression";
  const caption=fr
    ?"La cotation de travail est recalculée sur les 60 jours précédant chaque point. Le trait en pointillés montre ton objectif personnel, pas une prévision. Les semaines sans données fiables sont volontairement absentes."
    :"The working grade is recalculated from the preceding 60 days at each point. The dashed line is your personal goal, not a forecast. Weeks without reliable data are deliberately absent.";
  if(points.length===0) return <section className="rounded-2xl border border-line bg-surface p-4">
    <h3 className="font-black">{heading}</h3>
    <p className="mt-3 text-sm text-ink-2">{fr?"Aucune cotation de travail fiable pour cette période.":"No reliable working grade in this period."}</p>
    <p className="mt-2 text-xs text-ink-3">{caption}</p>
  </section>;

  const allScores=[...points.map(p=>p.ordinal),...(target?[target.ordinal]:[])];
  const low=Math.min(...allScores)-.5;
  const high=Math.max(...allScores)+.5;
  const width=720,height=268,left=55,right=27,top=24,bottom=54;
  const px=(week:number)=>left+(week/horizonWeeks)*(width-left-right);
  const py=(score:number)=>top+((high-score)/(high-low))*(height-top-bottom);
  const groups:ObservedWorkingGrade[][]=[];
  // Don't join across missing qualifying weeks, which would imply observation.
  for(const point of points){
    const previous=groups[groups.length-1];
    if(previous && previous[previous.length-1].week===point.week-1)previous.push(point);
    else groups.push([point]);
  }
  return <section className="rounded-2xl border border-line bg-surface p-4">
    <h3 className="font-black">{heading}</h3>
    <p className="mt-1 text-xs text-ink-3">{system}</p>
    <svg viewBox={"0 0 "+width+" "+height} className="mt-4 w-full" role="img" aria-label={heading}>
      {Array.from(new Set([0,Math.round(horizonWeeks/4),Math.round(horizonWeeks/2),Math.round(horizonWeeks*3/4),horizonWeeks])).map(week=><text key={week}
        x={px(week)} y={height-16} textAnchor="middle" fontSize="12" fill="currentColor">
          {fr?"Sem.":"Week"} {week}
        </text>)}
      {target ? <g>
        <line x1={left} x2={width-right} y1={py(target.ordinal)} y2={py(target.ordinal)}
          stroke="#297cc8" strokeWidth="2" strokeDasharray="7 6"/>
        <text x={left} y={Math.max(12,py(target.ordinal)-9)} fontSize="12" fill="#b4532a">
          {fr?"Objectif":"Goal"} {target.grade}
        </text>
      </g>:null}
      {groups.map((group,i)=>group.length>1?<polyline key={i} fill="none" stroke="#173e66" strokeWidth="3"
        points={group.map(p=>px(p.week)+","+py(p.ordinal)).join(" ")}/>:null)}
      {points.map(p=><g key={p.week}>
        <circle cx={px(p.week)} cy={py(p.ordinal)} r="5" fill="#247ca0">
          <title>{fr?"Sem.":"Week"} {p.week}: {p.grade} ({p.sampleSize} {fr?"blocs":"problems"})</title>
        </circle>
        <text x={px(p.week)} y={py(p.ordinal)-11} textAnchor="middle" fontSize="12" fontWeight="650"
          fill="currentColor">{p.grade}</text>
      </g>)}
    </svg>
    <p className="mt-3 text-xs leading-relaxed text-ink-3">{caption}</p>
  </section>;
}
