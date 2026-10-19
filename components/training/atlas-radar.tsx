"use client";

import type { Locale } from "@/lib/i18n";
import { ATLAS_AXES, ATLAS_LABELS, ATLAS_SCORES } from "@/lib/training/atlas";
import type { TrainingEntry } from "@/lib/training/catalogue";

const PALETTE=["#2677c8","#718aa4","#19456e"] as const;
function point(i:number,r:number) {
  const a=-Math.PI/2+(i*2*Math.PI/ATLAS_AXES.length);
  return {x:380+Math.cos(a)*r,y:258+Math.sin(a)*r};
}
function points(values:readonly number[],r=180) {
  return values.map((score,i)=>{const p=point(i,r*Math.max(0,score)/5);return p.x.toFixed(1)+","+p.y.toFixed(1);}).join(" ");
}
export function AtlasRadar({ entries, locale, heading }: {entries: readonly TrainingEntry[];locale: Locale;heading:string}) {
  return <section className="leblond-premium-surface p-3 sm:p-5">
    <h2 className="text-lg font-extrabold">{heading}</h2>
    <p className="mt-1 text-xs leading-relaxed text-ink-2">{locale==="fr"
      ?"12 dimensions descriptives, estimées par LEBLOND sur une échelle 0 à 5. La surface représente la priorité d'entraînement, pas l'efficacité ou les performances mesurées."
      :"12 editorial training-emphasis dimensions, from 0 to 5. The shape illustrates focus, not verified effectiveness or measured performance."}</p>
    <svg viewBox="0 0 760 530" role="img" aria-label={heading} className="mt-3 w-full">
      {[1,2,3,4,5].map(level=><polygon key={level}
        points={points(ATLAS_AXES.map(()=>level))} fill="none" stroke="currentColor" strokeOpacity=".16"/>)}
      {ATLAS_AXES.map((axis,i)=>{
        const p=point(i,180),l=point(i,234);
        return <g key={axis}><line x1="380" y1="258" x2={p.x} y2={p.y} stroke="currentColor" strokeOpacity=".16"/>
          <text x={l.x} y={l.y+3} fill="currentColor" textAnchor="middle" fontSize="12" fontWeight="600">{ATLAS_LABELS[axis][locale]}</text>
        </g>;
      })}
      {entries.map((entry,i)=><polygon key={entry.id} points={points(ATLAS_SCORES[entry.id]??ATLAS_AXES.map(()=>0))}
        fill={PALETTE[i%PALETTE.length]} fillOpacity=".11" stroke={PALETTE[i%PALETTE.length]} strokeWidth="3"/>)}
    </svg>
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      {entries.map((entry,i)=><span key={entry.id} className="flex items-center gap-2 text-xs font-semibold">
        <span className="h-3 w-3 rounded" style={{background:PALETTE[i%PALETTE.length]}}/>{entry.title}</span>)}
    </div>
    <p className="mt-4 text-xs text-ink-3">{locale==="fr"
      ?"Repère externe : Lattice publie un profil de tests sur 4 domaines (force des doigts, endurance des avant-bras, force, mobilité). Ces résultats mesurés ne doivent pas être confondus avec ce radar comparatif éditorial."
      :"External reference: Lattice publishes tests across four capacities (finger strength, forearm endurance, strength, flexibility). Those measured tests are distinct from this editorial comparison."}
      {" "}<a href="https://www.latticetraining.com/docs/latticeplan-testing" target="_blank" rel="noopener noreferrer" className="text-accent underline">Lattice ↗</a>
    </p>
  </section>;
}
