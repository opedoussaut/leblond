import type { Locale } from "./index";

/** Strings for the Progress diagrams, the duel diagram and the duel banner on Aujourd'hui. */
const fr = {
  levelTitle: "Ta courbe de niveau",
  levelHint: "Le bloc le plus dur enchaîné chaque semaine, sur tes blocs notés. Aucune estimation.",
  levelEmpty: "Il faut des blocs enchaînés sur au moins deux semaines de la période pour tracer la courbe.",
  levelPoint: "Semaine du {date} : {grade}, {n} blocs enchaînés",
  levelCaption: "Plus dur bloc enchaîné par semaine",
  week: "Semaine",
  hardest: "Plus dur",
  sendsCol: "Blocs enchaînés",
  pyramidTitle: "Ta pyramide",
  pyramidHint: "Les blocs tentés sur la période, du plus dur au plus facile.",
  repsShort: "rép.",
  flashed: "Flash",
  sent: "Enchaînés",
  tried: "En cours",
  grade: "Cotation",
  raceTitle: "La course depuis la signature",
  raceHint: "Séances cumulées, à la fin de chaque semaine du pacte.",
  raceCaption: "Séances cumulées par semaine, toi et {name}",
  raceWeek: "S{n}",
  you: "Toi",
  bannerEyebrow: "Le duel",
  bannerSee: "Voir le duel",
  bannerSessions: "séances",
  bannerWeek: "Semaine {week} sur {total}",
  bannerScore: "Toi {you} – {rival} {name}, en séances",
};

const en: typeof fr = {
  levelTitle: "Your level curve",
  levelHint: "The hardest boulder you sent each week, from your logged climbs. No estimate.",
  levelEmpty: "The curve needs sends in at least two weeks of the period.",
  levelPoint: "Week of {date}: {grade}, {n} boulders sent",
  levelCaption: "Hardest boulder sent per week",
  week: "Week",
  hardest: "Hardest",
  sendsCol: "Boulders sent",
  pyramidTitle: "Your pyramid",
  pyramidHint: "Boulders tried in the period, hardest first.",
  repsShort: "reps",
  flashed: "Flash",
  sent: "Sent",
  tried: "Working",
  grade: "Grade",
  raceTitle: "The race since signing",
  raceHint: "Séances added up at the end of each pact week.",
  raceCaption: "Séances added up per week, you and {name}",
  raceWeek: "W{n}",
  you: "You",
  bannerEyebrow: "The duel",
  bannerSee: "See the duel",
  bannerSessions: "séances",
  bannerWeek: "Week {week} of {total}",
  bannerScore: "You {you} – {rival} {name}, in séances",
};

export function chartsDictionary(locale: Locale) {
  return locale === "en" ? en : fr;
}
