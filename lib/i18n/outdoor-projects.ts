import type { Locale } from "./index";

/** Outdoor projects (boulders and routes) on /projects. */
const fr = {
  venue: "Où ?", indoor: "En salle", outdoor: "En extérieur",
  site: "Site", sitePick: "Choisis un site…", siteNew: "+ Nouveau site (saisie libre)",
  siteMine: "Sites extérieurs", siteBleau: "Fontainebleau (Boolder)",
  siteName: "Nom du site", siteCity: "Commune (facultatif)", siteLink: "Lien vers le site ou son topo (facultatif)",
  siteNewHint: "Le site est ajouté à la liste des sites extérieurs et à tes favoris. Si un site porte déjà ce nom, il est réutilisé.",
  newBoulderProject: "Nouveau projet de bloc en extérieur",
  boulderFromTopo: "Bloc du topo (facultatif)", boulderFromTopoHint: "Tape au moins 2 lettres du nom pour le retrouver dans le topo du site.",
  boulderSearchPlaceholder: "ex. La Marie-Rose", noTopoHit: "Aucun bloc de ce nom dans le topo : saisis-le librement.",
  topoPicked: "Bloc du topo : {name}", clearTopo: "Saisie libre",
  boulderName: "Nom du bloc", routeName: "Nom de la voie",
  gradeFont: "Cotation (Font)", gradeFrench: "Cotation (française)",
  gradeNote: "La cotation est enregistrée telle quelle, jamais convertie.",
  sector: "Secteur", angle: "Inclinaison", beta: "Bêta", betaPlaceholder: "Méthode, prises clés, repos…",
  topo: "Topo", topoRef: "Référence topo (titre, page, numéro)", topoRefPlaceholder: "ex. Topo du site 2021, p. 34, n° 12",
  topoUrl: "Lien topo (https)", topoNote: "Indique la source (référence, lien). Ne recopie pas les schémas ou photos d’un topo publié.",
  notes: "Notes", create: "Créer le projet", details: "Détails du projet", save: "Enregistrer", saved: "Enregistré.",
  outdoorBadge: "Extérieur", topoSource: "voir le topo", photoHint: "Photos et vidéos : depuis la fiche du bloc.",
  noSites: "Aucun site extérieur pour l’instant : crée-le avec « Nouveau site ».",
  errors: {
    invalid: "Vérifie les champs : nom, cotation et lien en https.",
    siteNoRoutes: "Ce site n’est enregistré que pour le bloc. Choisis un autre site ou un autre nom.",
    siteNoBoulders: "Ce site n’est enregistré que pour la voie. Choisis un autre site ou un autre nom.",
    duplicate: "Tu as déjà un projet pour cette voie sur ce site.",
    unknownError: "Échec de l’enregistrement. Réessaie.",
  } as Record<string, string>,
};

type Dict = typeof fr;

const en: Dict = {
  venue: "Where?", indoor: "Indoors", outdoor: "Outdoors",
  site: "Crag", sitePick: "Pick a crag…", siteNew: "+ New crag (type it in)",
  siteMine: "Outdoor crags", siteBleau: "Fontainebleau (Boolder)",
  siteName: "Crag name", siteCity: "Town (optional)", siteLink: "Link to the crag or its topo (optional)",
  siteNewHint: "The crag is added to the outdoor crags and to your favourites. If a crag already has this name, it is reused.",
  newBoulderProject: "New outdoor boulder project",
  boulderFromTopo: "Boulder from the topo (optional)", boulderFromTopoHint: "Type at least 2 letters of its name to find it in the crag's topo.",
  boulderSearchPlaceholder: "e.g. La Marie-Rose", noTopoHit: "No boulder by that name in the topo: type it in freely.",
  topoPicked: "Topo boulder: {name}", clearTopo: "Type it in",
  boulderName: "Boulder name", routeName: "Route name",
  gradeFont: "Grade (Font)", gradeFrench: "Grade (French)",
  gradeNote: "The grade is stored as entered, never converted.",
  sector: "Sector", angle: "Angle", beta: "Beta", betaPlaceholder: "Method, key holds, rests…",
  topo: "Topo", topoRef: "Topo reference (title, page, number)", topoRefPlaceholder: "e.g. Crag guide 2021, p. 34, no. 12",
  topoUrl: "Topo link (https)", topoNote: "Cite the source (reference, link). Don't copy drawings or photos from a published guidebook.",
  notes: "Notes", create: "Create project", details: "Project details", save: "Save", saved: "Saved.",
  outdoorBadge: "Outdoors", topoSource: "see the topo", photoHint: "Photos and videos: from the boulder's page.",
  noSites: "No outdoor crag yet: create one with “New crag”.",
  errors: {
    invalid: "Check the fields: name, grade and an https link.",
    siteNoRoutes: "This crag is only set up for bouldering. Pick another crag or another name.",
    siteNoBoulders: "This crag is only set up for routes. Pick another crag or another name.",
    duplicate: "You already have a project for this route at this crag.",
    unknownError: "Could not save. Try again.",
  },
};

export const outdoorProjectsDictionary = (locale: Locale): Dict => (locale === "en" ? en : fr);
export type OutdoorProjectsDict = Dict;
