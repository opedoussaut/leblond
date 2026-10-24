import type { Locale } from "./index";

const fr = {
  quickTitle: "Saisie rapide", quickHint: "Plusieurs blocs de la même cotation, et le nombre d’essais, en une fois.",
  howMany: "Nombre de blocs", howManyRoutes: "Nombre de voies", tries: "Essais",
  triesHint: "Essais par bloc, réussite comprise.", triesRouteHint: "Essais pour cette voie, enchaînement compris.",
  outcome: "Résultat",
  flash: "Flash", top: "Top", notSent: "Pas réussi", project: "Projet",
  flashOnlyOne: "Un flash, c’est au premier essai.",
  comment: "Commentaire (facultatif)", commentPlaceholder: "Prises, méthode, sensations…",
  logged: "{n} bloc(s) {grade} noté(s).", loggedRoutes: "{n} voie(s) {grade} notée(s).",
  oneByOne: "Noter essai par essai", back: "Changer de cotation",
  markProject: "★ En faire un projet", isProject: "★ Projet", projectSaved: "Projet ajouté.",
  addComment: "💬 Commentaire", editComment: "💬 Modifier le commentaire", save: "Enregistrer", saved: "Enregistré.",
  triesShort: "{n} essais", sessionName: "Nom de la séance (facultatif)", sessionNamePlaceholder: "ex. Sortie avec Thomas",
  routeProjectName: "Le projet prend le nom de la voie, ou « Projet {grade} » sans nom.",
  logTries: "Ajouter {n} essais",
};
type Dict = typeof fr;

const en: Dict = {
  quickTitle: "Quick entry", quickHint: "Several problems of the same grade, and the number of tries, in one go.",
  howMany: "Number of problems", howManyRoutes: "Number of routes", tries: "Tries",
  triesHint: "Tries per problem, including the send.", triesRouteHint: "Goes on this route, including the send.",
  outcome: "Outcome",
  flash: "Flash", top: "Top", notSent: "Not sent", project: "Project",
  flashOnlyOne: "A flash is on the first try.",
  comment: "Comment (optional)", commentPlaceholder: "Holds, beta, how it felt…",
  logged: "{n} {grade} problem(s) logged.", loggedRoutes: "{n} {grade} route(s) logged.",
  oneByOne: "Log try by try", back: "Change grade",
  markProject: "★ Make it a project", isProject: "★ Project", projectSaved: "Project added.",
  addComment: "💬 Comment", editComment: "💬 Edit comment", save: "Save", saved: "Saved.",
  triesShort: "{n} tries", sessionName: "Session name (optional)", sessionNamePlaceholder: "e.g. Session with Thomas",
  routeProjectName: "The project takes the route’s name, or “Project {grade}” if unnamed.",
  logTries: "Add {n} tries",
};

export const loggingDictionary = (locale: Locale): Dict => (locale === "en" ? en : fr);
