import type { Locale } from "./index";
import type { ArkoseRejectReason } from "@/lib/climbing/arkose-history";

/** Strings for importing past sends counted by Arkose. */
const fr = {
  link: "Importer ton historique Arkose",
  title: "Importer ton historique Arkose",
  intro: "Ajoute tes anciennes séances à partir des nombres de blocs réussis par couleur que donnent tes statistiques Arkose.",
  what: "Chaque jour devient une séance de bloc terminée dans la salle choisie, avec un bloc réussi par croix, dans sa couleur. Arkose ne dit ni quel bloc, ni combien d'essais, ni s'il était flashé : rien n'est inventé, tout est noté « réussi » et la séance porte la mention « importée d'Arkose ».",
  format: "Fichier attendu : une ligne par jour et par couleur, avec les colonnes date, couleur, nombre (par exemple 2025-09-02,jaune,11).",
  again: "Un jour qui a déjà une séance de bloc dans cette salle est laissé de côté : importer deux fois le même fichier n'ajoute rien.",
  gym: "Salle Arkose",
  noGym: "Aucune salle Arkose de bloc n'est disponible.",
  file: "Fichier",
  preview: "{sends} blocs réussis sur {days} jour(s) · {rejected} ligne(s) refusée(s)",
  previewDay: "{date} · {n} blocs",
  missing: "Colonnes manquantes : {cols}",
  empty: "Aucune ligne utilisable dans ce fichier.",
  rejectedLine: "Ligne {line} : {reason}",
  reasons: {
    date: "date illisible (AAAA-MM-JJ attendu)",
    colour: "couleur inconnue",
    count: "nombre invalide",
    future: "date dans le futur",
  } satisfies Record<ArkoseRejectReason, string>,
  run: "Importer",
  importing: "Import en cours… {done} / {total} jours",
  done: "{sessions} séance(s) et {sends} blocs ajoutés, {skippedDays} jour(s) déjà présents laissés de côté.",
  seeJournal: "Voir le journal",
  error: "L'import s'est arrêté. Ce qui est déjà ajouté reste ; relance le même fichier pour finir.",
};

const en: typeof fr = {
  link: "Import your Arkose history",
  title: "Import your Arkose history",
  intro: "Add your past séances from the number of boulders sent per colour shown in your Arkose statistics.",
  what: "Each day becomes a finished boulder séance at the chosen gym, with one sent boulder per tick, in its colour. Arkose does not say which boulder, how many tries, or whether it was flashed: nothing is invented, everything is logged as “sent” and the séance is labelled “imported from Arkose”.",
  format: "Expected file: one line per day and colour, with the columns date, colour, count (for example 2025-09-02,yellow,11).",
  again: "A day that already has a boulder séance at this gym is left out: importing the same file twice adds nothing.",
  gym: "Arkose gym",
  noGym: "No Arkose bouldering gym is available.",
  file: "File",
  preview: "{sends} boulders sent over {days} day(s) · {rejected} line(s) refused",
  previewDay: "{date} · {n} boulders",
  missing: "Missing columns: {cols}",
  empty: "No usable line in this file.",
  rejectedLine: "Line {line}: {reason}",
  reasons: {
    date: "unreadable date (YYYY-MM-DD expected)",
    colour: "unknown colour",
    count: "invalid count",
    future: "date in the future",
  },
  run: "Import",
  importing: "Importing… {done} / {total} days",
  done: "{sessions} séance(s) and {sends} boulders added, {skippedDays} day(s) already there left out.",
  seeJournal: "See the journal",
  error: "The import stopped. What was added stays; run the same file again to finish.",
};

export function arkoseImportDictionary(locale: Locale) {
  return locale === "en" ? en : fr;
}
