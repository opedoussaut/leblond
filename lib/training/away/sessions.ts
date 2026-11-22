import type { Localized } from "../catalogue";
import type { Block } from "../session-templates";

/**
 * The eight Away Training séances (En déplacement): four of about 60 minutes,
 * four of about 90, rests and transitions included (see `estimateSeconds`).
 * Permanent: they live in the code, every climber can start them at any time.
 *
 * Each item names an exercise of `./exercises`. Sets, reps or hold seconds,
 * the rest between sets and the rest before the next exercise are explicit.
 */

export type AwayObjective = "MOBILITY" | "STRENGTH" | "CONDITIONING" | "RECOVERY";
/** How hard the séance is on the body, for the recovery advice. */
export type AwayLoad = "LIGHT" | "MODERATE" | "HARD";

export type AwayItem = {
  id: string;
  sets: number;
  /** Reps per set (per side when the exercise is per side). */
  reps?: number;
  /** Seconds per set (per side when the exercise is per side). */
  seconds?: number;
  /** Rest between sets, seconds. */
  rest: number;
  /** Rest before the next exercise, seconds. */
  after: number;
  /** Replaces the exercise's own cue as the intensity line. */
  note?: Localized;
};

export type AwaySection = { block: Block; title: Localized; items: readonly AwayItem[] };

export type AwaySession = {
  key: string;
  minutes: 60 | 90;
  objective: AwayObjective;
  load: AwayLoad;
  /** Atlas method of every exercise: what the séance counts as in history and charts. */
  method: "mobility" | "strength-conditioning";
  title: Localized;
  summary: Localized;
  /** What the séance works, in a few words each. */
  focus: readonly Localized[];
  sections: readonly AwaySection[];
  notes: Localized;
};

const L = (fr: string, en: string): Localized => ({ fr, en });
const R = (id: string, sets: number, reps: number, rest: number, after: number, note?: Localized): AwayItem =>
  ({ id, sets, reps, rest, after, ...(note ? { note } : {}) });
const H = (id: string, sets: number, seconds: number, rest: number, after: number, note?: Localized): AwayItem =>
  ({ id, sets, seconds, rest, after, ...(note ? { note } : {}) });

const WARMUP = L("Échauffement progressif", "Progressive warm-up");
const COOLDOWN = L("Retour au calme", "Cool-down");
const LATTICE = L("Bloc souplesse active (2 × 6 lents)", "Active flexibility block (2 × 6 slow)");
const LATTICE_3 = L("Bloc souplesse active (3 × 6 lents)", "Active flexibility block (3 × 6 slow)");
const LIGHT_LATTICE = L("Sans charge, tension 4/10", "No load, tension 4/10");

/** The six-exercise active flexibility block, in its fixed order. */
function lattice(sets: number, rest: number, note?: Localized): AwayItem[] {
  return ["calf-raise-step", "horse-stance-squat", "cossack-squat", "jefferson-curl", "single-leg-good-morning", "long-lunge-pulse"]
    .map((id, i, all) => R(id, sets, 6, rest, i === all.length - 1 ? 30 : 15, note));
}

const NO_FINGERS = L(
  "Les élastiques ne remplacent pas le travail des doigts : sans poutre ni prises, les doigts se reposent pendant le voyage.",
  "Bands do not replace finger training: with no hangboard or holds, your fingers rest while you travel.",
);

export const AWAY_SESSIONS: readonly AwaySession[] = [
  /* ── 1 · 60 min · Hip mobility ──────────────────────────────────────── */
  {
    key: "hanches-60", minutes: 60, objective: "MOBILITY", load: "LIGHT", method: "mobility",
    title: L("Mobilité des hanches", "Hip mobility"),
    summary: L(
      "Les hanches dans toute leur amplitude, puis actives : pieds hauts, placements latéraux et le bloc de souplesse active.",
      "The hips through their full range, then active: high steps, lateral foot placements and the active flexibility block.",
    ),
    focus: [L("Rotation de hanche", "Hip rotation"), L("Pieds hauts actifs", "Active high steps"), L("Placements latéraux", "Lateral foot placements")],
    sections: [
      { block: "WARMUP", title: WARMUP, items: [
        H("joint-circles", 1, 150, 0, 10), H("march-arm-swings", 1, 120, 0, 10), R("cat-cow", 1, 8, 0, 10),
        R("quadruped-hip-circles", 2, 5, 15, 15), R("leg-swings", 1, 10, 0, 20),
      ] },
      { block: "MAIN", title: L("Hanches en douceur", "Gentle hips"), items: [
        R("supine-knee-sways", 2, 8, 20, 20), R("seated-hip-rotations", 2, 6, 20, 20), R("adductor-rock-backs", 2, 8, 20, 20),
        H("half-kneeling-hip-flexor", 2, 40, 15, 30),
      ] },
      { block: "MAIN", title: L("Pieds hauts et placements latéraux", "High steps and lateral placements"), items: [
        R("high-knee-hold", 3, 4, 30, 20), R("wall-high-step", 3, 5, 30, 20), R("lateral-foot-placement", 3, 5, 30, 30),
      ] },
      { block: "MAIN", title: LATTICE, items: lattice(2, 20) },
      { block: "COOLDOWN", title: COOLDOWN, items: [
        H("figure-four", 1, 45, 0, 10), H("butterfly", 1, 60, 0, 10), H("legs-up-breathing", 1, 180, 0, 0),
      ] },
    ],
    notes: L(
      "Une séance légère : tu peux la faire le lendemain d’une grosse journée. Les mouvements les plus exigeants pour les hanches suivent ton dernier test des hanches.",
      "A light séance: you can do it the day after a big day. The most demanding hip movements follow your latest hip test.",
    ),
  },

  /* ── 2 · 60 min · Upper-body strength ───────────────────────────────── */
  {
    key: "haut-du-corps-60", minutes: 60, objective: "STRENGTH", load: "MODERATE", method: "strength-conditioning",
    title: L("Force haut du corps", "Upper-body strength"),
    summary: L(
      "Tirage à l’élastique sans ancrage, blocages, épaules et coiffe des rotateurs, puis les antagonistes.",
      "Anchor-free band pulling, lock-offs, shoulders and rotator cuff, then the antagonists.",
    ),
    focus: [L("Tirage", "Pulling"), L("Épaules stables", "Stable shoulders"), L("Antagonistes", "Antagonists")],
    sections: [
      { block: "WARMUP", title: WARMUP, items: [
        H("joint-circles", 1, 120, 0, 10), H("march-arm-swings", 1, 120, 0, 10), R("thoracic-rotation", 1, 6, 0, 10),
        R("scapular-push-up", 2, 10, 20, 15), R("band-pull-apart", 2, 15, 20, 15), R("band-external-rotation-free", 1, 12, 0, 30),
      ] },
      { block: "MAIN", title: L("Tirage", "Pulling"), items: [
        R("band-bent-row", 3, 12, 60, 60), R("band-overhead-pulldown", 3, 12, 60, 60), R("band-one-arm-row", 3, 10, 45, 60),
        H("band-lockoff", 3, 15, 45, 60),
      ] },
      { block: "MAIN", title: L("Épaules et coiffe", "Shoulders and cuff"), items: [
        R("band-face-pull-free", 3, 15, 45, 30), R("band-external-rotation-free", 2, 12, 45, 30), R("prone-ytw", 2, 5, 45, 45),
      ] },
      { block: "MAIN", title: L("Antagonistes", "Antagonists"), items: [
        R("push-up", 3, 10, 60, 45), R("pike-push-up", 2, 8, 60, 45), R("finger-extensions", 2, 20, 30, 30),
      ] },
      { block: "COOLDOWN", title: COOLDOWN, items: [
        H("wall-pec", 1, 40, 0, 10), H("kneeling-lat-stretch", 1, 60, 0, 10), H("forearm-stretch", 1, 40, 0, 10), H("childs-pose", 1, 60, 0, 0),
      ] },
    ],
    notes: L(
      "Choisis un élastique qui te laisse 2 répétitions en réserve ; raccourcis-le pour durcir. " + NO_FINGERS.fr,
      "Pick a band that leaves 2 reps in reserve; shorten it to make it harder. " + NO_FINGERS.en,
    ),
  },

  /* ── 3 · 60 min · Lower-body strength ───────────────────────────────── */
  {
    key: "bas-du-corps-60", minutes: 60, objective: "STRENGTH", load: "MODERATE", method: "strength-conditioning",
    title: L("Force bas du corps", "Lower-body strength"),
    summary: L(
      "Force d’une jambe, fessiers et ischios, équilibre et chevilles : les jambes qui poussent sur les pieds.",
      "Single-leg strength, glutes and hamstrings, balance and ankles: the legs that push through your feet.",
    ),
    focus: [L("Force d’une jambe", "Single-leg strength"), L("Stabilité des genoux", "Knee stability"), L("Équilibre", "Balance")],
    sections: [
      { block: "WARMUP", title: WARMUP, items: [
        H("joint-circles", 1, 120, 0, 10), H("march-arm-swings", 1, 120, 0, 10), R("glute-bridge", 1, 12, 0, 10),
        R("squat-to-stand", 1, 6, 0, 10), R("leg-swings", 1, 10, 0, 15), R("band-lateral-walk", 1, 10, 0, 30),
      ] },
      { block: "MAIN", title: L("Force d’une jambe", "Single-leg strength"), items: [
        R("split-squat", 3, 8, 60, 60), R("single-leg-rdl", 3, 8, 45, 60), R("single-leg-squat-to-chair", 3, 6, 45, 60),
      ] },
      { block: "MAIN", title: L("Hanches et fessiers", "Hips and glutes"), items: [
        R("band-squat", 3, 12, 60, 45), R("single-leg-bridge", 3, 10, 30, 30), R("clamshell", 2, 12, 20, 45),
      ] },
      { block: "MAIN", title: L("Équilibre et chevilles", "Balance and ankles"), items: [
        R("balance-reach", 2, 4, 30, 30), R("calf-raise-step", 2, 12, 45, 30), H("wall-sit", 2, 45, 60, 45),
      ] },
      { block: "COOLDOWN", title: COOLDOWN, items: [
        H("side-lying-quad", 1, 40, 0, 10), H("strap-hamstring", 1, 40, 0, 10), H("figure-four", 1, 40, 0, 10), H("wall-calf", 1, 30, 0, 0),
      ] },
    ],
    notes: L(
      "Genoux sensibles : réduis l’amplitude des fentes et du squat sur une jambe plutôt que de forcer. Pas de chaise stable : prends l’alternative au sol indiquée.",
      "Sensitive knees: shorten the range of the lunges and the single-leg squat rather than forcing. No stable chair: use the floor alternative given.",
    ),
  },

  /* ── 4 · 60 min · Full flexibility ──────────────────────────────────── */
  {
    key: "souplesse-60", minutes: 60, objective: "MOBILITY", load: "LIGHT", method: "mobility",
    title: L("Souplesse complète", "Full flexibility"),
    summary: L(
      "Tout le corps : hanches et adducteurs, arrière des jambes, chevilles, haut du dos et épaules, avec le bloc de souplesse active.",
      "The whole body: hips and adductors, back of the legs, ankles, upper back and shoulders, with the active flexibility block.",
    ),
    focus: [L("Adducteurs", "Adductors"), L("Ischios et chevilles", "Hamstrings and ankles"), L("Épaules et haut du dos", "Shoulders and upper back")],
    sections: [
      { block: "WARMUP", title: WARMUP, items: [
        H("joint-circles", 1, 120, 0, 10), H("march-arm-swings", 1, 90, 0, 10), R("cat-cow", 1, 8, 0, 10),
        R("thoracic-rotation", 1, 6, 0, 10), R("low-lunge-rotation", 1, 4, 0, 20),
      ] },
      { block: "MAIN", title: L("Hanches et adducteurs", "Hips and adductors"), items: [
        H("butterfly", 2, 45, 15, 20), R("supine-hip-internal-rotation", 2, 8, 15, 20), H("pancake", 2, 45, 15, 20), H("pigeon", 1, 50, 0, 20),
        H("wall-straddle", 1, 120, 0, 30),
      ] },
      { block: "MAIN", title: L("Arrière des jambes et chevilles", "Back of the legs and ankles"), items: [
        H("strap-hamstring", 2, 40, 15, 20), R("knee-to-wall", 2, 10, 15, 20), H("wall-calf", 1, 40, 0, 30),
      ] },
      { block: "MAIN", title: L("Haut du dos et épaules", "Upper back and shoulders"), items: [
        H("towel-thoracic-opener", 1, 90, 0, 20), H("wall-pec", 2, 30, 15, 20), H("kneeling-lat-stretch", 2, 45, 15, 20), H("forearm-stretch", 1, 40, 0, 30),
      ] },
      { block: "MAIN", title: LATTICE, items: lattice(2, 20) },
      { block: "COOLDOWN", title: COOLDOWN, items: [
        H("side-lying-quad", 1, 40, 0, 10), H("childs-pose", 1, 60, 0, 10), H("legs-up-breathing", 1, 120, 0, 0),
      ] },
    ],
    notes: L(
      "Étirements à 4/10 : une sensation d’étirement nette, jamais de douleur. Respire lentement pendant les positions tenues.",
      "Stretch at 4/10: a clear stretch, never pain. Breathe slowly in the held positions.",
    ),
  },

  /* ── 5 · 90 min · Advanced mobility and control ─────────────────────── */
  {
    key: "mobilite-avancee-90", minutes: 90, objective: "MOBILITY", load: "MODERATE", method: "mobility",
    title: L("Mobilité avancée et contrôle", "Advanced mobility and control"),
    summary: L(
      "La grande séance hanches : amplitude, force au bout de l’amplitude, équilibre et pieds hauts contrôlés, plus le bloc de souplesse active en 3 séries.",
      "The big hip séance: range, strength at end range, balance and controlled high steps, plus the active flexibility block in 3 sets.",
    ),
    focus: [L("Force en amplitude", "End-range strength"), L("Contrôle de hanche", "Hip control"), L("Équilibre", "Balance")],
    sections: [
      { block: "WARMUP", title: WARMUP, items: [
        H("joint-circles", 1, 120, 0, 10), H("march-arm-swings", 1, 120, 0, 10), R("cat-cow", 1, 8, 0, 10),
        R("quadruped-hip-circles", 2, 5, 15, 15), R("thoracic-rotation", 1, 6, 0, 10), R("leg-swings", 1, 10, 0, 10),
        R("squat-to-stand", 1, 6, 0, 10), R("glute-bridge", 1, 12, 0, 30),
      ] },
      { block: "MAIN", title: L("Hanches : amplitude", "Hips: range"), items: [
        R("supine-knee-sways", 2, 8, 20, 20), R("seated-hip-rotations", 2, 8, 20, 20), R("adductor-rock-backs", 2, 8, 20, 20),
        R("supine-hip-internal-rotation", 2, 8, 20, 30),
      ] },
      { block: "MAIN", title: L("Force au bout de l’amplitude", "End-range strength"), items: [
        R("ninety-ninety-lift", 3, 5, 30, 30), R("high-knee-hold", 3, 5, 30, 30), R("hip-airplane", 3, 4, 30, 30), R("rock-over-lunge", 2, 5, 45, 45),
      ] },
      { block: "MAIN", title: L("Contrôle en situation de grimpe", "Control in climbing positions"), items: [
        R("wall-high-step", 3, 6, 30, 30), R("lateral-foot-placement", 3, 6, 30, 30), H("eyes-closed-balance", 2, 30, 15, 30),
      ] },
      { block: "MAIN", title: LATTICE_3, items: lattice(3, 20) },
      { block: "MAIN", title: L("Ouverture", "Opening"), items: [
        H("pancake", 1, 60, 0, 20), H("pigeon", 1, 60, 0, 20), H("half-kneeling-hip-flexor", 1, 45, 0, 30),
      ] },
      { block: "COOLDOWN", title: COOLDOWN, items: [H("legs-up-breathing", 1, 180, 0, 0)] },
    ],
    notes: L(
      "Une séance longue mais modérée : le travail en fin d’amplitude fatigue. Évite-la la veille d’une grosse journée de grimpe. Les mouvements exigeants suivent ton dernier test des hanches.",
      "A long but moderate séance: end-range work is tiring. Avoid it the day before a big climbing day. Demanding movements follow your latest hip test.",
    ),
  },

  /* ── 6 · 90 min · Climber strength and core ─────────────────────────── */
  {
    key: "force-gainage-90", minutes: 90, objective: "STRENGTH", load: "HARD", method: "strength-conditioning",
    title: L("Force et gainage grimpeur", "Climber strength and core"),
    summary: L(
      "Le grand bloc de force : tirage et blocages à l’élastique, gainage complet, jambes, épaules et antagonistes.",
      "The big strength block: band pulling and lock-offs, full core, legs, shoulders and antagonists.",
    ),
    focus: [L("Tirage et blocages", "Pulling and lock-offs"), L("Tension du corps", "Body tension"), L("Épaules", "Shoulders")],
    sections: [
      { block: "WARMUP", title: WARMUP, items: [
        H("joint-circles", 1, 120, 0, 10), H("march-arm-swings", 1, 120, 0, 10), R("scapular-push-up", 2, 10, 20, 15),
        R("band-pull-apart", 2, 15, 20, 15), R("thoracic-rotation", 1, 6, 0, 10), R("glute-bridge", 1, 12, 0, 10),
        R("dead-bug", 1, 6, 0, 10), R("band-external-rotation-free", 1, 12, 0, 30),
      ] },
      { block: "MAIN", title: L("Tirage et blocages", "Pulling and lock-offs"), items: [
        R("band-bent-row", 4, 10, 60, 60), R("band-overhead-pulldown", 4, 10, 60, 60), R("band-one-arm-row", 3, 10, 45, 60),
        H("band-lockoff", 3, 15, 45, 60), R("prone-towel-pulldown", 3, 8, 45, 60),
      ] },
      { block: "MAIN", title: L("Gainage", "Core"), items: [
        H("hollow-hold", 3, 25, 40, 30), H("side-plank", 3, 30, 30, 30), R("plank-shoulder-taps", 3, 10, 30, 30),
        R("reverse-crunch", 3, 10, 40, 30), R("side-lying-adductor", 3, 6, 30, 45),
      ] },
      { block: "MAIN", title: L("Jambes", "Legs"), items: [R("split-squat", 3, 8, 60, 45)] },
      { block: "MAIN", title: L("Épaules et antagonistes", "Shoulders and antagonists"), items: [
        R("push-up", 3, 10, 60, 45), R("band-face-pull-free", 3, 15, 45, 30), R("finger-extensions", 2, 20, 30, 30),
      ] },
      { block: "COOLDOWN", title: COOLDOWN, items: [
        H("wall-pec", 1, 40, 0, 10), H("kneeling-lat-stretch", 1, 60, 0, 10), H("forearm-stretch", 1, 40, 0, 10),
        H("childs-pose", 1, 60, 0, 10), H("legs-up-breathing", 1, 120, 0, 0),
      ] },
    ],
    notes: L(
      "Séance dure : pas la veille ni le lendemain d’une autre séance dure. Laisse 2 répétitions en réserve sur le tirage. " + NO_FINGERS.fr,
      "A hard séance: not the day before or after another hard one. Leave 2 reps in reserve on the pulls. " + NO_FINGERS.en,
    ),
  },

  /* ── 7 · 90 min · Full conditioning ─────────────────────────────────── */
  {
    key: "conditionnement-90", minutes: 90, objective: "CONDITIONING", load: "HARD", method: "strength-conditioning",
    title: L("Conditionnement complet", "Full conditioning"),
    summary: L(
      "Trois circuits : tout le corps, jambes et équilibre, haut du corps et gainage. Le cœur monte, la technique reste propre.",
      "Three circuits: whole body, legs and balance, upper body and core. Heart rate up, technique stays clean.",
    ),
    focus: [L("Cardio", "Cardio"), L("Puissance des jambes", "Leg power"), L("Gainage", "Core")],
    sections: [
      { block: "WARMUP", title: WARMUP, items: [
        H("joint-circles", 1, 120, 0, 10), H("march-arm-swings", 1, 150, 0, 10), R("squat-to-stand", 1, 6, 0, 10),
        R("leg-swings", 1, 10, 0, 10), R("scapular-push-up", 1, 10, 0, 10), R("glute-bridge", 1, 12, 0, 10),
        H("jumping-jacks", 2, 30, 20, 45),
      ] },
      { block: "MAIN", title: L("Circuit 1 · tout le corps", "Circuit 1 · whole body"), items: [
        H("jumping-jacks", 4, 40, 20, 30), R("squat-jumps", 4, 10, 40, 30), H("mountain-climbers", 4, 30, 30, 30),
        R("push-up", 4, 10, 45, 30), R("burpees", 3, 8, 45, 60),
      ] },
      { block: "MAIN", title: L("Circuit 2 · jambes et équilibre", "Circuit 2 · legs and balance"), items: [
        R("skater-hops", 4, 8, 30, 30), R("split-squat", 3, 10, 45, 30), R("band-squat", 3, 15, 45, 30),
        R("balance-reach", 2, 4, 20, 30), H("wall-sit", 2, 45, 45, 60),
      ] },
      { block: "MAIN", title: L("Circuit 3 · haut du corps et gainage", "Circuit 3 · upper body and core"), items: [
        R("band-bent-row", 4, 15, 30, 30), H("bear-crawl", 4, 30, 30, 30), R("plank-shoulder-taps", 3, 12, 30, 30),
        R("hollow-rocks", 3, 12, 30, 30), H("shadow-boxing", 2, 60, 30, 60),
      ] },
      { block: "COOLDOWN", title: COOLDOWN, items: [
        H("march-arm-swings", 1, 60, 0, 10, L("Marche lente, respiration qui redescend", "Slow march, breathing settles")),
        H("strap-hamstring", 1, 40, 0, 10), H("side-lying-quad", 1, 40, 0, 10), H("wall-calf", 1, 30, 0, 10),
        H("kneeling-lat-stretch", 1, 60, 0, 10), H("legs-up-breathing", 1, 120, 0, 0),
      ] },
    ],
    notes: L(
      "Séance dure. Sans sauts (voisins, étage, genoux), prends les versions sans saut décrites. Pas la veille d’une journée de grimpe dure.",
      "A hard séance. With no jumping (neighbours, upper floor, knees), use the no-jump versions described. Not the day before a hard climbing day.",
    ),
  },

  /* ── 8 · 90 min · Mobility, flexibility and recovery ────────────────── */
  {
    key: "recuperation-90", minutes: 90, objective: "RECOVERY", load: "LIGHT", method: "mobility",
    title: L("Mobilité, souplesse et récupération", "Mobility, flexibility and recovery"),
    summary: L(
      "Une longue séance douce : hanches, colonne et épaules, souplesse en profondeur et respiration. Pour récupérer en gagnant de l’amplitude.",
      "A long gentle séance: hips, spine and shoulders, deep flexibility and breathing. Recover while gaining range.",
    ),
    focus: [L("Récupération", "Recovery"), L("Hanches et colonne", "Hips and spine"), L("Respiration", "Breathing")],
    sections: [
      { block: "WARMUP", title: L("Mise en route douce", "Gentle start"), items: [
        H("joint-circles", 1, 180, 0, 10), R("cat-cow", 1, 10, 0, 10), H("childs-pose", 1, 60, 0, 10),
        R("quadruped-hip-circles", 2, 5, 15, 15), R("thoracic-rotation", 2, 6, 15, 30),
      ] },
      { block: "MAIN", title: L("Hanches en douceur", "Gentle hips"), items: [
        R("supine-knee-sways", 2, 8, 20, 20), R("seated-hip-rotations", 2, 6, 20, 20), R("adductor-rock-backs", 2, 8, 20, 20),
        R("supine-hip-internal-rotation", 2, 8, 20, 20), H("butterfly", 2, 60, 20, 30),
      ] },
      { block: "MAIN", title: L("Activation douce", "Gentle activation"), items: [
        R("glute-bridge", 2, 12, 20, 20), R("bird-dog", 2, 6, 20, 30),
      ] },
      { block: "MAIN", title: L("Colonne et épaules", "Spine and shoulders"), items: [
        H("towel-thoracic-opener", 2, 60, 15, 20), R("reverse-snow-angels", 2, 6, 30, 20), R("band-pull-apart", 2, 15, 30, 20,
          L("Élastique léger, tension 3/10", "Light band, tension 3/10")), H("wall-pec", 2, 30, 15, 20), H("kneeling-lat-stretch", 2, 45, 15, 30),
      ] },
      { block: "MAIN", title: LATTICE, items: lattice(2, 20, LIGHT_LATTICE) },
      { block: "MAIN", title: L("Souplesse en profondeur", "Deep flexibility"), items: [
        H("strap-hamstring", 2, 45, 15, 20), H("side-lying-quad", 2, 40, 15, 20), H("wall-straddle", 1, 120, 0, 20),
        H("figure-four", 2, 40, 15, 20), H("half-kneeling-hip-flexor", 2, 40, 15, 20), R("knee-to-wall", 2, 10, 15, 20), H("wall-calf", 1, 40, 0, 20),
        H("forearm-stretch", 1, 40, 0, 30),
      ] },
      { block: "COOLDOWN", title: COOLDOWN, items: [H("legs-up-breathing", 1, 300, 0, 0)] },
    ],
    notes: L(
      "Tout reste sous 4/10. C’est la séance à faire le lendemain d’un effort dur ou d’un long trajet.",
      "Everything stays under 4/10. This is the séance for the day after a hard effort or a long journey.",
    ),
  },
];

export const AWAY_SESSION_BY_KEY: ReadonlyMap<string, AwaySession> = new Map(AWAY_SESSIONS.map((s) => [s.key, s]));
