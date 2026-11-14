import type { Locale } from "./index";

/** Strings for the profile picture: the climber's photo, or their avatar by default. */
const fr = {
  title: "Photo de profil",
  yourPhoto: "Ta photo de profil",
  yourAvatar: "Ton avatar de progression",
  usingAvatar: "Sans photo, ton avatar de progression s’affiche partout : il change de couleur quand tu progresses.",
  usingPhoto: "Ta photo s’affiche partout à la place de ton avatar. Le cercle garde la couleur de ton niveau.",
  choose: "Choisir une photo",
  change: "Changer de photo",
  remove: "Retirer ma photo",
  removeHint: "Ton avatar reprendra sa place.",
  uploading: "Envoi…",
  removing: "Retrait…",
  saved: "Photo de profil mise à jour.",
  removed: "Photo retirée : ton avatar est de retour.",
  badType: "Ce format n’est pas lisible ici : choisis une photo JPEG, PNG ou WebP.",
  tooLarge: "Photo trop lourde (15 Mo maximum).",
  error: "La photo n’a pas pu être enregistrée. Réessaie.",
  private: "Ta photo reste privée : elle n’est visible que par toi.",
  edit: "Modifier la photo",
};

const en: typeof fr = {
  title: "Profile picture",
  yourPhoto: "Your profile photo",
  yourAvatar: "Your progression avatar",
  usingAvatar: "Without a photo, your progression avatar shows everywhere: it changes colour as you progress.",
  usingPhoto: "Your photo shows everywhere instead of your avatar. The ring keeps your level’s colour.",
  choose: "Choose a photo",
  change: "Change photo",
  remove: "Remove my photo",
  removeHint: "Your avatar will take its place again.",
  uploading: "Uploading…",
  removing: "Removing…",
  saved: "Profile picture updated.",
  removed: "Photo removed: your avatar is back.",
  badType: "This format can’t be read here: choose a JPEG, PNG or WebP photo.",
  tooLarge: "Photo too large (15 MB maximum).",
  error: "The photo couldn’t be saved. Try again.",
  private: "Your photo stays private: only you can see it.",
  edit: "Edit picture",
};

export function profilePhotoDictionary(locale: Locale) {
  return locale === "en" ? en : fr;
}
