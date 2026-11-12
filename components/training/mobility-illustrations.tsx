/*
 * Original line drawings for the hip-mobility exercises and tests (drawn for
 * LEBLOND, no external source). Simple figures in currentColor so they follow
 * the light and dark themes; the accent marks the movement.
 */

type Drawing = "supine-knee-sways" | "seated-hip-rotations" | "adductor-rock-backs" | "low-step-placements"
  | "lateral-weight-shifts" | "butterfly" | "wall-step";

const DRAWINGS: ReadonlySet<string> = new Set(["supine-knee-sways", "seated-hip-rotations", "adductor-rock-backs", "low-step-placements",
  "lateral-weight-shifts", "butterfly", "wall-step"]);
const TEST_DRAWINGS: Record<string, Drawing> = { A: "seated-hip-rotations", B: "butterfly", C: "low-step-placements", D: "wall-step" };

function Arrow({ d, both = false }: { d: string; both?: boolean }) {
  return <path d={d} fill="none" stroke="var(--color-accent, #1769b9)" strokeWidth={2.5} strokeLinecap="round"
    markerEnd="url(#mob-arrow)" markerStart={both ? "url(#mob-arrow-start)" : undefined} />;
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
  }
}

export function MobilityIllustration({ exerciseId, test, title, className = "" }: {
  exerciseId?: string; test?: string; title: string; className?: string;
}) {
  const id = (test ? TEST_DRAWINGS[test] : exerciseId) as Drawing | undefined;
  if (!id || !DRAWINGS.has(id)) return null;
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
