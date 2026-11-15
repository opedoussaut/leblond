import type { Locale } from "./index";

/** Strings for the self-reported form of the day on Aujourd'hui (filled "Forme du jour" card). */
const fr = {
  eyebrow: "Forme du jour",
  declarative: "Auto-évaluation",
  declarativeHint: "D’après tes réponses de ce matin : une indication déclarative, pas une mesure.",
  levels: {
    GOOD: { label: "En forme", hint: "Tes réponses sont au vert." },
    WATCH: { label: "À surveiller", hint: "Quelques signaux : écoute ton corps." },
    REST: { label: "Repos conseillé", hint: "Tes réponses demandent de lever le pied." },
  },
  ringLabel: "Forme déclarée : {level}, {lit} segment(s) allumé(s) sur 3.",
  summary: "Tes réponses",
  sleep: "Nuit",
  fatigue: "Fatigue",
  pain: "Douleur",
  time: "Temps",
  painNone: "Aucune",
  painLevels: { DISCOMFORT: "gêne", PAIN: "douleur", ACUTE: "aiguë" },
  painMore: "{first} +{n}",
  minutes: "{n} min",
  noTime: "Aucun",
  session: "Séance du jour :",
  edit: "Modifier",
  editLabel: "Modifier ma forme du jour",
};

type Dict = typeof fr;

const en: Dict = {
  eyebrow: "Readiness",
  declarative: "Self-assessment",
  declarativeHint: "From your answers this morning: a self-reported indication, not a measurement.",
  levels: {
    GOOD: { label: "Good to go", hint: "Your answers are all green." },
    WATCH: { label: "Take care", hint: "A few signals: listen to your body." },
    REST: { label: "Rest advised", hint: "Your answers call for easing off." },
  },
  ringLabel: "Self-reported form: {level}, {lit} of 3 segments lit.",
  summary: "Your answers",
  sleep: "Night",
  fatigue: "Fatigue",
  pain: "Pain",
  time: "Time",
  painNone: "None",
  painLevels: { DISCOMFORT: "discomfort", PAIN: "pain", ACUTE: "acute" },
  painMore: "{first} +{n}",
  minutes: "{n} min",
  noTime: "None",
  session: "Today’s session:",
  edit: "Edit",
  editLabel: "Edit my readiness check",
};

export const dayFormDictionary = (locale: Locale): Dict => (locale === "en" ? en : fr);
