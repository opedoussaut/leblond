import type { Locale } from "./index";

/**
 * Strings for the rival (profile, feed, messages, duels, settings, player race).
 * Messages never comment on a body or an injury and never ask for more load or
 * shorter rests: they only talk about turning up and the score.
 */
const fr = {
  fictional: "fictif",
  profileLine: "Ton rival · grimpe du {grade} cette semaine",
  profileLineNoGrade: "Ton rival · suit ton programme",
  levelLabel: { REACH: "À ta portée", RELENTLESS: "Implacable", GOAL: "Objectif" },
  levelHint: {
    REACH: "Il reste au plus une séance et 10 % devant toi : tu peux toujours le rattraper.",
    RELENTLESS: "Il suit le programme à la lettre, chaque jour prévu.",
    GOAL: "Il grimpe au rythme qui atteint ton objectif de bloc à la date choisie.",
  },
  toneLabel: { SYMPA: "Sympa", PIQUANT: "Piquant", SANS_PITIE: "Sans pitié" },
  feedTitle: "{name}",
  feedEmpty: "Rien de neuf pour l’instant. {name} s’échauffe.",
  weekTitle: "Cette semaine",
  seasonTitle: "Saison",
  seasonScore: "{name} {rival} – {you} toi",
  duelLine: "Semaine {week} : {verdict}, {a}–{b}",
  duelWon: "tu gagnes", duelLost: "{name} gagne", duelLevel: "égalité",
  sessionLine: "{name} a fini {title} · {minutes} min · effort {effort}/10",
  sendLine: "{name} a enchaîné un {grade}{where} en {tries} essai(s)",
  sendOnBoard: " sur la {board} à {angle}°",
  projectLine: "{name} a enchaîné ton projet « {project} ». À toi.",
  today: "Auj.", yesterday: "Hier",
  messages: {
    SYMPA: {
      skipped: "J’ai fait la séance de {day} de mon côté. On s’y remet ensemble à la prochaine ?",
      passedYou: "Je suis passé devant, mais c’est serré. À toi de jouer !",
      youPassed: "Bien joué, tu es devant. Je vais devoir m’accrocher.",
      beforeSession: "Aujourd’hui c’est {title}. Je m’y mets aussi, on se motive ?",
      monday: "Bilan de la semaine {week} : saison {rival}–{you}. Belle semaine qui commence !",
    },
    PIQUANT: {
      skipped: "{day}, j’ai fait ta séance à ta place. Tu reviens quand ?",
      passedYou: "Coucou, je viens de te doubler.",
      youPassed: "D’accord, tu es devant. Profite, ça ne va pas durer.",
      beforeSession: "{title} aujourd’hui. Je suis déjà en chaussons.",
      monday: "Semaine {week} terminée. Saison : moi {rival}, toi {you}.",
    },
    SANS_PITIE: {
      skipped: "{day} : séance faite. La tienne aussi, du coup.",
      passedYou: "Devant. Comme prévu.",
      youPassed: "Tu es devant. Pour l’instant.",
      beforeSession: "{title} aujourd’hui. Je ne t’attendrai pas.",
      monday: "Semaine {week}. Saison {rival}–{you}. Je compte.",
    },
  },
  settingsTitle: "Réglages du rival",
  portrait: "Portrait",
  portraitN: "Portrait {n}",
  tone: "Ton",
  level: "Niveau",
  goalDate: "Date de l’objectif",
  goalNeedsGrades: "Le niveau Objectif utilise les cotations de bloc du pacte (départ et objectif).",
  chase: "Il peut s’attaquer à mes projets",
  save: "Enregistrer",
  saved: "Réglages enregistrés.",
  error: "Les réglages n’ont pas pu être enregistrés. Pour le niveau Objectif, choisis une date à venir.",
  laneBeat: "Tu as battu {name} de {d}",
  laneLost: "{name} a fini {d} avant toi",
};

const en: typeof fr = {
  fictional: "fictional",
  profileLine: "Your rival · climbs {grade} this week",
  profileLineNoGrade: "Your rival · follows your programme",
  levelLabel: { REACH: "Within reach", RELENTLESS: "Relentless", GOAL: "Goal" },
  levelHint: {
    REACH: "It stays at most one session and 10% ahead of you: you can always catch it.",
    RELENTLESS: "It follows the programme to the letter, every planned day.",
    GOAL: "It climbs at the pace that reaches your boulder goal on the date you choose.",
  },
  toneLabel: { SYMPA: "Friendly", PIQUANT: "Sharp", SANS_PITIE: "Merciless" },
  feedTitle: "{name}",
  feedEmpty: "Nothing new yet. {name} is warming up.",
  weekTitle: "This week",
  seasonTitle: "Season",
  seasonScore: "{name} {rival} – {you} you",
  duelLine: "Week {week}: {verdict}, {a}–{b}",
  duelWon: "you win", duelLost: "{name} wins", duelLevel: "draw",
  sessionLine: "{name} finished {title} · {minutes} min · effort {effort}/10",
  sendLine: "{name} sent a {grade}{where} in {tries} tries",
  sendOnBoard: " on the {board} at {angle}°",
  projectLine: "{name} sent your project “{project}”. Your turn.",
  today: "Today", yesterday: "Yest.",
  messages: {
    SYMPA: {
      skipped: "I did {day}’s session on my side. Back at it together next time?",
      passedYou: "I just got ahead, but it’s close. Your move!",
      youPassed: "Well done, you’re ahead. I’ll have to hang on.",
      beforeSession: "{title} today. I’m on it too, shall we?",
      monday: "Week {week} done: season {rival}–{you}. A new week starts!",
    },
    PIQUANT: {
      skipped: "{day}, I did your session for you. When are you coming back?",
      passedYou: "Hi there, I just passed you.",
      youPassed: "Fine, you’re ahead. Enjoy it, it won’t last.",
      beforeSession: "{title} today. My shoes are already on.",
      monday: "Week {week} done. Season: me {rival}, you {you}.",
    },
    SANS_PITIE: {
      skipped: "{day}: session done. Yours too, then.",
      passedYou: "Ahead. As planned.",
      youPassed: "You’re ahead. For now.",
      beforeSession: "{title} today. I won’t wait for you.",
      monday: "Week {week}. Season {rival}–{you}. I’m counting.",
    },
  },
  settingsTitle: "Rival settings",
  portrait: "Portrait",
  portraitN: "Portrait {n}",
  tone: "Tone",
  level: "Level",
  goalDate: "Goal date",
  goalNeedsGrades: "The Goal level uses the pact’s boulder grades (start and goal).",
  chase: "It may go after my projects",
  save: "Save",
  saved: "Settings saved.",
  error: "The settings could not be saved. For the Goal level, pick a future date.",
  laneBeat: "You beat {name} by {d}",
  laneLost: "{name} finished {d} before you",
};

export function rivalDictionary(locale: Locale) {
  return locale === "en" ? en : fr;
}
