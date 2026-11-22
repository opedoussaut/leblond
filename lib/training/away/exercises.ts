import type { Localized } from "../catalogue";
import { EXERCISE_BY_ID } from "../hip-mobility/content";
import type { IllustrationId } from "../illustrations";

/**
 * The exercises of the Away Training séances (En déplacement): bodyweight,
 * long and mini resistance bands, the floor and a wall, and a stable chair or
 * a low step when there is one. Never a climbing wall, hangboard, bar, weights
 * or gym machine.
 *
 * Bands are never anchored to furniture: every band exercise is held by the
 * hands and the feet (stand on it, loop it round the soles). An exercise that
 * needs a chair, a step or a mini band always has a version without it.
 *
 * Hip-demanding movements carry `hip`: below `fromStage` of the hip test (or
 * untested), the séance prescribes the easier version written there.
 */

export type AwayEquipment = "BODYWEIGHT" | "FLOOR" | "WALL" | "LONG_BAND" | "MINI_BAND" | "CHAIR";
/** Equipment that may be missing on a trip: an exercise needing it always has an `alternative`. */
export const OPTIONAL_EQUIPMENT: ReadonlySet<AwayEquipment> = new Set(["MINI_BAND", "CHAIR"]);

export type AwayExercise = {
  id: string;
  name: Localized;
  modality: "REPS" | "HOLD" | "TIME";
  /** Reps counted per side (left then right). */
  perSide: boolean;
  /** Seconds one rep takes (REPS), for the duration estimate. */
  tempo: number;
  summary: Localized;
  steps: readonly Localized[];
  /** How to do it well: the default intensity line. */
  cue: Localized;
  safety?: Localized;
  equipment: readonly AwayEquipment[];
  /** The version without the chair, step or mini band. */
  alternative?: Localized;
  illustration?: IllustrationId;
  /**
   * Hip-demanding: below `fromStage` of the hip test (0–4; never tested counts
   * as 0) the séance prescribes `easier`; from `harder.fromStage` on, `harder`.
   */
  hip?: { fromStage: number; easier: Localized; harder?: { fromStage: number; how: Localized } };
  /** Hip programme exercise this one is (its own text and its easier / harder versions). */
  hipProgramme?: string;
};

const L = (fr: string, en: string): Localized => ({ fr, en });

const COMFORT = L(
  "Amplitude confortable : pas d’à-coups, jamais de douleur vive. Une gêne qui monte, tu réduis ou tu passes.",
  "Comfortable range: no bouncing, never sharp pain. If discomfort builds, reduce or skip.",
);
const BAND_SAFE = L(
  "Vérifie l’élastique avant de commencer (pas de coupure). Garde-le sous les pieds ou dans les mains : jamais accroché à un meuble ou une poignée de porte.",
  "Check the band before you start (no nicks). Keep it under your feet or in your hands: never hooked to furniture or a door handle.",
);
const BACK_SAFE = L(
  "Dos neutre, mouvement lent. Douleur dans le dos ou qui descend dans la jambe : arrête.",
  "Neutral back, slow movement. Pain in the back or down the leg: stop.",
);

type Def = Omit<AwayExercise, "perSide" | "tempo" | "equipment"> & Partial<Pick<AwayExercise, "perSide" | "tempo" | "equipment">>;
const ex = (d: Def): AwayExercise => ({ perSide: false, tempo: 3, equipment: ["FLOOR"], ...d });

/** A hip programme exercise, with its own text: the standard version for everyone, the harder one from stage 3. */
function fromHip(id: string, extra: Partial<AwayExercise> = {}): AwayExercise {
  const h = EXERCISE_BY_ID.get(id);
  if (!h) throw new Error("Unknown hip exercise " + id);
  return ex({
    id, name: h.name, modality: "REPS", perSide: h.perSide, summary: h.purpose, steps: h.steps, cue: h.cue,
    safety: h.safety[0], illustration: id as IllustrationId, hipProgramme: id,
    hip: {
      fromStage: 0,
      easier: L(h.easier.name.fr + " : " + h.easier.how.fr, h.easier.name.en + ": " + h.easier.how.en),
      harder: { fromStage: 3, how: L(h.harder.name.fr + " : " + h.harder.how.fr, h.harder.name.en + ": " + h.harder.how.en) },
    },
    ...extra,
  });
}

export const AWAY_EXERCISES: readonly AwayExercise[] = [
  /* ── Warm-up ─────────────────────────────────────────────────────────── */
  ex({
    id: "joint-circles", modality: "TIME", equipment: ["BODYWEIGHT"],
    name: L("Tour des articulations", "Joint circles"),
    summary: L("Réveiller chaque articulation, de la nuque aux chevilles.", "Wake up every joint, neck to ankles."),
    steps: [
      L("Nuque, épaules, coudes, poignets : 5 cercles lents dans chaque sens.", "Neck, shoulders, elbows, wrists: 5 slow circles each way."),
      L("Bassin, genoux, chevilles : 5 cercles dans chaque sens.", "Hips, knees, ankles: 5 circles each way."),
      L("Ouvre et ferme les mains 20 fois, doigts bien écartés.", "Open and close your hands 20 times, fingers spread wide."),
    ],
    cue: L("Facile, respiration calme", "Easy, calm breathing"),
  }),
  ex({
    id: "march-arm-swings", modality: "TIME", equipment: ["BODYWEIGHT"],
    name: L("Marche sur place et balancés de bras", "Marching with arm swings"),
    summary: L("Monter la température sans impact.", "Raise your temperature without impact."),
    steps: [
      L("Marche sur place en montant les genoux, de plus en plus vite.", "March on the spot, knees up, gradually faster."),
      L("Balance les bras devant, derrière, puis en croisant devant la poitrine.", "Swing the arms forward, back, then across the chest."),
      L("Termine par 20 s de montées de genoux rapides.", "Finish with 20 s of quick high knees."),
    ],
    cue: L("Tu dois avoir chaud au bout de 2 min", "You should feel warm after 2 min"),
  }),
  ex({
    id: "cat-cow", modality: "REPS", tempo: 4, illustration: "cat-cow",
    name: L("Chat-vache", "Cat-cow"),
    summary: L("Mobiliser toute la colonne, vertèbre par vertèbre.", "Move the whole spine, one segment at a time."),
    steps: [
      L("À quatre pattes, mains sous les épaules, genoux sous les hanches.", "On all fours, hands under shoulders, knees under hips."),
      L("Sur l’expiration, arrondis le dos en rentrant le menton.", "Breathing out, round your back and tuck your chin."),
      L("Sur l’inspiration, creuse doucement en regardant devant.", "Breathing in, gently arch and look ahead."),
    ],
    cue: L("Lent, suivre la respiration", "Slow, follow your breath"),
  }),
  ex({
    id: "quadruped-hip-circles", modality: "REPS", perSide: true, tempo: 4, illustration: "quadruped-hip-circles",
    name: L("Cercles de hanche à quatre pattes", "Quadruped hip circles"),
    summary: L("Faire tourner la hanche dans toute son amplitude, sans charge.", "Take the hip through its full range, unloaded."),
    steps: [
      L("À quatre pattes, dos stable comme une table.", "On all fours, back steady like a table."),
      L("Dessine un grand cercle avec le genou : vers l’avant, sur le côté, vers l’arrière.", "Draw a big circle with the knee: forward, out to the side, back."),
      L("Le bassin ne bascule pas. Puis le cercle dans l’autre sens.", "The pelvis does not tip. Then circle the other way."),
    ],
    cue: L("Grands cercles lents", "Big slow circles"),
    safety: COMFORT,
  }),
  ex({
    id: "thoracic-rotation", modality: "REPS", perSide: true, tempo: 3, illustration: "quadruped-thoracic-rotation",
    name: L("Rotations du haut du dos à quatre pattes", "Quadruped thoracic rotations"),
    summary: L("Rendre au haut du dos la rotation dont les épaules ont besoin.", "Give the upper back the rotation your shoulders need."),
    steps: [
      L("À quatre pattes, une main derrière la tête.", "On all fours, one hand behind your head."),
      L("Amène le coude vers le bras d’appui, puis ouvre-le vers le plafond en suivant du regard.", "Bring the elbow towards the supporting arm, then open it to the ceiling, eyes following."),
      L("Le bassin reste immobile : seul le haut du dos tourne.", "The pelvis stays still: only the upper back turns."),
    ],
    cue: L("Expire en ouvrant", "Breathe out as you open"),
  }),
  ex({
    id: "leg-swings", modality: "REPS", perSide: true, tempo: 2, equipment: ["WALL"], illustration: "leg-swings",
    name: L("Balancés de jambe, main au mur", "Leg swings, hand on the wall"),
    summary: L("Préparer les hanches aux grands écarts de pieds.", "Prepare the hips for wide foot moves."),
    steps: [
      L("Une main au mur, balance une jambe d’avant en arrière, de plus en plus haut.", "One hand on the wall, swing one leg forward and back, gradually higher."),
      L("Puis de côté, devant toi, de gauche à droite.", "Then sideways, across in front of you."),
      L("Le buste reste droit, la jambe d’appui légèrement fléchie.", "Chest stays tall, standing knee slightly bent."),
    ],
    cue: L("Amplitude qui grandit, sans forcer", "Growing range, no forcing"),
  }),
  ex({
    id: "scapular-push-up", modality: "REPS", tempo: 2,
    name: L("Pompes scapulaires", "Scapular push-ups"),
    summary: L("Réveiller le dentelé et les omoplates avant de tirer ou de pousser.", "Wake up the serratus and shoulder blades before pulling or pushing."),
    steps: [
      L("En planche haute, bras tendus (ou genoux au sol).", "In a high plank, arms straight (or knees down)."),
      L("Laisse les omoplates se rapprocher sans plier les coudes, puis pousse le sol pour les écarter.", "Let the shoulder blades come together without bending the elbows, then push the floor to spread them."),
      L("Le dos reste plat.", "Keep your back flat."),
    ],
    cue: L("Petite amplitude, contrôlée", "Small, controlled range"),
  }),
  ex({
    id: "band-pull-apart", modality: "REPS", tempo: 2, equipment: ["LONG_BAND"], illustration: "band-pull-apart",
    name: L("Écartés à l’élastique", "Band pull-aparts"),
    summary: L("Activer l’arrière des épaules et les omoplates.", "Switch on the back of the shoulders and the shoulder blades."),
    steps: [
      L("Élastique tenu à deux mains devant toi, bras tendus à hauteur d’épaules.", "Band held in both hands in front of you, arms straight at shoulder height."),
      L("Écarte les bras jusqu’à toucher la poitrine en serrant les omoplates.", "Pull the arms apart until the band touches your chest, squeezing the shoulder blades."),
      L("Reviens lentement, sans hausser les épaules.", "Return slowly, without shrugging."),
    ],
    cue: L("Tension légère à moyenne", "Light to medium tension"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "glute-bridge", modality: "REPS", tempo: 3, illustration: "glute-bridge",
    name: L("Pont fessier", "Glute bridge"),
    summary: L("Allumer les fessiers et ouvrir l’avant des hanches.", "Switch on the glutes and open the front of the hips."),
    steps: [
      L("Sur le dos, genoux pliés, pieds à plat largeur de hanches.", "On your back, knees bent, feet flat hip-width apart."),
      L("Pousse dans les talons et monte le bassin jusqu’à l’alignement épaules-hanches-genoux.", "Drive through the heels and lift the hips until shoulders, hips and knees line up."),
      L("Tiens 1 s en serrant les fessiers, redescends lentement.", "Hold 1 s squeezing the glutes, lower slowly."),
    ],
    cue: L("1 s de pause en haut", "1 s pause at the top"),
  }),
  ex({
    id: "low-lunge-rotation", modality: "REPS", perSide: true, tempo: 6, illustration: "low-lunge-rotation",
    name: L("Fente basse avec rotation", "Low lunge with rotation"),
    summary: L("Ouvrir hanche, adducteurs et haut du dos en un seul mouvement.", "Open hip, adductors and upper back in one move."),
    steps: [
      L("Grande fente, genou arrière au sol, mains de part et d’autre du pied avant.", "Long lunge, back knee down, hands either side of the front foot."),
      L("Descends le coude intérieur vers le pied, puis tourne et lève ce bras vers le plafond.", "Lower the inside elbow towards the foot, then rotate and reach that arm to the ceiling."),
      L("Reviens et change de côté après les répétitions.", "Come back and switch sides after the reps."),
    ],
    cue: L("2 respirations par position", "2 breaths per position"),
    safety: COMFORT,
  }),
  ex({
    id: "squat-to-stand", modality: "REPS", tempo: 5, equipment: ["BODYWEIGHT"],
    name: L("Squat-to-stand", "Squat-to-stand"),
    summary: L("Préparer chevilles, hanches et ischios à la position accroupie.", "Prepare ankles, hips and hamstrings for the deep squat."),
    steps: [
      L("Debout, plie-toi et attrape tes orteils (genoux pliés autant que nécessaire).", "Standing, fold forward and hold your toes (bend the knees as much as needed)."),
      L("Descends les fesses en squat en gardant les orteils, coudes à l’intérieur des genoux.", "Drop your hips into a squat still holding your toes, elbows inside the knees."),
      L("Remonte les fesses en tendant les jambes autant que confortable.", "Lift your hips, straightening the legs as far as is comfortable."),
    ],
    cue: L("Lent, sans rebond", "Slow, no bouncing"),
    safety: COMFORT,
  }),

  /* ── Hip programme exercises (their own text, adapted to the hip test) ── */
  fromHip("supine-knee-sways", { tempo: 7 }),
  fromHip("seated-hip-rotations", { tempo: 5 }),
  fromHip("adductor-rock-backs", { tempo: 4 }),
  fromHip("low-step-placements", {
    tempo: 5, equipment: ["CHAIR", "WALL"],
    alternative: L("Sans marche : pose le pied sur un livre épais ou touche une marque au mur à hauteur de cheville.",
      "No step: place the foot on a thick book or touch a mark on the wall at ankle height."),
  }),
  fromHip("lateral-weight-shifts", { tempo: 5, equipment: ["FLOOR", "WALL"] }),

  /* ── Hip mobility and active range ───────────────────────────────────── */
  ex({
    id: "half-kneeling-hip-flexor", modality: "HOLD", perSide: true, illustration: "half-kneeling-hip-flexor",
    name: L("Fléchisseurs de hanche, un genou au sol", "Half-kneeling hip flexor stretch"),
    summary: L("Libérer l’avant de la hanche, raidi par la position assise.", "Free the front of the hip, stiffened by sitting."),
    steps: [
      L("Un genou au sol (sur une serviette), l’autre pied devant.", "One knee down (on a towel), the other foot in front."),
      L("Rentre le bassin (serre le fessier arrière) avant d’avancer légèrement.", "Tuck the pelvis (squeeze the back glute) before shifting slightly forward."),
      L("Bras du côté du genou au sol levé au-dessus de la tête.", "Raise the arm on the kneeling side overhead."),
    ],
    cue: L("Étirement 4/10, respiration lente", "Stretch 4/10, slow breathing"),
    safety: COMFORT,
  }),
  ex({
    id: "butterfly", modality: "HOLD", illustration: "butterfly",
    name: L("Papillon actif", "Active butterfly"),
    summary: L("Ouvrir les adducteurs, puis les contracter dans la position ouverte.", "Open the adductors, then contract them in the open position."),
    steps: [
      L("Assis, plantes des pieds jointes, dos long.", "Seated, soles together, long spine."),
      L("Laisse descendre les genoux, puis 3 fois : pousse les genoux contre tes mains 5 s, relâche, gagne un peu.", "Let the knees drop, then 3 times: press the knees into your hands for 5 s, release, gain a little."),
      L("Pieds plus loin du bassin si les genoux restent hauts.", "Feet further from the hips if the knees stay high."),
    ],
    cue: L("Contracter 5 s, relâcher, respirer", "Contract 5 s, release, breathe"),
    safety: COMFORT,
  }),
  ex({
    id: "figure-four", modality: "HOLD", perSide: true, equipment: ["CHAIR"], illustration: "figure-four-chair",
    name: L("Figure 4 (fessier profond)", "Figure-four stretch"),
    summary: L("Étirer le fessier profond et la rotation externe de hanche.", "Stretch the deep glute and hip external rotators."),
    steps: [
      L("Assis au bord d’une chaise stable, pose la cheville sur le genou opposé.", "Sitting at the edge of a stable chair, rest the ankle on the opposite knee."),
      L("Dos long, penche-toi en avant à partir des hanches.", "Long back, lean forward from the hips."),
      L("Garde le pied fléchi pour protéger le genou.", "Keep the foot flexed to protect the knee."),
    ],
    cue: L("Étirement 4/10", "Stretch 4/10"),
    alternative: L("Sans chaise : sur le dos, cheville sur le genou opposé, tire la cuisse du dessous vers toi.",
      "No chair: on your back, ankle on the opposite knee, pull the lower thigh towards you."),
    safety: COMFORT,
  }),
  ex({
    id: "supine-hip-internal-rotation", modality: "REPS", perSide: true, tempo: 3, illustration: "supine-hip-internal-rotation",
    name: L("Rotation interne de hanche sur le dos", "Supine hip internal rotation"),
    summary: L("Travailler la rotation interne, celle des carres et des pieds en dedans.", "Work internal rotation, the one for edging and inside-foot moves."),
    steps: [
      L("Sur le dos, genoux pliés, pieds écartés plus que les hanches.", "On your back, knees bent, feet wider than the hips."),
      L("Laisse un genou tomber vers l’intérieur en gardant le pied au sol.", "Let one knee fall inwards, keeping the foot down."),
      L("Ramène-le activement, sans l’aide des mains.", "Bring it back actively, without your hands."),
    ],
    cue: L("Lent, 1 s en bas", "Slow, 1 s at the bottom"),
    safety: COMFORT,
  }),
  ex({
    id: "high-knee-hold", modality: "REPS", perSide: true, tempo: 7, equipment: ["WALL"],
    name: L("Genou haut sans appui", "Active high-knee hold"),
    summary: L("Gagner de la force tout en haut de l’amplitude : c’est elle qui monte le pied haut.",
      "Build strength at the very top of the range: that is what lifts a high foot."),
    steps: [
      L("Debout, une main légère au mur, monte le genou le plus haut possible avec les mains.", "Standing, one hand lightly on the wall, pull the knee as high as you can with your hands."),
      L("Lâche le genou et garde-le en haut 5 s, sans te pencher en arrière.", "Let go and keep the knee up for 5 s without leaning back."),
      L("Redescends lentement.", "Lower slowly."),
    ],
    cue: L("5 s sans les mains, buste droit", "5 s hands-free, tall chest"),
    hip: { fromStage: 2, easier: L("Genou à hauteur de hanche seulement, 3 s sans les mains.", "Knee to hip height only, 3 s hands-free.") },
  }),
  ex({
    id: "wall-high-step", modality: "REPS", perSide: true, tempo: 6, equipment: ["WALL"], illustration: "wall-step",
    name: L("Pied haut au mur", "Wall high step"),
    summary: L("Le pied haut de la grimpe : poser haut, puis amener les hanches sur le pied.",
      "The climbing high step: place the foot high, then bring the hips over it."),
    steps: [
      L("Face au mur, mains à plat dessus, pose le bout du pied sur le mur à hauteur de hanche.", "Facing the wall, hands flat on it, place the toes on the wall at hip height."),
      L("Rapproche les hanches du mur et charge le pied 3 s, comme pour te hisser dessus.", "Bring your hips to the wall and load the foot for 3 s, as if pulling yourself onto it."),
      L("Redescends le pied sans bruit.", "Lower the foot quietly."),
    ],
    cue: L("Pied précis, hanches au mur", "Precise foot, hips to the wall"),
    hip: { fromStage: 2, easier: L("Pied à hauteur de genou, mains plus près du pied.", "Foot at knee height, hands closer to the foot.") },
    safety: COMFORT,
  }),
  ex({
    id: "lateral-foot-placement", modality: "REPS", perSide: true, tempo: 6, equipment: ["WALL"],
    name: L("Placements de pied latéraux au mur", "Lateral foot placements on the wall"),
    summary: L("Poser loin sur le côté et passer le poids dessus, comme un rétablissement de côté.",
      "Place a foot far to the side and move your weight onto it, like a side rock-over."),
    steps: [
      L("De profil au mur, une main dessus. Pose le pied extérieur sur le mur, sur le côté, le plus haut que tu contrôles.",
        "Side-on to the wall, one hand on it. Place the outside foot on the wall, out to the side, as high as you control."),
      L("Transfère le poids vers ce pied en pliant le genou, bassin près du mur.", "Shift your weight towards that foot, bending the knee, hips close to the wall."),
      L("Reviens au centre. Le pied ne glisse pas.", "Come back to the middle. The foot does not slide."),
    ],
    cue: L("Lent, pied immobile", "Slow, foot still"),
    hip: { fromStage: 2, easier: L("Pied plus bas (genou), petit transfert de poids.", "Foot lower (knee height), small weight shift.") },
    safety: COMFORT,
  }),
  ex({
    id: "rock-over-lunge", modality: "REPS", perSide: true, tempo: 6, equipment: ["FLOOR", "WALL"],
    name: L("Rétablissement au sol", "Floor rock-over"),
    summary: L("Se relever sur une jambe très pliée, sans les mains : le rétablissement du grimpeur.",
      "Stand up from a deeply bent leg without your hands: the climber’s rock-over."),
    steps: [
      L("Fente latérale profonde, poids sur la jambe pliée, l’autre tendue.", "Deep side lunge, weight on the bent leg, the other straight."),
      L("Amène la poitrine au-dessus du genou plié et pousse pour te relever sur cette jambe.", "Bring your chest over the bent knee and push to stand up on that leg."),
      L("Redescends en contrôlant. Une main au mur si besoin.", "Lower under control. A hand on the wall if needed."),
    ],
    cue: L("Montée en 2 s, sans élan", "2 s up, no momentum"),
    hip: { fromStage: 2, easier: L("Fente moins profonde, une main sur la cuisse ou au mur pour pousser.", "Shallower lunge, one hand on the thigh or the wall to help.") },
    safety: COMFORT,
  }),
  ex({
    id: "hip-airplane", modality: "REPS", perSide: true, tempo: 6, equipment: ["BODYWEIGHT", "WALL"],
    name: L("Avion de hanche", "Hip airplane"),
    summary: L("Contrôle de la hanche et équilibre sur une jambe, en rotation.", "Hip control and single-leg balance, through rotation."),
    steps: [
      L("Sur une jambe, penche le buste vers l’avant, jambe libre tendue derrière.", "On one leg, hinge your chest forward, free leg straight behind."),
      L("Ouvre le bassin vers le plafond, puis referme-le vers le sol, en tournant sur la hanche d’appui.", "Open the pelvis to the ceiling, then close it towards the floor, turning on the standing hip."),
      L("Le genou d’appui reste souple et aligné sur le pied.", "Standing knee soft and over the foot."),
    ],
    cue: L("Lent, regard fixe", "Slow, eyes fixed"),
    hip: { fromStage: 1, easier: L("Une main au mur, petite rotation.", "One hand on the wall, small rotation.") },
  }),
  ex({
    id: "ninety-ninety-lift", modality: "REPS", perSide: true, tempo: 5,
    name: L("90/90, décollés du pied arrière", "90/90 back-foot lift-offs"),
    summary: L("Force en rotation interne, au bout de l’amplitude.", "Internal-rotation strength at the end of the range."),
    steps: [
      L("Assis en 90/90 : jambe avant pliée devant, jambe arrière pliée sur le côté.", "Sit in 90/90: front leg bent in front, back leg bent to the side."),
      L("Buste droit, décolle le pied et le genou arrière du sol 2 s.", "Chest tall, lift the back foot and knee off the floor for 2 s."),
      L("Redescends sans t’affaisser.", "Lower without slumping."),
    ],
    cue: L("2 s en haut, même petit", "2 s up, even if small"),
    hip: { fromStage: 2, easier: L("Mains au sol derrière toi, décolle seulement le pied.", "Hands on the floor behind you, lift only the foot.") },
    safety: COMFORT,
  }),
  ex({
    id: "pigeon", modality: "HOLD", perSide: true,
    name: L("Pigeon au sol", "Floor pigeon"),
    summary: L("Étirer le fessier et la rotation externe, en appui sur le sol.", "Stretch the glute and external rotation, supported by the floor."),
    steps: [
      L("Depuis quatre pattes, avance un genou vers ta main, jambe arrière tendue.", "From all fours, bring one knee towards your hand, back leg straight."),
      L("Bassin d’équerre, descends sur les avant-bras si c’est confortable.", "Hips square, lower onto your forearms if comfortable."),
      L("Respire dans la hanche, sans tension au genou.", "Breathe into the hip, no strain on the knee."),
    ],
    cue: L("Étirement 4/10", "Stretch 4/10"),
    hip: { fromStage: 2, easier: L("Figure 4 sur le dos à la place : cheville sur le genou opposé.", "Supine figure-four instead: ankle on the opposite knee.") },
    safety: L("Genou sensible : prends la version figure 4 sur le dos.", "Sensitive knee: use the supine figure-four."),
  }),
  ex({
    id: "pancake", modality: "HOLD",
    name: L("Pancake actif", "Active pancake"),
    summary: L("Adducteurs et ischios ensemble, pour les grands écarts.", "Adductors and hamstrings together, for wide stems."),
    steps: [
      L("Assis jambes écartées, genoux vers le plafond.", "Sit with legs wide, kneecaps to the ceiling."),
      L("Bascule le bassin vers l’avant, dos long, mains au sol devant toi.", "Tip the pelvis forward, long back, hands on the floor in front."),
      L("Toutes les 15 s, soulève les mains 3 s en gardant la position.", "Every 15 s, lift your hands for 3 s, holding the position."),
    ],
    cue: L("Bassin qui bascule, pas le dos qui s’arrondit", "Tip the pelvis, don’t round the back"),
    hip: { fromStage: 2, easier: L("Genoux légèrement pliés, assis sur un coussin.", "Knees slightly bent, sitting on a cushion.") },
    safety: COMFORT,
  }),
  ex({
    id: "wall-straddle", modality: "HOLD", equipment: ["FLOOR", "WALL"], illustration: "wall-straddle",
    name: L("Grand écart au mur", "Wall straddle"),
    summary: L("Ouvrir les adducteurs sans effort, la gravité fait le travail.", "Open the adductors with no effort: gravity does the work."),
    steps: [
      L("Sur le dos, fesses contre le mur, jambes tendues dessus.", "On your back, hips against the wall, legs straight up it."),
      L("Laisse les jambes s’écarter lentement.", "Let the legs slide apart slowly."),
      L("Respire lentement ; resserre un peu si ça tire trop.", "Breathe slowly; bring them in a little if it pulls too much."),
    ],
    cue: L("Passif, 3/10", "Passive, 3/10"),
  }),

  /* ── The Lattice bare-minimum block (2 × 6 slow, in this order) ─────────── */
  ex({
    id: "calf-raise-step", modality: "REPS", tempo: 5, equipment: ["CHAIR", "WALL"], illustration: "calf-raise-step",
    name: L("Montées sur pointes, talon dans le vide", "Calf raises off a step"),
    summary: L("Mollets forts en amplitude complète, chevilles libres.", "Strong calves through the full range, free ankles."),
    steps: [
      L("Avant-pieds sur une marche, une main au mur.", "Balls of the feet on a step, one hand on the wall."),
      L("Descends le talon lentement sous la marche (3 s).", "Lower the heels slowly below the step (3 s)."),
      L("Monte sur la pointe et tiens 1 s.", "Rise onto your toes and hold 1 s."),
    ],
    cue: L("3 s en descente", "3 s down"),
    alternative: L("Sans marche : au sol, ou avant-pieds sur un livre épais.", "No step: on the floor, or the balls of your feet on a thick book."),
  }),
  ex({
    id: "horse-stance-squat", modality: "REPS", tempo: 5, equipment: ["BODYWEIGHT"], illustration: "horse-stance-squat",
    name: L("Squat cavalier", "Horse stance squat"),
    summary: L("Force des adducteurs et des hanches en position écartée.", "Adductor and hip strength in a wide stance."),
    steps: [
      L("Pieds très écartés, pointes légèrement ouvertes.", "Feet very wide, toes slightly turned out."),
      L("Descends en poussant les genoux vers l’extérieur, buste droit.", "Sit down pushing the knees out, chest tall."),
      L("Remonte lentement.", "Come up slowly."),
    ],
    cue: L("3 s en descente, 1 s en bas", "3 s down, 1 s at the bottom"),
    hip: { fromStage: 2, easier: L("Pieds un peu moins écartés, demi-amplitude, mains devant toi.", "Slightly narrower stance, half range, hands out in front.") },
    safety: COMFORT,
  }),
  ex({
    id: "cossack-squat", modality: "REPS", perSide: true, tempo: 5, equipment: ["BODYWEIGHT"], illustration: "cossack-squat",
    name: L("Squat cosaque", "Cossack squat"),
    summary: L("Descendre sur une jambe pendant que l’autre s’étire : force et souplesse latérales.",
      "Sink onto one leg while the other stretches: lateral strength and flexibility."),
    steps: [
      L("Pieds très écartés. Descends sur une jambe, l’autre reste tendue, pointe vers le plafond.", "Feet very wide. Sit onto one leg, the other stays straight, toes to the ceiling."),
      L("Talon de la jambe pliée au sol, buste aussi droit que possible.", "Heel of the bent leg down, chest as tall as you can."),
      L("Passe de l’autre côté en restant bas si tu peux.", "Shift to the other side, staying low if you can."),
    ],
    cue: L("Lent, talon au sol", "Slow, heel down"),
    hip: { fromStage: 2, easier: L("Fente latérale assistée : mains au mur ou sur une chaise, demi-amplitude.", "Assisted side lunge: hands on the wall or a chair, half range.") },
    safety: COMFORT,
  }),
  ex({
    id: "jefferson-curl", modality: "REPS", tempo: 6, equipment: ["BODYWEIGHT"], illustration: "jefferson-curl",
    name: L("Jefferson curl, poids du corps", "Bodyweight Jefferson curl"),
    summary: L("Enrouler la colonne vertèbre par vertèbre pour assouplir l’arrière du corps.", "Roll the spine down segment by segment to free the back line."),
    steps: [
      L("Debout, jambes tendues, menton rentré.", "Standing, legs straight, chin tucked."),
      L("Enroule le dos vers le bas, vertèbre par vertèbre, bras pendants (4 s).", "Roll your back down one vertebra at a time, arms hanging (4 s)."),
      L("Remonte en déroulant, la tête en dernier.", "Roll back up, head last."),
    ],
    cue: L("Très lent, sans charge en voyage", "Very slow, no load while travelling"),
    safety: BACK_SAFE,
  }),
  ex({
    id: "single-leg-good-morning", modality: "REPS", perSide: true, tempo: 5, equipment: ["CHAIR"], illustration: "single-leg-good-morning",
    name: L("Good morning sur une jambe, talon surélevé", "Elevated single-leg good morning"),
    summary: L("Ischios en étirement actif, une jambe à la fois.", "Active hamstring stretch, one leg at a time."),
    steps: [
      L("Talon sur une chaise stable, jambe tendue, l’autre jambe légèrement pliée.", "Heel on a stable chair, leg straight, the other knee slightly bent."),
      L("Dos plat, penche le buste vers l’avant à partir des hanches.", "Flat back, hinge forward from the hips."),
      L("Remonte en serrant le fessier.", "Come up squeezing the glute."),
    ],
    cue: L("Dos plat, 3 s en descente", "Flat back, 3 s down"),
    alternative: L("Sans chaise : talon au sol devant toi, pointe vers le haut, même bascule.",
      "No chair: heel on the floor in front of you, toes up, same hinge."),
    safety: BACK_SAFE,
  }),
  ex({
    id: "long-lunge-pulse", modality: "REPS", perSide: true, tempo: 3, equipment: ["BODYWEIGHT"], illustration: "long-lunge-pulse",
    name: L("Fente longue pulsée", "Long lunge pulse"),
    summary: L("Fléchisseurs de hanche et quadriceps en amplitude, avec un peu de force.", "Hip flexors and quads through range, with a little strength."),
    steps: [
      L("Très grande fente, genou arrière près du sol.", "Very long lunge, back knee close to the floor."),
      L("Descends le bassin de quelques centimètres et remonte, sans rebond.", "Lower the hips a few centimetres and come back, no bounce."),
      L("Buste droit, fessier arrière serré.", "Chest tall, back glute squeezed."),
    ],
    cue: L("Petites pulsations contrôlées", "Small controlled pulses"),
    safety: COMFORT,
  }),

  /* ── Upper body: pulling, shoulders, antagonists ────────────────────── */
  ex({
    id: "band-bent-row", modality: "REPS", tempo: 3, equipment: ["LONG_BAND"],
    name: L("Rowing penché, pieds sur l’élastique", "Bent-over band row, standing on the band"),
    summary: L("Le tirage de base pour le dos, sans ancrage.", "The basic back pull, with no anchor."),
    steps: [
      L("Debout sur l’élastique, pieds largeur de hanches, buste penché à 45°, dos plat.", "Stand on the band, feet hip-width, chest hinged to 45°, flat back."),
      L("Tire les mains vers les hanches, coudes près du corps, omoplates serrées 1 s.", "Pull your hands to your hips, elbows close, shoulder blades squeezed for 1 s."),
      L("Redescends en 2 s. Raccourcis l’élastique pour durcir.", "Lower in 2 s. Shorten the band to make it harder."),
    ],
    cue: L("2 répétitions en réserve", "2 reps in reserve"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "band-seated-row", modality: "REPS", tempo: 3, equipment: ["LONG_BAND", "FLOOR"],
    name: L("Rowing assis, élastique autour des pieds", "Seated band row, band round the feet"),
    summary: L("Tirage horizontal, élastique bloqué par les pieds.", "Horizontal pull, the band held by your feet."),
    steps: [
      L("Assis jambes tendues, élastique passé sous les plantes de pieds.", "Sit with legs straight, the band round the soles of your feet."),
      L("Dos droit, tire les mains vers le nombril en ouvrant la poitrine.", "Back tall, pull your hands to your navel, opening the chest."),
      L("Tiens 1 s, reviens en 2 s sans arrondir le dos.", "Hold 1 s, return in 2 s without rounding."),
    ],
    cue: L("2 répétitions en réserve", "2 reps in reserve"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "band-one-arm-row", modality: "REPS", perSide: true, tempo: 3, equipment: ["LONG_BAND"],
    name: L("Rowing un bras en fente", "Split-stance one-arm band row"),
    summary: L("Tirage unilatéral avec gainage en rotation, comme un bras qui tire sur une prise.",
      "One-arm pull with anti-rotation core, like one arm pulling on a hold."),
    steps: [
      L("En fente, pied avant sur l’élastique, main opposée qui le tient.", "In a split stance, front foot on the band, opposite hand holding it."),
      L("Buste penché, tire le coude vers la hanche sans tourner le buste.", "Chest hinged, pull the elbow to the hip without twisting."),
      L("Redescends lentement.", "Lower slowly."),
    ],
    cue: L("1 s en haut, buste immobile", "1 s at the top, torso still"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "band-overhead-pulldown", modality: "REPS", tempo: 3, equipment: ["LONG_BAND"],
    name: L("Tirage vertical à l’élastique", "Band overhead pull-down"),
    summary: L("Grands dorsaux : tirer de haut en bas, comme une traction.", "Lats: pull from overhead down, like a pull-up."),
    steps: [
      L("Élastique tendu entre les mains, bras tendus au-dessus de la tête, mains plus larges que les épaules.", "Band stretched between your hands, arms straight overhead, hands wider than shoulders."),
      L("Écarte et descends les coudes vers les côtes, élastique derrière la tête ou devant la poitrine.", "Pull apart and drive the elbows down to the ribs, band behind the head or in front of the chest."),
      L("Remonte lentement en gardant la tension.", "Go back up slowly, keeping tension."),
    ],
    cue: L("Omoplates basses, 2 répétitions en réserve", "Shoulder blades down, 2 reps in reserve"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "band-lockoff", modality: "HOLD", perSide: true, equipment: ["LONG_BAND"],
    name: L("Blocage isométrique à l’élastique", "Band lock-off hold"),
    summary: L("Tenir un bras plié contre une forte tension : le blocage pour aller chercher la prise suivante.",
      "Hold a bent arm against strong tension: the lock-off that reaches the next hold."),
    steps: [
      L("Pied sur l’élastique, tire jusqu’à coude plié à 90°, poignet neutre.", "Foot on the band, pull until the elbow is bent to 90°, wrist neutral."),
      L("Tiens la position, épaule basse, sans te pencher.", "Hold the position, shoulder down, no leaning."),
      L("Choisis une tension que tu tiens tout juste.", "Pick a tension you can just hold."),
    ],
    cue: L("Effort 8/10 sur la fin", "Effort 8/10 by the end"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "band-face-pull-free", modality: "REPS", tempo: 3, equipment: ["LONG_BAND"],
    name: L("Face pull sans ancrage", "Anchor-free band face pull"),
    summary: L("Arrière d’épaule et rotation externe : l’équilibre des épaules de grimpeur.",
      "Rear shoulder and external rotation: balance for a climber’s shoulders."),
    steps: [
      L("Élastique tenu à deux mains à hauteur des yeux, bras tendus devant.", "Band held in both hands at eye level, arms straight ahead."),
      L("Tire vers le front en écartant les mains et en tournant les poings vers l’arrière.", "Pull towards your forehead, spreading the hands and turning the fists back."),
      L("Finis coudes hauts, mains à côté des oreilles.", "Finish elbows high, hands beside your ears."),
    ],
    cue: L("Lent, tension légère", "Slow, light tension"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "band-external-rotation-free", modality: "REPS", tempo: 3, equipment: ["LONG_BAND"],
    name: L("Rotations externes à deux mains", "Two-hand band external rotation"),
    summary: L("Coiffe des rotateurs : stabilité de l’épaule sur les jetés et les bras tendus.",
      "Rotator cuff: shoulder stability for dynos and straight-arm moves."),
    steps: [
      L("Coudes collés au corps, pliés à 90°, élastique court entre les mains.", "Elbows tucked in, bent to 90°, short band between your hands."),
      L("Écarte les avant-bras vers l’extérieur sans décoller les coudes.", "Rotate the forearms outwards without lifting the elbows."),
      L("Reviens en 3 s.", "Return in 3 s."),
    ],
    cue: L("Tension légère, contrôle", "Light tension, control"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "prone-ytw", modality: "REPS", tempo: 6,
    name: L("Y-T-W sur le ventre", "Prone Y-T-W raises"),
    summary: L("Bas des trapèzes et omoplates : les épaules restent basses quand on tire.", "Lower traps and shoulder blades: shoulders stay down when you pull."),
    steps: [
      L("À plat ventre, front sur une serviette, pouces vers le plafond.", "Lie face down, forehead on a towel, thumbs to the ceiling."),
      L("Lève les bras en Y, puis en T, puis en W (coudes pliés) : 2 s en haut chaque fois.", "Lift the arms in a Y, then a T, then a W (elbows bent): 2 s up each time."),
      L("Une lettre de chaque = une répétition.", "One of each letter = one rep."),
    ],
    cue: L("Petit mouvement, omoplates basses", "Small move, shoulder blades down"),
  }),
  ex({
    id: "prone-towel-pulldown", modality: "REPS", tempo: 4,
    name: L("Tirage serviette à plat ventre", "Prone towel pull-down"),
    summary: L("Contracter les dorsaux en position de traction, sans barre.", "Squeeze the lats in a pull-up position, without a bar."),
    steps: [
      L("À plat ventre, serviette tendue entre les mains, bras devant toi.", "Face down, towel taut between your hands, arms in front."),
      L("Décolle les bras et tire la serviette derrière la nuque en l’écartant fort.", "Lift the arms and pull the towel behind your neck, pulling it apart hard."),
      L("Tiens 2 s, retends les bras.", "Hold 2 s, reach forward again."),
    ],
    cue: L("2 s de contraction", "2 s squeeze"),
  }),
  ex({
    id: "push-up", modality: "REPS", tempo: 3,
    name: L("Pompes", "Push-ups"),
    summary: L("Les antagonistes : pousser pour protéger les épaules qui tirent toute l’année.", "Antagonists: push to protect shoulders that pull all year."),
    steps: [
      L("Mains sous les épaules, corps gainé de la tête aux talons.", "Hands under shoulders, body braced head to heels."),
      L("Descends la poitrine en 2 s, coudes à 45° du corps.", "Lower the chest in 2 s, elbows at 45° from the body."),
      L("Pousse le sol, omoplates qui s’écartent en haut.", "Push the floor away, shoulder blades spreading at the top."),
    ],
    cue: L("2 répétitions en réserve", "2 reps in reserve"),
    alternative: L("Plus facile : genoux au sol, ou mains contre le mur.", "Easier: knees down, or hands on the wall."),
  }),
  ex({
    id: "pike-push-up", modality: "REPS", tempo: 3,
    name: L("Pompes piquées", "Pike push-ups"),
    summary: L("Pousser au-dessus de la tête : épaules fortes pour les rétablissements.", "Overhead pushing: strong shoulders for mantles."),
    steps: [
      L("En V inversé, fesses hautes, mains largeur d’épaules.", "In an inverted V, hips high, hands shoulder-width."),
      L("Descends le sommet du crâne vers le sol entre les mains.", "Lower the top of your head towards the floor between your hands."),
      L("Repousse jusqu’aux bras tendus.", "Press back up to straight arms."),
    ],
    cue: L("Amplitude contrôlée", "Controlled range"),
    alternative: L("Plus facile : petite amplitude, pieds plus loin des mains.", "Easier: smaller range, feet further from the hands."),
  }),
  ex({
    id: "band-curl", modality: "REPS", tempo: 3, equipment: ["LONG_BAND"],
    name: L("Curl à l’élastique", "Band biceps curl"),
    summary: L("Fléchisseurs du coude, pour les blocages et les bras pliés.", "Elbow flexors, for lock-offs and bent-arm moves."),
    steps: [
      L("Debout sur l’élastique, mains en supination.", "Stand on the band, palms up."),
      L("Plie les coudes sans les avancer, jusqu’en haut.", "Bend the elbows without moving them forward, all the way up."),
      L("Redescends en 3 s.", "Lower in 3 s."),
    ],
    cue: L("3 s en descente", "3 s down"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "finger-extensions", modality: "REPS", tempo: 2, equipment: ["MINI_BAND"],
    name: L("Extensions des doigts", "Finger extensions"),
    summary: L("Les extenseurs des doigts, pour l’équilibre de l’avant-bras. Ce n’est pas un entraînement de force des doigts.",
      "The finger extensors, for forearm balance. This is not finger strength training."),
    steps: [
      L("Mini-élastique autour des doigts tendus, au niveau des ongles.", "Mini band round your straight fingers, at the nails."),
      L("Ouvre les doigts au maximum, tiens 1 s, referme lentement.", "Spread the fingers as wide as you can, hold 1 s, close slowly."),
      L("Puis l’autre main.", "Then the other hand."),
    ],
    cue: L("Facile, beaucoup de répétitions", "Easy, high reps"),
    alternative: L("Sans mini-élastique : ouvre les doigts contre la résistance de l’autre main.", "No mini band: spread the fingers against the other hand’s resistance."),
    perSide: true,
  }),
  ex({
    id: "reverse-snow-angels", modality: "REPS", tempo: 5,
    name: L("Anges inversés", "Reverse snow angels"),
    summary: L("Haut du dos et épaules en grande amplitude, allongé sur le ventre.", "Upper back and shoulders through a big range, lying face down."),
    steps: [
      L("À plat ventre, bras le long du corps, paumes vers le sol, légèrement décollés.", "Face down, arms by your sides, palms down, slightly lifted."),
      L("Fais glisser les bras en arc jusqu’au-dessus de la tête sans toucher le sol.", "Sweep the arms in an arc overhead without touching the floor."),
      L("Reviens le long du corps.", "Sweep back to your sides."),
    ],
    cue: L("Lent, bras décollés", "Slow, arms off the floor"),
  }),
  ex({
    id: "bear-crawl", modality: "TIME", equipment: ["FLOOR"],
    name: L("Marche de l’ours", "Bear crawl"),
    summary: L("Coordination bras-jambes et épaules stables sous le poids du corps.", "Arm-leg coordination and stable shoulders under bodyweight."),
    steps: [
      L("À quatre pattes, genoux décollés de 3 cm.", "On all fours, knees 3 cm off the floor."),
      L("Avance main et pied opposés, puis recule, dos plat.", "Move the opposite hand and foot forward, then back, flat back."),
      L("Dans une chambre : 2 pas en avant, 2 en arrière.", "In a hotel room: 2 steps forward, 2 back."),
    ],
    cue: L("Dos plat comme une table", "Back flat as a table"),
  }),

  /* ── Core and body tension ──────────────────────────────────────────── */
  ex({
    id: "hollow-hold", modality: "HOLD",
    name: L("Position creuse (hollow)", "Hollow body hold"),
    summary: L("La tension du corps qui garde les pieds sur les prises en dévers.", "The body tension that keeps your feet on in overhangs."),
    steps: [
      L("Sur le dos, bas du dos plaqué au sol.", "On your back, lower back pressed into the floor."),
      L("Décolle épaules et jambes, bras le long des oreilles.", "Lift shoulders and legs, arms by your ears."),
      L("Le bas du dos ne décolle jamais.", "The lower back never lifts."),
    ],
    cue: L("Bas du dos au sol", "Lower back down"),
    alternative: L("Plus facile : genoux pliés, bras le long du corps.", "Easier: knees bent, arms by your sides."),
  }),
  ex({
    id: "dead-bug", modality: "REPS", perSide: true, tempo: 4,
    name: L("Dead bug", "Dead bug"),
    summary: L("Gainage avec bras et jambes qui bougent : le tronc reste fixe.", "Core control while arms and legs move: the trunk stays still."),
    steps: [
      L("Sur le dos, bras vers le plafond, genoux au-dessus des hanches.", "On your back, arms to the ceiling, knees over hips."),
      L("Allonge bras et jambe opposés vers le sol en expirant.", "Reach the opposite arm and leg to the floor, breathing out."),
      L("Reviens et change de côté.", "Return and switch sides."),
    ],
    cue: L("Lent, bas du dos au sol", "Slow, lower back down"),
  }),
  ex({
    id: "side-plank", modality: "HOLD", perSide: true,
    name: L("Gainage latéral", "Side plank"),
    summary: L("Obliques et hanches : tenir le corps contre le mur sur les pieds de côté.", "Obliques and hips: holding the body in on side-on footholds."),
    steps: [
      L("Sur le côté, coude sous l’épaule, pieds empilés.", "On your side, elbow under shoulder, feet stacked."),
      L("Monte le bassin : corps droit de la tête aux pieds.", "Lift the hips: body straight head to feet."),
      L("Respire sans laisser tomber le bassin.", "Breathe without letting the hips drop."),
    ],
    cue: L("Bassin haut", "Hips high"),
    alternative: L("Plus facile : genoux au sol.", "Easier: knees down."),
  }),
  ex({
    id: "plank-shoulder-taps", modality: "REPS", perSide: true, tempo: 2,
    name: L("Planche, touchers d’épaule", "Plank shoulder taps"),
    summary: L("Gainage anti-rotation sur un bras, comme lâcher une main.", "Anti-rotation core on one arm, like letting go with one hand."),
    steps: [
      L("En planche haute, pieds un peu écartés.", "In a high plank, feet a little apart."),
      L("Touche l’épaule opposée avec une main, sans que le bassin bouge.", "Tap the opposite shoulder with one hand without moving the hips."),
      L("Alterne.", "Alternate."),
    ],
    cue: L("Bassin immobile", "Hips still"),
  }),
  ex({
    id: "bird-dog", modality: "REPS", perSide: true, tempo: 4,
    name: L("Bird-dog", "Bird-dog"),
    summary: L("Chaîne croisée bras-jambe et stabilité du dos.", "Cross-body arm-leg chain and back stability."),
    steps: [
      L("À quatre pattes, allonge un bras et la jambe opposée.", "On all fours, reach one arm and the opposite leg long."),
      L("Tiens 2 s, ramène coude et genou sous toi.", "Hold 2 s, bring elbow and knee together under you."),
      L("Puis l’autre côté.", "Then the other side."),
    ],
    cue: L("Dos plat, 2 s en extension", "Flat back, 2 s extended"),
  }),
  ex({
    id: "reverse-crunch", modality: "REPS", tempo: 3,
    name: L("Relevés de bassin", "Reverse crunch"),
    summary: L("Remonter les genoux vers la poitrine : la compression des pieds hauts et des crochets.", "Knees to chest: the compression behind high feet and toe hooks."),
    steps: [
      L("Sur le dos, genoux pliés au-dessus des hanches, mains au sol.", "On your back, knees bent over hips, hands on the floor."),
      L("Enroule le bassin pour amener les genoux vers la poitrine.", "Curl the pelvis to bring the knees to the chest."),
      L("Redescends en 3 s sans laisser le dos se cambrer.", "Lower in 3 s without arching."),
    ],
    cue: L("Contrôle en descente", "Control the way down"),
  }),
  ex({
    id: "hollow-rocks", modality: "REPS", tempo: 2,
    name: L("Bascules en creux", "Hollow rocks"),
    summary: L("La position creuse en mouvement.", "The hollow position, in motion."),
    steps: [
      L("En position creuse.", "In the hollow position."),
      L("Bascule d’avant en arrière comme un berceau sans perdre la forme.", "Rock back and forth like a cradle without losing the shape."),
      L("Arrête la série dès que le dos se cambre.", "Stop the set as soon as your back arches."),
    ],
    cue: L("Forme d’abord", "Shape first"),
    alternative: L("Plus facile : position creuse tenue 15 s.", "Easier: hold the hollow for 15 s."),
  }),
  ex({
    id: "side-lying-adductor", modality: "REPS", perSide: true, tempo: 3, equipment: ["FLOOR", "CHAIR"],
    name: L("Adducteurs : Copenhague court", "Short-lever Copenhagen plank"),
    summary: L("Adducteurs forts : plaquer un pied sur le côté et tirer le corps vers lui.", "Strong adductors: pressing a foot on the side and pulling the body to it."),
    steps: [
      L("Gainage latéral, genou du dessus posé sur une chaise stable, jambe du dessous libre.", "Side plank with the top knee on a stable chair, bottom leg free."),
      L("Monte le bassin en serrant la cuisse sur la chaise, tiens 2 s.", "Lift the hips by pressing the thigh into the chair, hold 2 s."),
      L("Redescends lentement.", "Lower slowly."),
    ],
    cue: L("2 s en haut", "2 s at the top"),
    alternative: L("Sans chaise : allongé sur le côté, lève la jambe du dessous (celle au sol) 2 s, l’autre pied posé devant.",
      "No chair: lying on your side, lift the bottom leg for 2 s, top foot planted in front."),
  }),
  ex({
    id: "superman", modality: "REPS", tempo: 4,
    name: L("Superman", "Superman"),
    summary: L("Toute la chaîne arrière, pour les talons et les pieds qui poussent.", "The whole back chain, for heel hooks and pushing feet."),
    steps: [
      L("À plat ventre, bras devant.", "Face down, arms in front."),
      L("Décolle bras, poitrine et jambes 2 s, regard vers le sol.", "Lift arms, chest and legs for 2 s, eyes on the floor."),
      L("Redescends.", "Lower."),
    ],
    cue: L("2 s en haut, nuque longue", "2 s up, long neck"),
    safety: BACK_SAFE,
  }),

  /* ── Lower body and balance ─────────────────────────────────────────── */
  ex({
    id: "split-squat", modality: "REPS", perSide: true, tempo: 4, equipment: ["CHAIR"],
    name: L("Fente bulgare", "Bulgarian split squat"),
    summary: L("Force d’une jambe, celle qui pousse sur un pied haut.", "Single-leg strength, the one that pushes up on a high foot."),
    steps: [
      L("Pied arrière posé sur une chaise stable, pied avant loin devant.", "Back foot on a stable chair, front foot well ahead."),
      L("Descends en 3 s jusqu’à frôler le sol avec le genou arrière.", "Lower in 3 s until the back knee nearly touches the floor."),
      L("Pousse dans le talon avant pour remonter.", "Drive through the front heel to stand."),
    ],
    cue: L("2 répétitions en réserve", "2 reps in reserve"),
    alternative: L("Sans chaise : fente arrière au sol, même tempo.", "No chair: reverse lunge on the floor, same tempo."),
  }),
  ex({
    id: "single-leg-rdl", modality: "REPS", perSide: true, tempo: 4, equipment: ["BODYWEIGHT"],
    name: L("Soulevé de terre sur une jambe", "Single-leg Romanian deadlift"),
    summary: L("Ischios, fessiers et équilibre sur un pied.", "Hamstrings, glutes and one-foot balance."),
    steps: [
      L("Sur une jambe, genou souple.", "On one leg, soft knee."),
      L("Bascule le buste en avant, jambe libre derrière, dos plat, jusqu’à sentir les ischios.", "Hinge forward, free leg behind, flat back, until you feel the hamstrings."),
      L("Remonte en poussant les hanches vers l’avant.", "Come up by driving the hips forward."),
    ],
    cue: L("Lent, bassin de face", "Slow, hips square"),
    alternative: L("Plus facile : bout du pied arrière posé au sol.", "Easier: back toes resting on the floor."),
  }),
  ex({
    id: "single-leg-squat-to-chair", modality: "REPS", perSide: true, tempo: 4, equipment: ["CHAIR"],
    name: L("Squat sur une jambe vers une chaise", "Single-leg squat to a chair"),
    summary: L("Se relever sur une jambe, comme sur un pied haut.", "Standing up on one leg, as on a high foot."),
    steps: [
      L("Dos à une chaise stable, sur une jambe, l’autre tendue devant.", "Back to a stable chair, on one leg, the other straight in front."),
      L("Descends en 3 s jusqu’à effleurer la chaise.", "Lower in 3 s until you just touch the chair."),
      L("Remonte sans élan.", "Stand up without momentum."),
    ],
    cue: L("3 s en descente", "3 s down"),
    alternative: L("Sans chaise : squat sur une jambe main au mur, demi-amplitude.", "No chair: single-leg squat with a hand on the wall, half range."),
  }),
  ex({
    id: "wall-sit", modality: "HOLD", equipment: ["WALL"], illustration: "wall-sit",
    name: L("Chaise au mur", "Wall sit"),
    summary: L("Endurance des cuisses, genoux ménagés.", "Thigh endurance, easy on the knees."),
    steps: [
      L("Dos au mur, descends jusqu’à cuisses presque parallèles au sol.", "Back on the wall, slide down until the thighs are nearly level."),
      L("Genoux au-dessus des chevilles.", "Knees over ankles."),
      L("Remonte un peu si le genou proteste.", "Come up a little if a knee complains."),
    ],
    cue: L("Effort 7/10 à la fin", "Effort 7/10 by the end"),
  }),
  ex({
    id: "band-lateral-walk", modality: "REPS", perSide: true, tempo: 2, equipment: ["MINI_BAND"], illustration: "band-lateral-walk",
    name: L("Pas chassés à l’élastique", "Band lateral walk"),
    summary: L("Moyen fessier : genoux stables sur les pieds de côté.", "Glute medius: steady knees on side footholds."),
    steps: [
      L("Mini-élastique au-dessus des genoux ou aux chevilles, demi-squat.", "Mini band above the knees or at the ankles, half squat."),
      L("Fais des pas latéraux sans laisser les genoux rentrer.", "Step sideways without letting the knees cave."),
      L("Les répétitions comptent les pas de chaque côté.", "Reps count the steps each way."),
    ],
    cue: L("Genoux vers l’extérieur", "Knees pushed out"),
    alternative: L("Sans mini-élastique : même mouvement très lent, ou élastique long noué en boucle.", "No mini band: same move very slowly, or a long band tied in a loop."),
  }),
  ex({
    id: "clamshell", modality: "REPS", perSide: true, tempo: 3, equipment: ["FLOOR", "MINI_BAND"], illustration: "clamshell",
    name: L("Clamshell", "Clamshell"),
    summary: L("Rotation externe de hanche contre résistance.", "Hip external rotation against resistance."),
    steps: [
      L("Sur le côté, hanches et genoux pliés, mini-élastique au-dessus des genoux.", "On your side, hips and knees bent, mini band above the knees."),
      L("Ouvre le genou du dessus sans rouler le bassin en arrière.", "Open the top knee without rolling the pelvis back."),
      L("Tiens 1 s, referme lentement.", "Hold 1 s, close slowly."),
    ],
    cue: L("1 s en haut", "1 s at the top"),
    alternative: L("Sans mini-élastique : même mouvement, 2 s en haut.", "No mini band: same move, 2 s at the top."),
  }),
  ex({
    id: "single-leg-bridge", modality: "REPS", perSide: true, tempo: 3,
    name: L("Pont fessier sur une jambe", "Single-leg glute bridge"),
    summary: L("Fessiers et ischios, un côté à la fois.", "Glutes and hamstrings, one side at a time."),
    steps: [
      L("Sur le dos, un pied au sol, l’autre jambe tendue en l’air.", "On your back, one foot down, the other leg straight up."),
      L("Monte le bassin en poussant dans le talon, sans le laisser pencher.", "Lift the hips through the heel without letting them tilt."),
      L("Redescends en 2 s.", "Lower in 2 s."),
    ],
    cue: L("Bassin horizontal", "Hips level"),
  }),
  ex({
    id: "hamstring-walkout", modality: "REPS", tempo: 6,
    name: L("Pont marché", "Hamstring bridge walkout"),
    summary: L("Ischios forts en allongement, sans machine.", "Strong hamstrings at length, no machine."),
    steps: [
      L("En pont fessier, avance les talons à petits pas jusqu’à jambes presque tendues.", "In a glute bridge, walk the heels out in small steps until the legs are nearly straight."),
      L("Reviens à petits pas, bassin toujours haut.", "Walk back in, hips staying up."),
      L("Arrête dès qu’une crampe arrive.", "Stop at the first hint of a cramp."),
    ],
    cue: L("Bassin haut tout du long", "Hips up the whole time"),
  }),
  ex({
    id: "band-squat", modality: "REPS", tempo: 3, equipment: ["LONG_BAND"],
    name: L("Squat à l’élastique", "Band squat"),
    summary: L("Squat complet avec une charge qui augmente en haut.", "Full squat with load that grows at the top."),
    steps: [
      L("Debout sur l’élastique, l’autre extrémité passée derrière les épaules ou tenue aux épaules.", "Stand on the band, the other end behind your shoulders or held at them."),
      L("Descends aussi bas que tu contrôles, talons au sol.", "Squat as deep as you control, heels down."),
      L("Remonte en poussant le sol.", "Push the floor away to stand."),
    ],
    cue: L("2 répétitions en réserve", "2 reps in reserve"),
    safety: BAND_SAFE,
  }),
  ex({
    id: "balance-reach", modality: "REPS", perSide: true, tempo: 5, equipment: ["BODYWEIGHT"],
    name: L("Équilibre sur un pied, atteintes en étoile", "Single-leg star reach"),
    summary: L("Équilibre et contrôle du genou dans toutes les directions.", "Balance and knee control in every direction."),
    steps: [
      L("Sur un pied, genou souple.", "On one foot, soft knee."),
      L("Touche le sol du bout de l’autre pied devant, sur le côté, puis derrière, le plus loin possible.", "Tap the floor with the other foot in front, to the side, then behind, as far as you can."),
      L("Les trois directions = une répétition.", "All three directions = one rep."),
    ],
    cue: L("Genou au-dessus du pied", "Knee over the foot"),
  }),
  ex({
    id: "eyes-closed-balance", modality: "HOLD", perSide: true, equipment: ["WALL"],
    name: L("Équilibre yeux fermés", "Eyes-closed balance"),
    summary: L("Proprioception de la cheville : le pied qui sent la prise.", "Ankle proprioception: the foot that feels the hold."),
    steps: [
      L("Près d’un mur, sur un pied, genou souple.", "Near a wall, on one foot, soft knee."),
      L("Ferme les yeux et tiens sans toucher le mur.", "Close your eyes and hold without touching the wall."),
      L("Rouvre les yeux si tu perds l’équilibre, puis reprends.", "Open your eyes if you lose balance, then start again."),
    ],
    cue: L("Calme, respiration lente", "Calm, slow breathing"),
  }),

  /* ── Conditioning ───────────────────────────────────────────────────── */
  ex({
    id: "jumping-jacks", modality: "TIME", equipment: ["BODYWEIGHT"],
    name: L("Jumping jacks", "Jumping jacks"),
    summary: L("Monter le cœur, tout le corps.", "Raise the heart rate, whole body."),
    steps: [
      L("Saute pieds écartés en levant les bras, puis pieds joints bras en bas.", "Jump feet apart raising the arms, then feet together arms down."),
      L("Version sans saut (voisins, genoux) : un pied après l’autre.", "No-jump version (neighbours, knees): one foot at a time."),
      L("Rythme régulier.", "Steady rhythm."),
    ],
    cue: L("Effort 6/10", "Effort 6/10"),
  }),
  ex({
    id: "mountain-climbers", modality: "TIME", equipment: ["FLOOR"],
    name: L("Mountain climbers", "Mountain climbers"),
    summary: L("Cardio et gainage avec les genoux qui montent vite.", "Cardio and core, knees driving fast."),
    steps: [
      L("En planche haute, ramène un genou vers la poitrine, puis l’autre.", "In a high plank, drive one knee to the chest, then the other."),
      L("Bassin bas, épaules au-dessus des mains.", "Hips low, shoulders over the hands."),
      L("Ralentis plutôt que de perdre la forme.", "Slow down rather than lose the shape."),
    ],
    cue: L("Effort 7/10", "Effort 7/10"),
  }),
  ex({
    id: "squat-jumps", modality: "REPS", tempo: 3, equipment: ["BODYWEIGHT"],
    name: L("Squats sautés", "Squat jumps"),
    summary: L("Puissance des jambes, réception silencieuse.", "Leg power, quiet landings."),
    steps: [
      L("Demi-squat, puis saute le plus haut possible.", "Half squat, then jump as high as you can."),
      L("Reçois-toi en silence, genoux souples, et enchaîne.", "Land quietly, knees soft, and go again."),
      L("Sans saut (étage, genoux) : squat rapide sur la pointe des pieds.", "No jump (upstairs, knees): fast squat up onto your toes."),
    ],
    cue: L("Explosif, réception douce", "Explosive, soft landing"),
  }),
  ex({
    id: "skater-hops", modality: "REPS", perSide: true, tempo: 2, equipment: ["BODYWEIGHT"],
    name: L("Sauts de patineur", "Skater hops"),
    summary: L("Puissance latérale et réception sur un pied.", "Lateral power and single-leg landing."),
    steps: [
      L("Saute latéralement d’un pied sur l’autre.", "Jump sideways from one foot to the other."),
      L("Stabilise 1 s la réception, genou au-dessus du pied.", "Stick the landing for 1 s, knee over the foot."),
      L("Petits sauts dans une chambre.", "Small hops in a hotel room."),
    ],
    cue: L("Réception tenue", "Stick the landing"),
  }),
  ex({
    id: "burpees", modality: "REPS", tempo: 5, equipment: ["FLOOR"],
    name: L("Burpees", "Burpees"),
    summary: L("Tout le corps, de la planche à la position debout.", "Whole body, from plank to standing."),
    steps: [
      L("Accroupis, mains au sol, pieds en arrière en planche.", "Squat, hands down, step or jump back to a plank."),
      L("Ramène les pieds, relève-toi et monte les bras (saut facultatif).", "Bring the feet in, stand and reach up (jump optional)."),
      L("Rythme que tu peux garder toute la série.", "A pace you can hold for the whole set."),
    ],
    cue: L("Effort 7–8/10", "Effort 7–8/10"),
  }),
  ex({
    id: "shadow-boxing", modality: "TIME", equipment: ["BODYWEIGHT"],
    name: L("Shadow boxing", "Shadow boxing"),
    summary: L("Cardio du haut du corps, épaules relâchées.", "Upper-body cardio, loose shoulders."),
    steps: [
      L("Garde haute, petits pas.", "Guard up, light feet."),
      L("Directs, crochets, esquives, sans verrouiller les coudes.", "Jabs, hooks, slips, never locking the elbows."),
      L("Respire à chaque coup.", "Breathe out with each punch."),
    ],
    cue: L("Effort 6/10", "Effort 6/10"),
  }),

  /* ── Flexibility and cool-down ──────────────────────────────────────── */
  ex({
    id: "strap-hamstring", modality: "HOLD", perSide: true, equipment: ["FLOOR", "LONG_BAND"], illustration: "strap-hamstring",
    name: L("Ischios à l’élastique, sur le dos", "Supine hamstring stretch with the band"),
    summary: L("Ischios étirés sans charger le dos.", "Hamstrings stretched without loading the back."),
    steps: [
      L("Sur le dos, élastique autour du pied, jambe tendue vers le plafond.", "On your back, band round the foot, leg straight to the ceiling."),
      L("Tire doucement la jambe vers toi, l’autre jambe au sol.", "Gently draw the leg towards you, the other leg on the floor."),
      L("Toutes les 15 s, pousse 3 s contre l’élastique puis gagne un peu.", "Every 15 s, push into the band for 3 s, then gain a little."),
    ],
    cue: L("Étirement 4/10", "Stretch 4/10"),
  }),
  ex({
    id: "side-lying-quad", modality: "HOLD", perSide: true, illustration: "side-lying-quad",
    name: L("Quadriceps allongé sur le côté", "Side-lying quad stretch"),
    summary: L("Avant de la cuisse, sans charger le genou.", "Front of the thigh, without loading the knee."),
    steps: [
      L("Sur le côté, attrape la cheville du dessus.", "On your side, hold the top ankle."),
      L("Ramène le talon vers la fesse et pousse la hanche vers l’avant.", "Bring the heel to the glute and push the hip forward."),
      L("Utilise l’élastique si tu n’attrapes pas la cheville.", "Use the band if you can’t reach the ankle."),
    ],
    cue: L("Étirement 4/10", "Stretch 4/10"),
  }),
  ex({
    id: "wall-calf", modality: "HOLD", perSide: true, equipment: ["WALL"], illustration: "wall-calf",
    name: L("Mollets au mur", "Wall calf stretch"),
    summary: L("Chevilles souples pour les pieds sur des grattons.", "Supple ankles for feet on tiny edges."),
    steps: [
      L("Mains au mur, une jambe tendue derrière, talon au sol.", "Hands on the wall, one leg straight behind, heel down."),
      L("Avance le bassin jusqu’à sentir le mollet.", "Move your hips forward until you feel the calf."),
      L("Puis plie le genou arrière pour le bas du mollet.", "Then bend the back knee for the lower calf."),
    ],
    cue: L("Étirement 4/10", "Stretch 4/10"),
  }),
  ex({
    id: "knee-to-wall", modality: "REPS", perSide: true, tempo: 3, equipment: ["WALL"], illustration: "knee-to-wall",
    name: L("Genou au mur", "Knee to wall"),
    summary: L("Flexion de cheville, pour les pieds hauts et les talons.", "Ankle bend, for high feet and heel hooks."),
    steps: [
      L("Face au mur, pied à une main du mur.", "Facing the wall, foot a hand’s width away."),
      L("Avance le genou pour toucher le mur, talon au sol.", "Drive the knee to touch the wall, heel down."),
      L("Recule le pied d’un centimètre quand c’est facile.", "Move the foot back a centimetre when it’s easy."),
    ],
    cue: L("Talon collé au sol", "Heel stuck down"),
  }),
  ex({
    id: "wall-pec", modality: "HOLD", perSide: true, equipment: ["WALL"], illustration: "wall-pec",
    name: L("Pectoraux au mur", "Wall pec stretch"),
    summary: L("Ouvrir la poitrine que les tractions referment.", "Open the chest that pulling closes."),
    steps: [
      L("Avant-bras contre le mur, coude à hauteur d’épaule.", "Forearm on the wall, elbow at shoulder height."),
      L("Tourne doucement le buste à l’opposé.", "Gently turn your chest away."),
      L("Épaule basse, pas de fourmillement dans la main.", "Shoulder down, no tingling in the hand."),
    ],
    cue: L("Étirement 3/10", "Stretch 3/10"),
  }),
  ex({
    id: "kneeling-lat-stretch", modality: "HOLD", illustration: "kneeling-lat-stretch",
    name: L("Dorsaux à genoux", "Kneeling lat stretch"),
    summary: L("Allonger les dorsaux, raccourcis par la grimpe.", "Lengthen the lats that climbing shortens."),
    steps: [
      L("À genoux, mains au sol loin devant, une main sur l’autre.", "Kneeling, hands far ahead on the floor, one on the other."),
      L("Recule les fesses vers les talons, poitrine vers le sol.", "Sit the hips back to the heels, chest towards the floor."),
      L("Penche un peu d’un côté puis de l’autre.", "Lean a little to one side, then the other."),
    ],
    cue: L("Respire dans les côtes", "Breathe into your ribs"),
  }),
  ex({
    id: "towel-thoracic-opener", modality: "HOLD", illustration: "towel-thoracic-opener",
    name: L("Ouverture du haut du dos sur serviette roulée", "Towel thoracic opener"),
    summary: L("Rendre de l’extension au haut du dos.", "Give the upper back its extension back."),
    steps: [
      L("Serviette roulée sous le haut du dos, perpendiculaire à la colonne.", "Rolled towel under your upper back, across the spine."),
      L("Mains derrière la tête, laisse le haut du dos s’ouvrir.", "Hands behind your head, let the upper back open."),
      L("Déplace la serviette d’une vertèbre toutes les 30 s.", "Move the towel up one vertebra every 30 s."),
    ],
    cue: L("Passif, respiration lente", "Passive, slow breathing"),
  }),
  ex({
    id: "forearm-stretch", modality: "HOLD", perSide: true, equipment: ["BODYWEIGHT"], illustration: "forearm-stretch",
    name: L("Avant-bras : fléchisseurs et extenseurs", "Forearm flexor and extensor stretch"),
    summary: L("Détendre les avant-bras, même sans grimper.", "Release the forearms, even without climbing."),
    steps: [
      L("Bras tendu, paume vers l’avant, tire doucement les doigts vers toi.", "Arm straight, palm forward, gently pull the fingers back."),
      L("Puis paume vers toi, poing fermé, plie le poignet vers le bas.", "Then palm facing you, fist closed, bend the wrist down."),
      L("La moitié du temps pour chaque position.", "Half the time in each position."),
    ],
    cue: L("Étirement 3/10", "Stretch 3/10"),
  }),
  ex({
    id: "childs-pose", modality: "HOLD", illustration: "childs-pose",
    name: L("Posture de l’enfant", "Child’s pose"),
    summary: L("Relâcher le dos et les épaules.", "Let the back and shoulders go."),
    steps: [
      L("À genoux, fesses vers les talons, bras devant.", "Kneeling, hips to heels, arms ahead."),
      L("Front posé, respire dans le dos.", "Forehead down, breathe into your back."),
      L("Genoux écartés si les hanches bloquent.", "Knees apart if your hips block."),
    ],
    cue: L("Relâché", "Relaxed"),
  }),
  ex({
    id: "legs-up-breathing", modality: "TIME", equipment: ["FLOOR", "WALL"], illustration: "legs-up-breathing",
    name: L("Jambes au mur, respiration", "Legs up the wall, breathing"),
    summary: L("Faire redescendre le système nerveux, finir la séance au calme.", "Bring the nervous system down and end the séance calm."),
    steps: [
      L("Sur le dos, jambes posées contre le mur.", "On your back, legs resting up the wall."),
      L("Inspire 4 s, retiens 4 s, expire 6 s.", "Breathe in for 4 s, hold 4 s, breathe out for 6 s."),
      L("Laisse les épaules et la mâchoire se relâcher.", "Let your shoulders and jaw relax."),
    ],
    cue: L("Lent, rien à faire", "Slow, nothing to do"),
  }),
];

export const AWAY_EXERCISE_BY_ID: ReadonlyMap<string, AwayExercise> = new Map(AWAY_EXERCISES.map((e) => [e.id, e]));
