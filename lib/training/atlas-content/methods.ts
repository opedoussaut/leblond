import type { AtlasDetail } from "@/lib/training/atlas-types";
import type { Localized } from "@/lib/training/catalogue";
import { EXERCISE_BY_ID, LEVEL_SESSIONS } from "@/lib/training/hip-mobility/content";
import { SRC } from "./sources";

/**
 * Atlas content for the 11 training METHODS. Written in LEBLOND's own words
 * from the cited sources. Diagram numbers mirror the executable session
 * templates (lib/training/session-templates.ts); a unit test keeps them equal.
 */
const loc = (fr: string, en: string): Localized => ({ fr, en });

const PAIN_STOP = loc(
  "Stop immédiat à la moindre douleur localisée (poulie, articulation du doigt, coude, épaule) : une douleur n'est jamais un signal à « passer en force ».",
  "Stop at once at any localised pain (pulley, finger joint, elbow, shoulder): pain is never a cue to push through.",
);
const GROWTH = loc(
  "Âge : pas de suspensions lestées ni de campus avant la fin de la croissance. Chez l'adolescent, les cartilages de croissance des doigts sont vulnérables aux fractures de fatigue.",
  "Age: no weighted hangs or campusing before growth has finished. In adolescents the finger growth plates are vulnerable to stress fractures.",
);

export const METHOD_DETAILS: Record<string, AtlasDetail> = {
  "technique": {
    summary: loc(
      "Exercices délibérés de placement sur des passages faciles : pieds précis et silencieux, hanches proches du mur, regard qui anticipe, rythme régulier. Un retour concret (vidéo ou partenaire) remplace l'impression. Le but n'est pas de grimper plus dur pendant la séance, mais de rendre automatique un geste plus économe.",
      "Deliberate positioning drills on easy terrain: precise, quiet feet, hips close to the wall, eyes ahead of the hands, steady rhythm. Concrete feedback (video or a partner) replaces impressions. The aim is not to climb harder during the session but to make economical movement automatic.",
    ),
    trains: loc(
      "Une qualité, pas un système énergétique : coordination, économie gestuelle et perception des prises. La fatigue gêne l'apprentissage, donc on travaille frais et sous sa limite.",
      "A skill rather than an energy system: coordination, movement economy and perception of holds. Fatigue blocks learning, so the work is done fresh and below your limit.",
    ),
    suits: loc(
      "Tous les niveaux, et surtout les grimpeurs de 2 à 5 ans de pratique dont la force progresse plus vite que la technique : ceux qui « forcent » les mouvements, ratent les pieds ou chutent en sortie de mouvement.",
      "Every level, especially climbers 2–5 years in whose strength has outpaced their technique: those who muscle through moves, miss feet or fall at the end of a move.",
    ),
    level: loc("Tous niveaux", "All levels"),
    prerequisites: [
      loc("Niveau : aucun minimum ; choisir des passages 2 à 3 niveaux sous sa limite.", "Level: no minimum; choose climbs 2–3 grades below your limit."),
      loc("Âge : adapté aux enfants et adolescents, c'est même la priorité avant tout travail de force spécifique.", "Age: suitable for children and teenagers; it is the priority before any specific strength work."),
      loc("Blessures : possible pendant une blessure si les passages n'ont aucune prise ni position qui réveille la douleur ; demander l'avis d'un professionnel de santé.", "Injuries: possible during an injury if no hold or position provokes pain; ask a health professional."),
    ],
    protocol: [
      { key: "intensity", value: loc("Facile à modéré : 2–3 niveaux sous ta limite, aucune fatigue marquée.", "Easy to moderate: 2–3 grades below your limit, no marked fatigue.") },
      { key: "effort", value: loc("Un bloc ou une courte voie par essai (≈ 30 s à 2 min).", "One problem or short route per attempt (≈ 30 s to 2 min).") },
      { key: "rest", value: loc("1 min entre essais, 2 min entre séries.", "1 min between attempts, 2 min between sets.") },
      { key: "reps", value: loc("4 blocs par série.", "4 problems per set.") },
      { key: "sets", value: loc("3 séries, un seul thème par série (ex. pieds silencieux).", "3 sets, one theme per set (e.g. silent feet).") },
      { key: "session", value: loc("20–30 min, juste après l'échauffement, quand tu es frais.", "20–30 min, right after the warm-up, while fresh.") },
      { key: "frequency", value: loc("À chaque séance de grimpe, ou 2–3 fois par semaine.", "Every climbing session, or 2–3 times a week.") },
    ],
    preparation: loc("Un mur peu difficile, des prises variées, un partenaire ou un téléphone fixe pour filmer.", "An easy wall, varied holds, a partner or a fixed phone to film."),
    steps: [
      loc("Choisis un thème unique pour la série : pieds silencieux, hanches proches, regard sur le prochain pied.", "Pick a single theme for the set: silent feet, hips close, eyes on the next foot."),
      loc("Grimpe 4 blocs faciles en appliquant ce thème ; compte les erreurs (bruit de pied, repositionnement).", "Climb 4 easy problems applying that theme; count errors (noisy foot, readjustment)."),
      loc("Revois une vidéo ou écoute ton partenaire, garde UNE correction, puis rejoue le bloc.", "Review a video or listen to your partner, keep ONE correction, then climb it again."),
    ],
    progression: [
      loc("Changer de thème seulement quand le premier devient automatique (ex. aucun repositionnement de pied sur 4 blocs).", "Change theme only once the first is automatic (e.g. no foot readjustment over 4 problems)."),
      loc("Monter d'un niveau en gardant le même critère de qualité.", "Go up one grade while keeping the same quality criterion."),
      loc("Combiner deux consignes, puis les retirer pour vérifier que le geste reste.", "Combine two cues, then remove them to check the movement stays."),
    ],
    mistakes: [
      loc("Choisir des passages trop durs : la survie remplace l'apprentissage.", "Choosing climbs that are too hard: survival replaces learning."),
      loc("Changer de consigne à chaque essai au lieu d'en garder une par série.", "Changing cue every attempt instead of one per set."),
      loc("Juger la séance à la réussite plutôt qu'au critère de qualité.", "Judging the session by sends rather than by the quality criterion."),
      loc("Placer les exercices en fin de séance, fatigué.", "Doing the drills at the end of the session, tired."),
    ],
    safety: [
      loc("Échauffement général puis grimpe progressive avant les exercices.", "General warm-up, then progressive climbing before the drills."),
      loc("En bloc, réceptions dégagées ; désescalader plutôt que sauter quand c'est possible.", "When bouldering, keep landings clear; downclimb rather than jump when you can."),
    ],
    variants: [
      loc("Pieds silencieux : aucun bruit au contact du chausson.", "Silent feet: no sound when the shoe touches the hold."),
      loc("Mains en suspens : marquer 1–2 s au-dessus de chaque prise avant de la saisir, pour tester l'équilibre.", "Hover hands: pause 1–2 s above each hold before grabbing it, to test balance."),
      loc("Copier la méthode d'un grimpeur plus expérimenté sur le même bloc.", "Copy a more experienced climber's beta on the same problem."),
    ],
    observe: loc("Nombre de repositionnements de pied, bruits de pied, pauses et sensation de contrôle, série après série.", "Foot readjustments, noisy feet, pauses and sense of control, set after set."),
    evidenceNote: loc(
      "Faible à modéré. Une revue de 42 études montre que les experts marquent moins de pauses et explorent moins, et une étude à cas unique a amélioré la précision gestuelle de débutants grâce à un modèle vidéo et un retour. Peu d'essais contrôlés mesurent l'effet sur le niveau de grimpe.",
      "Low to moderate. A review of 42 studies shows experts pause and explore less, and a single-case study improved novices' movement accuracy with video modelling and feedback. Few controlled trials measure the effect on climbing grade.",
    ),
    sources: [SRC.orth2016, SRC.walker2020, SRC.seifert2017, SRC.latticeVideo],
    diagram: {
      kind: "loop",
      steps: [
        loc("Un seul thème (ex. pieds silencieux)", "One theme (e.g. silent feet)"),
        loc("Grimper 2–3 niveaux sous la limite", "Climb 2–3 grades below your limit"),
        loc("Retour : vidéo ou partenaire", "Feedback: video or partner"),
        loc("Rejouer avec une correction", "Repeat with one correction"),
      ],
      center: [loc("3 séries × 4", "3 sets × 4"), loc("blocs", "problems"), loc("2 min de repos", "2 min rest")],
    },
  },

  "constraints": {
    summary: loc(
      "Au lieu d'expliquer le bon mouvement, on modifie une contrainte (de la tâche, du mur ou du grimpeur) pour que le grimpeur découvre lui-même d'autres solutions. Cette approche vient de la « dynamique écologique » (Davids, Seifert, Orth) : l'habileté naît de l'exploration, pas de la répétition d'un modèle unique.",
      "Instead of explaining the right movement, you change a constraint (of the task, the wall or the climber) so the climber discovers other solutions. The approach comes from ecological dynamics (Davids, Seifert, Orth): skill grows from exploration, not from repeating a single model.",
    ),
    trains: loc(
      "Une qualité : adaptabilité, répertoire gestuel, lecture et coordination. Aucune cible énergétique.",
      "A skill: adaptability, movement repertoire, route reading and coordination. No energy-system target.",
    ),
    suits: loc(
      "Tous niveaux ; idéal pour ceux qui n'ont qu'une façon de grimper (tout en force, toujours de face) et pour les enfants, sous forme de jeux.",
      "All levels; ideal for climbers with only one way of moving (all strength, always square-on) and for children, as games.",
    ),
    level: loc("Tous niveaux", "All levels"),
    prerequisites: [
      loc("Niveau : aucun minimum ; la contrainte s'adapte au grimpeur.", "Level: no minimum; the constraint is scaled to the climber."),
      loc("Âge : très adapté aux jeunes.", "Age: very well suited to young climbers."),
      loc("Blessures : éviter les contraintes qui chargent la zone blessée (ex. « sans pieds » avec une épaule douloureuse).", "Injuries: avoid constraints that load the injured area (e.g. “no feet” with a sore shoulder)."),
    ],
    protocol: [
      { key: "intensity", value: loc("Facile à modéré : la contrainte doit gêner sans empêcher de réussir.", "Easy to moderate: the constraint should hinder without preventing success.") },
      { key: "effort", value: loc("Un bloc ou un passage court par essai.", "One problem or short section per attempt.") },
      { key: "rest", value: loc("≈ 1 min entre essais, 2 min entre séries.", "≈ 1 min between attempts, 2 min between sets.") },
      { key: "reps", value: loc("3 essais par contrainte.", "3 attempts per constraint.") },
      { key: "sets", value: loc("4 séries : 3 contraintes différentes puis 1 série libre pour tester le transfert.", "4 sets: 3 different constraints, then 1 free set to test transfer.") },
      { key: "session", value: loc("20–30 min.", "20–30 min.") },
      { key: "frequency", value: loc("1 à 3 fois par semaine, en début de séance.", "1–3 times a week, early in the session.") },
    ],
    preparation: loc("Blocs faciles, assez de place pour répéter sans fatigue maximale.", "Easy problems with enough room to repeat without maximal fatigue."),
    steps: [
      loc("Choisis un bloc facile et garde-le pour toute la séance.", "Choose one easy problem and keep it for the whole session."),
      loc("Grimpe-le 3 fois sous chaque contrainte, en décrivant ce qui change dans ta façon de bouger.", "Climb it 3 times under each constraint, describing what changes in how you move."),
      loc("Termine sans contrainte : le nouveau geste apparaît-il spontanément ?", "Finish without constraint: does the new movement appear on its own?"),
    ],
    progression: [
      loc("Rendre la contrainte plus exigeante (mains lentes → arrêt de 2 s sur chaque prise).", "Make the constraint stricter (slow hands → a 2 s stop on every hold)."),
      loc("Passer de contraintes de tâche (pieds imposés) à des contraintes de terrain (dalle, dévers, volumes).", "Move from task constraints (set feet) to terrain constraints (slab, overhang, volumes)."),
      loc("Laisser le grimpeur inventer ses contraintes et comparer les solutions trouvées.", "Let the climber invent constraints and compare the solutions found."),
    ],
    mistakes: [
      loc("Donner la solution en plus de la contrainte : l'exploration disparaît.", "Giving the solution as well as the constraint: exploration disappears."),
      loc("Contrainte trop dure : échecs répétés, rien à apprendre.", "Constraint too hard: repeated failure, nothing to learn."),
      loc("Oublier la série libre finale qui vérifie le transfert.", "Skipping the final free set that checks transfer."),
    ],
    safety: [
      loc("Les contraintes « sans pieds » ou « dynamique obligatoire » chargent davantage doigts et épaules : réservées aux grimpeurs échauffés et expérimentés.", "“No feet” or “must dyno” constraints load fingers and shoulders more: keep them for warmed-up, experienced climbers."),
      loc("Réceptions dégagées.", "Clear landings."),
    ],
    variants: [
      loc("Mains lentes : 3 s par mouvement de main.", "Slow hands: 3 s per hand move."),
      loc("Sans réajuster : chaque prise de main n'est saisie qu'une fois.", "No regrips: each handhold is grabbed only once."),
      loc("Pieds imposés : seulement certains appuis autorisés.", "Set feet: only some footholds allowed."),
      loc("Trois façons différentes de grimper le même bloc.", "Three different ways to climb the same problem."),
    ],
    observe: loc("Nombre de solutions différentes trouvées, fluidité (pauses), et ce qui reste lors de la série libre.", "Number of different solutions found, fluency (pauses) and what remains in the free set."),
    evidenceNote: loc(
      "Faible. Cadre théorique solide et nombreuses études descriptives (fluidité, exploration, lecture de voie), mais peu d'essais contrôlés sur la performance ; la revue d'Orth et al. (2016) souligne le manque de consignes validées.",
      "Low. A strong theoretical framework and many descriptive studies (fluency, exploration, route preview), but few controlled trials on performance; Orth et al. (2016) stress the lack of validated guidelines.",
    ),
    sources: [SRC.orth2016, SRC.seifert2017],
    diagram: {
      kind: "rounds",
      rounds: [
        { label: loc("Mains lentes", "Slow hands"), mark: "slowHands" },
        { label: loc("Sans réajuster", "No regrips"), mark: "noRegrip" },
        { label: loc("Pieds imposés", "Set feet"), mark: "setFeet" },
        { label: loc("Libre (transfert)", "Free (transfer)"), mark: "free" },
      ],
      attempts: 3,
      rest: 120,
    },
  },

  "limit-bouldering": {
    summary: loc(
      "Travailler des sections de 3 à 5 mouvements à la limite de son niveau (ou un peu au-delà), avec des essais à effort maximal et un repos complet entre chaque. On produit de la force et de la puissance dans de vraies positions de grimpe, ce qui en fait la méthode de force la plus spécifique.",
      "Work sections of 3–5 moves at (or slightly beyond) your limit, with maximal-effort attempts and full rest between each. You produce strength and power in real climbing positions, which makes it the most specific strength method.",
    ),
    trains: loc(
      "Force maximale et puissance spécifiques : recrutement nerveux, force de contact, tension du corps. Système énergétique : anaérobie alactique (efforts de quelques secondes, récupération longue). Développe aussi la capacité à « essayer fort ».",
      "Specific maximal strength and power: neural recruitment, contact strength, body tension. Energy system: alactic anaerobic (efforts of a few seconds, long recovery). Also builds the ability to try hard.",
    ),
    suits: loc(
      "Bloqueurs et grimpeurs de voie intermédiaires à confirmés que les passages durs (cruxes) arrêtent, avec au moins 1 à 2 ans de grimpe régulière.",
      "Intermediate to advanced boulderers and route climbers stopped by hard cruxes, with at least 1–2 years of regular climbing.",
    ),
    level: loc("Intermédiaire et confirmé", "Intermediate to advanced"),
    prerequisites: [
      loc("Niveau : 1–2 ans de grimpe régulière ; savoir chuter et se réceptionner.", "Level: 1–2 years of regular climbing; able to fall and land well."),
      loc("Âge : chez les jeunes en croissance, préférer des blocs « durs mais sûrs » et éviter les petites réglettes tenues en arqué.", "Age: for growing climbers, prefer “hard but safe” problems and avoid small edges held in a full crimp."),
      loc("Blessures : antécédent de poulie ou d'épaule = éviter les prises et mouvements qui la provoquent ; avis médical en cas de douleur.", "Injuries: a past pulley or shoulder injury means avoiding the holds and moves that provoke it; see a clinician if painful."),
    ],
    protocol: [
      { key: "intensity", value: loc("Maximale : mouvements à ta limite, réalisables séparément.", "Maximal: moves at your limit that you can do individually.") },
      { key: "effort", value: loc("≈ 10–20 s par essai (3 à 5 mouvements).", "≈ 10–20 s per attempt (3–5 moves).") },
      { key: "rest", value: loc("3 min minimum entre essais (jusqu'à 5 min si l'essai était très dur).", "At least 3 min between attempts (up to 5 min after a very hard one).") },
      { key: "reps", value: loc("3 essais par section.", "3 attempts per section.") },
      { key: "sets", value: loc("4 sections ou blocs.", "4 sections or problems.") },
      { key: "session", value: loc("≈ 40–60 min après l'échauffement ; arrêter dès que la qualité baisse.", "≈ 40–60 min after the warm-up; stop as soon as quality drops.") },
      { key: "frequency", value: loc("1 à 2 fois par semaine, jamais deux jours de suite.", "1–2 times a week, never on consecutive days.") },
    ],
    preparation: loc("Échauffement progressif jusqu'à des mouvements durs ; choisir des mouvements difficiles mais contrôlables, avec une réception adaptée.", "Progressive warm-up up to hard moves; choose difficult but controllable moves with a suitable landing."),
    steps: [
      loc("Choisis 1–2 blocs 1 à 2 niveaux au-dessus de ton niveau habituel et découpe-les en sections de 3–5 mouvements.", "Pick 1–2 problems 1–2 grades above your usual level and split them into 3–5-move sections."),
      loc("Fais 3 essais à fond par section, avec au moins 3 min de repos entre chaque.", "Give each section 3 all-out attempts, with at least 3 min rest between them."),
      loc("Arrête dès que la coordination ou la vitesse se dégrade.", "Stop as soon as coordination or speed drops."),
    ],
    progression: [
      loc("Relier les sections (3 → 5 → 8 mouvements) puis le bloc entier.", "Link sections (3 → 5 → 8 moves), then the whole problem."),
      loc("Choisir des mouvements qui ciblent tes faiblesses (types de prises, styles, angles).", "Choose moves that target your weaknesses (hold types, styles, angles)."),
      loc("Passer à un bloc plus dur quand une section passe régulièrement.", "Move to a harder problem once a section goes regularly."),
    ],
    mistakes: [
      loc("Raccourcir le repos : la séance devient de la résistance, plus de la force.", "Cutting rest short: the session turns into power endurance, not strength."),
      loc("Enchaîner les essais du bloc complet au lieu de travailler les sections.", "Repeating full-problem attempts instead of working sections."),
      loc("Continuer quand la coordination baisse : risque de blessure et mauvais apprentissage.", "Carrying on once coordination drops: injury risk and poor learning."),
      loc("Ne travailler que son style favori.", "Only working your favourite style."),
    ],
    safety: [
      loc("Échauffement complet et montée progressive vers les mouvements limites.", "Full warm-up and a gradual build-up to limit moves."),
      loc("Parade et tapis bien placés ; éviter les chutes sur le dos.", "Spotting and well-placed pads; avoid falling onto your back."),
      PAIN_STOP,
    ],
    variants: [
      loc("Sur pan d'entraînement (MoonBoard, Kilter…) pour des mouvements reproductibles.", "On a training board (MoonBoard, Kilter…) for repeatable moves."),
      loc("Mouvement unique : répéter seulement le mouvement clé.", "Single move: repeat only the crux move."),
      loc("Crux de voie travaillé en moulinette.", "A route crux worked on top rope."),
    ],
    observe: loc("Mouvements réussis, essais de qualité, nombre de sections reliées et sensation de vitesse.", "Moves completed, quality attempts, sections linked and sense of speed."),
    evidenceNote: loc(
      "Pratique. Méthode centrale chez la plupart des coachs, mais aucun essai contrôlé ne l'isole. Une méta-analyse indique que le bloc en intervalles peut améliorer la performance, en rappelant que les études sur grimpeurs sont rares.",
      "Practice-based. A core method for most coaches, but no controlled trial isolates it. A meta-analysis indicates interval-style bouldering may improve performance, while noting how few climbing studies exist.",
    ),
    sources: [SRC.horstLimit, SRC.stien2023],
    diagram: {
      kind: "intervals", work: 15, pause: 180, reps: 3, sets: 4, setRest: 180, approximate: true, zoom: false,
      workLabel: loc("essai à fond (3–5 mouvements)", "all-out attempt (3–5 moves)"),
      setLabel: loc("Section", "Section"),
    },
  },

  "max-hangs": {
    summary: loc(
      "Suspensions courtes (10 s) avec une charge élevée sur une réglette de taille fixe, en s'arrêtant environ 3 s avant l'échec, avec un repos complet de 3 min. Protocole popularisé par Eva López (« MaxHangs ») et étudié dans plusieurs essais randomisés.",
      "Short hangs (10 s) with a heavy load on a fixed-size edge, stopping about 3 s short of failure, with a full 3-min rest. Popularised by Eva López (“MaxHangs”) and studied in several randomised trials.",
    ),
    trains: loc(
      "Force maximale isométrique des fléchisseurs des doigts. Les premiers gains sont surtout nerveux (recrutement, vitesse de production de force), puis musculaires sur des cycles plus longs. Système énergétique : anaérobie alactique.",
      "Maximal isometric strength of the finger flexors. Early gains are mostly neural (recruitment, rate of force development), then muscular over longer cycles. Energy system: alactic anaerobic.",
    ),
    suits: loc(
      "Grimpeurs avec au moins 2 ans de grimpe régulière dont les doigts limitent la performance sur petites prises, en bloc comme en voie. Les études montrent des gains plus nets chez ceux dont la force de départ est modeste.",
      "Climbers with at least 2 years of regular climbing whose fingers limit them on small holds, bouldering or routes. Studies show clearer gains in those with modest starting strength.",
    ),
    level: loc("Intermédiaire/confirmé ; adaptation pour débutants accompagnés", "Intermediate/advanced; scale down for new climbers"),
    prerequisites: [
      loc("Niveau : ≥ 2 ans de grimpe régulière (les études portent sur des grimpeurs de 7a et plus) ; débuter pieds au sol ou avec une poulie d'assistance.", "Level: ≥ 2 years of regular climbing (studies involve 7a+ climbers); start with feet on the floor or a pulley assist."),
      GROWTH,
      loc("Blessures : aucune douleur de doigt, coude ou épaule ; après une blessure de poulie, reprise progressive encadrée par un professionnel de santé.", "Injuries: no finger, elbow or shoulder pain; after a pulley injury, return gradually with a health professional."),
    ],
    protocol: [
      { key: "intensity", value: loc("Charge que tu pourrais tenir ≈ 13 s ; tu t'arrêtes à 10 s (marge de 3 s). Ajuste la charge à chaque séance.", "A load you could hold ≈ 13 s; stop at 10 s (3 s in reserve). Adjust the load each session.") },
      { key: "effort", value: loc("10 s par suspension.", "10 s per hang.") },
      { key: "rest", value: loc("3 min entre suspensions (2 à 5 min selon les protocoles).", "3 min between hangs (2–5 min depending on the protocol).") },
      { key: "reps", value: loc("1 suspension par série.", "1 hang per set.") },
      { key: "sets", value: loc("3 à 5 séries (3 en début de cycle, jusqu'à 5).", "3–5 sets (3 at the start of a cycle, up to 5).") },
      { key: "session", value: loc("≈ 13 min de suspensions + 10–15 min d'échauffement progressif des doigts.", "≈ 13 min of hangs + 10–15 min of progressive finger warm-up.") },
      { key: "frequency", value: loc("2 fois par semaine, en début de séance, sur des cycles de 4 à 8 semaines.", "Twice a week, at the start of a session, in 4–8-week cycles.") },
    ],
    preparation: loc("Poutre stable, réglette constante (souvent 18–20 mm), baudrier et lest ou poulie d'assistance, chronomètre, échauffement des doigts.", "Stable board, a consistent edge (often 18–20 mm), harness and weights or an assist pulley, timer, finger warm-up."),
    steps: [
      loc("Teste ta charge sur la même réglette et la même prise (semi-arqué ou tendu) qu'à l'entraînement.", "Find your load on the same edge and grip (half crimp or open hand) you will train on."),
      loc("Fais 3 à 5 suspensions de 10 s, 3 min de repos entre chacune, en gardant ≈ 3 s de marge.", "Do 3–5 hangs of 10 s, 3 min rest between each, keeping ≈ 3 s in reserve."),
      loc("Note la charge ajoutée ou retirée, la prise et la sensation pour comparer d'une séance à l'autre.", "Log added or removed load, grip and feel so sessions can be compared."),
    ],
    progression: [
      loc("Ajouter 1 à 2 kg quand les 10 s passent avec nettement plus de 3 s de marge.", "Add 1–2 kg when the 10 s feel clearly easier than a 3-s reserve."),
      loc("Approche López : 4 semaines lestées sur ≈ 18 mm, puis réduire la taille de la réglette sans lest.", "López approach: 4 weighted weeks on ≈ 18 mm, then reduce the edge size without added weight."),
      loc("Re-tester toutes les 4 à 8 semaines dans les mêmes conditions.", "Retest every 4–8 weeks under the same conditions."),
    ],
    mistakes: [
      loc("Aller jusqu'à l'échec : le protocole vise une marge, pas l'épuisement.", "Going to failure: the protocol aims for a reserve, not exhaustion."),
      loc("Changer de réglette ou de prise entre deux tests : les résultats deviennent incomparables.", "Changing edge or grip between tests: results become incomparable."),
      loc("Utiliser l'arqué avec le pouce verrouillé.", "Using a full crimp with the thumb locked."),
      loc("Faire les suspensions après une séance de bloc intense.", "Hanging after a hard bouldering session."),
    ],
    safety: [
      loc("Échauffement progressif (≈ 50 % → 90 % de l'effort) avant la première série.", "Progressive warm-up (≈ 50% → 90% effort) before the first set."),
      loc("Épaules engagées, coudes légèrement fléchis ; monter et descendre sans à-coup.", "Shoulders engaged, elbows slightly bent; load and unload smoothly."),
      PAIN_STOP,
    ],
    variants: [
      loc("Réglette minimale sans lest : même durée, la plus petite réglette tenable.", "Minimum edge, no added weight: same duration, smallest edge you can hold."),
      loc("7-53 (Hörst) : 7 s lourdes, 53 s de repos, 3 suspensions par série.", "7-53 (Hörst): 7 heavy seconds, 53 s rest, 3 hangs per set."),
      loc("Une main avec poulie et contrepoids, pour les grimpeurs très forts.", "One arm with a pulley and counterweight, for very strong climbers."),
    ],
    observe: loc("Charge (kg ajoutés ou retirés), durée, réglette, prise et confort des tissus.", "Load (kg added or removed), duration, edge, grip and tissue comfort."),
    evidenceNote: loc(
      "Modéré. Plusieurs essais randomisés de 4 à 10 semaines (petits effectifs, grimpeurs confirmés) montrent des gains de force des doigts de +8 % à +28 % selon les études, par rapport à la grimpe seule. Les gains sont plus faibles chez les grimpeurs déjà très forts.",
      "Moderate. Several 4–10-week randomised trials (small samples, experienced climbers) show finger-strength gains of +8% to +28% depending on the study, compared with climbing alone. Gains are smaller in already very strong climbers.",
    ),
    sources: [SRC.lopez2019, SRC.lopezBlog2018, SRC.devise2022, SRC.levernier2019, SRC.hermans2022, SRC.latticeMaxHangs, SRC.horstProtocols, SRC.jones2022],
    diagram: {
      kind: "intervals", work: 10, pause: 0, reps: 1, sets: 5, setRest: 180, reserve: 3, zoom: true,
      workLabel: loc("suspension lourde", "heavy hang"),
      setLabel: loc("Série", "Set"),
    },
  },

  "repeaters": {
    summary: loc(
      "Suspensions intermittentes : 7 s de suspension, 3 s de repos, 6 fois de suite (≈ 1 min), puis 3 min de repos avant la série suivante. Le rythme imite l'alternance serrer-relâcher de la grimpe. Protocole classique décrit par Eric Hörst et les frères Anderson.",
      "Intermittent hangs: 7 s on, 3 s off, six times in a row (≈ 1 min), then 3 min rest before the next set. The rhythm mimics the grip-and-release of climbing. A classic protocol described by Eric Hörst and the Anderson brothers.",
    ),
    trains: loc(
      "Endurance de force des doigts : répéter des efforts à environ 60–80 % de la force maximale. Sollicite la capacité anaérobie et la puissance aérobie locales de l'avant-bras, avec un effet sur la force quand la charge est proche de 80 %.",
      "Finger strength endurance: repeating efforts at roughly 60–80% of maximal force. Taxes local anaerobic capacity and aerobic power in the forearm, with some strength effect when the load is near 80%.",
    ),
    suits: loc(
      "Grimpeurs de voie et de blocs longs, intermédiaires à confirmés, qui tombent « pompés » plus que par manque de force pure.",
      "Intermediate to advanced route climbers and long-problem boulderers who fall pumped more than from lack of pure strength.",
    ),
    level: loc("Intermédiaire et confirmé, charge adaptée", "Intermediate to advanced, with matched loading"),
    prerequisites: [
      loc("Niveau : ≥ 1–2 ans de grimpe régulière ; commencer sans lest, pieds assistés si besoin.", "Level: ≥ 1–2 years of regular climbing; start without added weight, feet assisted if needed."),
      GROWTH,
      loc("Blessures : aucune douleur aux doigts, coudes ou épaules.", "Injuries: no pain in fingers, elbows or shoulders."),
    ],
    protocol: [
      { key: "intensity", value: loc("Sous-maximale : la dernière répétition de la dernière série doit passer de justesse (≈ 60–80 % de ta force max).", "Submaximal: the last rep of the last set should only just go (≈ 60–80% of max force).") },
      { key: "effort", value: loc("7 s de suspension, 3 s de repos.", "7 s hang, 3 s rest.") },
      { key: "rest", value: loc("3 min entre séries.", "3 min between sets.") },
      { key: "reps", value: loc("6 suspensions par série (≈ 1 min).", "6 hangs per set (≈ 1 min).") },
      { key: "sets", value: loc("3 séries (1 à 3 par type de prise ; 6 à 10 au total chez les confirmés).", "3 sets (1–3 per grip type; 6–10 in total for advanced climbers).") },
      { key: "session", value: loc("≈ 10 à 25 min + échauffement des doigts.", "≈ 10–25 min + finger warm-up.") },
      { key: "frequency", value: loc("2 fois par semaine, blocs de 4 à 8 semaines.", "Twice a week, in 4–8-week blocks.") },
    ],
    preparation: loc("Poutre avec assistance possible (poulie, pieds), chronomètre à intervalles, réglette constante.", "Fingerboard with possible assistance (pulley, feet), interval timer, a consistent edge."),
    steps: [
      loc("Échauffe les doigts et choisis une réglette et une prise constantes.", "Warm up your fingers and pick a consistent edge and grip."),
      loc("Enchaîne 6 × (7 s suspendu / 3 s de repos), puis 3 min de repos ; répète 3 séries.", "Do 6 × (7 s on / 3 s off), then rest 3 min; repeat for 3 sets."),
      loc("Note les répétitions réussies par série et réduis la charge si la forme se dégrade.", "Log completed reps per set and reduce the load if form breaks."),
    ],
    progression: [
      loc("Ajouter une répétition par série (6 → 7 → 8) avant d'augmenter la charge.", "Add a rep per set (6 → 7 → 8) before increasing the load."),
      loc("Réduire la prise ou ajouter 1–2 kg quand les 3 séries passent proprement.", "Use a smaller edge or add 1–2 kg once all 3 sets go cleanly."),
      loc("Ajouter un type de prise (semi-arqué, tendu, trou à deux doigts) plutôt que des séries de plus.", "Add a grip type (half crimp, open hand, two-finger pocket) rather than more sets."),
    ],
    mistakes: [
      loc("Charge trop lourde : la forme se dégrade dès la 3e répétition (épaules qui lâchent).", "Load too heavy: form breaks by the 3rd rep (shoulders letting go)."),
      loc("Raccourcir les 3 min entre séries.", "Shortening the 3 min between sets."),
      loc("Confondre avec les suspensions lourdes : ici on finit les séries, on ne teste pas son maximum.", "Confusing it with max hangs: here you finish the sets, you do not test your maximum."),
    ],
    safety: [
      loc("Même échauffement progressif que pour les suspensions lourdes.", "Same progressive warm-up as for max hangs."),
      loc("Jamais d'arqué avec le pouce ; épaules engagées.", "Never full crimp with the thumb; shoulders engaged."),
      PAIN_STOP,
    ],
    variants: [
      loc("IntHangs (López) : 10 s / 5 s, 4 à 5 répétitions, 1 min entre séries, proche de l'échec.", "IntHangs (López): 10 s / 5 s, 4–5 reps, 1 min between sets, close to failure."),
      loc("Version « aérobie » : 7/3 × 12 à environ 50 % de la charge totale.", "“Aerobic” version: 7/3 × 12 at about 50% of total load."),
      loc("Régler la charge à partir d'un test de force critique avec capteur.", "Set the load from a critical-force test with a sensor."),
    ],
    observe: loc("Répétitions réussies par série, charge, taille de prise, gêne éventuelle.", "Completed reps per set, load, edge size, any discomfort."),
    evidenceNote: loc(
      "Modéré. Des essais randomisés montrent que les suspensions intermittentes améliorent l'endurance des doigts (+45 % d'endurance de préhension chez López-Rivera 2019 ; gains d'endurance à 60–80 % de la force max chez Devise 2022). Le ratio 7/3 lui-même est une convention de coachs, pas un optimum démontré.",
      "Moderate. Randomised trials show intermittent hangs improve finger endurance (+45% grip endurance in López-Rivera 2019; endurance gains at 60–80% of max force in Devise 2022). The 7/3 ratio itself is a coaching convention, not a proven optimum.",
    ),
    sources: [SRC.horstProtocols, SRC.lopez2019, SRC.devise2022, SRC.medernach2015, SRC.lopezBlog2018],
    diagram: {
      kind: "intervals", work: 7, pause: 3, reps: 6, sets: 3, setRest: 180, zoom: true,
      workLabel: loc("suspension", "hang"),
      setLabel: loc("Série", "Set"),
    },
  },

  "easy-volume": {
    summary: loc(
      "Grimper en continu, longtemps et facilement (10 à 45 min sans s'arrêter), sans laisser le pompage s'installer. Eric Hörst a appelé ce travail ARC (Aerobic Restoration and Capillarity) ; Lattice parle de grimpe continue à très basse intensité.",
      "Climb continuously, for a long time and easily (10–45 min without stopping), without letting a pump build. Eric Hörst named it ARC (Aerobic Restoration and Capillarity); Lattice describes it as very-low-intensity continuous climbing.",
    ),
    trains: loc(
      "Système aérobie local de l'avant-bras (capillarisation, capacité oxydative) et économie gestuelle. La capacité de l'avant-bras à se ré-oxygéner est associée au niveau en voie.",
      "The forearm's local aerobic system (capillarisation, oxidative capacity) and movement economy. The forearm's ability to re-oxygenate is associated with sport-climbing grade.",
    ),
    suits: loc(
      "Tous niveaux ; prioritaire pour les grimpeurs de voie, en reprise après une coupure, ou comme séance de récupération active.",
      "All levels; a priority for route climbers, when returning after a break, or as an active-recovery session.",
    ),
    level: loc("Tous niveaux", "All levels"),
    prerequisites: [
      loc("Niveau : aucun minimum ; terrain très facile (≈ 3–4 niveaux sous ta limite).", "Level: no minimum; very easy terrain (≈ 3–4 grades below your limit)."),
      loc("Âge : adapté aux jeunes.", "Age: suitable for young climbers."),
      loc("Blessures : possible seulement sur grosses prises et sans douleur, avec l'accord d'un professionnel.", "Injuries: only on big holds and pain-free, with a clinician's agreement."),
    ],
    protocol: [
      { key: "intensity", value: loc("Effort perçu ≈ 2–4/10 : tu peux parler ; au plus un léger pompage qui ne monte pas.", "Perceived effort ≈ 2–4/10: you can talk; at most a light pump that does not build.") },
      { key: "effort", value: loc("10 min continues au départ, jusqu'à 20–45 min.", "10 continuous minutes at first, up to 20–45 min.") },
      { key: "rest", value: loc("5 min entre blocs (descendre, secouer, boire).", "5 min between blocks (come down, shake out, drink).") },
      { key: "reps", value: loc("Grimpe continue : traversée, ou voies faciles enchaînées en montée-désescalade.", "Continuous climbing: traversing, or easy routes linked up and down.") },
      { key: "sets", value: loc("3 blocs de 10 min au départ, puis 2 × 20–30 min.", "3 blocks of 10 min at first, then 2 × 20–30 min.") },
      { key: "session", value: loc("40 à 60 min.", "40–60 min.") },
      { key: "frequency", value: loc("2 à 4 fois par semaine en phase d'endurance ; 1 fois pour entretenir.", "2–4 times a week in an endurance phase; once to maintain.") },
    ],
    preparation: loc("Mur ou traversée facile, faible intensité, minuteur.", "An easy wall or traverse, low intensity, a timer."),
    steps: [
      loc("Choisis un terrain où tu peux parler en grimpant.", "Choose terrain on which you can talk while climbing."),
      loc("Grimpe 10 min sans t'arrêter, relâché, en respirant régulièrement ; récupère 5 min ; répète 3 fois.", "Climb 10 min without stopping, relaxed, breathing steadily; rest 5 min; repeat 3 times."),
      loc("Si le pompage monte, ralentis ou prends des prises plus grosses : ne t'arrête pas.", "If the pump builds, slow down or use bigger holds: do not stop."),
    ],
    progression: [
      loc("Allonger d'abord la durée (10 → 15 → 20 → 30 min), pas l'intensité.", "Lengthen the duration first (10 → 15 → 20 → 30 min), not the intensity."),
      loc("Réduire le repos entre blocs, puis passer à 2 blocs de 20–30 min.", "Shorten rest between blocks, then move to 2 blocks of 20–30 min."),
      loc("Après 4 à 6 semaines, ajouter des intervalles plus soutenus (ex. 1 min / 1 min).", "After 4–6 weeks, add harder intervals (e.g. 1 min on / 1 min off)."),
    ],
    mistakes: [
      loc("Grimper trop dur : si le pompage monte, ce n'est plus de l'ARC.", "Climbing too hard: if the pump builds, it is no longer ARC."),
      loc("S'arrêter accroché aux prises au lieu de continuer à bouger.", "Hanging still on holds instead of moving."),
      loc("Toujours le même terrain : alterner angles et prises entretient la technique.", "Always the same terrain: varying angles and holds keeps technique sharp."),
    ],
    safety: [
      loc("Peu de risques ; surveiller la peau et les coudes si le volume augmente vite.", "Low risk; watch skin and elbows if volume rises quickly."),
      loc("En traversée basse, pieds proches du sol et tapis dégagés.", "On low traverses, feet near the ground and clear pads."),
    ],
    variants: [
      loc("Traversée en boucle sur un pan.", "Looping traverse on a board."),
      loc("Montée-désescalade d'une voie facile en moulinette.", "Up-and-down laps on an easy top-rope route."),
      loc("Intervalles longs « 5 min / 3 min » à faible intensité.", "Long “5 min / 3 min” intervals at low intensity."),
    ],
    observe: loc("Minutes réellement grimpées sans arrêt, effort perçu, apparition du pompage.", "Minutes actually climbed without stopping, perceived effort, onset of pump."),
    evidenceNote: loc(
      "Faible (pratique et physiologie). La capacité oxydative de l'avant-bras prédit une part du niveau en voie (Fryer 2016), ce qui justifie le travail aérobie, mais aucun essai contrôlé n'a testé l'ARC en escalade. Hors escalade, des intensités plus élevées augmentent aussi la capillarisation.",
      "Low (practice and physiology). Forearm oxidative capacity predicts part of sport-climbing grade (Fryer 2016), which supports aerobic work, but no controlled trial has tested ARC in climbing. Outside climbing, higher intensities also increase capillarisation.",
    ),
    sources: [SRC.latticeEndurance, SRC.fryer2016, SRC.faggian2025],
    diagram: { kind: "continuous", blockMinutes: 10, blocks: 3, restMinutes: 5, rpe: [2, 4], ceiling: 5 },
  },

  "four-by-four": {
    summary: loc(
      "Enchaîner 4 blocs sans repos (un « tour »), récupérer 4 min, et répéter 4 tours. Chaque bloc est facile pris seul ; c'est leur enchaînement qui crée une fatigue proche du maximum au dernier tour.",
      "Link 4 problems without rest (one “round”), recover 4 min, and repeat for 4 rounds. Each problem is easy on its own; linking them builds near-maximal fatigue by the last round.",
    ),
    trains: loc(
      "Résistance (« power endurance ») : capacité anaérobie lactique, tolérance au pompage, maintien de la technique sous fatigue.",
      "Power endurance: lactic anaerobic capacity, pump tolerance, keeping technique under fatigue.",
    ),
    suits: loc(
      "Bloqueurs et grimpeurs de voie intermédiaires à confirmés, en préparation d'une sortie ou d'une compétition, après une base d'endurance et de force.",
      "Intermediate to advanced boulderers and route climbers preparing for a trip or competition, after a base of endurance and strength.",
    ),
    level: loc("Intermédiaire à confirmé", "Intermediate to advanced"),
    prerequisites: [
      loc("Niveau : ≥ 1 an de grimpe régulière ; réussir facilement les 4 blocs choisis.", "Level: ≥ 1 year of regular climbing; send the 4 chosen problems easily."),
      loc("Âge : possible chez les jeunes avec des blocs faciles et des réceptions sûres, sans surenchère de volume.", "Age: possible for young climbers with easy problems and safe landings, without piling on volume."),
      loc("Blessures : à éviter pendant une blessure — la fatigue dégrade la technique et les réceptions.", "Injuries: avoid while injured — fatigue degrades technique and landings."),
    ],
    protocol: [
      { key: "intensity", value: loc("Blocs ≈ 2–4 niveaux sous ta limite, réussis du premier coup à froid ; le 4e tour doit être très dur.", "Problems ≈ 2–4 grades below your limit, sent first go when fresh; the 4th round should be very hard.") },
      { key: "effort", value: loc("≈ 30–60 s par bloc, soit 2 à 4 min par tour.", "≈ 30–60 s per problem, so 2–4 min per round.") },
      { key: "rest", value: loc("Aucun entre les blocs d'un tour ; 4 min entre tours (vers un ratio 1:1 en progressant).", "None between problems in a round; 4 min between rounds (towards 1:1 as you progress).") },
      { key: "reps", value: loc("4 blocs par tour.", "4 problems per round.") },
      { key: "sets", value: loc("4 tours.", "4 rounds.") },
      { key: "session", value: loc("≈ 20–28 min + échauffement complet (≈ 20 min).", "≈ 20–28 min + a full warm-up (≈ 20 min).") },
      { key: "frequency", value: loc("1 à 2 fois par semaine sur 3 à 4 semaines ; 48 à 72 h entre deux séances.", "1–2 times a week for 3–4 weeks; 48–72 h between sessions.") },
    ],
    preparation: loc("Quatre blocs maîtrisés, proches les uns des autres, aux réceptions basses ; chronomètre.", "Four familiar problems close together with low landings; a timer."),
    steps: [
      loc("Choisis 4 blocs que tu réussis au premier essai.", "Choose 4 problems you send first go."),
      loc("Enchaîne-les sans repos (descendre, marcher, repartir), puis récupère 4 min.", "Climb them back to back (down, walk, go), then recover 4 min."),
      loc("Répète 4 tours et note les blocs réussis à chaque tour.", "Repeat for 4 rounds and log the problems completed each round."),
    ],
    progression: [
      loc("Réduire le repos entre tours (4 → 3 min → ratio 1:1).", "Shorten rest between rounds (4 → 3 min → 1:1 ratio)."),
      loc("Durcir un bloc à la fois.", "Make one problem harder at a time."),
      loc("Passer à 5 tours ou à des blocs plus longs (6 à 10 mouvements).", "Move to 5 rounds or longer problems (6–10 moves)."),
    ],
    mistakes: [
      loc("Blocs trop durs : échecs dès le 1er tour, la séance devient du bloc à la limite.", "Problems too hard: failing in round 1 turns it into limit bouldering."),
      loc("Blocs trop courts ou trop faciles : la séance devient du volume modéré.", "Problems too short or easy: it becomes moderate volume."),
      loc("Sauter de haut en fin de série, fatigué.", "Jumping off from high up at the end of a set, tired."),
    ],
    safety: [
      loc("Blocs aux réceptions basses et sûres ; désescalader quand c'est possible.", "Problems with low, safe landings; downclimb when possible."),
      loc("Arrêter si la technique ou les réceptions deviennent dangereuses.", "Stop if movement or landings become unsafe."),
    ],
    variants: [
      loc("Un bloc 4 fois de suite, puis le suivant (variante courante).", "One problem 4 times in a row, then the next (a common variant)."),
      loc("4×4 en voie : 4 voies en moulinette enchaînées.", "4×4 on routes: 4 top-rope routes linked."),
      loc("Circuits de 20–30 mouvements sur pan.", "20–30-move circuits on a board."),
    ],
    observe: loc("Blocs réussis par tour, repos réel, baisse de performance entre le 1er et le 4e tour.", "Problems completed per round, actual rest, drop-off between rounds 1 and 4."),
    evidenceNote: loc(
      "Faible. Méthode de coachs très répandue ; une méta-analyse note que les formats de bloc en intervalles peuvent améliorer la performance, mais aucun essai n'a testé le 4×4 lui-même.",
      "Low. A widespread coaching method; a meta-analysis notes interval-style bouldering may improve performance, but no trial has tested the 4×4 itself.",
    ),
    sources: [SRC.latticeFourByFour, SRC.stien2023],
    diagram: { kind: "circuit", problems: 4, rounds: 4, roundRest: 240, problemSeconds: [30, 60] },
  },

  "campus": {
    summary: loc(
      "Mouvements sans les pieds sur des réglettes numérotées (pan inventé par Wolfgang Güllich à la fin des années 1980) : échelles, rattrapés, doubles jetés. L'objectif est la puissance de contact : attraper une prise vite et fort. C'est l'exercice le plus traumatisant pour les doigts et les épaules.",
      "Feet-off moves on numbered rungs (a board invented by Wolfgang Güllich in the late 1980s): ladders, bumps, double dynos. The goal is contact power: catching a hold fast and hard. It is the most stressful exercise for fingers and shoulders.",
    ),
    trains: loc(
      "Puissance (force × vitesse) des doigts et du haut du corps, force de contact, coordination. Système énergétique : anaérobie alactique (séries de moins de 10 s).",
      "Power (force × speed) of the fingers and upper body, contact strength, coordination. Energy system: alactic anaerobic (sets under 10 s).",
    ),
    suits: loc(
      "Grimpeurs confirmés (≈ 7a+ en bloc / 7c en voie et plus) avec plusieurs années d'entraînement spécifique des doigts, pendant une phase de puissance.",
      "Advanced climbers (≈ 7a+ boulder / 7c route and above) with several years of specific finger training, during a power phase.",
    ),
    level: loc("Confirmé seulement", "Advanced only"),
    prerequisites: [
      loc("Niveau : confirmé, avec au moins 2–3 ans de suspensions sans blessure.", "Level: advanced, with at least 2–3 years of hangboarding without injury."),
      GROWTH,
      loc("Blessures : aucun antécédent récent de poulie, coude ou épaule.", "Injuries: no recent pulley, elbow or shoulder history."),
    ],
    protocol: [
      { key: "intensity", value: loc("Maximale et explosive, avec une qualité parfaite.", "Maximal and explosive, with perfect quality.") },
      { key: "effort", value: loc("Moins de 10 s par série (3 à 6 mouvements).", "Under 10 s per set (3–6 moves).") },
      { key: "rest", value: loc("≈ 3 min entre séries.", "≈ 3 min between sets.") },
      { key: "reps", value: loc("3 échelles par série.", "3 ladders per set.") },
      { key: "sets", value: loc("4 séries (séance type) ; les plus confirmés vont jusqu'à 15–30 séries courtes.", "4 sets (sample session); the most advanced go up to 15–30 short sets.") },
      { key: "session", value: loc("20 à 40 min ; arrêter si la performance baisse deux séries de suite.", "20–40 min; stop if performance drops two sets in a row.") },
      { key: "frequency", value: loc("1 à 2 fois par semaine sur 3 à 5 semaines ; 2 jours de repos complets après chaque séance.", "1–2 times a week for 3–5 weeks; two full rest days after each session.") },
    ],
    preparation: loc("Pan de campus avec grosses réglettes, échauffement complet des doigts et des épaules, tapis.", "Campus board with large rungs, full finger and shoulder warm-up, pads."),
    steps: [
      loc("Commence pieds posés sur grosses réglettes, puis sans les pieds.", "Start feet-on on large rungs, then feet-off."),
      loc("Fais 3 échelles par série (ex. 1-3-5), 3 min de repos, 4 séries.", "Do 3 ladders per set (e.g. 1-3-5), 3 min rest, 4 sets."),
      loc("Arrête au moindre signe de douleur ou dès que la vitesse baisse.", "Stop at the first sign of pain or as soon as speed drops."),
    ],
    progression: [
      loc("Pieds posés → sans pieds.", "Feet-on → feet-off."),
      loc("Échelles régulières 1-2-3-4-5 → espacées 1-3-5 → 1-4-7.", "Regular ladders 1-2-3-4-5 → spaced 1-3-5 → 1-4-7."),
      loc("Rattrapés, puis doubles jetés, seulement quand tout est maîtrisé.", "Bumps, then double dynos, only once everything is controlled."),
    ],
    mistakes: [
      loc("Faire du campus trop tôt dans sa progression.", "Campusing too early in your progression."),
      loc("Arqué avec le pouce et réceptions bras tendus : chocs sur les tendons.", "Full crimping and catching with straight arms: shock loads on tendons."),
      loc("Descendre en campus : fort risque, déconseillé.", "Campusing downwards: high risk, not recommended."),
      loc("Continuer fatigué : chaque série doit être de qualité maximale.", "Carrying on when tired: every set must be top quality."),
    ],
    safety: [
      loc("Échauffement complet avant la première série ; grosses réglettes au début.", "Full warm-up before the first set; large rungs at first."),
      loc("Redescendre par les pieds, jamais en lâchant d'en haut.", "Come down using your feet, never by dropping from the top."),
      PAIN_STOP,
    ],
    variants: [
      loc("Campus pieds posés sur pan.", "Feet-on campusing on a board."),
      loc("Échelle maximale : le plus grand écart possible.", "Max ladder: the biggest span possible."),
      loc("Touches : toucher la réglette haute puis redescendre contrôlé.", "Touches: tap the high rung, then lower under control."),
    ],
    observe: loc("Précision et vitesse du contact, plus grand écart réussi, absence de douleur.", "Contact precision and speed, largest span achieved, no pain."),
    evidenceNote: loc(
      "Faible à modéré. Un seul essai randomisé (16 grimpeurs avancés à élite, 5 semaines) montre des gains de force, de vitesse de production de force et de performance en bloc par rapport à la grimpe seule. Les entraîneurs restent prudents chez l'adolescent.",
      "Low to moderate. A single randomised trial (16 advanced-to-elite climbers, 5 weeks) shows gains in strength, rate of force development and bouldering performance versus climbing alone. Coaches remain cautious with adolescents.",
    ),
    sources: [SRC.stien2021campus, SRC.rctmCampus, SRC.mcmullen2021, SRC.jones2022],
    diagram: { kind: "ladder", rungs: 9, ladders: [[1, 3, 5], [1, 4, 7]], sets: 4, reps: 3, rest: 180 },
  },

  "strength-conditioning": {
    summary: loc(
      "Renforcement général au poids du corps ou avec charges : tirage, poussée, gainage, jambes et épaules. Il complète la grimpe : plus de marge de force, meilleure tolérance à la charge et équilibre entre muscles de traction et de poussée.",
      "General strength training with bodyweight or loads: pulling, pushing, trunk, legs and shoulders. It complements climbing: more strength reserve, better load tolerance and balance between pulling and pushing muscles.",
    ),
    trains: loc(
      "Force maximale et un peu d'hypertrophie (tirage, poussée), stabilité des épaules et du tronc. Peu spécifique sur le plan énergétique.",
      "Maximal strength and some hypertrophy (pull, push), shoulder and trunk stability. Little energy-system specificity.",
    ),
    suits: loc(
      "Tous niveaux ; surtout les grimpeurs qui manquent de traction, s'entraînent à la maison ou reprennent après une coupure.",
      "All levels; especially climbers lacking pulling strength, training at home or returning after a break.",
    ),
    level: loc("Tous niveaux avec adaptation", "All levels with modifications"),
    prerequisites: [
      loc("Niveau : maîtriser l'exécution sans charge avant d'ajouter du lest.", "Level: master each movement unloaded before adding weight."),
      loc("Âge : chez les jeunes, renforcement au poids du corps et encadré ; les charges lourdes viennent après l'apprentissage technique.", "Age: for young climbers, supervised bodyweight work; heavy loads come after technique is learned."),
      loc("Blessures : douleur d'épaule ou de coude = adapter amplitude et prises, et consulter.", "Injuries: shoulder or elbow pain means adapting range and grips, and seeing a clinician."),
    ],
    protocol: [
      { key: "intensity", value: loc("≈ 2 répétitions en réserve (effort ≈ 8/10).", "≈ 2 reps in reserve (effort ≈ 8/10).") },
      { key: "effort", value: loc("6 à 10 répétitions, ou 30 s de gainage.", "6–10 reps, or 30 s holds.") },
      { key: "rest", value: loc("1 à 2 min entre séries (2–3 min si lourd).", "1–2 min between sets (2–3 min if heavy).") },
      { key: "reps", value: loc("Tractions 6, pompes 10, dips 6, gainage 30 s (séance type).", "Pull-ups 6, push-ups 10, dips 6, hollow hold 30 s (sample session).") },
      { key: "sets", value: loc("3 séries par exercice.", "3 sets per exercise.") },
      { key: "session", value: loc("30 à 45 min.", "30–45 min.") },
      { key: "frequency", value: loc("2 fois par semaine, après la grimpe ou un jour sans travail de doigts.", "Twice a week, after climbing or on a day without finger work.") },
    ],
    preparation: loc("Barre de traction, sol, deux appuis stables pour les dips, élastique d'assistance ou lest.", "Pull-up bar, floor, two stable supports for dips, assistance band or weights."),
    steps: [
      loc("Choisis 1 ou 2 priorités (ex. traction et épaules) sans doubler la fatigue de grimpe.", "Pick 1–2 priorities (e.g. pulling and shoulders) without doubling climbing fatigue."),
      loc("Fais 3 séries par exercice en gardant 2 répétitions en réserve.", "Do 3 sets per exercise keeping 2 reps in reserve."),
      loc("Note charges et répétitions ; vérifie l'effet sur ta grimpe.", "Log loads and reps; check the effect on your climbing."),
    ],
    progression: [
      loc("Ajouter une répétition par séance jusqu'au haut de la fourchette, puis du lest ou une variante plus dure.", "Add one rep per session up to the top of the range, then weight or a harder variant."),
      loc("Tractions → lestées → un bras assisté ; pompes → déclinées.", "Pull-ups → weighted → assisted one-arm; push-ups → decline."),
      loc("Cycles de 4 à 8 semaines puis une semaine plus légère.", "4–8-week cycles, then a lighter week."),
    ],
    mistakes: [
      loc("Négliger la poussée et les épaules : déséquilibre.", "Neglecting pushing and shoulders: imbalance."),
      loc("Aller à l'échec à chaque série.", "Going to failure on every set."),
      loc("Placer le renforcement lourd juste avant une séance de doigts.", "Doing heavy strength work right before a finger session."),
    ],
    safety: [
      loc("Amplitude contrôlée, épaules basses.", "Controlled range, shoulders down."),
      loc("Pas de dips si l'avant de l'épaule tire.", "No dips if the front of the shoulder pulls."),
    ],
    variants: [
      loc("Tractions lestées 3–5 × 3–5 pour la force.", "Weighted pull-ups 3–5 × 3–5 for strength."),
      loc("Programme kettlebell pour grimpeurs.", "Kettlebell programme for climbers."),
      loc("Gainage suspendu : relevés de genoux, front lever progressif.", "Hanging core: knee raises, front-lever progressions."),
    ],
    observe: loc("Répétitions, charges, effort perçu et fatigue accumulée.", "Reps, loads, perceived effort and accumulated fatigue."),
    evidenceNote: loc(
      "Modéré. Une méta-analyse (Stien 2023) montre que l'entraînement en résistance spécifique améliore davantage les tests d'escalade que la grimpe seule (différence standardisée 0,57) ; les recommandations générales de l'ACSM encadrent séries, répétitions et repos.",
      "Moderate. A meta-analysis (Stien 2023) shows specific resistance training improves climbing tests more than climbing alone (standardised difference 0.57); general ACSM guidelines frame sets, reps and rest.",
    ),
    sources: [SRC.stien2023, SRC.acsm2009, SRC.saeterbakken2022, SRC.hoopersStrength],
    diagram: {
      kind: "sets",
      exercises: [
        { name: loc("Tractions", "Pull-ups"), sets: 3, reps: 6, rest: 120 },
        { name: loc("Pompes", "Push-ups"), sets: 3, reps: 10, rest: 90 },
        { name: loc("Dips", "Dips"), sets: 3, reps: 6, rest: 120 },
        { name: loc("Gainage creux", "Hollow hold"), sets: 3, seconds: 30, rest: 60 },
      ],
    },
  },

  "mobility": {
    summary: loc("Une routine courte d’étirements tenus (6 positions, 2 × 30–40 s chacune, ≈ 15 min) pour garder ou gagner l’amplitude utile en escalade : hanches ouvertes pour les pieds hauts et les lolottes, ischio-jambiers pour les crochets de talon, épaules pour les grands mouvements.", "A short routine of held stretches (6 positions, 2 × 30–40 s each, ≈ 15 min) to keep or gain the range climbing uses: open hips for high feet and drop knees, hamstrings for heel hooks, shoulders for big reaches."),
    trains: loc("Amplitude articulaire (hanches, chaîne postérieure, épaules, avant-bras) et tolérance à l’étirement. Ce n’est ni de la force ni de l’endurance.", "Joint range of motion (hips, posterior chain, shoulders, forearms) and stretch tolerance. It is neither strength nor endurance."),
    suits: loc("Tous niveaux, surtout si un mouvement te bloque par manque d’amplitude (pied haut, grand écart, épaule). Les jours off ou après la séance.", "All levels, especially if a move stops you for lack of range (high foot, wide bridge, shoulder). On rest days or after a session."),
    level: loc("Tous niveaux", "All levels"),
    prerequisites: [
      loc("Niveau : aucun minimum.", "Level: no minimum."),
      loc("Âge : adapté aux jeunes grimpeurs, sans forcer.", "Age: suitable for young climbers, without forcing."),
      loc("Blessures : pas d’étirement sur une zone douloureuse ou récemment blessée sans l’accord d’un professionnel de santé.", "Injuries: no stretching of a painful or recently injured area without a clinician’s agreement."),
    ],
    protocol: [
      { key: "intensity", value: loc("Tension franche mais sans douleur (≈ 6–7/10), respiration lente.", "A strong but painless pull (≈ 6–7/10), slow breathing.") },
      { key: "effort", value: loc("30 à 40 s par position (par côté quand il y en a deux).", "30–40 s per position (per side where there are two).") },
      { key: "rest", value: loc("≈ 15 s pour changer de côté ou de position.", "≈ 15 s to switch sides or positions.") },
      { key: "reps", value: loc("6 positions : grenouille, squat profond, fente basse, ischio-jambiers, épaules au mur, avant-bras.", "6 positions: frog, deep squat, low lunge, hamstrings, wall shoulders, forearms.") },
      { key: "sets", value: loc("2 passages par position.", "2 rounds per position.") },
      { key: "session", value: loc("≈ 15 min.", "≈ 15 min.") },
      { key: "frequency", value: loc("3 à 5 fois par semaine pour gagner de l’amplitude, 2 fois pour l’entretenir.", "3–5 times a week to gain range, twice to maintain it.") },
    ],
    preparation: loc("Un tapis, un mur, un minuteur. Muscles chauds : après la séance ou après 5 min de mouvement.", "A mat, a wall, a timer. Warm muscles: after climbing or after 5 min of movement."),
    steps: [
      loc("Grenouille : À quatre pattes, genoux écartés, recule doucement le bassin.", "Frog stretch: On all fours, knees wide, gently sit the hips back."),
      loc("Squat profond : Pieds à plat, talons au sol, coudes poussant les genoux vers l’extérieur.", "Deep squat hold: Feet flat, heels down, elbows pushing the knees out."),
      loc("Fente basse (par côté) : Genou arrière au sol, bassin vers l’avant, buste droit ; change de côté.", "Low lunge (per side): Back knee down, hips forward, chest up; switch sides."),
      loc("Ischio-jambiers assis : Jambes tendues, buste long vers l’avant sans arrondir le dos.", "Seated hamstrings: Straight legs, long chest reaching forward without rounding the back."),
      loc("Épaules au mur : Mains au mur, recule et laisse descendre la poitrine, bras tendus.", "Wall shoulder stretch: Hands on the wall, step back and let the chest sink, arms straight."),
      loc("Avant-bras (par bras) : Bras tendu, paume vers l’avant, tire doucement les doigts vers toi ; change de bras.", "Forearms (per arm): Straight arm, palm forward, gently pull the fingers back; switch arms."),
    ],
    progression: [
      loc("Augmenter d’abord le temps total par semaine (plus de séances), puis la durée tenue (40 → 60 s).", "First increase total time per week (more sessions), then the hold (40 → 60 s)."),
      loc("Passer aux positions actives : tenir l’amplitude avec ses muscles (pied haut sans les mains).", "Move to active positions: hold the range with your own muscles (high foot without hands)."),
      loc("Ajouter la position qui te manque au mur (lolotte, grand écart facial).", "Add the position you lack on the wall (drop knee, wide bridge)."),
    ],
    mistakes: [
      loc("Forcer dans la douleur ou par à-coups : l’amplitude se gagne avec le temps, pas la force.", "Forcing into pain or bouncing: range comes with time, not force."),
      loc("De longs étirements statiques juste avant un essai maximal : garde-les pour après ou les jours off.", "Long static stretches right before a maximal attempt: keep them for after or rest days."),
      loc("Étirer fort les doigts juste après une grosse séance de doigts.", "Stretching the fingers hard right after a big finger session."),
    ],
    safety: [
      loc("Jamais dans une douleur articulaire, une poulie ou un coude sensible.", "Never into joint pain, a sore pulley or a sensitive elbow."),
      loc("Hanches et genoux : arrête si le genou tourne ou pince.", "Hips and knees: stop if the knee twists or pinches."),
    ],
    variants: [
      loc("Version 5 min pour l’échauffement : mouvements dynamiques plutôt que positions tenues.", "5-minute warm-up version: dynamic movements rather than held positions."),
      loc("Suivre la routine vidéo de Lattice Training (lien ci-dessous).", "Follow Lattice Training’s video routine (link below)."),
      loc("Yoga doux ou mobilité guidée, 20–30 min, un jour off.", "Gentle yoga or guided mobility, 20–30 min, on a rest day."),
    ],
    observe: loc("Le pied le plus haut posé sans les mains, la distance doigts-sol jambes tendues, et si le mouvement qui te bloquait passe mieux.", "The highest foot placed without hands, the fingers-to-floor distance with straight legs, and whether the move that stopped you feels easier."),
    evidenceNote: loc("Faible pour la performance, solide pour l’amplitude. S’étirer régulièrement augmente l’amplitude (au moins ≈ 5 min par muscle et par semaine, Thomas 2018). Des étirements courts dans l’échauffement ne gênent pas la performance (Behm 2016), mais s’étirer après l’effort n’accélère pas la récupération (Afonso 2021). En escalade, la souplesse pèse peu sur le niveau (Mermier 2000) : elle compte surtout quand un mouvement précis te bloque.", "Low for performance, solid for range. Regular stretching increases range of motion (at least ≈ 5 min per muscle per week, Thomas 2018). Short stretches in a warm-up do not hurt performance (Behm 2016), but stretching after exercise does not speed up recovery (Afonso 2021). In climbing, flexibility weighs little on grade (Mermier 2000): it matters most when a specific move stops you."),
    sources: [SRC.thomas2018, SRC.behm2016, SRC.afonso2021, SRC.mermier2000, SRC.latticeFlexibility],
    diagram: {
      kind: "sets",
      exercises: [
        { name: loc("Grenouille", "Frog stretch"), sets: 2, seconds: 40, rest: 15 },
        { name: loc("Squat profond", "Deep squat hold"), sets: 2, seconds: 40, rest: 15 },
        { name: loc("Fente basse (par côté)", "Low lunge (per side)"), sets: 2, seconds: 30, rest: 15 },
        { name: loc("Ischio-jambiers assis", "Seated hamstrings"), sets: 2, seconds: 40, rest: 15 },
        { name: loc("Épaules au mur", "Wall shoulder stretch"), sets: 2, seconds: 30, rest: 15 },
        { name: loc("Avant-bras (par bras)", "Forearms (per arm)"), sets: 2, seconds: 30, rest: 15 },
      ],
    },
    video: {
      title: "The Bare Minimum Flexibility Routine for Climbers",
      author: "Lattice Training",
      url: "https://www.youtube.com/watch?v=mKUle2yBYq0",
      note: loc("Routine vidéo recommandée pour suivre la séance (en anglais, sur YouTube).", "Recommended video routine to follow along (in English, on YouTube)."),
    },
  },
  "hip-mobility": {
    summary: loc(
      "Un programme pour partir de hanches très raides et arriver à une mobilité utile au mur : d’abord des mouvements doux avec appui, puis du contrôle actif et de la force dans l’amplitude gagnée, enfin le placement des pieds, les transferts de poids et les rotations de hanche en grimpant. Pas de grand écart : le but est une amplitude que tu contrôles. On progresse par niveau, quand le précédent est contrôlé et bien toléré, jamais parce qu’un nombre de semaines est passé.",
      "A programme to go from very stiff hips to mobility that works on the wall: first gentle supported movements, then active control and strength in the range you gain, then foot placement, weight shifts and hip turns while climbing. No splits: the goal is range you control. You progress by level, when the previous one is controlled and well tolerated, never because a number of weeks has passed.",
    ),
    trains: loc(
      "Amplitude passive des hanches, contrôle actif et force dans cette amplitude, puis coordination au mur (pieds qui restent en pression, hanches qui se déplacent). La souplesse n’explique pas tout : la force, l’équilibre, la technique, l’écart des prises et l’inclinaison du mur comptent aussi.",
      "Passive hip range, active control and strength in that range, then coordination on the wall (feet that keep pressure, hips that move). Flexibility is not the whole story: strength, balance, technique, foothold spacing and wall angle matter too.",
    ),
    suits: loc(
      "Les grimpeurs dont les hanches limitent les pieds écartés, les pieds hauts ou les rotations, même au tout début. Aucun bilan complet ni autre programme n’est nécessaire.",
      "Climbers whose hips limit wide feet, high feet or hip turns, even at the very start. No full assessment or other programme is needed.",
    ),
    level: loc("Débutant, dès le niveau 0", "Beginner, from level 0"),
    prerequisites: [
      loc("Niveau : aucun minimum ; la séance de niveau 0 se fait avec beaucoup d’appui.", "Level: no minimum; the level 0 session uses plenty of support."),
      loc("Matériel : un tapis, un coussin ferme, une marche basse et stable, un support (mur, chaise, table).", "Equipment: a mat, a firm cushion, a low stable step, a support (wall, chair, table)."),
      loc("Blessures : pas de séance sur une hanche, un genou ou un dos douloureux ou récemment blessé sans l’accord d’un professionnel de santé.", "Injuries: no session on a painful or recently injured hip, knee or back without a clinician’s agreement."),
    ],
    protocol: [
      { key: "intensity", value: loc("Amplitude confortable, effort léger ; gêne ≤ 2/10, jamais de douleur vive.", "Comfortable range, light effort; discomfort ≤ 2/10, never sharp pain.") },
      { key: "effort", value: loc("Répétitions lentes et contrôlées (3 à 4 s par mouvement).", "Slow, controlled reps (3–4 s per movement).") },
      { key: "rest", value: loc("≈ 15 s entre les côtés, ≈ 30 s entre les exercices.", "≈ 15 s between sides, ≈ 30 s between exercises.") },
      { key: "reps", value: loc("5 à 8 répétitions (par côté pour les exercices à un côté).", "5–8 reps (per side for one-sided exercises).") },
      { key: "sets", value: loc("1 série par côté au niveau 0.", "1 set per side at level 0.") },
      { key: "session", value: loc("≈ 10 min, version courte ≈ 5 min.", "≈ 10 min, short version ≈ 5 min.") },
      { key: "frequency", value: loc("3 à 4 séances courtes par semaine au début.", "3–4 short sessions a week at the start.") },
    ],
    preparation: loc("Un tapis, un coussin ferme, une marche basse et un support stable. Pas besoin d’échauffement séparé : la séance commence en douceur.", "A mat, a firm cushion, a low step and a stable support. No separate warm-up needed: the session starts gently."),
    steps: [
      loc("Fais le bilan débutant (4 tests, gauche et droite) pour situer ton point de départ, sans score de souplesse.", "Do the beginner assessment (4 tests, left and right) to find your starting point, with no flexibility score."),
      loc("Fais la séance guidée de ton niveau : chaque exercice a une version plus facile et une plus difficile.", "Do your level’s guided session: every exercise has an easier and a harder version."),
      loc("Note pour chaque côté les répétitions, la version faite, le contrôle et la gêne : LEBLOND ajuste la séance suivante.", "Record for each side the reps, the version done, control and discomfort: LEBLOND adjusts the next session."),
      loc("Refais le bilan quelques semaines plus tard, dans les mêmes conditions, pour comparer.", "Repeat the assessment a few weeks later, in the same conditions, to compare."),
    ],
    progression: [
      loc("Une marche après l’autre : quelques répétitions de plus, puis la version plus difficile, seulement après deux séances propres d’affilée, et seulement si tu acceptes.", "One step at a time: a few more reps, then the harder version, only after two clean sessions in a row, and only if you accept."),
      loc("Gêne forte, accrochage ou répétitions mal contrôlées : la séance suivante revient automatiquement à une version plus facile.", "Strong discomfort, catching or poorly controlled reps: the next session automatically steps back to an easier version."),
      loc("Ensuite : contrôle actif dans l’amplitude, puis transfert au mur et exercices de pan facultatifs.", "Then: active control in the range, then transfer to the wall and optional board drills."),
    ],
    mistakes: [
      loc("Forcer l’amplitude, rebondir ou tenir longtemps en fin d’amplitude.", "Forcing the range, bouncing or loading the end of the range for long."),
      loc("Croire que tout vient de la souplesse : sans force ni contrôle, l’amplitude gagnée ne sert pas au mur.", "Thinking it is all about flexibility: without strength and control, new range does not help on the wall."),
      loc("Monter de niveau parce que des semaines ont passé plutôt que parce que le niveau est maîtrisé.", "Moving up because weeks have passed rather than because the level is mastered."),
    ],
    safety: [
      loc("Jamais de douleur vive, d’accrochage ou de blocage net : arrête l’exercice et prends la version plus facile.", "Never sharp pain, catching or a hard block: stop the exercise and use the easier version."),
      loc("Douleur qui dure, accrochage, grosse différence gauche/droite ou blocage mécanique : consulte un professionnel de santé qualifié ou un kinésithérapeute du sport avant de progresser.", "Persistent pain, catching, a large left/right difference or a mechanical block: see a qualified clinician or sports physiotherapist before progressing."),
    ],
    variants: [
      loc("Version courte (≈ 5 min, 3 exercices) les jours chargés.", "Short version (≈ 5 min, 3 exercises) on busy days."),
      loc("Chaque exercice en version plus facile (plus d’appui, moins d’amplitude) ou plus difficile (moins d’appui, pause).", "Each exercise in an easier version (more support, less range) or a harder one (less support, a pause)."),
      loc("Au mur, plus tard : terrain facile ou pan réglé moins raide, prises de pied rapprochées d’abord.", "On the wall, later: easy terrain or a less steep board, close footholds first."),
    ],
    observe: loc("Les tests répétés dans les mêmes conditions : transitions 90/90 contrôlées, distance genou–sol, hauteur de marche, transferts de pied propres, côté par côté.", "The tests repeated in the same conditions: controlled 90/90 transitions, knee-to-floor distance, step height, clean foot transfers, side by side."),
    evidenceNote: loc(
      "Limitée mais cohérente. L’amplitude progresse avec un travail régulier (Thomas 2018), et le renforcement améliore l’amplitude autant que l’étirement dans une méta-analyse aux études très variées (Afonso 2021) : d’où un programme qui mêle mouvement doux, contrôle actif et force. En escalade, la souplesse pèse peu sur le niveau (Mermier 2000) ; elle compte quand un mouvement précis te bloque. Les niveaux de LEBLOND sont des repères d’entraînement, pas une évaluation clinique.",
      "Limited but consistent. Range improves with regular work (Thomas 2018), and strength training improved range of motion as much as stretching in a meta-analysis of very varied studies (Afonso 2021): hence a programme mixing gentle movement, active control and strength. In climbing, flexibility weighs little on grade (Mermier 2000); it matters when a specific move stops you. LEBLOND’s levels are training landmarks, not a clinical assessment.",
    ),
    sources: [SRC.thomas2018, SRC.afonso2021strength, SRC.mermier2000],
    diagram: {
      kind: "sets",
      exercises: LEVEL_SESSIONS[0]!.STANDARD.exercises.map((id) => {
        const e = EXERCISE_BY_ID.get(id)!;
        return { name: e.name, sets: e.perSide ? 2 : 1, reps: e.reps.start, rest: e.restSeconds };
      }),
    },
  },
  "mental": {
    summary: loc(
      "Préparer la tête autant que le corps : lire la voie depuis le sol, respirer, décider puis s'engager, et apprivoiser la chute en tête par paliers. L'approche s'inspire notamment de The Warrior's Way (Arno Ilgner) et des psychologues du sport qui travaillent avec des grimpeurs.",
      "Train the mind as well as the body: read the route from the ground, breathe, decide, then commit, and get used to lead falls step by step. The approach draws on The Warrior's Way (Arno Ilgner) and sport psychologists working with climbers.",
    ),
    trains: loc(
      "Une qualité : gestion de l'anxiété, attention, prise de décision et engagement. Aucun système énergétique.",
      "A skill: anxiety management, attention, decision-making and commitment. No energy system.",
    ),
    suits: loc(
      "Tous niveaux en voie ; surtout ceux qui grimpent nettement moins bien en tête qu'en moulinette ou qui bloquent au-dessus du dernier point.",
      "Route climbers at every level; especially those who climb clearly worse on lead than on top rope or freeze above the last bolt.",
    ),
    level: loc("Tous niveaux, avec encadrement en voie", "All levels with appropriate belay supervision"),
    prerequisites: [
      loc("Niveau : savoir grimper en tête et clipper en sécurité.", "Level: able to lead and clip safely."),
      loc("Assureur formé à l'assurage dynamique ; voie verticale ou en dévers sans vire ni obstacle.", "A belayer trained in soft catches; a vertical or overhanging route with no ledges or obstacles."),
      loc("Blessures : pas de chute volontaire avec une blessure en cours (cheville, épaule, doigt).", "Injuries: no practice falls with a current injury (ankle, shoulder, finger)."),
    ],
    protocol: [
      { key: "intensity", value: loc("Exposition graduelle : rester dans un inconfort acceptable (anxiété ≤ 5/10).", "Gradual exposure: stay within acceptable discomfort (anxiety ≤ 5/10).") },
      { key: "effort", value: loc("Une voie ou une chute par essai.", "One route or one fall per attempt.") },
      { key: "rest", value: loc("≈ 3 min entre essais.", "≈ 3 min between attempts.") },
      { key: "reps", value: loc("3 à 5 chutes par palier, jusqu'à ce qu'elles soient calmes.", "3–5 falls per step, until they feel calm.") },
      { key: "sets", value: loc("4 essais de la routine lecture-respiration-décision.", "4 attempts of the read-breathe-decide routine.") },
      { key: "session", value: loc("20 à 30 min, en début ou milieu de séance.", "20–30 min, early or mid-session.") },
      { key: "frequency", value: loc("1 fois par semaine, plus quelques minutes à chaque séance en tête.", "Once a week, plus a few minutes every lead session.") },
    ],
    preparation: loc("Assureur compétent, voie adaptée, objectifs progressifs et cadre sécurisé.", "A competent belayer, a suitable route, gradual goals and a safe setting."),
    steps: [
      loc("Lis la voie au sol : repos, sections, clippages ; décide où tu vas t'engager.", "Read the route from the ground: rests, sections, clips; decide where you will commit."),
      loc("Avant chaque passage clé, trois respirations lentes, puis décide : engager ou désescalader.", "Before each crux, three slow breaths, then decide: commit or downclimb."),
      loc("Pratique la chute palier par palier et note ta confiance (1–10) après chaque essai.", "Practise falling one step at a time and rate your confidence (1–10) after each attempt."),
    ],
    progression: [
      loc("Moulinette avec du mou → tête sous le point → au niveau du point → au-dessus du point.", "Top rope with slack → lead below the bolt → at the bolt → above the bolt."),
      loc("Augmenter la hauteur seulement quand le palier précédent est calme.", "Increase height only when the previous step feels calm."),
      loc("Transférer la routine aux essais de projet.", "Carry the routine into project attempts."),
    ],
    mistakes: [
      loc("Chutes trop grandes trop tôt : on sensibilise au lieu de rassurer.", "Falls too big too soon: they sensitise instead of reassuring."),
      loc("Négliger la communication avec l'assureur.", "Neglecting communication with the belayer."),
      loc("Se juger sur une seule séance.", "Judging yourself on a single session."),
    ],
    safety: [
      loc("Vérification croisée avant chaque essai.", "Partner check before every attempt."),
      loc("Jamais de chute près du sol, d'une vire ou avec la corde derrière la jambe.", "Never fall near the ground, a ledge or with the rope behind your leg."),
      loc("Assureur expérimenté, écart de poids raisonnable ou dispositif adapté.", "An experienced belayer, a reasonable weight difference or a suitable device."),
    ],
    variants: [
      loc("Routine de lecture au sol avant chaque voie.", "A ground-reading routine before every route."),
      loc("Voies faciles à vue pour pratiquer la décision.", "Easy on-sights to practise decisions."),
      loc("Chutes avec un coach ou un encadrant (stage).", "Falls with a coach or instructor (course)."),
    ],
    observe: loc("Confiance auto-évaluée, rythme, décisions prises sous stress, hauteur de chute acceptée.", "Self-rated confidence, pacing, decisions under stress, fall height accepted."),
    evidenceNote: loc(
      "Faible. Les études montrent que la tête génère plus d'anxiété et de cortisol que la moulinette (Hodgson 2009, Draper 2012), ce qui confirme le besoin ; les programmes d'exposition progressive viennent de la pratique et n'ont pas été testés par des essais contrôlés en escalade.",
      "Low. Studies show lead climbing produces more anxiety and cortisol than top rope (Hodgson 2009, Draper 2012), which confirms the need; graded-exposure programmes come from practice and have not been tested in controlled climbing trials.",
    ),
    sources: [SRC.hodgson2009, SRC.draper2012, SRC.latticeFear, SRC.alpinistIlgner],
    diagram: {
      kind: "staircase",
      axis: loc("exposition croissante →", "increasing exposure →"),
      steps: [
        { label: loc("Moulinette avec mou", "Top rope with slack"), detail: loc("3–5 chutes", "3–5 falls") },
        { label: loc("Tête : sous le point", "Lead: below the bolt"), detail: loc("3–5 chutes", "3–5 falls") },
        { label: loc("Tête : au point", "Lead: at the bolt"), detail: loc("3–5 chutes", "3–5 falls") },
        { label: loc("Tête : 50 cm au-dessus", "Lead: 50 cm above"), detail: loc("3–5 chutes", "3–5 falls") },
        { label: loc("Tête : 1–2 m au-dessus", "Lead: 1–2 m above"), detail: loc("3–5 chutes", "3–5 falls") },
      ],
    },
  },

  "periodized": {
    summary: loc(
      "Organiser l'entraînement en cycles qui font varier volume et intensité, avec des semaines de récupération et des tests. Exemple classique : le cycle 4-3-2-1 d'Eric Hörst (10 semaines) — 4 semaines de technique et d'endurance, 3 de force et puissance, 2 de résistance, 1 de repos.",
      "Organise training in cycles that vary volume and intensity, with recovery weeks and tests. A classic example is Eric Hörst's 4-3-2-1 cycle (10 weeks): 4 weeks of technique and endurance, 3 of strength and power, 2 of power endurance, 1 of rest.",
    ),
    trains: loc(
      "Toutes les qualités, dans un ordre logique : base (endurance, technique) → force et puissance → résistance → récupération.",
      "All qualities, in a logical order: base (endurance, technique) → strength and power → power endurance → recovery.",
    ),
    suits: loc(
      "Tous niveaux dès qu'on s'entraîne au moins 3 fois par semaine ; indispensable pour préparer un objectif (voyage, compétition, projet).",
      "Every level once you train at least 3 times a week; essential when preparing a goal (trip, competition, project).",
    ),
    level: loc("Tous niveaux", "All levels"),
    prerequisites: [
      loc("Connaître son point faible (bilan ou tests).", "Know your weak point (assessment or tests)."),
      loc("Disponibilité régulière et journal d'entraînement.", "Regular availability and a training log."),
      loc("Blessures : reprendre à la phase de base et adapter les phases intenses.", "Injuries: restart at the base phase and adapt the intense phases."),
    ],
    protocol: [
      { key: "intensity", value: loc("Varie par phase : faible en base, maximale en force/puissance, sous-maximale en résistance.", "Varies by phase: low in the base, maximal in strength/power, submaximal in power endurance.") },
      { key: "effort", value: loc("Selon les méthodes de chaque phase (ARC, bloc à la limite, 4×4…).", "Set by each phase's methods (ARC, limit bouldering, 4×4…).") },
      { key: "rest", value: loc("1 semaine de récupération (4 à 7 jours) en fin de cycle.", "1 recovery week (4–7 days) at the end of the cycle.") },
      { key: "reps", value: loc("Définies par les méthodes de chaque phase.", "Defined by each phase's methods.") },
      { key: "sets", value: loc("4 phases : 4 + 3 + 2 + 1 semaines.", "4 phases: 4 + 3 + 2 + 1 weeks.") },
      { key: "session", value: loc("Séance type de 40 min dans LEBLOND, selon le plan de la semaine.", "40-min sample session in LEBLOND, per the week's plan.") },
      { key: "frequency", value: loc("3 à 5 séances par semaine selon la phase ; re-test en fin de cycle.", "3–5 sessions a week depending on the phase; retest at the end of the cycle.") },
    ],
    preparation: loc("Historique de séances, objectifs clairs, disponibilité hebdomadaire et test de départ.", "Session history, clear goals, weekly availability and a baseline test."),
    steps: [
      loc("Choisis l'objectif et les qualités qui te limitent.", "Choose the goal and the qualities that limit you."),
      loc("Place les phases sur le calendrier, avec la semaine de repos et le re-test.", "Put the phases on the calendar, with the rest week and the retest."),
      loc("Chaque semaine, compare les séances faites au plan et ajuste.", "Each week, compare sessions done with the plan and adjust."),
    ],
    progression: [
      loc("Après la semaine de repos, repartir en phase 2 (force) ou ajuster selon le re-test.", "After the rest week, restart at phase 2 (strength) or adjust from the retest."),
      loc("Cycles plus courts (3-2-1) pour les grimpeurs avancés.", "Shorter cycles (3-2-1) for advanced climbers."),
      loc("Augmenter la charge hebdomadaire progressivement d'un cycle à l'autre.", "Raise weekly load gradually from one cycle to the next."),
    ],
    mistakes: [
      loc("Tout travailler en même temps toute l'année.", "Training everything at once all year round."),
      loc("Supprimer les semaines de récupération.", "Dropping recovery weeks."),
      loc("Ne jamais re-tester.", "Never retesting."),
    ],
    safety: [
      loc("Pas de saut brutal de volume d'une semaine à l'autre.", "No sudden jump in volume from one week to the next."),
      loc("Alléger dès que sommeil, douleurs ou motivation se dégradent.", "Ease off as soon as sleep, pain or motivation deteriorate."),
    ],
    variants: [
      loc("Périodisation linéaire : blocs successifs.", "Linear periodisation: successive blocks."),
      loc("Ondulatoire : intensités variées dans la semaine (approche non linéaire).", "Undulating: varied intensities within the week (non-linear approach)."),
      loc("Plans d'application avec ratio 3:1 ou 2:1 entre semaines de charge et de récupération.", "App plans with a 3:1 or 2:1 ratio of loading to recovery weeks."),
    ],
    observe: loc("Assiduité, récupération, qualité en grimpe et tests reproductibles en fin de cycle.", "Adherence, recovery, climbing quality and repeatable end-of-cycle tests."),
    evidenceNote: loc(
      "Faible à modéré. Hors escalade, une méta-analyse de 35 études montre un petit avantage de la périodisation pour la force maximale (effet 0,31), sans différence pour l'hypertrophie ; aucune étude ne compare directement des plans périodisés en escalade.",
      "Low to moderate. Outside climbing, a meta-analysis of 35 studies shows a small advantage of periodisation for maximal strength (effect 0.31) and none for hypertrophy; no study directly compares periodised plans in climbing.",
    ),
    sources: [SRC.moesgaard2022, SRC.trainingBetaPeriodization, SRC.latticeStructure],
    diagram: {
      kind: "phases",
      phases: [
        { weeks: 4, label: loc("Technique & endurance", "Technique & endurance"), volume: 4, intensity: 2 },
        { weeks: 3, label: loc("Force & puissance", "Strength & power"), volume: 2, intensity: 5 },
        { weeks: 2, label: loc("Résistance", "Power endurance"), volume: 3, intensity: 4 },
        { weeks: 1, label: loc("Repos", "Rest"), volume: 1, intensity: 1 },
      ],
    },
  },
};
