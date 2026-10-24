import type { Locale } from "./index";

const fr = {
  pastTab: "Séance passée",
  pastTitle: "Ajouter une séance déjà faite",
  pastHint: "Tu as grimpé sans l’appli ? Choisis le lieu, puis la date, l’heure et la durée. Tu ajouteras ensuite tes blocs ou tes voies.",
  where: "Où as-tu grimpé ?", gymTab: "En salle", bleauTab: "À Bleau",
  chosen: "Lieu choisi", change: "Changer",
  discipline: "Discipline", boulder: "Bloc", route: "Voie",
  date: "Date", time: "Heure de début", minutes: "Durée (minutes)",
  create: "Créer la séance et ajouter mes blocs / voies", creating: "Création…",
  invalidDate: "La date doit être dans le passé.",
  editTitle: "Modifier la séance", editing: "MODIFICATION",
  when: "Date, heure et durée", save: "Enregistrer", saved: "Enregistré.",
  moveHint: "Les essais de la séance sont déplacés avec elle.",
  logTitle: "Blocs et voies de la séance",
  done: "Terminer les modifications", edit: "Modifier", delete: "Supprimer la séance",
  deleteConfirm: "Supprimer définitivement cette séance et tous ses essais ?",
  addedAfter: "Ajoutée après coup",
  nativeColour: "Couleur de la salle", frenchEquivalent: "Équivalent en cotation française",
  frenchHint: "La salle cote ses voies en couleurs : indique la cotation française correspondante. LEBLOND retient ton choix pour cette couleur.",
};
type Dict = typeof fr;

const en: Dict = {
  pastTab: "Past session",
  pastTitle: "Add a session you already did",
  pastHint: "Climbed without the app? Pick the place, then the date, start time and duration. You will then add your problems or routes.",
  where: "Where did you climb?", gymTab: "Gym", bleauTab: "Fontainebleau",
  chosen: "Place", change: "Change",
  discipline: "Discipline", boulder: "Bouldering", route: "Routes",
  date: "Date", time: "Start time", minutes: "Duration (minutes)",
  create: "Create the session and add my problems / routes", creating: "Creating…",
  invalidDate: "The date must be in the past.",
  editTitle: "Edit session", editing: "EDITING",
  when: "Date, time and duration", save: "Save", saved: "Saved.",
  moveHint: "The session’s attempts move with it.",
  logTitle: "Problems and routes in this session",
  done: "Finish editing", edit: "Edit", delete: "Delete session",
  deleteConfirm: "Permanently delete this session and all its attempts?",
  addedAfter: "Added afterwards",
  nativeColour: "Gym colour", frenchEquivalent: "French grade equivalent",
  frenchHint: "This gym grades routes by colour: pick the matching French grade. LEBLOND remembers your choice for that colour.",
};

export const sessionEditDictionary = (locale: Locale): Dict => (locale === "en" ? en : fr);
