/*
 * Original line drawings for the hip-mobility exercises and tests and for
 * coach-session exercises no approved demo site shows (drawn for LEBLOND, no
 * external source). Simple figures in currentColor so they follow the light
 * and dark themes; the accent marks the movement.
 */
import { isIllustration, type IllustrationId } from "@/lib/training/illustrations";

type Drawing = IllustrationId;
const TEST_DRAWINGS: Record<string, Drawing> = { A: "seated-hip-rotations", B: "butterfly", C: "low-step-placements", D: "wall-step" };

function Arrow({ d, both = false }: { d: string; both?: boolean }) {
  return <path d={d} fill="none" stroke="var(--color-accent, #1769b9)" strokeWidth={2.5} strokeLinecap="round"
    markerEnd="url(#mob-arrow)" markerStart={both ? "url(#mob-arrow-start)" : undefined} />;
}

/* Solid figure parts for the newer drawings: limbs with volume, far limbs lighter for depth, the moving limb in the accent colour. */
const ACCENT = "var(--color-accent, #1769b9)";
type Tone = "near" | "far" | "move" | "ghost";
function toneProps(tone: Tone) {
  if (tone === "move") return { stroke: ACCENT };
  if (tone === "far") return { stroke: "currentColor", strokeOpacity: 0.38 };
  if (tone === "ghost") return { stroke: "currentColor", strokeOpacity: 0.28, strokeDasharray: "2 6", strokeWidth: 3 };
  return { stroke: "currentColor", strokeOpacity: 0.88 };
}
function Limb({ pts, tone = "near", thin = false }: { pts: string; tone?: Tone; thin?: boolean }) {
  return <polyline points={pts} fill="none" strokeWidth={thin ? 6 : 8} strokeLinecap="round" strokeLinejoin="round" {...toneProps(tone)} />;
}
function Foot({ heel, toe, tone = "near" }: { heel: [number, number]; toe: [number, number]; tone?: Tone }) {
  return <path d={`M${heel[0]} ${heel[1]} L${toe[0]} ${toe[1]}`} fill="none" strokeWidth={6} strokeLinecap="round" {...toneProps(tone)} />;
}
function Torso({ from, to, wide = false }: { from: [number, number]; to: [number, number]; wide?: boolean }) {
  return <path d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`} fill="none" stroke="currentColor" strokeOpacity={0.88} strokeWidth={wide ? 16 : 13} strokeLinecap="round" />;
}
function Head({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={7.5} fill="currentColor" fillOpacity={0.88} stroke="none" />;
}
function Wall({ x }: { x: number }) {
  return <g stroke="currentColor" strokeOpacity={0.45}>
    <path d={`M${x} 4 L${x} 89`} strokeWidth={2.5} />
    {[12, 26, 40, 54, 68, 82].map((y) => <path key={y} d={`M${x} ${y} L${x + 7} ${y - 7}`} strokeWidth={1.5} />)}
  </g>;
}

function Figure({ id }: { id: Drawing }) {
  switch (id) {
    case "supine-knee-sways": return <>
      <circle cx={24} cy={74} r={7} />
      <path d="M31 77 L84 78 M84 78 L102 50 L120 80 M84 78 L96 52 L112 80 M44 78 L56 86" />
      <Arrow d="M86 38 Q100 26 116 38" both />
    </>;
    case "seated-hip-rotations": return <>
      <circle cx={50} cy={34} r={7} />
      <path d="M52 42 L62 80 M56 54 L36 84 M62 80 L94 70 L118 84 M62 80 L90 82 L104 66" />
      <path d="M90 82 L104 66" strokeDasharray="3 4" />
      <Arrow d="M96 52 Q110 44 122 56" />
    </>;
    case "adductor-rock-backs": return <>
      <circle cx={34} cy={46} r={7} />
      <path d="M40 52 L86 56 M44 54 L42 86 M86 56 L90 86 M86 56 L136 84" />
      <Arrow d="M70 34 L104 34" both />
    </>;
    case "low-step-placements": return <>
      <rect x={98} y={74} width={40} height={14} rx={2} />
      <path d="M28 26 L28 88" />
      <circle cx={60} cy={20} r={7} />
      <path d="M60 28 L62 58 M62 58 L60 88 M62 58 L84 60 L106 74 M60 36 L30 46" />
      <Arrow d="M78 46 Q96 40 108 60" />
    </>;
    case "lateral-weight-shifts": return <>
      <circle cx={80} cy={18} r={7} />
      <path d="M80 26 L80 56 M80 56 L54 88 M80 56 L106 88 M80 34 L64 52 M80 34 L96 52" />
      <Arrow d="M48 66 L112 66" both />
    </>;
    case "butterfly": return <>
      <circle cx={80} cy={20} r={7} />
      <path d="M80 28 L80 66 M80 66 L46 72 L74 86 M80 66 L114 72 L86 86 M80 40 L60 74 M80 40 L100 74" />
      <path d="M46 74 L46 88 M43 76 L49 76 M43 82 L49 82" stroke="var(--color-accent, #1769b9)" strokeDasharray="2 2" />
    </>;
    case "wall-step": return <>
      <path d="M118 6 L118 88" />
      <circle cx={114} cy={18} r={3} /><circle cx={114} cy={52} r={3} /><circle cx={114} cy={78} r={3} />
      <circle cx={92} cy={24} r={7} />
      <path d="M94 32 L98 62 M95 36 L112 18 M98 62 L106 88 M98 62 L86 50 L110 52" />
      <Arrow d="M74 70 Q78 52 96 46" />
    </>;
    // Facing the wall in a split stance, the front knee goes to the wall, heel down.
    case "knee-to-wall": return <>
      <Wall x={138} />
      <Limb pts="96,55 80,70 66,85" tone="far" /><Foot heel={[66, 85]} toe={[76, 87]} tone="far" />
      <Limb pts="99,29 114,37 132,40" tone="far" thin />
      <Torso from={[99, 25]} to={[96, 55]} />
      <Limb pts="96,55 128,63 114,85" tone="move" /><Foot heel={[114, 85]} toe={[126, 87]} tone="move" />
      <Limb pts="100,30 117,34 133,34" thin />
      <Head x={101} y={16} />
      <path d="M108 93 L120 93" stroke="var(--color-accent, #1769b9)" strokeWidth={2} strokeDasharray="2 2" />
      <Arrow d="M108 49 Q120 47 128 54" />
    </>;
    // Seen from the feet, lying on a mat, feet wide: the right knee drops inwards (the left foot then rests on it).
    case "supine-hip-internal-rotation": return <>
      <path d="M28 89 L132 89 L112 6 L48 6 Z" fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1.5} />
      <Limb pts="73,27 62,42 56,56" tone="far" thin /><Limb pts="87,27 98,42 104,56" tone="far" thin />
      <Torso from={[80, 24]} to={[80, 58]} wide />
      <Head x={80} y={15} />
      <Limb pts="88,62 104,46 120,86" tone="ghost" />
      <Limb pts="72,62 56,46 42,86" />
      <Limb pts="88,62 74,78 120,86" tone="move" />
      <Arrow d="M110 40 Q110 66 84 72" />
    </>;
    // Facing the wall, forearms on it, the arms slide up without shrugging.
    case "wall-slides": return <>
      <Wall x={124} />
      <Limb pts="98,58 97,73 95,86" tone="far" /><Foot heel={[95, 86]} toe={[104, 88]} tone="far" />
      <Limb pts="98,31 117,38 117,16" tone="far" thin />
      <Torso from={[98, 27]} to={[98, 58]} />
      <Limb pts="98,58 101,73 100,86" /><Foot heel={[100, 86]} toe={[110, 88]} />
      <Limb pts="117,46 117,26" tone="ghost" thin />
      <Limb pts="99,32 119,34 119,10" tone="move" thin />
      <Head x={99} y={18} />
      <Arrow d="M132 48 L132 12" />
    </>;
    // Seen from the feet: lying with the buttocks at the wall, the legs open along the wall.
    case "wall-straddle": return <>
      <rect x={12} y={4} width={136} height={70} rx={3} fill="currentColor" fillOpacity={0.05} stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />
      <Limb pts="76,66 72,10" tone="ghost" /><Limb pts="84,66 88,10" tone="ghost" />
      <Limb pts="80,72 56,84" tone="far" thin /><Limb pts="80,72 104,84" tone="far" thin />
      <Limb pts="76,66 44,14" tone="move" /><Limb pts="84,66 116,14" tone="move" />
      <Torso from={[80, 64]} to={[80, 76]} wide />
      <Head x={80} y={84} />
      <Arrow d="M38 24 Q28 36 26 52" />
      <Arrow d="M122 24 Q132 36 134 52" />
    </>;
  }
}

export function MobilityIllustration({ exerciseId, test, title, className = "" }: {
  exerciseId?: string; test?: string; title: string; className?: string;
}) {
  const id = (test ? TEST_DRAWINGS[test] : exerciseId) as Drawing | undefined;
  if (!isIllustration(id)) return null;
  return <svg viewBox="0 0 160 96" role="img" aria-label={title}
    className={"h-auto w-full max-w-xs text-ink " + className}>
    <title>{title}</title>
    <defs>
      <marker id="mob-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="var(--color-accent, #1769b9)" />
      </marker>
      <marker id="mob-arrow-start" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="var(--color-accent, #1769b9)" />
      </marker>
    </defs>
    <path d="M6 89 L154 89" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />
    <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Figure id={id} />
    </g>
  </svg>;
}
