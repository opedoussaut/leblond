import type { Locale } from "./index";

const fr = {
  editLink: "Modifier les blocs",
  title: "Blocs du topo",
  intro: "Corrige un bloc, ajoutes-en un ou supprime-le. Les blocs déjà notés par les grimpeurs restent liés. Une liste écrite ou un fichier réimporté plus tard remplace ces corrections pour les blocs qu’il contient.",
  back: "Administration bêta",
  search: "Nom ou numéro",
  allCircuits: "Tous", offCircuit: "Hors circuit",
  count: "{shown} sur {total} blocs",
  add: "+ Ajouter un bloc", addTitle: "Nouveau bloc",
  edit: "Modifier", save: "Enregistrer", cancel: "Annuler", delete: "Supprimer",
  name: "Nom", grade: "Cotation", circuit: "Circuit", number: "Numéro", numberHint: "ex. 12, 12b (bis)",
  steepness: "Profil", none: "—", sitStart: "Départ assis",
  latitude: "Latitude", longitude: "Longitude", positionHint: "Facultatif : les deux ou aucune. Sans position, le bloc est dans la liste mais pas sur la carte.",
  noPosition: "pas sur la carte",
  logged: "noté {n} fois",
  saved: "Bloc enregistré.", added: "Bloc ajouté.", deleted: "Bloc supprimé.",
  deleteTitle: "Supprimer « {name} » du topo ?",
  deleteLinked: "Il a été noté {n} fois par des grimpeurs : leurs essais restent, mais le lien vers le topo est retiré.",
  deleteUnlinked: "Personne ne l’a encore noté.",
  errors: {
    invalid: "Vérifie les champs : nom, cotation, et un numéro si le bloc est sur un circuit.",
    position: "Indique la latitude et la longitude, ou aucune des deux.",
    duplicate: "Un autre bloc a déjà ce circuit et ce numéro (ou ce nom hors circuit).",
    forbidden: "Réservé à l’administrateur.",
    notFound: "Ce bloc n’existe plus : recharge la page.",
    failed: "L’enregistrement a échoué. Réessaie.",
  },
};
type Dict = typeof fr;

const en: Dict = {
  editLink: "Edit problems",
  title: "Topo problems",
  intro: "Correct a problem, add one or delete it. Problems climbers have already logged stay linked. A written list or file re-imported later replaces these corrections for the problems it contains.",
  back: "Beta administration",
  search: "Name or number",
  allCircuits: "All", offCircuit: "Off circuit",
  count: "{shown} of {total} problems",
  add: "+ Add a problem", addTitle: "New problem",
  edit: "Edit", save: "Save", cancel: "Cancel", delete: "Delete",
  name: "Name", grade: "Grade", circuit: "Circuit", number: "Number", numberHint: "e.g. 12, 12b (bis)",
  steepness: "Profile", none: "—", sitStart: "Sit start",
  latitude: "Latitude", longitude: "Longitude", positionHint: "Optional: both or neither. Without a position, the problem is in the list but not on the map.",
  noPosition: "not on the map",
  logged: "logged {n} times",
  saved: "Problem saved.", added: "Problem added.", deleted: "Problem deleted.",
  deleteTitle: "Delete “{name}” from the topo?",
  deleteLinked: "Climbers logged it {n} times: their tries stay, but the link to the topo is removed.",
  deleteUnlinked: "Nobody has logged it yet.",
  errors: {
    invalid: "Check the fields: name, grade, and a number if the problem is on a circuit.",
    position: "Give both latitude and longitude, or neither.",
    duplicate: "Another problem already has this circuit and number (or this name off circuit).",
    forbidden: "Admin only.",
    notFound: "This problem no longer exists: reload the page.",
    failed: "Saving failed. Try again.",
  },
};

export type TopoEditorError = keyof Dict["errors"];
export const topoEditorDictionary = (locale: Locale): Dict => (locale === "en" ? en : fr);
