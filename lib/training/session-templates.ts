import type { Localized } from "./catalogue";
import { METHODS_FOR_PLANS } from "./catalogue";

/**
 * Executable exercise templates for each Atlas method.
 *
 * Workload numbers are CONSERVATIVE STARTING POINTS drawn from common coaching
 * practice, not individual prescriptions or research-derived optima. Every
 * exercise can be modified or skipped in the player, and the instructions are
 * snapshotted into the session so later Atlas edits never rewrite history.
 */
export const TEMPLATE_VERSION = 1;

export type Block = "WARMUP" | "MAIN" | "COOLDOWN";
export type Modality = "REPS" | "HOLD" | "TIME" | "ROUTES" | "INTERVALS" | "FREE";

export type ExerciseTemplate = {
  key: string;
  block: Block;
  methodId: string | null;
  name: Localized;
  modality: Modality;
  targetSets: number | null;
  targetReps: number | null;
  targetSeconds: number | null;
  restSeconds: number | null;
  intensity: Localized;
  summary: Localized;
  steps: readonly Localized[];
  safety?: Localized;
  adaptation?: Localized;
};

export type ExerciseSnapshot = {
  version: number;
  key: string;
  summary: Localized;
  steps: Localized[];
  intensity: Localized;
  safety?: Localized;
  adaptation?: Localized;
};

const loc = (fr: string, en: string): Localized => ({ fr, en });
type Partial_ = Omit<ExerciseTemplate, "methodId" | "targetSets" | "targetReps" | "targetSeconds" | "restSeconds"> &
  Partial<Pick<ExerciseTemplate, "methodId" | "targetSets" | "targetReps" | "targetSeconds" | "restSeconds">>;
const ex = (e: Partial_): ExerciseTemplate => ({
  methodId: null, targetSets: null, targetReps: null, targetSeconds: null, restSeconds: null, ...e,
});

const PAIN_STOP = loc(
  "Arrête immédiatement en cas de douleur articulaire ou tendineuse (doigts, coudes, épaules).",
  "Stop immediately if you feel joint or tendon pain (fingers, elbows, shoulders).",
);

/* ── Shared warm-up and cool-down ─────────────────────────────────────────── */
const GENERAL_WARMUP = ex({
  key: "general-warmup", block: "WARMUP", name: loc("Échauffement général", "General warm-up"),
  modality: "TIME", targetSets: 1, targetSeconds: 600,
  intensity: loc("Facile, respiration aisée", "Easy, conversational breathing"),
  summary: loc("Élever la température et mobiliser épaules, poignets, hanches.", "Raise body temperature and mobilise shoulders, wrists and hips."),
  steps: [
    loc("3–4 min de cardio léger (corde, montées de genoux, vélo).", "3–4 min light cardio (skipping, high knees, bike)."),
    loc("Cercles d’épaules, rotations de poignets, ouverture de hanches.", "Shoulder circles, wrist rotations, hip openers."),
    loc("Quelques tractions scapulaires et pompes faciles.", "A few scapular pull-ups and easy push-ups."),
  ],
});
const EASY_CLIMBING_WARMUP = ex({
  key: "easy-climbing-warmup", block: "WARMUP", name: loc("Grimpe d’échauffement progressive", "Progressive climbing warm-up"),
  modality: "ROUTES", targetSets: 1, targetReps: 6, restSeconds: 60,
  intensity: loc("Très facile → modéré", "Very easy → moderate"),
  summary: loc("Six blocs ou voies faciles, de plus en plus soutenus.", "Six easy problems or routes, gradually harder."),
  steps: [
    loc("Commence 3–4 niveaux sous ton niveau de travail.", "Start 3–4 grades below your working level."),
    loc("Augmente progressivement ; garde des pieds précis.", "Increase gradually; keep precise footwork."),
  ],
});
const FINGER_WARMUP = ex({
  key: "finger-warmup", block: "WARMUP", name: loc("Échauffement des doigts", "Finger warm-up"),
  modality: "HOLD", targetSets: 6, targetSeconds: 10, restSeconds: 50,
  intensity: loc("Charge progressive : 50 % → 80 % de l’effort perçu", "Progressive: 50% → 80% perceived effort"),
  summary: loc("Suspensions progressives, pieds au sol si besoin.", "Progressive hangs, feet assisted if needed."),
  steps: [
    loc("Prise large d’abord, puis la prise de la séance.", "Large hold first, then the session’s edge."),
    loc("Augmente la charge à chaque répétition sans jamais forcer.", "Increase load each rep without ever straining."),
  ],
  safety: PAIN_STOP,
});
const COOLDOWN = ex({
  key: "cooldown", block: "COOLDOWN", name: loc("Retour au calme", "Cool-down"),
  modality: "TIME", targetSets: 1, targetSeconds: 480,
  intensity: loc("Très facile", "Very easy"),
  summary: loc("Grimpe très facile puis mobilité douce.", "Very easy climbing then gentle mobility."),
  steps: [
    loc("3–4 min de grimpe ou traversée très facile.", "3–4 min very easy climbing or traversing."),
    loc("Étirements doux des avant-bras, épaules et hanches.", "Gentle forearm, shoulder and hip mobility."),
  ],
});

/* ── Main blocks per Atlas method ─────────────────────────────────────────── */
const MAIN: Record<string, readonly ExerciseTemplate[]> = {
  "technique": [
    ex({ key: "silent-feet", block: "MAIN", methodId: "technique", name: loc("Pieds silencieux", "Silent feet"),
      modality: "ROUTES", targetSets: 3, targetReps: 4, restSeconds: 120,
      intensity: loc("Facile à modéré, qualité maximale", "Easy to moderate, maximum quality"),
      summary: loc("Poser chaque pied sans bruit et sans le repositionner.", "Place every foot silently, without readjusting."),
      steps: [loc("Choisis 4 blocs 2–3 niveaux sous ta limite.", "Pick 4 problems 2–3 grades below your limit."),
        loc("Regarde le pied jusqu’au contact ; compte les repositionnements.", "Watch each foot onto the hold; count readjustments."),
        loc("Note le nombre d’erreurs par série.", "Record the number of errors per set.")] }),
    ex({ key: "video-review", block: "MAIN", methodId: "video-tool", name: loc("Essai filmé et correction", "Filmed attempt and correction"),
      modality: "ROUTES", targetSets: 3, targetReps: 1, restSeconds: 180,
      intensity: loc("Modéré", "Moderate"),
      summary: loc("Filmer, repérer UNE correction, réessayer.", "Film, spot ONE correction, try again."),
      steps: [loc("Filme un essai sous un angle fixe.", "Film one attempt from a fixed angle."),
        loc("Choisis une seule correction (hanches, regard, pied).", "Choose one correction (hips, gaze, foot)."),
        loc("Réessaie et compare.", "Retry and compare.")] }),
  ],
  "constraints": [
    ex({ key: "constraint-rounds", block: "MAIN", methodId: "constraints", name: loc("Séries sous contrainte", "Constraint rounds"),
      modality: "ROUTES", targetSets: 4, targetReps: 3, restSeconds: 120,
      intensity: loc("Facile à modéré", "Easy to moderate"),
      summary: loc("Même bloc, contrainte différente à chaque série.", "Same problem, a different constraint each set."),
      steps: [loc("Série 1 : mains lentes. Série 2 : pas de reprise de prise.", "Set 1: slow hands. Set 2: no regrips."),
        loc("Série 3 : pieds imposés. Série 4 : sans contrainte.", "Set 3: set feet. Set 4: no constraint."),
        loc("Décris ce qui change.", "Describe what changes.")] }),
  ],
  "limit-bouldering": [
    ex({ key: "limit-attempts", block: "MAIN", methodId: "limit-bouldering", name: loc("Essais à la limite", "Limit attempts"),
      modality: "ROUTES", targetSets: 4, targetReps: 3, restSeconds: 180,
      intensity: loc("Proche de la limite, mouvements contrôlables", "Near limit, controllable moves"),
      summary: loc("Quelques essais de grande qualité avec repos complet.", "A few high-quality attempts with full rest."),
      steps: [loc("Choisis 1–2 blocs ou mouvements au voisinage de ta limite.", "Pick 1–2 problems or moves near your limit."),
        loc("3 essais par série, 3 min de repos minimum entre essais.", "3 attempts per set, at least 3 min rest between."),
        loc("Arrête dès que la coordination se dégrade.", "Stop as soon as coordination drops.")],
      safety: loc("Réception dégagée, parade si nécessaire.", "Clear landing, spotter when needed."),
      adaptation: loc("Débutant : remplace par des blocs « difficiles mais sûrs ».", "Beginner: use “hard but safe” problems instead.") }),
  ],
  "max-hangs": [
    ex({ key: "max-hang-sets", block: "MAIN", methodId: "max-hangs", name: loc("Suspensions lourdes", "Heavy hangs"),
      modality: "HOLD", targetSets: 5, targetSeconds: 10, restSeconds: 180,
      intensity: loc("Effort ≈ 8/10 : garde 2–3 s de marge", "≈ 8/10 effort: keep 2–3 s in reserve"),
      summary: loc("Suspensions courtes et lourdes, repos complet.", "Short, heavy hangs with full rest."),
      steps: [loc("Même réglette et même prise qu’au test de référence.", "Same edge and grip as your reference test."),
        loc("10 s de suspension, 3 min de repos.", "10 s hang, 3 min rest."),
        loc("Note la charge ajoutée ou retirée (kg).", "Record added or removed load (kg).")],
      safety: PAIN_STOP,
      adaptation: loc("Moins de 2 ans d’escalade : pieds au sol ou poulie d’assistance.", "Under 2 years climbing: feet on the floor or assisted pulley.") }),
  ],
  "repeaters": [
    ex({ key: "repeater-sets", block: "MAIN", methodId: "repeaters", name: loc("Repeaters 7:3", "7:3 repeaters"),
      modality: "INTERVALS", targetSets: 3, targetReps: 6, targetSeconds: 7, restSeconds: 180,
      intensity: loc("Sous-maximal : 6 répétitions propres", "Submaximal: 6 clean reps"),
      summary: loc("7 s de suspension / 3 s de repos × 6, puis 3 min.", "7 s hang / 3 s rest × 6, then 3 min."),
      steps: [loc("Réglette constante et prise identique.", "Consistent edge and grip."),
        loc("Compte les répétitions réussies par série.", "Count completed reps per set."),
        loc("Si tu perds la forme, réduis la charge.", "If form breaks, reduce the load.")],
      safety: PAIN_STOP }),
  ],
  "easy-volume": [
    ex({ key: "arc-blocks", block: "MAIN", methodId: "easy-volume", name: loc("Blocs de grimpe continue (ARC)", "Continuous climbing (ARC)"),
      modality: "TIME", targetSets: 3, targetSeconds: 600, restSeconds: 300,
      intensity: loc("Tu peux parler ; léger pompage seulement", "Able to talk; only a light pump"),
      summary: loc("Grimper sans s’arrêter sur du facile.", "Climb continuously on easy terrain."),
      steps: [loc("Traversée ou voies faciles enchaînées.", "Traverse or link easy routes."),
        loc("Reste relâché, respire régulièrement.", "Stay relaxed, breathe steadily."),
        loc("Note la durée réellement grimpée.", "Record the actual time climbed.")] }),
  ],
  "four-by-four": [
    ex({ key: "four-by-four-sets", block: "MAIN", methodId: "four-by-four", name: loc("4×4", "4×4"),
      modality: "ROUTES", targetSets: 4, targetReps: 4, restSeconds: 240,
      intensity: loc("Blocs modérés maîtrisés", "Moderate, familiar problems"),
      summary: loc("4 blocs enchaînés, 4 séries, 4 min de repos.", "4 problems back-to-back, 4 sets, 4 min rest."),
      steps: [loc("Choisis 4 blocs que tu réussis au premier essai.", "Choose 4 problems you send first go."),
        loc("Enchaîne-les sans repos, puis récupère 4 min.", "Climb them without rest, then recover 4 min."),
        loc("Note les blocs réussis par série.", "Record problems completed per set.")],
      safety: loc("Arrête si les réceptions deviennent dangereuses.", "Stop if landings become unsafe.") }),
  ],
  "campus": [
    ex({ key: "campus-ladders", block: "MAIN", methodId: "campus", name: loc("Échelles de campus", "Campus ladders"),
      modality: "REPS", targetSets: 4, targetReps: 3, restSeconds: 180,
      intensity: loc("Explosif, qualité avant tout", "Explosive, quality first"),
      summary: loc("Montées contrôlées sur grosses réglettes.", "Controlled ladders on large rungs."),
      steps: [loc("Grosses réglettes uniquement.", "Large rungs only."),
        loc("3 montées par série, repos complet.", "3 ladders per set, full rest."),
        loc("Arrête dès le moindre signe de douleur.", "Stop at the slightest sign of pain.")],
      safety: loc("Réservé aux grimpeurs confirmés et bien échauffés.", "For experienced, fully warmed-up climbers only."),
      adaptation: loc("Alternative : mouvements dynamiques sur pan, pieds posés.", "Alternative: feet-on dynamic moves on a board.") }),
  ],
  "strength-conditioning": [
    ex({ key: "pull-ups", block: "MAIN", methodId: "strength-conditioning", name: loc("Tractions", "Pull-ups"),
      modality: "REPS", targetSets: 3, targetReps: 6, restSeconds: 120,
      intensity: loc("2 répétitions en réserve", "2 reps in reserve"),
      summary: loc("Tractions strictes, amplitude complète.", "Strict pull-ups, full range."),
      steps: [loc("Bras tendus en bas, menton au-dessus de la barre.", "Straight arms at the bottom, chin over the bar."),
        loc("Élastique si besoin.", "Use a band if needed.")] }),
    ex({ key: "push-ups", block: "MAIN", methodId: "strength-conditioning", name: loc("Pompes", "Push-ups"),
      modality: "REPS", targetSets: 3, targetReps: 10, restSeconds: 90,
      intensity: loc("2 répétitions en réserve", "2 reps in reserve"),
      summary: loc("Équilibre agoniste/antagoniste des épaules.", "Balance shoulder pushing and pulling."),
      steps: [loc("Corps gainé, coudes à 45°.", "Braced body, elbows at 45°.")] }),
    ex({ key: "hollow-hold", block: "MAIN", methodId: "strength-conditioning", name: loc("Gainage creux", "Hollow hold"),
      modality: "HOLD", targetSets: 3, targetSeconds: 30, restSeconds: 60,
      intensity: loc("Contrôlé", "Controlled"),
      summary: loc("Tension du tronc utile en dévers.", "Trunk tension that transfers to overhangs."),
      steps: [loc("Bas du dos plaqué au sol.", "Lower back pressed to the floor.")] }),
  ],
  "mental": [
    ex({ key: "reading-routine", block: "MAIN", methodId: "mental", name: loc("Routine lecture–respiration–décision", "Read–breathe–decide routine"),
      modality: "ROUTES", targetSets: 4, targetReps: 1, restSeconds: 180,
      intensity: loc("Voies ou blocs modérés", "Moderate routes or problems"),
      summary: loc("Lire, respirer, s’engager, sur chaque essai.", "Read, breathe, commit on every attempt."),
      steps: [loc("Lis la voie au sol : repos, sections, clippages.", "Read from the ground: rests, cruxes, clips."),
        loc("Trois respirations lentes avant de partir.", "Three slow breaths before starting."),
        loc("Note ta confiance (1–10) après chaque essai.", "Rate your confidence (1–10) after each attempt.")],
      safety: loc("Aucune chute non maîtrisée ; assureur compétent.", "No uncontrolled falls; competent belayer.") }),
  ],
  "periodized": [
    ex({ key: "plan-review", block: "MAIN", methodId: "periodized", name: loc("Bloc de séance planifié", "Planned session block"),
      modality: "FREE", targetSets: 1, targetSeconds: 2400,
      intensity: loc("Selon le plan de la semaine", "As set by your weekly plan"),
      summary: loc("Réalise le contenu prévu et note ce qui a été fait.", "Do the planned content and record what was done."),
      steps: [loc("Suis le contenu prévu par ton programme.", "Follow your plan’s content."),
        loc("Note la durée et l’effort perçu.", "Record duration and perceived effort.")] }),
  ],
};

const FINGER_METHODS = new Set(["max-hangs", "repeaters", "campus"]);

export function templateFor(methodId: string | null, minutes: number | null): ExerciseTemplate[] {
  const main = methodId ? MAIN[methodId] : undefined;
  const body = main ?? [ex({
    key: "free-training", block: "MAIN", methodId, name: loc("Entraînement libre", "Free training"),
    modality: "FREE", targetSets: 1, targetSeconds: Math.max(10, (minutes ?? 45) - 15) * 60,
    intensity: loc("À ton choix", "Your choice"),
    summary: loc("Note ce que tu as réellement fait.", "Record what you actually did."),
    steps: [loc("Décris les exercices réalisés dans les notes.", "Describe the work done in the notes.")],
  })];
  const short = (minutes ?? 60) <= 30;
  const warm = short ? [{ ...GENERAL_WARMUP, targetSeconds: 300 }] : [GENERAL_WARMUP];
  if (methodId && FINGER_METHODS.has(methodId)) warm.push(FINGER_WARMUP);
  else if (!short && methodId !== "strength-conditioning") warm.push(EASY_CLIMBING_WARMUP);
  return [...warm, ...body, ...(short ? [] : [COOLDOWN])];
}

export function snapshotOf(t: ExerciseTemplate): ExerciseSnapshot {
  return {
    version: TEMPLATE_VERSION, key: t.key, summary: t.summary, steps: [...t.steps],
    intensity: t.intensity, ...(t.safety ? { safety: t.safety } : {}), ...(t.adaptation ? { adaptation: t.adaptation } : {}),
  };
}

export const EXECUTABLE_METHOD_IDS = METHODS_FOR_PLANS.map((m) => m.id);
