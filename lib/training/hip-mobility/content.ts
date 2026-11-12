import type { Localized } from "@/lib/training/catalogue";
import type { LoadMap } from "@/lib/training/health";

/**
 * Hip Mobility — From Zero to Functional Climbing Mobility.
 *
 * Programme content, written in LEBLOND's own words from common coaching and
 * rehabilitation practice. It is GENERIC: no one's personal history appears here.
 * Doses are conservative starting points for a very low starting point, not an
 * individual prescription; every exercise has an easier and a harder version and
 * stays in a comfortable, controlled range (no forced stretching, no bouncing, no
 * aggressive end-range loading, never into sharp pain).
 *
 * Progression is by LEVEL, never by date: the week ranges in ROADMAP are only
 * what is typical, and a climber stays at a level as long as they need.
 */

export const HIP_PROGRAMME = "HIP" as const;
export type MobilityProgramme = typeof HIP_PROGRAMME;
/** The Atlas method id of every hip-mobility training session. */
export const HIP_METHOD_ID = "hip-mobility";

export const LEVELS = [0, 1, 2, 3, 4] as const;
export type Level = (typeof LEVELS)[number];

/** Internal training stages. Explicitly NOT a clinical classification. */
export const LEVEL_LABELS: Record<Level, { name: Localized; detail: Localized }> = {
  0: {
    name: { fr: "Niveau 0 · Très limité, beaucoup d’appui", en: "Level 0 · Highly restricted, heavy support" },
    detail: {
      fr: "Les positions de base demandent les mains, un coussin ou un support. Objectif : des mouvements doux, confortables et répétables.",
      en: "Basic positions need hands, a cushion or a support. Goal: gentle movements that are comfortable and repeatable.",
    },
  },
  1: {
    name: { fr: "Niveau 1 · Mobilité de base, avec appui", en: "Level 1 · Basic supported mobility" },
    detail: {
      fr: "Les mouvements se font avec contrôle tant qu’il y a un appui (mains, coussin, mur).",
      en: "Movements are controlled as long as there is support (hands, cushion, wall).",
    },
  },
  2: {
    name: { fr: "Niveau 2 · Mouvement contrôlé sur une amplitude modeste", en: "Level 2 · Controlled movement through a modest range" },
    detail: {
      fr: "Peu ou pas d’appui, contrôle sur une amplitude encore modeste.",
      en: "Little or no support, control through a still modest range.",
    },
  },
  3: {
    name: { fr: "Niveau 3 · Fonctionnel, spécifique à l’escalade", en: "Level 3 · Functional, climbing-specific" },
    detail: {
      fr: "Les pieds restent en pression au mur pendant les transferts et les rotations de hanche.",
      en: "Feet keep pressure on the wall through foot transfers and hip turns.",
    },
  },
  4: {
    name: { fr: "Niveau 4 · Contrôle avancé", en: "Level 4 · Advanced control" },
    detail: {
      fr: "Contrôle sans les mains sur toute l’amplitude confortable, pieds larges et hauts au mur.",
      en: "Hands-free control through the whole comfortable range, wide and high feet on the wall.",
    },
  },
};

export const NOT_CLINICAL: Localized = {
  fr: "Niveau d’entraînement interne à LEBLOND, pas un bilan médical ni une mesure clinique.",
  en: "LEBLOND’s internal training stage, not a medical assessment or a clinical measurement.",
};

/** The 12-week guide. Ranges are typical, never targets: content follows the level. */
export const ROADMAP: readonly { key: "discover" | "build" | "transfer"; typicalWeeks: Localized; levels: readonly Level[]; title: Localized; focus: readonly Localized[]; available: boolean }[] = [
  {
    key: "discover", levels: [0], available: true,
    typicalWeeks: { fr: "souvent semaines 1–2", en: "often weeks 1–2" },
    title: { fr: "Découvrir", en: "Discover" },
    focus: [
      { fr: "De toutes petites amplitudes, avec appui.", en: "Tiny ranges, with support." },
      { fr: "3 à 4 séances courtes par semaine.", en: "3–4 short sessions a week." },
    ],
  },
  {
    key: "build", levels: [1, 2], available: false,
    typicalWeeks: { fr: "souvent semaines 3–6, selon la tolérance", en: "often weeks 3–6, as tolerated" },
    title: { fr: "Construire", en: "Build" },
    focus: [
      { fr: "Transitions 90/90 avec appui et rotation contrôlée.", en: "Supported 90/90 transitions and controlled rotation." },
      { fr: "Travail doux des adducteurs.", en: "Gentle adductor work." },
      { fr: "Montées de genou actives sur marche basse.", en: "Low active high-steps." },
      { fr: "Déplacements latéraux avec appui.", en: "Supported lateral movement." },
    ],
  },
  {
    key: "transfer", levels: [3, 4], available: false,
    typicalWeeks: { fr: "souvent semaines 7–12", en: "often weeks 7–12" },
    title: { fr: "Transférer au mur", en: "Transfer to the wall" },
    focus: [
      { fr: "Placement des pieds et stabilité sur deux pieds.", en: "Foot placement and two-feet stability." },
      { fr: "Petites rotations et déplacements latéraux de hanche.", en: "Small hip turns and side-to-side hip movement." },
      { fr: "Bouger un pied en poussant sur l’autre, prises de pied de plus en plus écartées.", en: "Moving one foot while pressing through the other, progressively wider footholds." },
      { fr: "Pieds hauts contrôlés, sur terrain facile ou pan réglé moins raide. Exercices de pan facultatifs tant que tu n’es pas prêt.", en: "Controlled high steps, on easy terrain or a less steep board. Board drills stay optional until you are ready." },
    ],
  },
];

export type Quality = "PASSIVE" | "ACTIVE" | "STRENGTH" | "COORDINATION";
export type TestId = "A" | "B" | "C" | "D";

export type MobilityExercise = {
  id: string;
  level: Level;
  name: Localized;
  /** What it is for, in one sentence. */
  purpose: Localized;
  quality: Quality;
  /** Counted per side (left then right) or as one alternating movement. */
  perSide: boolean;
  /** Standard prescription: one set (per side when perSide), `reps` slow reps. */
  reps: { start: number; min: number; max: number };
  /** Seconds between the two sides (or between sets). */
  restSeconds: number;
  /** Seconds before the next exercise. */
  restAfterSeconds: number;
  /** Tempo / intensity cue shown with the target. */
  cue: Localized;
  steps: readonly Localized[];
  mistakes: readonly Localized[];
  safety: readonly Localized[];
  easier: { name: Localized; how: Localized };
  harder: { name: Localized; how: Localized };
  /** The assessment test whose result sets the starting version. */
  test: TestId | null;
  /** Areas it loads, for the declared-injury rules (editorial heuristic, like health.ts). */
  loads: LoadMap;
};

const L = (fr: string, en: string): Localized => ({ fr, en });

const COMFORT = L(
  "Amplitude confortable uniquement : pas d’à-coups, pas de forçage en fin d’amplitude, jamais de douleur vive.",
  "Comfortable range only: no bouncing, no forcing at the end of the range, never sharp pain.",
);

export const EXERCISES: readonly MobilityExercise[] = [
  {
    id: "supine-knee-sways", level: 0, quality: "PASSIVE", perSide: false, test: null,
    name: L("Balancier des genoux sur le dos", "Gentle supine knee sways"),
    purpose: L("Réveiller la rotation des hanches sans aucune charge.", "Wake up hip rotation with no load at all."),
    reps: { start: 8, min: 6, max: 12 }, restSeconds: 0, restAfterSeconds: 20,
    cue: L("Lent : 3 à 4 s par côté", "Slow: 3–4 s each way"),
    steps: [
      L("Allonge-toi sur le dos, genoux pliés, pieds à plat un peu plus écartés que les hanches, bras posés de chaque côté.",
        "Lie on your back, knees bent, feet flat a little wider than your hips, arms resting out to the sides."),
      L("Laisse descendre les deux genoux d’un côté, seulement tant que c’est confortable.",
        "Let both knees lower to one side, only as far as is comfortable."),
      L("Reviens au centre puis va de l’autre côté. Un aller-retour des deux côtés = une répétition.",
        "Come back to the middle, then go to the other side. Both sides and back = one rep."),
      L("Garde les épaules au sol et souffle quand les genoux descendent.",
        "Keep your shoulders on the floor and breathe out as the knees go down."),
    ],
    mistakes: [
      L("Laisser tomber les genoux d’un coup au lieu de les accompagner.", "Letting the knees drop instead of lowering them."),
      L("Décoller l’épaule opposée pour aller plus loin.", "Lifting the opposite shoulder to go further."),
      L("Bloquer la respiration.", "Holding your breath."),
    ],
    safety: [COMFORT, L("Arrête avant tout pincement dans l’aine ou à l’avant de la hanche.", "Stop before any pinch in the groin or the front of the hip.")],
    easier: {
      name: L("Petite amplitude, pieds rapprochés", "Small range, feet together"),
      how: L("Pieds joints, bouge les genoux de quelques centimètres seulement, ou pose un coussin de chaque côté pour les accueillir.",
        "Feet together, move the knees only a few centimetres, or put a cushion on each side for them to land on."),
    },
    harder: {
      name: L("Pieds écartés, un genou vers l’intérieur", "Feet wide, one knee inwards"),
      how: L("Pieds largement écartés : laisse un genou descendre vers l’intérieur, vers l’autre pied, pendant que l’autre jambe reste immobile.",
        "Feet wide apart: let one knee lower inwards, towards the other foot, while the other leg stays still."),
    },
    loads: { hip: 1, back: 1 },
  },
  {
    id: "seated-hip-rotations", level: 0, quality: "ACTIVE", perSide: true, test: "A",
    name: L("Rotations de hanches assises, avec appui", "Supported seated hip rotations"),
    purpose: L("Apprendre à tourner les hanches d’un côté à l’autre, la base des positions 90/90.",
      "Learn to turn the hips from side to side, the basis of 90/90 positions."),
    reps: { start: 6, min: 4, max: 10 }, restSeconds: 15, restAfterSeconds: 30,
    cue: L("Lent et contrôlé, appui des mains selon le besoin", "Slow and controlled, lean on your hands as needed"),
    steps: [
      L("Assieds-toi au sol ou sur un coussin ferme, mains posées derrière toi, genoux pliés, pieds plus écartés que les hanches.",
        "Sit on the floor or on a firm cushion, hands behind you, knees bent, feet wider than your hips."),
      L("Tourne lentement les deux genoux du même côté, aussi loin que c’est confortable : la jambe de devant tourne vers l’extérieur, celle de derrière vers l’intérieur.",
        "Slowly turn both knees to the same side, as far as is comfortable: the front leg turns out, the back leg turns in."),
      L("Appuie-toi sur les mains autant que nécessaire, puis remonte les genoux par le centre.",
        "Lean on your hands as much as you need, then bring the knees back up through the middle."),
      L("Fais toutes les répétitions vers un côté, puis vers l’autre.", "Do all the reps to one side, then to the other."),
    ],
    mistakes: [
      L("Pousser les genoux vers le sol pour gagner de l’amplitude.", "Pushing the knees towards the floor to gain range."),
      L("Se laisser tomber en arrière sur les mains pour tricher sur l’amplitude.", "Collapsing back onto the hands to cheat the range."),
      L("Aller vite et laisser l’élan faire le travail.", "Going fast and letting momentum do the work."),
    ],
    safety: [COMFORT, L("Ce sont les hanches qui tournent, pas les genoux : si un genou tire ou fait mal, écarte davantage les pieds et réduis l’amplitude.",
      "The hips turn, not the knees: if a knee pulls or hurts, widen the feet and shrink the range.")],
    easier: {
      name: L("Sur un coussin haut, demi-amplitude", "On a high cushion, half range"),
      how: L("Assis sur un coussin ou une couverture pliée de 10 à 20 cm, pieds bien écartés, ne tourne les genoux qu’à mi-chemin.",
        "Sit on a firm cushion or folded blanket 10–20 cm high, feet wide, and turn the knees only halfway."),
    },
    harder: {
      name: L("Une main, puis le bout des doigts", "One hand, then fingertips"),
      how: L("Même mouvement avec une seule main en appui, puis seulement le bout des doigts, toujours sous contrôle.",
        "Same movement with only one hand behind you, then just your fingertips, still under control."),
    },
    loads: { hip: 2, knee: 1 },
  },
  {
    id: "adductor-rock-backs", level: 0, quality: "PASSIVE", perSide: true, test: "B",
    name: L("Bascules arrière douces pour les adducteurs, avec appui", "Gentle supported adductor rock-backs"),
    purpose: L("Ouvrir doucement l’intérieur des cuisses pour écarter les pieds.", "Gently open the inner thighs so the feet can spread wider."),
    reps: { start: 6, min: 4, max: 10 }, restSeconds: 15, restAfterSeconds: 30,
    cue: L("Étirement léger (≈ 3/10), 2 s à l’arrière", "Light stretch (≈ 3/10), 2 s at the back"),
    steps: [
      L("À quatre pattes sur un tapis, un coussin sous le genou si besoin. Tends une jambe sur le côté, pied à plat.",
        "On hands and knees on a mat, a cushion under the knee if needed. Stretch one leg out to the side, foot flat."),
      L("Recule doucement le bassin vers le talon de la jambe pliée, jusqu’à sentir un léger étirement à l’intérieur de la cuisse tendue.",
        "Slowly rock your hips back towards the heel of the bent leg, until you feel a light stretch on the inside of the straight thigh."),
      L("Reviens au départ. C’est une répétition.", "Come back to the start. That is one rep."),
      L("Fais toutes les répétitions, puis change de jambe.", "Do all the reps, then switch legs."),
    ],
    mistakes: [
      L("Reculer plus loin que confortable ou rebondir en fin de mouvement.", "Rocking back further than comfortable, or bouncing at the end."),
      L("Creuser ou arrondir fortement le bas du dos.", "Arching or rounding the lower back a lot."),
      L("Laisser le pied de la jambe tendue rouler sur le côté.", "Letting the foot of the straight leg roll over."),
    ],
    safety: [COMFORT, L("Jamais de tiraillement vif dans l’aine. Genou sensible au sol : ajoute un coussin ou prends la version plus facile, debout.",
      "Never a sharp pull in the groin. Kneeling knee uncomfortable: add padding or use the easier, standing version.")],
    easier: {
      name: L("Debout, mains sur une table", "Standing, hands on a table"),
      how: L("Debout face à une table, pieds un peu plus écartés que les hanches : recule le bassin de quelques centimètres en le décalant légèrement d’un côté.",
        "Standing facing a table, feet a little wider than your hips: push the hips back a few centimetres, shifting slightly to one side."),
    },
    harder: {
      name: L("Jambe plus loin, pause de 2 s", "Leg further out, 2 s pause"),
      how: L("Tends la jambe un peu plus loin et marque 2 s de pause à l’arrière, toujours sans douleur.",
        "Place the leg a little further out and pause 2 s at the back, still pain-free."),
    },
    loads: { hip: 2, knee: 2 },
  },
  {
    id: "low-step-placements", level: 0, quality: "ACTIVE", perSide: true, test: "C",
    name: L("Pose du pied sur une marche basse, avec appui", "Low-step foot placements with support"),
    purpose: L("Lever la jambe avec les muscles de la hanche, comme pour un pied haut, sans s’aider des mains.",
      "Lift the leg with the hip muscles, as for a high foot, without pulling with the hands."),
    reps: { start: 5, min: 4, max: 10 }, restSeconds: 15, restAfterSeconds: 30,
    cue: L("Pied posé en silence, buste droit", "Quiet foot, tall chest"),
    steps: [
      L("Debout face à une marche basse et stable (10 à 20 cm), une main sur un mur, une rampe ou une chaise.",
        "Stand facing a low, stable step (10–20 cm), one hand on a wall, rail or chair."),
      L("Lève le genou et pose tout le pied sur la marche, sans bruit, puis repose-le au sol.",
        "Lift the knee and place the whole foot quietly on the step, then put it back on the floor."),
      L("Reste grand : c’est la hanche qui lève la jambe, pas un recul du buste.",
        "Stay tall: the hip lifts the leg, not a lean backwards."),
      L("Fais toutes les répétitions d’une jambe, puis de l’autre.", "Do all the reps on one leg, then the other."),
    ],
    mistakes: [
      L("Se pencher en arrière ou remonter la hanche pour monter le pied.", "Leaning back or hiking the hip to get the foot up."),
      L("Accrocher ou taper le pied contre la marche.", "Catching or banging the foot on the step."),
      L("S’agripper au support au point que les bras soulèvent le corps.", "Gripping the support so hard the arms lift the body."),
    ],
    safety: [
      L("Choisis une marche assez basse pour ne jamais accrocher les orteils ; support stable à portée de main.",
        "Pick a step low enough that you never catch your toes, with a stable support within reach."),
      L("Genou sensible : marche basse et mouvement lent.", "Sensitive knee: low step and slow movement."),
    ],
    easier: {
      name: L("Toucher du bout du pied, marche plus basse", "Toe touch on a lower step"),
      how: L("Utilise une marche plus basse (un gros livre, 5 à 10 cm) et touche-la seulement du bout du pied, les deux mains en appui.",
        "Use a lower step (a thick book, 5–10 cm) and just touch it with your toes, both hands on the support."),
    },
    harder: {
      name: L("Marche un peu plus haute, appui léger", "Slightly higher step, lighter support"),
      how: L("Une marche quelques centimètres plus haute, ou seulement le bout des doigts sur le support ; marque 1 s pied posé.",
        "A step a few centimetres higher, or fingertips only on the support; pause 1 s with the foot on the step."),
    },
    loads: { hip: 2, knee: 1 },
  },
  {
    id: "lateral-weight-shifts", level: 0, quality: "COORDINATION", perSide: true, test: "B",
    name: L("Transferts de poids latéraux, avec appui", "Supported side-to-side weight shifts"),
    purpose: L("Déplacer les hanches au-dessus d’un pied puis de l’autre sans perdre l’équilibre, comme au mur.",
      "Move the hips over one foot then the other without losing balance, as on the wall."),
    reps: { start: 6, min: 4, max: 10 }, restSeconds: 15, restAfterSeconds: 0,
    cue: L("Lent, pieds à plat, 1 s au-dessus du pied", "Slow, feet flat, 1 s over the foot"),
    steps: [
      L("Debout, pieds un peu plus écartés que les hanches, pointes légèrement ouvertes, mains sur une table, un dossier de chaise ou un mur.",
        "Stand with feet a little wider than your hips, toes slightly out, hands on a table, chair back or wall."),
      L("Déplace lentement ton poids au-dessus d’un pied en pliant un peu ce genou ; l’autre jambe reste allongée, les deux pieds à plat.",
        "Slowly shift your weight over one foot, bending that knee a little; the other leg stays long, both feet flat."),
      L("Reviens par le centre et va de l’autre côté. Une répétition par côté.", "Come back through the middle and shift to the other side. One rep per side."),
      L("Garde la poitrine haute et le genou dans l’axe des orteils.", "Keep the chest up and the knee in line with the toes."),
    ],
    mistakes: [
      L("Décoller le talon de la jambe allongée ou laisser glisser les pieds.", "Lifting the heel of the long leg, or letting the feet slide."),
      L("Laisser le genou rentrer vers l’intérieur.", "Letting the knee cave inwards."),
      L("Descendre plus bas que ce que tu peux remonter sous contrôle.", "Going lower than you can come back from with control."),
    ],
    safety: [COMFORT, L("Commence petit : quelques centimètres de déplacement de hanche suffisent. Arrête si le genou fait mal ou si l’aine pince.",
      "Start small: a few centimetres of hip movement is enough. Stop if the knee hurts or the groin pinches.")],
    easier: {
      name: L("Pieds moins écartés, deux mains", "Narrower stance, both hands"),
      how: L("Pieds simplement à largeur de hanches, les deux mains sur un support stable, très petit déplacement.",
        "Feet just hip-width apart, both hands on a stable support, a very small shift."),
    },
    harder: {
      name: L("Pieds plus écartés, appui léger", "Wider stance, light hands"),
      how: L("Pieds un peu plus écartés, seulement le bout des doigts en appui, 2 s de pause au-dessus de chaque pied.",
        "Feet a little wider, fingertips only on the support, a 2 s pause over each foot."),
    },
    loads: { hip: 1, knee: 1 },
  },
];

export const EXERCISE_BY_ID: ReadonlyMap<string, MobilityExercise> = new Map(EXERCISES.map((e) => [e.id, e]));

export type SessionLength = "SHORT" | "STANDARD";

/**
 * The guided sessions of each level that has content. SHORT keeps one exercise
 * of each kind that matters most (rotation, active lift) for the busy days.
 */
export const LEVEL_SESSIONS: Partial<Record<Level, Record<SessionLength, { exercises: readonly string[]; minutes: number }>>> = {
  0: {
    STANDARD: {
      minutes: 10,
      exercises: ["supine-knee-sways", "seated-hip-rotations", "adductor-rock-backs", "low-step-placements", "lateral-weight-shifts"],
    },
    SHORT: { minutes: 5, exercises: ["supine-knee-sways", "seated-hip-rotations", "low-step-placements"] },
  },
};

/** The highest level at or below `level` that has a guided session. */
export function contentLevel(level: number): Level {
  for (let l = Math.min(4, Math.max(0, Math.floor(level))); l >= 0; l--) {
    if (LEVEL_SESSIONS[l as Level]) return l as Level;
  }
  return 0;
}

export const SESSION_TITLE: Localized = { fr: "Mobilité des hanches", en: "Hip mobility" };
export const PROGRAMME_TITLE: Localized = {
  fr: "Mobilité des hanches — Niveau débutant",
  en: "Hip Mobility — From Zero to Functional Climbing Mobility",
};
