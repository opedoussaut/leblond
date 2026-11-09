import type { AtlasDetail } from "@/lib/training/atlas-types";
import type { Localized } from "@/lib/training/catalogue";
import { SRC } from "./sources";

/**
 * Atlas content for TOOLS. A tool is not a method: each entry says what it is
 * for, how to set it up so measurements stay comparable, and which methods use it.
 */
const loc = (fr: string, en: string): Localized => ({ fr, en });

export const TOOL_DETAILS: Record<string, AtlasDetail> = {
  "hangboard": {
    summary: loc(
      "Une planche de prises (réglettes de différentes profondeurs, trous, plats) fixée au-dessus d'une porte ou au mur. Elle permet de charger les doigts de façon précise, mesurable et reproductible. Ce n'est pas une méthode : c'est le support des suspensions lourdes, des repeaters et des tests de force.",
      "A board of holds (edges of different depths, pockets, slopers) mounted above a door or on a wall. It loads the fingers in a precise, measurable and repeatable way. It is not a method: it is where max hangs, repeaters and strength tests happen.",
    ),
    trains: loc(
      "Selon le protocole : force maximale des doigts (suspensions courtes et lourdes) ou endurance de force (suspensions intermittentes).",
      "Depends on the protocol: maximal finger strength (short, heavy hangs) or strength endurance (intermittent hangs).",
    ),
    suits: loc(
      "Grimpeurs intermédiaires et confirmés qui veulent un travail de doigts dosé, ou qui s'entraînent à la maison.",
      "Intermediate and advanced climbers who want dosed finger training, or who train at home.",
    ),
    level: loc("Selon protocole et expérience", "Based on protocol and experience"),
    prerequisites: [
      loc("Niveau : ≥ 1–2 ans de grimpe régulière avant un travail lourd ; avant, pieds au sol ou poulie d'assistance.", "Level: ≥ 1–2 years of regular climbing before heavy work; before that, feet on the floor or an assist pulley."),
      loc("Âge : pas de suspensions lestées avant la fin de la croissance.", "Age: no weighted hangs before growth has finished."),
      loc("Blessures : aucune douleur de doigt ; après une blessure de poulie, reprise encadrée.", "Injuries: no finger pain; after a pulley injury, a supervised return."),
    ],
    protocol: [
      { key: "format", value: loc("Support de suspensions : réglettes de 6 à 30 mm, trous, plats.", "A hanging surface: edges from 6 to 30 mm, pockets, slopers.") },
      { key: "intensity", value: loc("Fixée par le protocole : voir Suspensions lourdes et Repeaters.", "Set by the protocol: see Max hangs and Repeaters.") },
      { key: "frequency", value: loc("2 séances de doigts par semaine au plus pour la plupart des grimpeurs.", "At most 2 finger sessions a week for most climbers.") },
      { key: "equipment", value: loc("Fixation solide, poulie et lest ou élastique, chronomètre.", "Solid mounting, pulley and weights or a band, a timer.") },
      { key: "cost", value: loc("Achat unique, de quelques dizaines à quelques centaines d'euros.", "One-off purchase, from tens to a few hundred euros.") },
    ],
    preparation: loc("Poutre bien fixée, réglette choisie et notée, échauffement des doigts, carnet ou application pour noter.", "A well-mounted board, a chosen and logged edge, a finger warm-up, a notebook or app to log."),
    steps: [
      loc("Choisis un protocole (suspensions lourdes ou repeaters) et une réglette que tu garderas.", "Choose a protocol (max hangs or repeaters) and an edge you will keep."),
      loc("Fais des suspensions contrôlées, épaules engagées, sans à-coup.", "Do controlled hangs, shoulders engaged, no jerking."),
      loc("Note réglette, prise, charge et durée à chaque séance.", "Log edge, grip, load and duration every session."),
    ],
    progression: [
      loc("Ajouter de la charge, ou réduire la réglette, une variable à la fois.", "Add load or reduce the edge, one variable at a time."),
      loc("Passer de deux mains assistées à deux mains, puis lestées.", "Move from assisted two-hand hangs to two-hand, then weighted."),
    ],
    mistakes: [
      loc("Changer de réglette d'une séance à l'autre : impossible de comparer.", "Changing edge between sessions: nothing is comparable."),
      loc("Arqué avec le pouce verrouillé.", "Full crimp with the thumb locked."),
      loc("Poutre fixée sur un support fragile.", "A board mounted on a weak support."),
    ],
    safety: [
      loc("Vérifier la fixation avant chaque séance.", "Check the mounting before each session."),
      loc("Échauffement progressif des doigts.", "Progressive finger warm-up."),
      loc("Stop immédiat à la moindre douleur localisée.", "Stop at once at any localised pain."),
    ],
    variants: [
      loc("Poutre portable (blocs suspendus à une corde) pour les déplacements.", "Portable block hung from a cord for travel."),
      loc("Tirage au sol avec capteur, sans se suspendre (voir Capteur de force).", "Floor pulls with a sensor, without hanging (see Force sensor)."),
    ],
    observe: loc("Charge, durée, réglette, prise et confort des tissus.", "Load, time, edge, grip and tissue comfort."),
    evidenceNote: loc(
      "Modéré pour l'outil, via les protocoles testés : plusieurs essais randomisés d'entraînement sur poutre montrent des gains de force ou d'endurance des doigts. Les profondeurs de réglette diffèrent d'une étude à l'autre (8 à 23 mm), d'où l'importance de garder la même.",
      "Moderate for the tool, through the protocols tested: several randomised hangboard trials show finger-strength or endurance gains. Edge depths differ between studies (8–23 mm), which is why keeping the same edge matters.",
    ),
    sources: [SRC.hermans2022, SRC.medernach2015, SRC.lopez2022edges, SRC.devise2022, SRC.perezCordero2025, SRC.horstProtocols],
    diagram: {
      kind: "edges",
      edges: [
        { mm: 8, note: loc("test le plus fiable", "most reliable test") },
        { mm: 10, note: loc("test pour 6b–7c", "test for 6b–7c") },
        { mm: 12, note: loc("étude Devise 2022", "Devise 2022 study") },
        { mm: 18, note: loc("MaxHangs lestées", "weighted MaxHangs") },
        { mm: 20, note: loc("test force critique", "critical-force test") },
        { mm: 23, note: loc("étude Hermans 2022", "Hermans 2022 study") },
      ],
    },
  },

  "training-board": {
    summary: loc(
      "Un pan incliné aux prises fixes (MoonBoard, Kilter, Tension…) ou un « spray wall » couvert de prises. Les mouvements sont reproductibles d'une séance à l'autre et souvent partagés dans une application, ce qui permet de mesurer ses progrès sur les mêmes blocs. L'angle du pan modifie fortement la difficulté et le style.",
      "A fixed-hold inclined board (MoonBoard, Kilter, Tension…) or a spray wall covered in holds. Moves are repeatable from one session to the next and often shared in an app, so progress can be measured on the same problems. The board angle strongly changes difficulty and style.",
    ),
    trains: loc(
      "Force et puissance spécifiques, coordination, gainage ; sert de support au bloc à la limite et aux circuits de résistance.",
      "Specific strength and power, coordination, body tension; the setting for limit bouldering and power-endurance circuits.",
    ),
    suits: loc(
      "Bloqueurs intermédiaires à confirmés ; débutants possibles sur un pan peu incliné aux grosses prises.",
      "Intermediate to advanced boulderers; beginners can use a shallow board with big holds.",
    ),
    level: loc("Tous niveaux selon difficulté", "All levels with matched difficulty"),
    prerequisites: [
      loc("Niveau : les pans standard à 40° demandent une bonne base de force ; commencer à 25° ou moins.", "Level: standard 40° boards demand a solid strength base; start at 25° or less."),
      loc("Âge : adapté aux jeunes avec des blocs faciles et des réceptions sûres.", "Age: suitable for young climbers with easy problems and safe landings."),
      loc("Blessures : les petites prises et les dévers chargent doigts et épaules.", "Injuries: small holds and steep angles load fingers and shoulders."),
    ],
    protocol: [
      { key: "format", value: loc("Pan à prises fixes et blocs partagés, ou spray wall libre.", "Fixed-hold board with shared problems, or a free spray wall.") },
      { key: "intensity", value: loc("Selon la méthode : bloc à la limite, 4×4, technique.", "Depends on the method: limit bouldering, 4×4, technique.") },
      { key: "session", value: loc("45–90 min, avec des repos de 2–5 min entre essais durs.", "45–90 min, with 2–5 min rest between hard attempts.") },
      { key: "frequency", value: loc("1 à 3 fois par semaine selon l'intensité.", "1–3 times a week depending on intensity.") },
      { key: "equipment", value: loc("Pan réglé à un angle connu (souvent 25° ou 40°), tapis épais, application.", "A board set at a known angle (often 25° or 40°), thick pads, the app.") },
    ],
    preparation: loc("Angle connu, tapis bien placés, échauffement sur blocs faciles du pan.", "A known angle, well-placed pads, warm-up on easy board problems."),
    steps: [
      loc("Choisis ou crée quelques blocs reproductibles adaptés à l'objectif.", "Choose or set a few repeatable problems matching the goal."),
      loc("Répète-les avec qualité et un repos suffisant.", "Repeat them with quality and enough rest."),
      loc("Note le bloc, l'angle, la réussite et les solutions trouvées.", "Log the problem, angle, success and the solutions found."),
    ],
    progression: [
      loc("Monter en difficulté sur le même angle avant de changer d'angle.", "Raise difficulty at the same angle before changing angle."),
      loc("Utiliser les blocs « benchmark » comme repères stables.", "Use benchmark problems as stable reference points."),
    ],
    mistakes: [
      loc("Passer toute la séance sur des blocs trop durs.", "Spending the whole session on problems that are too hard."),
      loc("Comparer des blocs réalisés à des angles différents.", "Comparing problems climbed at different angles."),
      loc("Chuter en arrière depuis le haut du pan.", "Falling backwards from the top of the board."),
    ],
    safety: [
      loc("Tapis épais sur toute la zone de chute.", "Thick pads across the whole fall zone."),
      loc("Désescalader ou sauter contrôlé ; éviter les chutes sur le dos.", "Downclimb or drop under control; avoid falling onto your back."),
    ],
    variants: [
      loc("Spray wall : liberté totale de création.", "Spray wall: complete freedom to set."),
      loc("Circuits longs sur pan pour la résistance.", "Long board circuits for power endurance."),
    ],
    observe: loc("Blocs réussis par angle, qualité des solutions et vitesse de progression.", "Problems sent per angle, quality of solutions and rate of progress."),
    evidenceNote: loc(
      "Pratique. Outil très utilisé par les coachs ; aucune étude contrôlée ne mesure son effet propre, qui dépend de la méthode pratiquée dessus.",
      "Practice-based. Widely used by coaches; no controlled study measures its own effect, which depends on the method practised on it.",
    ),
    sources: [SRC.moonboardUse, SRC.horstLimit, SRC.stien2023],
    diagram: {
      kind: "angles",
      angles: [
        { deg: 0, note: loc("mur vertical, référence", "vertical wall, reference") },
        { deg: 25, note: loc("MoonBoard, plus accessible", "MoonBoard, more accessible") },
        { deg: 40, note: loc("MoonBoard standard, plus physique", "standard MoonBoard, more physical") },
      ],
    },
  },

  "force-sensor": {
    summary: loc(
      "Un capteur (dynamomètre) placé entre une réglette et un baudrier ou une charge, relié à une application. Il mesure la force de traction des doigts en kilos, ce qui permet des tests reproductibles (force maximale, force critique) et le réglage précis des charges. Il ne constitue pas un entraînement en soi.",
      "A sensor (load cell) placed between an edge and a harness or load, connected to an app. It measures finger-pulling force in kilograms, enabling repeatable tests (maximal force, critical force) and precise load setting. It does not train anything by itself.",
    ),
    trains: loc(
      "Rien directement : c'est un outil de mesure. Il sert à doser la force maximale et l'endurance des doigts.",
      "Nothing directly: it is a measuring tool. It helps dose finger strength and endurance work.",
    ),
    suits: loc(
      "Grimpeurs qui suivent un entraînement structuré des doigts et veulent des tests comparables ; coachs.",
      "Climbers following structured finger training who want comparable tests; coaches.",
    ),
    level: loc("Selon protocole", "By protocol"),
    prerequisites: [
      loc("Savoir faire un effort maximal des doigts en sécurité (expérience de la poutre).", "Able to produce a safe maximal finger effort (fingerboard experience)."),
      loc("Âge : tests maximaux déconseillés pendant la croissance.", "Age: maximal tests not advised during growth."),
      loc("Blessures : pas de test maximal avec une douleur de doigt.", "Injuries: no maximal test with finger pain."),
    ],
    protocol: [
      { key: "format", value: loc("Test de force critique « tout-donné » de 4 min : 24 tractions de 7 s, 3 s de pause.", "4-min all-out critical-force test: 24 pulls of 7 s, 3 s rest.") },
      { key: "intensity", value: loc("Maximale à chaque traction ; la force chute puis se stabilise.", "Maximal on every pull; force drops, then levels off.") },
      { key: "duration", value: loc("4 min de test (24 × 10 s, dernière pause non comptée) + échauffement.", "4 min of testing (24 × 10 s, last pause not counted) + warm-up.") },
      { key: "frequency", value: loc("Re-test toutes les 4 à 8 semaines, dans les mêmes conditions.", "Retest every 4–8 weeks under the same conditions.") },
      { key: "equipment", value: loc("Capteur, réglette de 20 mm, ancrage fixe, application.", "Sensor, 20 mm edge, fixed anchor, app.") },
      { key: "cost", value: loc("Achat unique (environ 100–300 €) ; vérifier la fiabilité du modèle.", "One-off purchase (about €100–300); check the model's reliability.") },
    ],
    preparation: loc("Ancrage stable, même réglette (20 mm) et même position à chaque test, échauffement des doigts.", "A stable anchor, the same edge (20 mm) and position every test, a finger warm-up."),
    steps: [
      loc("Échauffe-toi jusqu'à quelques tractions proches du maximum.", "Warm up to a few near-maximal pulls."),
      loc("Fais 24 tractions maximales de 7 s avec 3 s de pause, sans retenir l'effort.", "Do 24 maximal 7-s pulls with 3-s rests, without holding back."),
      loc("Note le pic de force et la force moyenne des 3 dernières tractions.", "Log peak force and the mean force of the last 3 pulls."),
    ],
    progression: [
      loc("Comparer des tests faits dans les mêmes conditions (heure, fatigue, réglette).", "Compare tests done under the same conditions (time, fatigue, edge)."),
      loc("Utiliser la force critique pour régler des intensités d'endurance, avec prudence.", "Use critical force to set endurance intensities, with caution."),
    ],
    mistakes: [
      loc("Changer d'ancrage ou de réglette entre deux tests.", "Changing anchor or edge between tests."),
      loc("Retenir l'effort au début pour « tenir » la fin.", "Holding back early to “last” to the end."),
      loc("Prendre la force de fin de test pour une valeur exacte : elle varie d'environ 20 % d'un test à l'autre.", "Treating end-test force as exact: it varies by about 20% between tests."),
    ],
    safety: [
      loc("Vérifier l'ancrage avant chaque test.", "Check the anchor before every test."),
      loc("Arrêter le test en cas de douleur.", "Stop the test if it hurts."),
    ],
    variants: [
      loc("Test de force maximale : 2–3 tractions de 5 s, 2–3 min de repos.", "Maximal force test: 2–3 pulls of 5 s, 2–3 min rest."),
      loc("Suivi de charge pendant les suspensions.", "Load monitoring during hangs."),
    ],
    observe: loc("Pic de force, force critique, cohérence des mesures et tendance.", "Peak force, critical force, measurement consistency and trend."),
    evidenceNote: loc(
      "Modéré pour la mesure. Les tests de force maximale des doigts sont très fidèles ; la force critique explique une grande part du niveau en voie, mais la valeur de fin de test est moins reproductible et peut surestimer l'intensité réellement tenable.",
      "Moderate for measurement. Maximal finger-strength tests are highly reliable; critical force explains a large share of sport grade, but end-test force is less repeatable and can overestimate the truly sustainable intensity.",
    ),
    sources: [SRC.giles2021, SRC.mcclean2023, SRC.balas2024, SRC.perezCordero2025, SRC.tindeqProgressor, SRC.latticePortableVideo],
    diagram: { kind: "forceTest", reps: 24, on: 7, off: 3, edgeMm: 20, lastN: 3 },
  },

  "video-tool": {
    summary: loc(
      "Filmer ses essais, puis les revoir seul, avec un partenaire ou un coach, pour repérer une erreur observable (pied replacé, hanche loin du mur, pause) et la corriger à l'essai suivant. La vidéo remplace l'impression par des faits, à condition de filmer toujours de la même façon.",
      "Film your attempts, then review them alone, with a partner or a coach, to spot an observable error (a re-placed foot, hips away from the wall, a pause) and fix it on the next attempt. Video replaces impressions with facts, as long as you always film the same way.",
    ),
    trains: loc(
      "Indirectement la technique : la vidéo sert de retour d'information pour l'apprentissage gestuel.",
      "Technique, indirectly: video is feedback for motor learning.",
    ),
    suits: loc(
      "Tous niveaux ; particulièrement utile en technique, sur un projet ou pour un coaching à distance.",
      "All levels; especially useful for technique, on a project or for remote coaching.",
    ),
    level: loc("Tous niveaux", "All levels"),
    prerequisites: [
      loc("Accord des personnes filmées ; respecter les règles de la salle.", "Consent from the people filmed; follow the gym's rules."),
      loc("Âge : accord des parents pour filmer des mineurs.", "Age: parental consent to film minors."),
      loc("Aucune contre-indication liée aux blessures.", "No injury-related contraindication."),
    ],
    protocol: [
      { key: "format", value: loc("Téléphone sur trépied, cadrage fixe.", "A phone on a tripod, a fixed frame.") },
      { key: "session", value: loc("Revoir chaque essai juste après, pendant le repos.", "Review each attempt right after, during the rest.") },
      { key: "frequency", value: loc("Sur les séances de technique et les projets.", "During technique sessions and on projects.") },
      { key: "equipment", value: loc("Téléphone, petit trépied ; ralenti utile.", "Phone, small tripod; slow motion helps.") },
      { key: "cost", value: loc("Aucun coût supplémentaire avec un téléphone.", "No extra cost with a phone.") },
    ],
    preparation: loc("Caméra fixe, autorisation de filmer, bon éclairage et angle utile.", "A fixed camera, permission to film, good light and a useful angle."),
    steps: [
      loc("Place la caméra comme sur le schéma : tout le corps et les pieds dans le cadre, face au mur.", "Place the camera as in the diagram: whole body and feet in frame, square to the wall."),
      loc("Filme des essais comparables, au même endroit à chaque fois.", "Film comparable attempts, from the same spot every time."),
      loc("Repère une seule correction et vérifie-la sur l'essai suivant.", "Pick a single correction and check it on the next attempt."),
    ],
    progression: [
      loc("Comparer côte à côte avec un grimpeur plus expérimenté sur le même bloc.", "Compare side by side with a more experienced climber on the same problem."),
      loc("Revoir à quelques semaines d'écart pour mesurer les changements.", "Review a few weeks apart to measure change."),
    ],
    mistakes: [
      loc("Cadrage trop serré : les pieds sortent de l'image.", "Framing too tight: the feet leave the image."),
      loc("Filmer de biais ou d'en bas : les distances sont déformées.", "Filming at an angle or from below: distances are distorted."),
      loc("Vouloir corriger dix choses à la fois.", "Trying to fix ten things at once."),
    ],
    safety: [
      loc("Ne pas placer le trépied dans la zone de chute.", "Never put the tripod in the fall zone."),
      loc("Ne pas filmer les autres sans leur accord.", "Do not film others without their consent."),
    ],
    variants: [
      loc("Vidéo en différé (retard de quelques secondes) sur tablette.", "Delayed video (a few seconds' lag) on a tablet."),
      loc("Annotations dans une application d'analyse.", "Annotations in an analysis app."),
    ],
    observe: loc("Pieds, hanches, trajectoire, reprises et rythme.", "Feet, hips, path, readjustments and pace."),
    evidenceNote: loc(
      "Faible à modéré. Une étude à cas unique montre qu'un modèle vidéo d'expert et un retour vidéo améliorent la précision gestuelle de débutants ; les études d'experts montrent quels indicateurs observer (pauses, exploration).",
      "Low to moderate. A single-case study shows expert video modelling and video feedback improve novices' movement accuracy; expert studies show which markers to watch (pauses, exploration).",
    ),
    sources: [SRC.walker2020, SRC.seifert2017, SRC.latticeVideo],
    diagram: {
      kind: "camera",
      notes: [
        loc("Tout le corps et les pieds dans le cadre.", "Whole body and feet in frame."),
        loc("Objectif face au mur, à angle droit.", "Lens square to the wall."),
        loc("Même position de caméra à chaque essai.", "Same camera spot every attempt."),
        loc("Une seule correction par essai.", "One correction per attempt."),
      ],
    },
  },
};
