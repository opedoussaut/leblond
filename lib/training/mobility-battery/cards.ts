import type { Localized } from "@/lib/training/catalogue";

/**
 * Mobility performance assessment (battery v2): 20 cards, 18 done at home and 2 by a
 * clinician. The battery is demanding by its precision and reproducibility, never by
 * forced movements. Every card records raw values (side, unit, value, pain before/after,
 * radiation) or an explicit "not done" with a reason, which is never a zero.
 *
 * There is NO global score: each test is followed on its own. Home tests are functional
 * proxies; they do not give a bone or neurological diagnosis.
 *
 * Bump a card's `version` when its protocol changes, so older values stay explainable.
 */
export const BATTERY_PROTOCOL_VERSION = 1;
/** Every four weeks. */
export const BATTERY_INTERVAL_DAYS = 28;
/** Years of 4-weekly history. */
export const MAX_BATTERY_SESSIONS = 200;

export const CARD_IDS = [
  "M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10",
  "M11", "M12", "M13", "M14", "M15", "M16", "M17", "M18", "M19", "M20",
] as const;
export type CardId = (typeof CARD_IDS)[number];

export const ACCESS_LEVELS = [
  "self_baseline", "self_when_painfree", "conditional_no_knee_pain", "after_clinical_review", "clinician_only",
] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const UNITS = ["SCORE", "SECONDS", "REPS", "CM", "DEGREES", "CATEGORY", "REPORT"] as const;
export type Unit = (typeof UNITS)[number];
export type MeasureUnit = Exclude<Unit, "CATEGORY" | "REPORT">;

export const SIDES = ["LEFT", "RIGHT", "BOTH"] as const;
export type Side = (typeof SIDES)[number];

export type Category = { id: string; label: Localized };

export type Measure = {
  /** The numeric unit the card is measured in (null when only categories are recorded). */
  unit: MeasureUnit | null;
  min: number;
  max: number;
  step: number;
  /**
   * The direction usually read as "more capacity" (more range, more reps, a shorter time).
   * Only used to word a change, never to judge it: a change with more pain or radiation is
   * never read as favourable.
   */
  higherIsMore: boolean;
  /** Stable categories, for when a number cannot be taken the same way each time. */
  categories?: readonly Category[];
};

/** Extra observations a card records next to its value. */
export type DetailField = "handsUsed" | "unilateral" | "compensation" | "limitedByOtherLeg" | "photo";

export type CardItem = { item: number; label: Localized };

export type Card = {
  id: CardId;
  version: number;
  access: AccessLevel;
  /** The two 40–45 minute slots; 0 = done by a clinician. */
  slot: 0 | 1 | 2;
  name: Localized;
  region: Localized;
  /** LR = each side separately; BOTH = once. */
  sides: "LR" | "BOTH";
  /** Several recorded items on one card (the 3 PSFS tasks, back and leg pain). */
  items: readonly CardItem[];
  /** Scored trials after one familiarisation try. */
  trials: 1 | 2;
  measure: Measure | null;
  /** Whether pain before / after and radiation are asked (movement cards). */
  painCheck: boolean;
  details: readonly DetailField[];
  /** How to do it. Null for clinician cards: they are never self-test tutorials. */
  how: readonly Localized[] | null;
  record: Localized;
  limit: Localized;
  /** A published minimal detectable change, when the brief gives one. */
  mdc?: { value: number; source: Localized };
  /** Context from the literature: never a target, never a diagnosis. */
  context?: Localized;
};

const L = (fr: string, en: string): Localized => ({ fr, en });
const ONE: readonly CardItem[] = [{ item: 1, label: L("", "") }];

const MORE_RANGE_CM = (max: number): Measure => ({ unit: "CM", min: 0, max, step: 0.5, higherIsMore: true });

const ANGLE_CATEGORIES_90: readonly Category[] = [
  { id: "BELOW_90", label: L("Moins de 90°", "Less than 90°") },
  { id: "ABOUT_90", label: L("Environ 90°", "About 90°") },
  { id: "ABOVE_90", label: L("Plus de 90°", "More than 90°") },
];

export const CARDS: readonly Card[] = [
  {
    id: "M01", version: 1, access: "self_baseline", slot: 1, sides: "BOTH", trials: 1, painCheck: false, details: [],
    name: L("Sécurité et symptômes", "Safety and symptoms"),
    region: L("Rachis / neurologique", "Spine / neurological"),
    items: [{ item: 1, label: L("Douleur du dos au repos", "Back pain at rest") }, { item: 2, label: L("Douleur de jambe au repos", "Leg pain at rest") }],
    measure: { unit: "SCORE", min: 0, max: 10, step: 1, higherIsMore: false },
    how: [
      L("Au repos, note ta douleur lombaire et ta douleur de jambe de 0 à 10.", "At rest, rate your low-back pain and your leg pain from 0 to 10."),
      L("Indique le côté et le territoire le plus bas où la douleur descend.", "Note the side and the lowest area the pain reaches."),
      L("Compare ton état (sensations, force) à la veille.", "Compare how you feel (sensation, strength) with yesterday."),
    ],
    record: L("Douleur dos et jambe 0–10, côté, territoire le plus bas, évolution depuis la veille.", "Back and leg pain 0–10, side, lowest area reached, change since yesterday."),
    limit: L("Repère fonctionnel à la maison, pas une mesure clinique.", "A home functional check, not a clinical measure."),
  },
  {
    id: "M02", version: 1, access: "self_baseline", slot: 1, sides: "BOTH", trials: 1, painCheck: false, details: [],
    name: L("PSFS — 3 tâches prioritaires", "PSFS — 3 priority tasks"),
    region: L("Fonction", "Function"),
    items: [
      { item: 1, label: L("Enfiler une chaussette", "Putting on a sock") },
      { item: 2, label: L("Placer le pied sur une prise latérale basse", "Placing the foot on a low side hold") },
      { item: 3, label: L("Rapprocher le bassin du mur sur un mur facile, sans chute", "Bringing the hips close to the wall on an easy wall, without falling") },
    ],
    measure: { unit: "SCORE", min: 0, max: 10, step: 1, higherIsMore: true },
    how: [
      L("Pour chaque tâche, note ta capacité actuelle : 0 = impossible, 10 = ton niveau habituel souhaité.", "For each task, rate what you can do now: 0 = impossible, 10 = your usual, wished-for level."),
      L("Ce sont les mêmes tâches chaque mois.", "The tasks stay the same every month."),
    ],
    record: L("0 à 10 pour chacune des 3 tâches.", "0 to 10 for each of the 3 tasks."),
    limit: L("Échelle de fonction rapportée par toi, pas une mesure d’amplitude.", "A self-reported function scale, not a range measure."),
  },
  {
    id: "M03", version: 1, access: "self_when_painfree", slot: 1, sides: "BOTH", items: ONE, trials: 2, painCheck: true, details: ["handsUsed"],
    name: L("Cinq levers de chaise", "Five chair stands"),
    region: L("Jambes / force", "Legs / strength"),
    measure: { unit: "SECONDS", min: 1, max: 120, step: 0.1, higherIsMore: false },
    how: [
      L("Chaise stable dont tu notes la hauteur, pieds au sol, bras croisés seulement si c’est possible.", "A stable chair whose height you note, feet on the floor, arms crossed only if you can."),
      L("Lève-toi complètement puis rassieds-toi, cinq fois. Chronomètre du départ au cinquième lever.", "Stand up fully then sit back down, five times. Time from the start to the fifth stand."),
      L("Si tu as besoin des mains, coche-le : c’est un protocole modifié, non comparable aux normes.", "If you need your hands, tick it: it is a modified protocol, not comparable to norms."),
    ],
    record: L("Durée, usage des mains, douleur genou/dos avant et après.", "Time, use of hands, knee/back pain before and after."),
    limit: L("Le temps dépend aussi de la force, de la coordination et de la hauteur d’assise.", "The time also depends on strength, coordination and seat height."),
    context: L("Une médiane d’environ 9 s a été rapportée chez des hommes de 50–54 ans dans un grand échantillon européen. Ce n’est ni une cible ni un diagnostic.",
      "A median of about 9 s was reported in men aged 50–54 in a large European sample. It is neither a target nor a diagnosis."),
  },
  {
    id: "M04", version: 1, access: "self_when_painfree", slot: 1, sides: "LR", items: ONE, trials: 2, painCheck: true, details: ["unilateral"],
    name: L("Élévations du talon avec appui", "Supported heel raises"),
    region: L("Chevilles / mollets", "Ankles / calves"),
    measure: { unit: "REPS", min: 0, max: 20, step: 1, higherIsMore: true },
    how: [
      L("Devant un plan stable, doigts posés pour l’équilibre, monte sur les pointes et redescends lentement.", "Facing a stable surface, fingertips on it for balance, rise onto your toes and lower slowly."),
      L("À deux pieds, ou sur un pied seulement si c’est sûr. Garde le buste neutre.", "On both feet, or on one only if it is safe. Keep the trunk neutral."),
    ],
    record: L("Répétitions propres jusqu’à 20 ; variante un pied / deux pieds.", "Clean repetitions up to 20; one-foot or two-foot version."),
    limit: L("Performance fonctionnelle, pas une mobilité de cheville.", "A functional performance, not ankle mobility."),
  },
  {
    id: "M05", version: 1, access: "conditional_no_knee_pain", slot: 1, sides: "LR", items: ONE, trials: 2, painCheck: true, details: [],
    name: L("Genou vers le mur", "Knee to wall"),
    region: L("Cheville (flexion dorsale)", "Ankle (dorsiflexion)"),
    measure: MORE_RANGE_CM(25),
    how: [
      L("Face au mur, pied à plat, avance le genou jusqu’au mur sans lever le talon.", "Facing the wall, foot flat, bring the knee to the wall without lifting the heel."),
      L("Recule le pied progressivement jusqu’au dernier point confortable.", "Move the foot back little by little to the last comfortable point."),
      L("Aucun effort si le genou ou le dos fait mal.", "No effort if the knee or the back hurts."),
    ],
    record: L("Distance gros orteil–mur en cm au dernier point confortable.", "Big toe to wall distance in cm at the last comfortable point."),
    limit: L("Test de fente en charge, fiable si les conditions sont identiques.", "A weight-bearing lunge test, reliable when conditions are identical."),
    mdc: { value: 1.9, source: L("revue de fiabilité : environ 1,6 à 1,9 cm selon les méthodes", "reliability review: about 1.6 to 1.9 cm depending on method") },
  },
  {
    id: "M06", version: 1, access: "self_when_painfree", slot: 1, sides: "LR", items: ONE, trials: 2, painCheck: true, details: [],
    name: L("Flexion du genou debout", "Standing knee bend"),
    region: L("Genou / quadriceps", "Knee / quadriceps"),
    measure: { unit: "CM", min: 0, max: 80, step: 0.5, higherIsMore: false, categories: ANGLE_CATEGORIES_90 },
    how: [
      L("Main sur un plan stable, plie doucement le genou en ramenant le talon vers la fesse.", "Hand on a stable surface, gently bend the knee, bringing the heel towards the buttock."),
      L("Sans pencher le buste ni cambrer.", "Without leaning the trunk or arching the back."),
    ],
    record: L("Distance talon–fesse à l’amplitude confortable, ou une catégorie si la mesure n’est pas possible.", "Heel to buttock distance at the comfortable range, or a category if it cannot be measured."),
    limit: L("Repère mixte genou/quadriceps, pas un angle pur.", "A mixed knee/quadriceps proxy, not a pure angle."),
  },
  {
    id: "M07", version: 1, access: "self_when_painfree", slot: 1, sides: "LR", items: ONE, trials: 2, painCheck: true, details: ["photo"],
    name: L("Figure 4 assis", "Seated figure 4"),
    region: L("Hanche (rotation externe)", "Hip (external rotation)"),
    measure: { unit: "CM", min: 0, max: 60, step: 0.5, higherIsMore: false },
    how: [
      L("Assis dos appuyé, pose la cheville sur la cuisse opposée seulement si c’est spontané et indolore.", "Seated with back support, place the ankle on the opposite thigh only if it comes easily and painlessly."),
      L("Ne pousse jamais le genou avec la main.", "Never push the knee down with your hand."),
    ],
    record: L("Hauteur du genou de la jambe croisée au-dessus du plan d’assise, en cm.", "Height of the crossed leg’s knee above the seat, in cm."),
    limit: L("Repère de posture, dépend aussi du bassin et des genoux.", "A posture proxy, also depends on the pelvis and knees."),
  },
  {
    id: "M08", version: 1, access: "self_when_painfree", slot: 1, sides: "LR", items: ONE, trials: 2, painCheck: true, details: ["compensation"],
    name: L("Rotation interne active de hanche, assis", "Seated active hip internal rotation"),
    region: L("Hanche (rotation interne)", "Hip (internal rotation)"),
    measure: MORE_RANGE_CM(50),
    how: [
      L("Assis droit, dos soutenu, hanche et genou pliés vers 90°, la cuisse reste fixe.", "Sit upright, back supported, hip and knee bent near 90°, the thigh stays still."),
      L("Déplace doucement le pied vers l’extérieur, sans bouger le bassin.", "Gently move the foot outwards, without moving the pelvis."),
    ],
    record: L("Déplacement latéral du talon depuis le départ (cm) et compensation éventuelle.", "Sideways heel travel from the start (cm) and any compensation."),
    limit: L("Repère de rotation, pas une amplitude en degrés.", "A rotation proxy, not a range in degrees."),
  },
  {
    id: "M09", version: 1, access: "self_when_painfree", slot: 1, sides: "LR", items: ONE, trials: 2, painCheck: true, details: ["limitedByOtherLeg"],
    name: L("Rotation externe active de hanche, assis", "Seated active hip external rotation"),
    region: L("Hanche (rotation externe)", "Hip (external rotation)"),
    measure: MORE_RANGE_CM(50),
    how: [
      L("Assis droit, dos soutenu, la cuisse reste fixe.", "Sit upright, back supported, the thigh stays still."),
      L("Déplace doucement le pied vers la ligne médiane, sans bouger le bassin.", "Gently move the foot towards the midline, without moving the pelvis."),
    ],
    record: L("Déplacement latéral du talon (cm) ; note si l’autre jambe limite le geste.", "Sideways heel travel (cm); note if the other leg limits the movement."),
    limit: L("Repère de rotation, pas une amplitude en degrés.", "A rotation proxy, not a range in degrees."),
  },
  {
    id: "M10", version: 1, access: "self_when_painfree", slot: 1, sides: "BOTH", items: ONE, trials: 2, painCheck: true, details: [],
    name: L("Ouverture active des genoux, assis", "Seated active knee opening"),
    region: L("Hanche (abduction)", "Hip (abduction)"),
    measure: MORE_RANGE_CM(100),
    how: [
      L("Pieds à plat à une distance standard que tu notes, dos soutenu.", "Feet flat at a standard distance that you note, back supported."),
      L("Ouvre doucement les genoux sans déplacer les pieds.", "Gently open the knees without moving the feet."),
    ],
    record: L("Écart entre le centre des genoux à l’amplitude confortable, en cm.", "Distance between the centres of the knees at the comfortable range, in cm."),
    limit: L("Repère des deux côtés à la fois, dépend de la position des pieds.", "A two-sided proxy that depends on foot position."),
  },
  {
    id: "M11", version: 1, access: "after_clinical_review", slot: 2, sides: "LR", items: ONE, trials: 2, painCheck: true, details: ["photo"],
    name: L("Flexion de hanche allongé, genou plié", "Lying hip flexion, knee bent"),
    region: L("Hanche (flexion)", "Hip (flexion)"),
    measure: { unit: "DEGREES", min: 0, max: 160, step: 1, higherIsMore: true, categories: ANGLE_CATEGORIES_90 },
    how: [
      L("Uniquement si descendre au sol et te relever sont sûrs pour toi.", "Only if getting down to the floor and back up is safe for you."),
      L("Sur un tapis ferme, genou plié, rapproche activement le genou sans tirer avec les bras ni enrouler le dos.", "On a firm mat, knee bent, actively bring the knee closer without pulling with your arms or rounding your back."),
    ],
    record: L("Angle sur vidéo si possible, sinon une catégorie stable ; douleur lombaire et irradiation.", "Angle from a video if possible, otherwise a stable category; low-back pain and radiation."),
    limit: L("Devient une mesure clinique seulement avec goniomètre et bassin stabilisé.", "Only a clinical measure with a goniometer and a stabilised pelvis."),
  },
  {
    id: "M12", version: 1, access: "self_when_painfree", slot: 2, sides: "LR", items: ONE, trials: 2, painCheck: true, details: [],
    name: L("Marche assise, levée de pied", "Seated march, foot lift"),
    region: L("Hanche (flexion active)", "Hip (active flexion)"),
    measure: MORE_RANGE_CM(60),
    how: [
      L("Assis dos soutenu, pied au sol, lève le pied en soulevant le genou sans tirer avec les mains, puis repose-le.", "Seated with back support, foot on the floor, lift the foot by raising the knee without pulling with your hands, then put it down."),
      L("Toujours la même chaise.", "Always the same chair."),
    ],
    record: L("Hauteur du talon au-dessus du sol (cm).", "Heel height above the floor (cm)."),
    limit: L("Repère de force et d’amplitude active dans cette posture.", "A proxy of strength and active range in this posture."),
  },
  {
    id: "M13", version: 1, access: "self_when_painfree", slot: 2, sides: "LR", items: ONE, trials: 2, painCheck: true, details: [],
    name: L("Abduction debout avec appui", "Supported standing abduction"),
    region: L("Hanche (abduction active)", "Hip (active abduction)"),
    measure: MORE_RANGE_CM(100),
    how: [
      L("Main au comptoir, fais glisser le pied sur le côté au sol, jambe presque tendue.", "Hand on the counter, slide the foot sideways along the floor, leg almost straight."),
      L("Bassin et tronc stables, sans pencher le dos.", "Pelvis and trunk steady, without tilting your back."),
    ],
    record: L("Distance latérale du pied depuis le repère de départ (cm), à comparer entre les côtés.", "Sideways foot distance from the starting mark (cm), compared between sides."),
    limit: L("Repère fonctionnel, pas une amplitude en degrés.", "A functional proxy, not a range in degrees."),
  },
  {
    id: "M14", version: 1, access: "self_when_painfree", slot: 2, sides: "LR", items: ONE, trials: 2, painCheck: true, details: [],
    name: L("Extension de hanche avec appui", "Supported hip extension"),
    region: L("Hanche (extension active)", "Hip (active extension)"),
    measure: MORE_RANGE_CM(100),
    how: [
      L("Main au comptoir, recule le pied au sol en gardant buste et bassin neutres.", "Hand on the counter, slide the foot back along the floor, trunk and pelvis neutral."),
      L("Ne cambre pas.", "Do not arch your back."),
    ],
    record: L("Distance arrière du talon depuis le repère de départ (cm).", "Backward heel distance from the starting mark (cm)."),
    limit: L("Repère qui dépend de la longueur du pas, pas une extension isolée.", "A proxy that depends on step length, not an isolated extension."),
  },
  {
    id: "M15", version: 1, access: "self_when_painfree", slot: 2, sides: "LR", items: ONE, trials: 2, painCheck: true, details: ["photo"],
    name: L("Élévation des bras, assis", "Seated arm raise"),
    region: L("Épaules (flexion active)", "Shoulders (active flexion)"),
    measure: {
      unit: "DEGREES", min: 0, max: 180, step: 1, higherIsMore: true,
      categories: [
        { id: "BELOW_SHOULDERS", label: L("Sous les épaules", "Below the shoulders") },
        { id: "SHOULDERS", label: L("Hauteur des épaules", "Shoulder height") },
        { id: "EYES", label: L("Hauteur des yeux", "Eye height") },
        { id: "EARS", label: L("Hauteur des oreilles", "Ear height") },
      ],
    },
    how: [
      L("Assis, dos contre le dossier, monte chaque bras devant toi jusqu’à une hauteur confortable.", "Seated, back against the backrest, raise each arm in front of you to a comfortable height."),
      L("Sans cambrer ni hausser l’épaule. Photo de profil facultative.", "Without arching or shrugging. Side photo optional."),
    ],
    record: L("Angle bras/tronc approximatif sur image, ou une catégorie.", "Approximate arm/trunk angle from a picture, or a category."),
    limit: L("Amplitude fonctionnelle qui associe épaule et omoplate.", "A functional range combining shoulder and shoulder blade."),
  },
  {
    id: "M16", version: 1, access: "self_when_painfree", slot: 2, sides: "LR", items: ONE, trials: 2, painCheck: true, details: ["photo"],
    name: L("Rotation externe d’épaule, coude au corps", "Shoulder external rotation, elbow at the side"),
    region: L("Épaules (rotation active)", "Shoulders (active rotation)"),
    measure: {
      unit: "DEGREES", min: 0, max: 120, step: 1, higherIsMore: true,
      categories: [
        { id: "FORWARD", label: L("Avant-bras vers l’avant", "Forearm pointing forward") },
        { id: "HALF", label: L("À mi-chemin", "Halfway out") },
        { id: "SIDE", label: L("Avant-bras sur le côté", "Forearm pointing sideways") },
      ],
    },
    how: [
      L("Assis dos appuyé, coude plié près du tronc, maintenu sans pression.", "Seated with back support, elbow bent close to the trunk, held there without pressure."),
      L("Fais tourner doucement l’avant-bras vers l’extérieur. Même prise de vue à chaque fois.", "Gently rotate the forearm outwards. Same camera angle each time."),
    ],
    record: L("Angle approximatif de l’avant-bras, ou une catégorie.", "Approximate forearm angle, or a category."),
    limit: L("Rotation active fonctionnelle, dépend de la posture.", "A functional active rotation, depends on posture."),
  },
  {
    id: "M17", version: 1, access: "after_clinical_review", slot: 2, sides: "LR", items: ONE, trials: 2, painCheck: true, details: [],
    name: L("Placement latéral du pied, bas", "Low side foot placement"),
    region: L("Escalade — contrôle de hanche", "Climbing — hip control"),
    measure: MORE_RANGE_CM(120),
    how: [
      L("Face à un support solide, main au garde-corps, pose l’orteil sur une marque latérale stable de hauteur graduée.", "Facing a solid support, hand on the rail, touch your toe onto a stable side mark of graded height."),
      L("Pas de transfert de poids, pas de chute, pas de torsion du dos. Commence bas.", "No weight transfer, no fall, no twisting of the back. Start low."),
    ],
    record: L("Plus grande hauteur touchée confortablement sous contrôle, gauche et droite.", "Highest mark touched comfortably with control, left and right."),
    limit: L("Test du geste de grimpe, pas une amplitude articulaire.", "A climbing-movement test, not a joint range."),
  },
  {
    id: "M18", version: 1, access: "after_clinical_review", slot: 2, sides: "LR", items: ONE, trials: 2, painCheck: true, details: [],
    name: L("Placement frontal du pied, bas", "Low front foot placement"),
    region: L("Escalade — contrôle de hanche", "Climbing — hip control"),
    measure: MORE_RANGE_CM(120),
    how: [
      L("Debout, main sur un support, place l’orteil sur un support frontal bas dont tu montes la hauteur peu à peu.", "Standing, hand on a support, place your toe on a low support in front, raising its height little by little."),
      L("Sans monter dessus ni tirer sur les bras.", "Without stepping up onto it or pulling with your arms."),
    ],
    record: L("Hauteur maximale sans cambrure ni irradiation, gauche et droite.", "Highest point without arching or radiating pain, left and right."),
    limit: L("Test fonctionnel spécifique, pas une amplitude articulaire.", "A specific functional test, not a joint range."),
  },
  {
    id: "M19", version: 1, access: "clinician_only", slot: 0, sides: "BOTH", items: ONE, trials: 1, painCheck: false, details: [], how: null, measure: null,
    name: L("Goniométrie des hanches active / passive", "Active / passive hip goniometry"),
    region: L("Hanche — bilan clinique", "Hip — clinical assessment"),
    record: L("Ce que le ou la professionnelle t’a communiqué : angles droite/gauche, actifs et passifs, en degrés.", "What the clinician told you: right/left angles, active and passive, in degrees."),
    limit: L("Mesure articulaire clinique avec examen différentiel, réalisée par un ou une kinésithérapeute.", "A clinical joint measure with a differential exam, done by a physiotherapist."),
  },
  {
    id: "M20", version: 1, access: "clinician_only", slot: 0, sides: "BOTH", items: ONE, trials: 1, painCheck: false, details: [], how: null, measure: null,
    name: L("Bilan rachidien, neurologique et du genou", "Spine, neurological and knee examination"),
    region: L("Rachis et membre inférieur", "Spine and lower limb"),
    record: L("La conclusion transmise par le médecin : restrictions, examens prescrits, activités autorisées.", "The conclusion your doctor gave you: restrictions, tests ordered, activities allowed."),
    limit: L("Examen médical : il ne donne pas de score dans l’application.", "A medical examination: it gives no score in the app."),
  },
];

export const CARD_BY_ID: ReadonlyMap<CardId, Card> = new Map(CARDS.map((c) => [c.id, c]));
export function isCardId(id: string): id is CardId { return (CARD_IDS as readonly string[]).includes(id); }

/** The sides a card is recorded on. */
export function cardSides(card: Card): readonly Side[] {
  return card.sides === "LR" ? ["LEFT", "RIGHT"] : ["BOTH"];
}

/** Angles a clinician may report for M19 (transcribed, never measured by the app). */
export const GONIOMETRY_MOVES = ["FLEXION", "ABDUCTION", "INTERNAL_ROTATION", "EXTERNAL_ROTATION", "EXTENSION"] as const;
export type GoniometryMove = (typeof GONIOMETRY_MOVES)[number];
