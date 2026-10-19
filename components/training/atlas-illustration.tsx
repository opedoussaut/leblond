import type { AtlasDetail } from "@/lib/training/atlas";

/** Original explanatory schematics, not a copy of provider artwork. Not a
 * coaching exercise prescription or a substitute for qualified supervision. */
export function AtlasIllustration({ type, locale }: {type:AtlasDetail["drawing"];locale:"fr"|"en"}) {
  const label = {
    wall:locale==="fr"?"Schéma de placements sur un mur":"Wall movement schematic",
    hang:locale==="fr"?"Schéma de prise et de suspension":"Grip and hanging schematic",
    cycle:locale==="fr"?"Schéma de séquences effort-récupération":"Work and recovery cycle",
    profile:locale==="fr"?"Schéma du bilan et de la progression":"Assessment cycle schematic",
  }[type];
  return <div className="rounded-2xl border border-line bg-[#e9f1f9] p-4">
    <svg viewBox="0 0 420 225" role="img" aria-label={label} className="w-full">
      {type==="wall"?<g fill="none" stroke="#19456e" strokeWidth="3" strokeLinecap="round">
        <path d="M78 15 24 207 184 207 240 15Z" fill="#c1d2e1" opacity=".9"/>
        {[[114,43],[78,100],[145,137],[86,182],[178,64]].map(([x,y],i)=><path key={i} d={"M"+x+" "+y+"c12 -12 32 -9 37 7l-16 15-25-3Z"} fill="#6ba4d6"/>)}
        <circle cx="300" cy="71" r="13" fill="#19456e"/>
        <path d="m290 87-12 44 25 22 21-20m-46-2-30 14m55 7-7 40m-4-1-17 15m21-14 16 14" strokeWidth="9"/>
        <path d="M244 145Q195 161 156 139" stroke="#1769b9" strokeDasharray="7 7"/>
        <path d="m165 131-9 8 12 7" stroke="#1769b9"/>
      </g>:null}
      {type==="hang"?<g stroke="#19456e" strokeWidth="4" fill="none" strokeLinecap="round">
        <rect x="95" y="24" width="230" height="34" rx="7" fill="#a9c1d6"/>
        <path d="M115 58h45v12h-45zm145 0h45v12h-45z" fill="#4c789c"/>
        <path d="M141 71v15m138-15v15m-152 0 15 20m139-20-15 20" stroke="#2775b6" strokeWidth="8"/>
        <path d="m141 106 43 43 24 4 28-4 41-43" strokeWidth="10"/>
        <circle cx="210" cy="143" r="18" fill="#19456e"/>
        <path d="m210 164v24m0 0-28 16m28-16 28 16" strokeWidth="10"/>
        <path d="M340 31v160M334 37l6-8 6 8m-12 149 6 8 6-8" stroke="#1769b9" strokeDasharray="5 5"/>
      </g>:null}
      {type==="cycle"?<g>
        {Array.from({length:4},(_,i)=><g key={i}>
          <rect x={28+i*97} y="62" width="47" height="95" rx="5" fill="#2f7dba"/>
          <rect x={75+i*97} y="111" width="35" height="46" rx="5" fill="#a6bfda"/>
        </g>)}
        <path d="M27 174h366" stroke="#19456e" strokeWidth="3"/>
        <text x="32" y="48" fill="#19456e" fontSize="14">{locale==="fr"?"Effort":"Work"}</text>
        <text x="110" y="195" fill="#19456e" fontSize="14">{locale==="fr"?"Repos":"Recovery"}</text>
      </g>:null}
      {type==="profile"?<g fill="none" strokeWidth="4" strokeLinecap="round">
        <circle cx="90" cy="110" r="43" stroke="#729abe"/><circle cx="210" cy="110" r="43" stroke="#1769b9"/><circle cx="330" cy="110" r="43" stroke="#19456e"/>
        <path d="M133 110h34m-9-9 9 9-9 9M253 110h34m-9-9 9 9-9 9" stroke="#19456e"/>
        <text x="90" y="115" fontSize="13" fill="#19456e" textAnchor="middle">{locale==="fr"?"Bilan":"Assess"}</text>
        <text x="210" y="115" fontSize="13" fill="#1769b9" textAnchor="middle">{locale==="fr"?"Plan":"Plan"}</text>
        <text x="330" y="115" fontSize="13" fill="#19456e" textAnchor="middle">{locale==="fr"?"Mesure":"Track"}</text>
      </g>:null}
    </svg>
    <p className="mt-1 text-center text-xs text-[#47647d]">{label} · LEBLOND</p>
  </div>;
}
