import type { Locale } from "./index";
import type { ConfidenceBand, ConversionSource } from "@/lib/grading/harmonise";

/** Strings for the harmonised results (Progrès › Charge) and the correspondence settings (Réglages › Cotations). */
const fr = {
  boulderTitle: "Bloc · Font",
  routeTitle: "Voie · cotation française",
  converted: "converti, estimé",
  asLogged: "comme noté",
  entriesLabel: "Tes meilleures croix",
  entryFrom: "{converted} ← {native}",
  entryNativeRoute: "{grade} · {native}",
  fromScales: "Converti depuis : {list}",
  scaleCount: "{scale} {n}",
  unconverted: "{n} blocs sans correspondance (couleurs libres, rose mystère) ne sont pas comptés.",
  refine: "Affiner la correspondance",
  confidence: {
    high: "confiance bonne",
    medium: "confiance moyenne",
    low: "confiance faible",
  } satisfies Record<ConfidenceBand, string>,
  weakest: "Au plus bas : {band}",
  detailTitle: "Détail par échelle d’origine",
  detailHint: "Tes résultats dans chaque échelle de salle, sans conversion.",
  otherTitle: "Board et suspension",

  settings: {
    title: "Correspondance des cotations",
    cardTitle: "Correspondance des cotations",
    cardHint: "Comment tes couleurs et niveaux de salle se lisent en Font dans Progrès.",
    intro: "Progrès lit tous tes blocs en Font pour les comparer d’une salle à l’autre. Voici la table utilisée : une première estimation, que tu peux ajuster cotation par cotation. Tes cotations enregistrées ne changent jamais.",
    routesNote: "Les voies ne sont pas converties : tu les notes déjà en cotation française, la couleur de la salle reste à côté.",
    from: "De",
    to: "à",
    defaultLine: "Par défaut : {span}",
    custom: "à toi",
    save: "Enregistrer",
    saved: "Enregistré",
    reset: "Revenir au défaut",
    resetScale: "Tout remettre par défaut",
    error: "Impossible d’enregistrer. Réessaie.",
    sourceLink: "source",
    back: "Réglages",
  },
  source: {
    FONT_NATIVE: "Font d’origine",
    PROBLEM_ESTIMATE: "ton estimation sur ce bloc",
    GYM_PUBLISHED: "publiée par la salle",
    OBSERVED: "observée par Kaskad, non officielle",
    SHARED_ESTIMATE: "estimation transmise, non officielle",
    REFERENCE_TABLE: "table de référence LEBLOND",
    LEBLOND_ESTIMATE: "première estimation LEBLOND",
    USER_SETTING: "ton réglage",
  } satisfies Record<ConversionSource, string>,
};
type Dict = typeof fr;

const en: Dict = {
  boulderTitle: "Boulders · Font",
  routeTitle: "Routes · French grade",
  converted: "converted, estimated",
  asLogged: "as logged",
  entriesLabel: "Your best sends",
  entryFrom: "{converted} ← {native}",
  entryNativeRoute: "{grade} · {native}",
  fromScales: "Converted from: {list}",
  scaleCount: "{scale} {n}",
  unconverted: "{n} boulders with no correspondence (free colours, mystery pink) are not counted.",
  refine: "Refine the correspondence",
  confidence: {
    high: "good confidence",
    medium: "medium confidence",
    low: "low confidence",
  },
  weakest: "Lowest: {band}",
  detailTitle: "Detail per original scale",
  detailHint: "Your results in each gym scale, unconverted.",
  otherTitle: "Board and hangs",

  settings: {
    title: "Grade correspondence",
    cardTitle: "Grade correspondence",
    cardHint: "How your gym colours and levels read on Font in Progress.",
    intro: "Progress reads all your boulders on Font to compare one gym with another. This is the table it uses: a first estimate you can adjust grade by grade. Your logged grades never change.",
    routesNote: "Routes are not converted: you already log them on the French scale, with the gym's colour next to it.",
    from: "From",
    to: "to",
    defaultLine: "Default: {span}",
    custom: "yours",
    save: "Save",
    saved: "Saved",
    reset: "Back to default",
    resetScale: "Reset all to default",
    error: "Could not save. Try again.",
    sourceLink: "source",
    back: "Settings",
  },
  source: {
    FONT_NATIVE: "Font as logged",
    PROBLEM_ESTIMATE: "your estimate on this boulder",
    GYM_PUBLISHED: "published by the gym",
    OBSERVED: "observed by Kaskad, unofficial",
    SHARED_ESTIMATE: "shared estimate, unofficial",
    REFERENCE_TABLE: "LEBLOND reference table",
    LEBLOND_ESTIMATE: "LEBLOND first estimate",
    USER_SETTING: "your setting",
  },
};

export function gradeHarmoniseDictionary(locale: Locale): Dict {
  return locale === "en" ? en : fr;
}
