import type { Locale } from "./index";

/** Strings for the climber's avatar (seven colours earned on four pillars). */
const fr = {
  title: "Ton avatar",
  colour: { WHITE: "Blanc", YELLOW: "Jaune", ORANGE: "Orange", GREEN: "Vert", VIOLET: "Violet", BLUE: "Bleu", BLACK: "Noir" },
  portraitLabel: "Ton avatar, niveau {colour}",
  levelOf: "Niveau {n} sur 7",
  nextUnlock: "Prochain avatar : {colour}",
  holding: "Pour le débloquer : {pillars}",
  allDone: "Tu as débloqué le dernier avatar.",
  capped: "Mobilité et souplesse s’arrêtent à Violet pour l’instant : Bleu et Noir demanderont des tests de hanches plus avancés, pas encore disponibles.",
  pillar: { mobility: "Mobilité", flexibility: "Souplesse", boulder: "Blocs", route: "Voies" },
  toUnlock: "à débloquer",
  boulderNext: "{grade} ou plus : {climbs}/{needClimbs} blocs différents, sur {sessions}/{needSessions} séances",
  routeNext: "{grade} ou plus en tête, enchaîné : {climbs}/{needClimbs} voies différentes, sur {sessions}/{needSessions} séances",
  bodyNext: "Niveau {level} sur chaque test et chaque côté, deux évaluations de suite ({assessments}/{need} faites)",
  bodyLatest: "Dernière évaluation : niveau {level}",
  bodyWeakest: "À travailler : {tests}",
  bodyNone: "Fais l’évaluation des hanches pour valider ce pilier.",
  bodyLink: "Évaluation des hanches",
  pillarTop: "Validé jusqu’au Noir",
  pillarCapped: "Violet, le maximum pour l’instant",
  rule: "Ton avatar est toujours ton pilier le plus bas : les quatre doivent atteindre une couleur pour la débloquer.",
  how: "Blocs : niveaux Font seulement (blocs cotés en Font, couleurs de salle avec une estimation Font fiable, pan en Font). Voies : en tête, enchaînées. Mobilité (tests C et D) et souplesse (tests A et B) : l’évaluation des hanches. Des repères LEBLOND, pas une mesure de ton niveau.",
  list: { and: " et " },
};

const en: typeof fr = {
  title: "Your avatar",
  colour: { WHITE: "White", YELLOW: "Yellow", ORANGE: "Orange", GREEN: "Green", VIOLET: "Violet", BLUE: "Blue", BLACK: "Black" },
  portraitLabel: "Your avatar, {colour} level",
  levelOf: "Level {n} of 7",
  nextUnlock: "Next avatar: {colour}",
  holding: "To unlock it: {pillars}",
  allDone: "You unlocked the last avatar.",
  capped: "Mobility and flexibility stop at Violet for now: Blue and Black will need more advanced hip tests, not available yet.",
  pillar: { mobility: "Mobility", flexibility: "Flexibility", boulder: "Boulders", route: "Routes" },
  toUnlock: "to unlock",
  boulderNext: "{grade} or harder: {climbs}/{needClimbs} different problems, over {sessions}/{needSessions} sessions",
  routeNext: "{grade} or harder, led clean: {climbs}/{needClimbs} different routes, over {sessions}/{needSessions} sessions",
  bodyNext: "Level {level} on every test and side, two assessments in a row ({assessments}/{need} done)",
  bodyLatest: "Latest assessment: level {level}",
  bodyWeakest: "To work on: {tests}",
  bodyNone: "Take the hip assessment to validate this pillar.",
  bodyLink: "Hip assessment",
  pillarTop: "Validated up to Black",
  pillarCapped: "Violet, the maximum for now",
  rule: "Your avatar is always your lowest pillar: all four must reach a colour to unlock it.",
  how: "Boulders: Font grades only (Font-graded problems, gym colours with a reliable Font estimate, boards in Font). Routes: led clean. Mobility (tests C and D) and flexibility (tests A and B): the hip assessment. LEBLOND reference points, not a measurement of your level.",
  list: { and: " and " },
};

export function avatarDictionary(locale: Locale) {
  return locale === "en" ? en : fr;
}
