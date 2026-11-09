import type { AtlasDetail } from "@/lib/training/atlas-types";
import type { Localized } from "@/lib/training/catalogue";
import { SRC } from "./sources";

/**
 * Atlas content for the coaching PROGRAMS. Facts come from each provider's own
 * public pages (checked November 2026) and are summarised, never copied.
 * Prices and plan names change: the page tells users to check the official site.
 */
const loc = (fr: string, en: string): Localized => ({ fr, en });

export const COACHING_DETAILS: Record<string, AtlasDetail> = {
  "lattice": {
    summary: loc(
      "Lattice Training (Royaume-Uni) part d'un bilan physique standardisé pour comparer tes capacités à celles de grimpeurs de ton niveau, puis propose un plan dans une application (LatticePlan) ou un coaching individuel. Les résultats des tests orientent les priorités ; on re-teste pour ajuster.",
      "Lattice Training (UK) starts from a standardised physical assessment that compares your capacities with climbers at your grade, then offers an app-based plan (LatticePlan) or one-to-one coaching. Test results set the priorities; you retest to adjust.",
    ),
    trains: loc(
      "Selon le bilan : force des doigts, endurance des avant-bras, force générale et mobilité, plus les séances de grimpe associées.",
      "Depends on the assessment: finger strength, forearm endurance, general strength and flexibility, plus matching climbing sessions.",
    ),
    suits: loc(
      "Grimpeurs autonomes qui aiment les chiffres et veulent savoir quoi travailler en priorité ; du niveau intermédiaire au confirmé.",
      "Self-directed climbers who like numbers and want to know what to work on first; intermediate to advanced.",
    ),
    level: loc("Plusieurs niveaux — selon programme", "Several levels depending on plan"),
    prerequisites: [
      loc("Pouvoir réaliser les tests sans douleur ; certains demandent une poutre ou un capteur de force.", "Able to perform the tests pain-free; some need a fingerboard or a force sensor."),
      loc("Âge : les plans destinés aux adultes ne conviennent pas tels quels aux jeunes en croissance.", "Age: adult-oriented plans are not suitable as-is for growing climbers."),
      loc("Blessures : signaler tout antécédent ; un plan d'application ne remplace pas un avis médical.", "Injuries: report any history; an app plan does not replace medical advice."),
    ],
    protocol: [
      { key: "format", value: loc("Bilan en 4 domaines + plan dans l'application, ou coaching individuel.", "4-area assessment + an app plan, or one-to-one coaching.") },
      { key: "duration", value: loc("Plans de plusieurs semaines, avec re-test en fin de bloc.", "Multi-week plans, with a retest at the end of each block.") },
      { key: "frequency", value: loc("Selon ta disponibilité, déclarée dans le questionnaire.", "Based on the availability you declare in the questionnaire.") },
      { key: "equipment", value: loc("Poutre, barre de traction ; capteur de force pour certains tests.", "Fingerboard, pull-up bar; a force sensor for some tests.") },
      { key: "cost", value: loc("Abonnement ou coaching payant : vérifier les tarifs sur le site officiel.", "Paid subscription or coaching: check prices on the official site.") },
    ],
    preparation: loc("Objectifs, historique de grimpe et de blessures, disponibilité hebdomadaire et matériel de test.", "Goals, climbing and injury history, weekly availability and testing equipment."),
    steps: [
      loc("Passe les tests dans des conditions standardisées (échauffement, réglette, prise).", "Take the tests under standardised conditions (warm-up, edge, grip)."),
      loc("Remplis le questionnaire d'objectifs : il utilise les résultats des 12 derniers mois.", "Fill in the goals questionnaire: it uses results from the last 12 months."),
      loc("Suis le plan, puis re-teste pour voir ce qui a bougé et ajuster.", "Follow the plan, then retest to see what changed and adjust."),
    ],
    progression: [
      loc("Re-tester dans les mêmes conditions à la fin de chaque bloc.", "Retest under the same conditions at the end of each block."),
      loc("Passer du plan d'application au coaching individuel si les besoins deviennent spécifiques.", "Move from the app plan to one-to-one coaching if needs become specific."),
    ],
    mistakes: [
      loc("Lire les comparaisons de niveau comme des verdicts : ce sont des moyennes, pas des normes.", "Reading grade comparisons as verdicts: they are averages, not standards."),
      loc("Tester fatigué ou sur un matériel différent de la fois précédente.", "Testing tired or on different equipment than last time."),
      loc("Ajouter le plan par-dessus un volume de grimpe déjà élevé sans rien retirer.", "Stacking the plan on top of an already high climbing volume without removing anything."),
    ],
    safety: [
      loc("Les tests de force maximale exigent un échauffement complet des doigts.", "Maximal strength tests require a full finger warm-up."),
      loc("Arrêter un test en cas de douleur, même si la valeur n'est pas atteinte.", "Stop a test if it hurts, even if you have not reached a value."),
    ],
    variants: [
      loc("Bilan seul, sans plan, pour orienter son propre entraînement.", "Assessment only, without a plan, to guide your own training."),
      loc("Plan d'application vs coaching individuel.", "App plan vs one-to-one coaching."),
    ],
    observe: loc("Tests mesurés, évolution entre deux bilans, récupération et performance réelle en grimpe.", "Measured tests, change between assessments, recovery and actual climbing performance."),
    evidenceNote: loc(
      "Fournisseur. La méthode est décrite par le prestataire et n'a pas été comparée à d'autres approches dans un essai. Certains de ses tests reposent sur des études publiées (ex. force critique, Giles 2021), mais l'efficacité du programme lui-même n'est pas démontrée.",
      "Provider. The method is described by the provider and has not been compared with other approaches in a trial. Some of its tests rest on published studies (e.g. critical force, Giles 2021), but the programme's effectiveness itself is not demonstrated.",
    ),
    sources: [SRC.latticeTesting, SRC.giles2021, SRC.latticeStructure],
    diagram: {
      kind: "loop",
      steps: [
        loc("Bilan : 4 domaines testés", "Assessment: 4 areas tested"),
        loc("Questionnaire d'objectifs", "Goals questionnaire"),
        loc("Plan dans l'application", "Plan in the app"),
        loc("Re-test et ajustement", "Retest and adjust"),
      ],
      center: [loc("doigts", "fingers"), loc("endurance", "endurance"), loc("force", "strength"), loc("mobilité", "mobility")],
    },
  },

  "power-company": {
    summary: loc(
      "Power Company Climbing (États-Unis) propose des « Proven Plans » : des programmes écrits à l'avance, classés par niveau et par discipline, qui mêlent grimpe, mouvement, tactique et renforcement. Les plans suivent une périodisation non linéaire (plusieurs qualités travaillées dans la même semaine). Le site publie aussi des repères chiffrés, présentés comme des guides et non comme des verdicts.",
      "Power Company Climbing (USA) offers “Proven Plans”: pre-written programmes sorted by grade and discipline, mixing climbing, movement, tactics and strength work. Plans follow non-linear periodisation (several qualities trained in the same week). The site also publishes benchmarks, presented as guides rather than verdicts.",
    ),
    trains: loc(
      "Toutes les qualités, avec une place importante pour le mouvement et la tactique ; force et puissance selon le plan choisi.",
      "All qualities, with a strong emphasis on movement and tactics; strength and power depending on the plan.",
    ),
    suits: loc(
      "Grimpeurs qui veulent un programme clé en main adapté à leur niveau, du débutant (« Just Climb More ») au confirmé (plans 5.13–5.14).",
      "Climbers who want a ready-made programme matched to their grade, from beginner (“Just Climb More”) to advanced (5.13–5.14 plans).",
    ),
    level: loc("Débutant à confirmé, selon le plan", "Beginner to advanced, by plan"),
    prerequisites: [
      loc("Choisir le plan correspondant à son niveau réel actuel, pas à son objectif.", "Pick the plan matching your current grade, not your goal grade."),
      loc("Âge : programmes conçus pour des adultes.", "Age: programmes designed for adults."),
      loc("Blessures : adapter ou retirer les exercices qui chargent une zone blessée.", "Injuries: adapt or remove exercises that load an injured area."),
    ],
    protocol: [
      { key: "format", value: loc("Programme écrit (Proven Plan) suivi en autonomie.", "Written programme (Proven Plan) followed on your own.") },
      { key: "duration", value: loc("Plusieurs semaines par plan.", "Several weeks per plan.") },
      { key: "frequency", value: loc("Fixée par le plan ; plusieurs qualités dans la même semaine (non linéaire).", "Set by the plan; several qualities within the same week (non-linear).") },
      { key: "equipment", value: loc("Salle de bloc ou de voie ; poutre et matériel de renforcement selon le plan.", "Bouldering or roped gym; fingerboard and strength gear depending on the plan.") },
      { key: "cost", value: loc("Plans payants (à partir d'environ 150 $ au moment de la rédaction) : vérifier sur le site officiel.", "Paid plans (from about $150 at the time of writing): check on the official site.") },
    ],
    preparation: loc("Niveau actuel honnête en bloc et en voie, disponibilité, accès à une salle.", "An honest current grade in bouldering and routes, availability, gym access."),
    steps: [
      loc("Choisis le plan correspondant à ton niveau actuel et à ta discipline.", "Choose the plan for your current grade and discipline."),
      loc("Suis les séances dans l'ordre, en notant ce qui a été fait.", "Follow the sessions in order, logging what you did."),
      loc("Compare tes repères chiffrés au début et à la fin, puis choisis le plan suivant.", "Compare your benchmarks at the start and end, then pick the next plan."),
    ],
    progression: [
      loc("Passer au plan du niveau suivant une fois le plan terminé et les repères améliorés.", "Move to the next grade's plan once the plan is done and benchmarks improve."),
      loc("Alterner bloc et voie selon la saison.", "Alternate bouldering and route plans by season."),
    ],
    mistakes: [
      loc("Choisir un plan trop avancé « pour progresser plus vite ».", "Picking a plan that is too advanced “to progress faster”."),
      loc("Interpréter les repères chiffrés comme une note de valeur.", "Treating benchmarks as a judgement of worth."),
      loc("Ajouter le plan à un volume de grimpe inchangé.", "Adding the plan to an unchanged climbing volume."),
    ],
    safety: [
      loc("Respecter les journées de repos prévues.", "Keep the planned rest days."),
      loc("Réduire le volume dès l'apparition d'une douleur persistante.", "Reduce volume as soon as a persistent pain appears."),
    ],
    variants: [
      loc("Plans bloc (« Boulder Better », « Boulder Strong ») ou voie (« Climb 5.12 »…).", "Bouldering plans (“Boulder Better”, “Boulder Strong”) or route plans (“Climb 5.12”…)."),
      loc("Coaching individuel proposé séparément.", "One-to-one coaching offered separately."),
    ],
    observe: loc("Séances réalisées, repères chiffrés comparables dans le temps et réussite réelle des projets.", "Sessions completed, benchmarks comparable over time and real project success."),
    evidenceNote: loc(
      "Fournisseur. Programmes décrits par le prestataire, sans essai publié comparant leurs résultats ; la périodisation non linéaire a un appui général hors escalade.",
      "Provider. Programmes described by the provider, with no published trial comparing their results; non-linear periodisation has general support outside climbing.",
    ),
    sources: [SRC.powerCompanyMetrics, SRC.moesgaard2022],
    diagram: {
      kind: "staircase",
      axis: loc("niveau croissant →", "increasing grade →"),
      steps: [
        { label: loc("Just Climb More", "Just Climb More"), detail: loc("≤ V3 (6A) · 6b+", "≤ V3 · 5.11a") },
        { label: loc("Boulder Better", "Boulder Better"), detail: loc("V3–V6 (6A–7A)", "V3–V6") },
        { label: loc("Climb 5.12", "Climb 5.12"), detail: loc("7a+–7c", "5.12") },
        { label: loc("Boulder Strong", "Boulder Strong"), detail: loc("V6–V9 (7A–7C)", "V6–V9") },
        { label: loc("Climb 5.13", "Climb 5.13"), detail: loc("7c+–8a+", "5.13") },
        { label: loc("Climb 5.14", "Climb 5.14"), detail: loc("8b+–9a", "5.14") },
      ],
    },
  },

  "crimpd": {
    summary: loc(
      "Crimpd (application de Lattice) regroupe une bibliothèque d'exercices, un journal et un générateur de plans de 1 à 24 semaines (12 au maximum recommandé). Le plan alterne semaines de base, semaines de repos (environ la moitié du volume) et semaines de pic, avec un rapport par défaut de 3 semaines de charge pour 1 de repos.",
      "Crimpd (an app by Lattice) combines a workout library, a log and a plan builder for 1–24 weeks (12 at most recommended). Plans alternate base weeks, rest weeks (about half the volume) and peak weeks, with a default ratio of 3 loading weeks to 1 rest week.",
    ),
    trains: loc(
      "Toutes les qualités, selon les séances choisies : force des doigts, endurance, résistance, renforcement, compétences.",
      "Any quality, depending on the workouts chosen: finger strength, endurance, power endurance, conditioning, skills.",
    ),
    suits: loc(
      "Grimpeurs autonomes qui veulent structurer et suivre leurs séances eux-mêmes ; tous niveaux, avec un choix d'exercices adapté.",
      "Self-directed climbers who want to structure and log their own sessions; all levels, with suitable workout choices.",
    ),
    level: loc("Plusieurs niveaux selon exercice", "Varies by workout"),
    prerequisites: [
      loc("Savoir choisir des exercices adaptés à son niveau (la bibliothèque contient des exercices avancés).", "Able to choose workouts matching your level (the library includes advanced ones)."),
      loc("Âge : pas de suspensions lestées ni de campus avant la fin de la croissance.", "Age: no weighted hangs or campusing before growth has finished."),
      loc("Blessures : retirer les séances qui sollicitent la zone blessée.", "Injuries: remove sessions that load the injured area."),
    ],
    protocol: [
      { key: "format", value: loc("Application : bibliothèque, journal, générateur de plans.", "App: library, log, plan builder.") },
      { key: "duration", value: loc("1 à 24 semaines ; 12 au maximum recommandé.", "1–24 weeks; 12 at most recommended.") },
      { key: "frequency", value: loc("Rapport par défaut 3:1 (charge:repos) ; modèles « Skill » de 6 semaines en 2 blocs de 3 (2:1).", "Default 3:1 ratio (load:rest); 6-week “Skill” templates in two 3-week blocks (2:1).") },
      { key: "intensity", value: loc("Semaines de repos à environ la moitié du volume.", "Rest weeks at about half the volume.") },
      { key: "equipment", value: loc("Selon les exercices : poutre, pan, salle.", "Depends on workouts: fingerboard, board, gym.") },
      { key: "cost", value: loc("Version gratuite et abonnement : vérifier sur le site officiel.", "Free version and subscription: check on the official site.") },
    ],
    preparation: loc("Objectif du cycle, nombre de séances par semaine, matériel disponible.", "Cycle goal, sessions per week, available equipment."),
    steps: [
      loc("Choisis la durée du plan (≤ 12 semaines conseillé) et ton rythme charge/repos.", "Choose the plan length (≤ 12 weeks advised) and your load/rest rhythm."),
      loc("Ajoute des séances adaptées à ton objectif dans chaque semaine.", "Add workouts suited to your goal to each week."),
      loc("Note chaque séance et ajuste la suivante selon ta récupération.", "Log each workout and adjust the next one to your recovery."),
    ],
    progression: [
      loc("Augmenter le volume d'un cycle à l'autre, pas d'une semaine à l'autre.", "Raise volume from one cycle to the next, not week to week."),
      loc("Ajouter une semaine de pic avant un objectif.", "Add a peak week before a goal."),
    ],
    mistakes: [
      loc("Empiler des séances sans retirer de volume ailleurs.", "Stacking workouts without removing volume elsewhere."),
      loc("Sauter les semaines de repos.", "Skipping rest weeks."),
      loc("Choisir des exercices avancés trop tôt.", "Picking advanced workouts too early."),
    ],
    safety: [
      loc("Échauffement complet avant chaque séance de doigts.", "Full warm-up before every finger session."),
      loc("Alléger si sommeil, douleur ou motivation se dégradent.", "Ease off if sleep, pain or motivation deteriorate."),
    ],
    variants: [
      loc("Rapport 2:1 pour les blocs courts de compétences.", "2:1 ratio for short skill blocks."),
      loc("Bibliothèque seule, sans plan, pour des séances ponctuelles.", "Library only, without a plan, for one-off workouts."),
    ],
    observe: loc("Répétitions, temps, effort perçu, régularité et récupération.", "Reps, time, perceived effort, consistency and recovery."),
    evidenceNote: loc(
      "Fournisseur. Outil d'organisation décrit par le prestataire ; son efficacité dépend des séances choisies. Le principe de semaines de récupération s'appuie sur la littérature générale de périodisation.",
      "Provider. An organising tool described by the provider; its effectiveness depends on the workouts chosen. Planned recovery weeks are supported by the general periodisation literature.",
    ),
    sources: [SRC.crimpdPlan, SRC.moesgaard2022],
    diagram: {
      kind: "phases",
      phases: [
        { weeks: 1, label: loc("Base", "Base"), volume: 2 },
        { weeks: 1, label: loc("Base", "Base"), volume: 2 },
        { weeks: 1, label: loc("Base", "Base"), volume: 2 },
        { weeks: 1, label: loc("Repos", "Rest"), volume: 1 },
        { weeks: 1, label: loc("Base", "Base"), volume: 2 },
        { weeks: 1, label: loc("Base", "Base"), volume: 2 },
        { weeks: 1, label: loc("Base", "Base"), volume: 2 },
        { weeks: 1, label: loc("Repos", "Rest"), volume: 1 },
      ],
    },
  },

  "hoopers": {
    summary: loc(
      "Hooper's Beta (États-Unis) publie des ressources gratuites (articles, vidéos) sur la technique, le renforcement et la gestion des blessures, et propose du coaching à distance fondé sur l'analyse vidéo. Le suivi kinésithérapique est un service distinct.",
      "Hooper's Beta (USA) publishes free resources (articles, videos) on technique, strength and injury management, and offers remote coaching built on video analysis. Physiotherapy follow-up is a separate service.",
    ),
    trains: loc(
      "Technique (analyse vidéo), renforcement général et spécifique, gestion de la charge.",
      "Technique (video analysis), general and specific strength, load management.",
    ),
    suits: loc(
      "Tous niveaux ; utile à ceux qui veulent un regard extérieur sur leur grimpe ou un renforcement complet bien expliqué.",
      "All levels; useful for climbers who want an outside eye on their climbing or a well-explained full-body strength routine.",
    ),
    level: loc("Tous niveaux", "All levels"),
    prerequisites: [
      loc("Pouvoir filmer ses essais (voir la fiche Vidéo).", "Able to film your attempts (see the Video entry)."),
      loc("Âge : ressources pensées pour les adultes.", "Age: resources written for adults."),
      loc("Blessures : les contenus éducatifs ne remplacent pas un diagnostic.", "Injuries: educational content does not replace a diagnosis."),
    ],
    protocol: [
      { key: "format", value: loc("Ressources gratuites + coaching à distance par analyse vidéo.", "Free resources + remote coaching via video analysis.") },
      { key: "duration", value: loc("Question ponctuelle ou suivi mensuel.", "One-off question or monthly follow-up.") },
      { key: "frequency", value: loc("Retour hebdomadaire en suivi mensuel.", "Weekly feedback in monthly coaching.") },
      { key: "equipment", value: loc("Téléphone pour filmer ; matériel de renforcement selon le programme.", "A phone to film; strength gear depending on the programme.") },
      { key: "cost", value: loc("Ressources gratuites ; coaching payant (environ 175 à 350 $ au moment de la rédaction) : vérifier sur le site officiel.", "Free resources; paid coaching (about $175–$350 at the time of writing): check on the official site.") },
    ],
    preparation: loc("Identifier le geste ou la capacité à faire analyser ; filmer quelques essais.", "Identify the movement or capacity to review; film a few attempts."),
    steps: [
      loc("Fais une auto-évaluation : objectifs, faiblesses, disponibilité.", "Do a self-assessment: goals, weaknesses, availability."),
      loc("Envoie des vidéos d'essais comparables.", "Send videos of comparable attempts."),
      loc("Applique le plan reçu et renvoie de nouvelles vidéos pour le suivi.", "Apply the plan you receive and send new videos for follow-up."),
    ],
    progression: [
      loc("Passer d'une question ponctuelle à un suivi régulier si besoin.", "Move from a one-off question to regular follow-up if needed."),
      loc("Comparer des vidéos prises dans les mêmes conditions à quelques semaines d'écart.", "Compare videos taken under the same conditions a few weeks apart."),
    ],
    mistakes: [
      loc("Envoyer des vidéos où les pieds ne sont pas visibles.", "Sending videos where the feet are not visible."),
      loc("Appliquer dix corrections à la fois.", "Applying ten corrections at once."),
    ],
    safety: [
      loc("Pour une douleur, consulter un professionnel de santé en personne.", "For pain, see a health professional in person."),
    ],
    variants: [
      loc("Ressources gratuites seules.", "Free resources only."),
      loc("Coaching vidéo ponctuel vs suivi mensuel.", "One-off video coaching vs monthly follow-up."),
    ],
    observe: loc("Vidéos comparables, exécution, ressenti et progrès spécifiques.", "Comparable videos, execution, feel and specific progress."),
    evidenceNote: loc(
      "Fournisseur. Services décrits par le prestataire ; l'intérêt du retour vidéo est soutenu par des études sur l'apprentissage gestuel, mais ce coaching précis n'a pas été évalué.",
      "Provider. Services described by the provider; video feedback is supported by motor-learning studies, but this specific coaching has not been evaluated.",
    ),
    sources: [SRC.hoopersStrength, SRC.walker2020],
    diagram: {
      kind: "loop",
      steps: [
        loc("Auto-évaluation", "Self-assessment"),
        loc("Vidéos d'essais", "Attempt videos"),
        loc("Analyse et plan", "Analysis and plan"),
        loc("Suivi hebdomadaire", "Weekly follow-up"),
      ],
      center: [loc("coaching", "remote"), loc("à distance", "coaching")],
    },
  },
};
