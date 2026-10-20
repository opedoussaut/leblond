import type { Locale } from "./index";

const fr = {
  chooseDiscipline: "Que grimpes-tu aujourd’hui ?",
  boulder: "Bloc", route: "Voie",
  boulderHint: "Essais, tops et flashs sur les blocs.",
  routeHint: "Voies en tête, en moulinette ou sur enrouleur — cotation française.",
  routeSession: "Séance de voie",
  grade: "Cotation", moreGrades: "Autre cotation", style: "Style",
  styles: { LEAD: "Tête", TOPROPE: "Moulinette", AUTOBELAY: "Enrouleur" },
  results: {
    ONSIGHT: "À vue", FLASH: "Flash", REDPOINT: "Enchaînée",
    TOP_WITH_REST: "Sortie avec repos", ATTEMPT: "Non sortie",
  },
  resultHints: {
    ONSIGHT: "1er essai, sans info", FLASH: "1er essai, avec info", REDPOINT: "Sans chute, après travail",
    TOP_WITH_REST: "Chutes ou repos sur la corde", ATTEMPT: "Pas jusqu’au relais",
  },
  routeName: "Nom ou repère de la voie (facultatif)", routeNameHint: "Permet de suivre une voie projet et de vérifier l’à vue.",
  falls: "Chutes / repos", addFall: "Ajouter une chute", removeFall: "Retirer une chute", logHint: "Choisis la cotation et le style, puis touche le résultat.",
  logged: "{grade} · {result} noté.", notFirst: "Cette voie a déjà été grimpée ici : ni à vue ni flash possible.",
  thisSession: "Voies de la séance", noneYet: "Aucune voie notée pour l’instant.", remove: "Retirer",
  end: "Terminer la séance", endConfirm: "Terminer la séance maintenant ?",
  summaryTitle: "SÉANCE DE VOIE TERMINÉE",
  climbed: "voies", clean: "enchaînées", onsights: "à vue", topped: "sorties",
  highestLead: "Plus haute enchaînée en tête", highestClean: "Plus haute enchaînée", highestOnsight: "Plus haute à vue",
  cleanRate: "Taux d’enchaînement", pyramid: "Pyramide des enchaînements",
  sectionTitle: "Voie · 30 derniers jours", workingGrade: "Niveau de travail en tête observé",
  workingRule: "Plus haute cotation enchaînée au moins 2 fois en tête sur 60 jours, si au moins 6 voies ont été notées.",
  insufficient: "données insuffisantes", noRoutes: "Aucune voie notée sur cette période.",
  separateScales: "Cotations de voie (françaises) et de bloc restent séparées : aucune conversion.",
  topropeNote: "Les voies en moulinette et sur enrouleur sont comptées à part du niveau en tête.",
};
type Dict = typeof fr;

const en: Dict = {
  chooseDiscipline: "What are you climbing today?",
  boulder: "Bouldering", route: "Routes",
  boulderHint: "Attempts, tops and flashes on boulder problems.",
  routeHint: "Lead, top-rope or auto-belay routes — French grades.",
  routeSession: "Route session",
  grade: "Grade", moreGrades: "Other grade", style: "Style",
  styles: { LEAD: "Lead", TOPROPE: "Top-rope", AUTOBELAY: "Auto-belay" },
  results: {
    ONSIGHT: "Onsight", FLASH: "Flash", REDPOINT: "Redpoint",
    TOP_WITH_REST: "Topped with rests", ATTEMPT: "Not topped",
  },
  resultHints: {
    ONSIGHT: "1st go, no beta", FLASH: "1st go, with beta", REDPOINT: "No falls, after working it",
    TOP_WITH_REST: "Falls or rests on the rope", ATTEMPT: "Did not reach the anchor",
  },
  routeName: "Route name or marker (optional)", routeNameHint: "Lets you track a project and checks onsights.",
  falls: "Falls / rests", addFall: "Add a fall", removeFall: "Remove a fall", logHint: "Pick the grade and style, then tap the result.",
  logged: "{grade} · {result} logged.", notFirst: "You have climbed this route here before: it can’t be an onsight or flash.",
  thisSession: "Routes this session", noneYet: "No routes logged yet.", remove: "Remove",
  end: "End session", endConfirm: "End the session now?",
  summaryTitle: "ROUTE SESSION COMPLETE",
  climbed: "routes", clean: "clean", onsights: "onsight", topped: "topped",
  highestLead: "Hardest clean lead", highestClean: "Hardest clean ascent", highestOnsight: "Hardest onsight",
  cleanRate: "Clean ascent rate", pyramid: "Clean ascent pyramid",
  sectionTitle: "Routes · last 30 days", workingGrade: "Observed lead working grade",
  workingRule: "Hardest grade climbed clean on lead at least twice in 60 days, when at least 6 routes were logged.",
  insufficient: "insufficient data", noRoutes: "No routes logged in this period.",
  separateScales: "Route (French) and boulder grades stay separate: no conversion.",
  topropeNote: "Top-rope and auto-belay ascents are counted separately from lead level.",
};

export const routeDictionary = (locale: Locale): Dict => (locale === "en" ? en : fr);
