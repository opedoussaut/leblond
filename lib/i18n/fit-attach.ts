import type { Locale } from "./index";

/** Attaching a watch's FIT file to a climbing séance (creation, edit, summary). */
const fr = {
  sectionTitle: "Fichier FIT de la montre",
  optional: "facultatif",
  pastHint: "COROS, Garmin, Suunto… Exporte l’activité au format .fit (max 4 Mo) : la date, l’heure et la durée de la séance seront reprises du fichier.",
  attach: "Joindre un fichier FIT",
  replace: "Remplacer le fichier FIT",
  remove: "Retirer le fichier FIT",
  removeConfirm: "Retirer le fichier FIT de cette séance ? La séance garde ses horaires actuels (comptés comme saisis à la main) ; le fichier reste dans Réglages › Connexions.",
  uploading: "Envoi du fichier…",
  attached: "Fichier FIT joint.",
  timingReplaced: "Les horaires de la séance ont été remplacés par ceux de la montre : {after} (avant : {before}).",
  timingSame: "Les horaires de la séance correspondaient déjà à ceux de la montre.",
  alreadyHere: "Ce fichier est déjà joint à cette séance.",
  elsewhere: "Ce fichier est déjà joint à une autre séance.",
  openOther: "Voir cette séance",
  confirmTitle: "Ce fichier ne correspond pas aux horaires de la séance",
  confirmBody: "Fichier : {watch}. Séance : {session}. Si tu le joins, la séance prendra les horaires du fichier.",
  confirmAttach: "Joindre quand même",
  cancel: "Annuler",
  fileTimes: "Horaires repris du fichier : {when}.",
  fieldsDiffer: "Tu as changé les horaires : la séance prendra quand même ceux du fichier ({when}).",
  linkFailed: "La séance est créée, mais le fichier FIT n’a pas pu y être joint. Réessaie ci-dessous.",
  notFit: "Ce fichier n’est pas un fichier FIT valide.",
  noActivity: "Le fichier ne contient pas de résumé d’activité exploitable.",
  tooLarge: "Fichier trop gros : 4 Mo maximum.",
  unknown: "L’envoi a échoué. Réessaie.",
};
type Dict = typeof fr;

const en: Dict = {
  sectionTitle: "Watch FIT file",
  optional: "optional",
  pastHint: "COROS, Garmin, Suunto… Export the activity as a .fit file (4 MB max): the session’s date, start time and duration will be taken from it.",
  attach: "Attach a FIT file",
  replace: "Replace the FIT file",
  remove: "Remove the FIT file",
  removeConfirm: "Remove the FIT file from this session? The session keeps its current times (counted as typed by hand); the file stays in Settings › Connections.",
  uploading: "Uploading…",
  attached: "FIT file attached.",
  timingReplaced: "The session’s times were replaced by the watch’s: {after} (before: {before}).",
  timingSame: "The session’s times already matched the watch’s.",
  alreadyHere: "This file is already attached to this session.",
  elsewhere: "This file is already attached to another session.",
  openOther: "Open that session",
  confirmTitle: "This file does not match the session’s times",
  confirmBody: "File: {watch}. Session: {session}. If you attach it, the session will take the file’s times.",
  confirmAttach: "Attach anyway",
  cancel: "Cancel",
  fileTimes: "Times taken from the file: {when}.",
  fieldsDiffer: "You changed the times: the session will still take the file’s ({when}).",
  linkFailed: "The session was created, but the FIT file could not be attached. Try again below.",
  notFit: "This is not a valid FIT file.",
  noActivity: "The file has no usable activity summary.",
  tooLarge: "File too large: 4 MB max.",
  unknown: "Upload failed. Try again.",
};

export const fitAttachDictionary = (locale: Locale): Dict => (locale === "en" ? en : fr);
export type FitAttachDictionary = Dict;
