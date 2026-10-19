import type { Localized, TrainingEntry } from "@/lib/training/catalogue";

/**
 * ATLAS DIMENSIONS ARE EDITORIAL EMPHASIS INDICES (0–5).
 * They are not performance norms, research effect sizes or user assessments.
 * They never replace Lattice's observed tests or a qualified coach.
 */
export const ATLAS_AXES = [
  "footwork","reading","fingerForce","pulling","contactPower","aerobic",
  "powerEndurance","mobility","mental","recovery","planning","measurement"
] as const;
export type AtlasAxis = typeof ATLAS_AXES[number];
export type AtlasScores = readonly [number,number,number,number,number,number,number,number,number,number,number,number];
export const ATLAS_LABELS: Record<AtlasAxis, Localized> = {
  footwork:{fr:"Pieds",en:"Footwork"},
  reading:{fr:"Lecture",en:"Reading"},
  fingerForce:{fr:"Force doigts",en:"Finger force"},
  pulling:{fr:"Traction",en:"Pulling"},
  contactPower:{fr:"Explosivité",en:"Explosiveness"},
  aerobic:{fr:"Aérobie",en:"Aerobic"},
  powerEndurance:{fr:"Résistance",en:"Power endurance"},
  mobility:{fr:"Mobilité",en:"Mobility"},
  mental:{fr:"Mental",en:"Mental"},
  recovery:{fr:"Récupération",en:"Recovery"},
  planning:{fr:"Planification",en:"Planning"},
  measurement:{fr:"Évaluation",en:"Measurement"},
};
export const ATLAS_SCORES: Readonly<Record<string,AtlasScores>> = {
  "technique":[5,5,1,1,2,2,2,3,3,2,2,4],
  "constraints":[5,5,1,2,3,2,2,4,3,2,2,3],
  "limit-bouldering":[3,4,3,4,5,1,2,2,3,3,2,3],
  "max-hangs":[0,0,5,2,1,0,1,0,0,4,3,5],
  "repeaters":[0,0,4,1,1,2,5,0,0,3,3,4],
  "easy-volume":[4,3,1,1,1,5,3,2,2,3,2,2],
  "four-by-four":[2,3,2,2,3,2,5,1,3,3,3,3],
  "campus":[1,2,4,4,5,0,1,2,2,5,3,3],
  "strength-conditioning":[1,1,3,5,3,1,2,4,1,4,4,3],
  "mental":[2,5,0,0,1,1,2,1,5,3,3,4],
  "periodized":[4,4,4,4,4,4,4,4,4,5,5,5],
  "lattice":[3,3,5,4,4,4,4,4,3,5,5,5],
  "power-company":[5,5,4,4,4,4,4,3,5,4,5,4],
  "crimpd":[3,2,5,4,4,5,5,2,2,4,5,4],
  "hoopers":[4,4,4,4,3,2,2,4,3,4,4,4],
  "hangboard":[0,0,5,2,1,1,4,0,0,3,2,5],
  "training-board":[4,4,3,4,5,2,2,3,3,3,2,3],
  "force-sensor":[0,0,5,0,0,0,1,0,0,1,3,5],
  "video-tool":[5,5,0,0,2,0,1,2,4,1,3,5],
};
export type AtlasDetail = {
  summary: Localized;
  preparation: Localized;
  steps: readonly Localized[];
  observe: Localized;
  drawing: "wall"|"hang"|"cycle"|"profile";
  video?: {url:string;title:Localized};
  reference?: {url:string;title:Localized};
  level: Localized;
};
const loc=(fr:string,en:string):Localized=>({fr,en});
const details: Record<string,AtlasDetail> = {
  "technique":{
    summary:loc("Apprendre à résoudre les mouvements avec économie : regard, centre de gravité, appuis précis, utilisation des hanches. La vidéo fournit un retour concret sur les gestes plutôt qu'une simple sensation.","Build efficient movement through visual attention, centre of mass, precise feet and hip positioning. Video provides observable feedback instead of impressions."),
    preparation:loc("Un mur peu difficile, des prises variées, un partenaire ou un téléphone fixe pour filmer.","An easy wall, varied holds, a partner or stable camera."),
    steps:[loc("Choisir un passage confortable et annoncer un point technique (pieds silencieux, hanches proches, équilibre).","Choose a comfortable climb and one focus (quiet feet, hip position, balance)."),loc("Grimper lentement puis revoir la séquence ; repérer une seule correction.","Climb slowly and review the sequence; identify one specific improvement."),loc("Rejouer le passage et comparer le mouvement plutôt que la seule réussite.","Repeat and compare movement quality, not only whether you reached the top.")],
    observe:loc("Précision des pieds, mouvements parasites, nombre de repositionnements et ressenti.","Foot accuracy, unnecessary adjustments, number of resets and perceived control."),
    drawing:"wall",level:loc("Tous niveaux","All levels"),
    video:{url:"https://www.youtube.com/watch?v=lgy1s9cWA00",title:loc("Lattice — 3 astuces de technique de grimpe (vidéo)","Lattice — 3 climbing movement tips (video)")},
    reference:{url:"https://latticetraining.com/blog/3-simple-hacks-to-crimp-harder",title:loc("Article Lattice et vidéo associée","Lattice article and linked video")},
  },
  "constraints":{
    summary:loc("Changer volontairement les contraintes d'une tâche : pieds imposés, mains lentes, interdiction de reprendre une prise, afin d'explorer plusieurs solutions de déplacement.","Deliberately vary task constraints—specified feet, slow hands, no regrips—to encourage exploration of different movement solutions."),
    preparation:loc("Blocs faciles, espace pour répéter sans fatigue maximale.","Easy problems with enough room for practice."),
    steps:[loc("Choisir un problème et une contrainte simple.","Choose a climb and one simple constraint."),loc("Tester 2 ou 3 stratégies et décrire les différences.","Try two or three strategies and discuss the differences."),loc("Supprimer la contrainte et voir si le mouvement appris se transfère.","Remove the constraint and see whether the learning transfers.")],
    observe:loc("Diversité des solutions et qualité de placement, pas uniquement la vitesse.","Variation in solutions and movement quality, not just speed."),drawing:"wall",level:loc("Tous niveaux","All levels")
  },
  "limit-bouldering":{
    summary:loc("Travailler un petit nombre de mouvements au voisinage de la difficulté maximale, avec repos long et tentatives de bonne qualité.","Work a few moves near your current limit with substantial rest and high-quality attempts."),
    preparation:loc("Échauffement progressif ; choisir des mouvements difficiles mais contrôlables, avec réception adaptée.","Progressive warm-up; choose hard but controllable moves with appropriate landing."),
    steps:[loc("Isoler un mouvement et identifier sa difficulté.","Isolate a move and understand its difficulty."),loc("Faire peu d'essais précis avec repos suffisant.","Make a small number of precise attempts with sufficient rest."),loc("Arrêter lorsque la coordination ou la qualité chute.","Stop when coordination or movement quality drops.")],
    observe:loc("Mouvement réussi, coordination, qualité des tentatives et récupération.","Completed move, coordination, attempt quality and recovery."),drawing:"wall",level:loc("Intermédiaire et confirmé","Intermediate to advanced")
  },
  "max-hangs":{
    summary:loc("Développer la force isométrique des doigts par des suspensions contrôlées. Le protocole doit être individualisé à partir d'un niveau de référence reproductible.","Build maximal isometric finger force with controlled hangs. Set loads using a reproducible baseline rather than copying someone else's prescription."),
    preparation:loc("Poutre stable, réglette constante, échauffement des doigts, charge adaptée, absence de douleur.","Stable board, repeatable edge, finger warm-up, appropriate load, no pain."),
    steps:[loc("Évaluer sa capacité sur la même réglette et la même prise de main.","Benchmark on a consistent edge and grip position."),loc("Réaliser des suspensions courtes à charge élevée mais contrôlée avec repos complet.","Use controlled short high-intensity hangs with complete recovery."),loc("Noter charge, durée, prise et ressenti pour un retest cohérent.","Log load, duration, grip and perceived effort for consistent retesting.")],
    observe:loc("Charge supportée, temps, taille de prise et confort des tissus.","Load, hang time, edge size and tissue comfort."),drawing:"hang",level:loc("Intermédiaire/confirmé ; adaptation pour débutants accompagnés","Intermediate/advanced; scale down for new climbers"),
    reference:{url:"https://latticetraining.com/blog/how-to-manage-finger-strength-for-climbers",title:loc("Lattice — mesurer et gérer la force des doigts","Lattice — managing finger strength")}
  },
  "repeaters":{
    summary:loc("Répéter des contractions courtes séparées de récupérations brèves pour travailler la capacité à maintenir la force des doigts au fil des efforts.","Repeat short contractions separated by brief pauses to train repeatable gripping capacity."),
    preparation:loc("Poutre avec assistance possible, chronomètre et intensité modérée.","Fingerboard with scalable assistance and a timer."),
    steps:[loc("Échauffer et choisir une réglette reproductible.","Warm up and choose a consistent edge."),loc("Alterner périodes de suspension et repos court à une intensité sous-maximale.","Alternate controlled hangs and short rests at submaximal load."),loc("Noter la réussite de chaque répétition et la dégradation éventuelle.","Record completed reps and loss of form.")],
    observe:loc("Nombre de répétitions de qualité, récupération, gêne ressentie.","Quality repetitions, recovery and discomfort."),drawing:"cycle",level:loc("Avec charge et volume adaptés","With appropriate loading and volume"),
    reference:{url:"https://latticetraining.com/blog/how-to-manage-finger-strength-for-climbers",title:loc("Lattice — repeaters et protocoles","Lattice — repeater protocols")}
  },
  "easy-volume":{
    summary:loc("Volume de grimpe facile et continu pour travailler aisance gestuelle et endurance de base sans épuisement.","Sustained comfortable climbing to improve movement economy and basic endurance without maximal fatigue."),
    preparation:loc("Mur ou traversée simple, faible intensité, temps disponible.","Easy wall or traverse, low intensity, enough time."),
    steps:[loc("Choisir une difficulté permettant de parler normalement.","Choose a difficulty at which you can still speak."),loc("Grimper de manière régulière, en restant relâché.","Climb steadily with relaxed movement."),loc("Augmenter progressivement la durée, pas la douleur ou le pompage maximal.","Build duration gradually, not maximal pump or pain.")],
    observe:loc("Temps de grimpe confortable, continuité et qualité de déplacement.","Comfortable continuous duration and movement quality."),drawing:"cycle",level:loc("Tous niveaux","All levels")
  },
  "four-by-four":{
    summary:loc("Enchaîner plusieurs blocs modérés en série avec récupérations contrôlées pour travailler la résistance et le maintien de qualité sous fatigue.","Perform multiple moderate problems in controlled sets to work power-endurance and movement under fatigue."),
    preparation:loc("Blocs bien maîtrisés, repos planifié, tapis dégagés.","Familiar moderate problems, planned rest, clear landing zones."),
    steps:[loc("Sélectionner plusieurs blocs réalisables à répétition.","Select several repeatable problems."),loc("Les enchaîner en série, récupérer, puis répéter selon ta tolérance.","Climb them in a sequence, recover, then repeat within capacity."),loc("Arrêter si la technique ou les atterrissages deviennent dangereux.","Stop if movement or landings become unsafe.")],
    observe:loc("Séries terminées, repos, baisse de performance.","Completed sets, rest intervals and performance drop-off."),drawing:"cycle",level:loc("Intermédiaire à confirmé","Intermediate to advanced")
  },
  "campus":{
    summary:loc("Travail très spécifique de coordination explosive et de contact sur un pan de campus, à forte contrainte pour les doigts et épaules.","Highly specific explosive contact and coordination work on a campus board; substantial finger and shoulder loading."),
    preparation:loc("Expérience solide, épaules et doigts échauffés, prise de charge progressive.","Strong training base, warmed-up shoulders and fingers, careful progression."),
    steps:[loc("Choisir des mouvements limités et maîtrisés.","Choose a limited set of controlled movements."),loc("Prioriser la qualité et des repos très complets.","Prioritize movement quality and long rest."),loc("Arrêter avant la fatigue technique ou la douleur.","Stop before technique degrades or any pain.")],
    observe:loc("Précision du contact, qualité et absence de douleur.","Contact precision, movement quality and pain-free execution."),drawing:"hang",level:loc("Confirmé seulement","Advanced only")
  },
  "strength-conditioning":{
    summary:loc("Préparation physique générale au service de l'escalade : tirage, poussée, jambes, tronc, mobilité et tolérance à la charge.","General strength supporting climbing: pull, push, lower body, trunk and capacity to tolerate work."),
    preparation:loc("Matériel adapté et mouvements que tu contrôles correctement.","Appropriate equipment and technically controlled exercises."),
    steps:[loc("Identifier une ou deux qualités prioritaires sans doubler la fatigue de grimpe.","Choose one or two priorities without duplicating climbing fatigue."),loc("Répéter des mouvements mesurables, avec progression mesurée.","Use repeatable, measurable movements with gradual progression."),loc("Évaluer les conséquences sur la qualité en grimpe.","Assess transfer to climbing quality.")],
    observe:loc("Volume, charges, effort perçu et fatigue accumulée.","Volume, load, perceived effort and fatigue."),drawing:"profile",level:loc("Tous niveaux avec adaptation","All levels with modifications")
  },
  "mental":{
    summary:loc("Lecture, respiration, engagement, rythme et gestion prudente de l'appréhension, en particulier en voie.","Practice route reading, breathing, commitment, pacing and safe fear management, especially on routes."),
    preparation:loc("Assurage compétent, cadre contrôlé, objectifs progressifs.","Qualified belaying, safe environment and gradual goals."),
    steps:[loc("Identifier une situation spécifique et tolérable à travailler.","Identify one specific manageable challenge."),loc("Répéter une routine de lecture, respiration et décision.","Practice a consistent reading, breathing and decision routine."),loc("Noter la qualité des décisions et le confort, sans chute non maîtrisée.","Track decisions and confidence without uncontrolled falling.")],
    observe:loc("Confiance autoévaluée, rythme et décisions sous stress.","Self-rated confidence, pacing and choices under stress."),drawing:"wall",level:loc("Tous niveaux, avec encadrement en voie","All levels with appropriate belaying supervision")
  },
  "periodized":{
    summary:loc("Organiser sur plusieurs semaines les besoins, contraintes, qualités à travailler, récupération et réévaluations.","Organize needs, priorities, recovery and reassessment over several weeks."),
    preparation:loc("Historique de séances, objectifs clairs, disponibilité et test de départ.","Session history, goals, weekly availability and baseline."),
    steps:[loc("Choisir le ou les objectifs et les qualités limitantes.","Identify climbing objectives and limiting factors."),loc("Planifier un volume réaliste, les récupérations et les semaines de réévaluation.","Plan realistic volume, recovery and review weeks."),loc("Comparer les séances réellement faites au plan et ajuster.","Compare actual sessions against the plan and adapt.")],
    observe:loc("Assiduité, récupération, qualité en grimpe et tests cohérents.","Adherence, recovery, climbing quality and repeatable tests."),drawing:"cycle",level:loc("Tous niveaux","All levels"),
    reference:{url:"https://latticetraining.com/blog/how-to-structure-your-training",title:loc("Lattice — structurer sa semaine","Lattice — structuring a training week")}
  },
  "lattice":{
    summary:loc("Coaching basé sur un bilan de capacités, des comparaisons par rapport au niveau et un plan ajustable dans le temps. Les catégories officielles de tests comprennent force des doigts, endurance des avant-bras, force et mobilité.","Assessment-led coaching with capacity testing, grade-based comparisons and adaptable plans. Their official test profile covers finger strength, forearm endurance, strength and flexibility."),
    preparation:loc("Préparer les objectifs, l'historique, la disponibilité et un protocole de test adapté.","Have goals, history, availability and appropriate testing equipment ready."),
    steps:[loc("Tester dans des conditions standardisées, sans copier aveuglément les seuils d'autrui.","Test in standardized conditions; do not blindly copy other people's thresholds."),loc("Comparer avec les références de niveau en respectant leurs limites.","Compare against relevant grade benchmarks with their limits."),loc("Choisir des charges et revoir le plan après les bilans.","Use results to choose training and review the plan after retests.")],
    observe:loc("Tests mesurés, variation temporelle, récupération et performance en grimpe.","Actual test values, trends, recovery and climbing performance."),drawing:"profile",level:loc("Plusieurs niveaux — selon programme","Several levels depending on plan"),
    reference:{url:"https://www.latticetraining.com/docs/latticeplan-testing",title:loc("Lattice — détail officiel de leurs 4 domaines d'évaluation","Lattice — official four-area testing profile")}
  },
  "power-company":{
    summary:loc("Évaluation des mouvements et des capacités physiques, associant tactique, entraînement sur mur et mesures ciblées. Les références de performance restent des guides, pas des verdicts.","Movement and tactical coaching alongside physical testing. Their benchmarks are guides to needs, not standalone performance verdicts."),
    preparation:loc("Historique de grimpe, exercices mesurables et observation du mouvement.","Climbing history, repeatable physical tests and movement observation."),
    steps:[loc("Évaluer les caractéristiques techniques et les objectifs.","Assess technical skills and goals."),loc("Mesurer quelques indicateurs standardisés si adaptés (suspension, traction, repeaters).","Measure selected standardized tests when appropriate (hangs, pulls, repeaters)."),loc("Mettre en place puis réévaluer les priorités.","Choose training priorities, then reassess.")],
    observe:loc("Tests comparables dans le temps et réussite réelle des projets.","Repeatable tests and real climbing results."),drawing:"profile",level:loc("Intermédiaire à confirmé, avec adaptation","Intermediate to advanced with adaptation"),
    reference:{url:"https://www.powercompanyclimbing.com/blog/metrics-for-climbers",title:loc("Power Company — standards et limites des métriques","Power Company — metrics and their limitations")}
  },
  "crimpd":{
    summary:loc("Bibliothèque d'entraînements et organisation des séances orientées force, endurance et résistance. À ajuster selon le niveau et le volume de grimpe.","Workout library and structured strength/endurance sessions that must be adapted to climbing volume."),
    preparation:loc("Objectif de séance, capacités et équipement approprié.","Session objective, personal capacity and appropriate equipment."),
    steps:[loc("Choisir un exercice pertinent pour l'objectif et la fatigue actuelle.","Choose relevant work for your goal and current fatigue."),loc("Suivre une charge reproductible et noter ce qui a été effectué.","Use repeatable loads and log completion."),loc("Adapter la prochaine séance selon la récupération.","Adapt the next workout to recovery.")],
    observe:loc("Répétitions, temps, sensations et régularité.","Reps, duration, perceived effort and consistency."),drawing:"cycle",level:loc("Plusieurs niveaux selon exercice","Varies by workout")
  },
  "hoopers":{
    summary:loc("Ressources pédagogiques sur la technique, la préparation physique et la gestion de charge, avec outils d'analyse.","Education on movement, general preparation and load management with practical analysis tools."),
    preparation:loc("Identifier la technique ou le besoin à observer.","Identify the movement or capacity to review."),
    steps:[loc("Choisir une ressource adaptée au problème.","Choose a relevant resource."),loc("Tester en séance avec un objectif simple.","Try it in a session with one clear focus."),loc("Comparer la qualité du geste puis réévaluer.","Compare movement quality and reassess.")],
    observe:loc("Vidéo, ressenti, exécution et progression spécifique.","Video, self-report, execution and specific progress."),drawing:"wall",level:loc("Tous niveaux","All levels")
  },
  "hangboard":{
    summary:loc("Outil permettant des charges progressives, mesurables et spécifiques aux doigts ; la poutre seule n'est pas une méthode complète.","Device for graded, measurable finger loading; the board itself is not a complete coaching method."),
    preparation:loc("Poutre, méthode choisie, préparation physique et prise standardisée.","Hangboard, appropriate method and standardized hold."),
    steps:[loc("Choisir un protocole et une charge adaptée.","Choose an appropriate protocol and load."),loc("Réaliser et noter des suspensions contrôlées.","Perform and log controlled hangs."),loc("Comparer uniquement des tests réalisés dans des conditions semblables.","Compare like-for-like tests.")],
    observe:loc("Charge, durée, réglette et douleur éventuelle.","Load, time, edge and any discomfort."),drawing:"hang",level:loc("Selon protocole et expérience","Based on protocol and experience"),
    reference:{url:"https://latticetraining.com/blog/how-to-manage-finger-strength-for-climbers",title:loc("Lattice — principes pour la poutre","Lattice — fingerboard guidance")}
  },
  "training-board":{
    summary:loc("Mur de prises variées ou pan d'entraînement pour reproduire les mouvements, analyser la technique et progresser en difficulté.","Board/spray wall for repeatable movements, analyzing technique and progressing difficulty."),
    preparation:loc("Mur adapté au niveau et tapis corrects.","Appropriate wall and safe landing."),
    steps:[loc("Créer ou choisir quelques mouvements reproductibles.","Choose or create repeatable movements."),loc("Répéter avec qualité et repos suffisant.","Repeat with quality and enough rest."),loc("Noter la difficulté, les solutions et les progrès.","Log difficulty, movement solutions and progress.")],
    observe:loc("Mouvements réussis et qualité des solutions.","Completed moves and quality."),drawing:"wall",level:loc("Tous niveaux selon difficulté","All levels with matched difficulty")
  },
  "force-sensor":{
    summary:loc("Capteur donnant une valeur de force reproductible pour mesurer la réponse à l'entraînement. Il ne remplace pas un entraînement de grimpe.","Force sensor offers repeatable strength metrics; does not replace climbing practice."),
    preparation:loc("Capteur fiable, installation constante et protocole standardisé.","Reliable sensor, consistent setup and standard protocol."),
    steps:[loc("Mesurer une référence dans des conditions répétables.","Establish repeatable baseline conditions."),loc("Faire quelques essais standardisés sans douleur.","Perform standardized pain-free trials."),loc("Comparer dans le temps en notant la récupération et l'entraînement.","Compare trends while accounting for recovery and training.")],
    observe:loc("Force maximale, cohérence des mesures, évolution.","Peak force, measurement repeatability and trend."),drawing:"hang",level:loc("Selon protocole","By protocol"),
    video:{url:"https://www.youtube.com/watch?v=wAe5uMjVKfw",title:loc("Lattice — démonstration de la prise portable","Lattice — portable hangboard demonstration")}
  },
  "video-tool":{
    summary:loc("Capturer et comparer des séquences de mouvements pour identifier des erreurs techniques observables.","Capture and compare movement footage to identify observable technical changes."),
    preparation:loc("Caméra fixe, autorisation de filmer, éclairage et angle utile.","Stable camera, permission to film, useful lighting and angle."),
    steps:[loc("Filmer des tentatives dans des conditions comparables.","Record comparable attempts."),loc("Repérer une correction précise, pas dix.","Identify one actionable change, not ten."),loc("Tester et comparer la tentative suivante.","Repeat and compare the next attempt.")],
    observe:loc("Pieds, hanches, trajectoire, reprises, rythme.","Feet, hips, path, resets and pace."),drawing:"wall",level:loc("Tous niveaux","All levels"),
    video:{url:"https://www.youtube.com/watch?v=lgy1s9cWA00",title:loc("Lattice — astuces de placement","Lattice — placement tips")}
  },
};
export function atlasDetail(entry: TrainingEntry): AtlasDetail { return details[entry.id]; }
