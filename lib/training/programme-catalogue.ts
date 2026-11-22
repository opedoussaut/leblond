import { fmt, type Locale } from "@/lib/i18n";
import type { PhaseKind, PlanPlace, TrainingPlanInput } from "./plans";

/**
 * Ready-made programmes the climber can follow from /programmes ("Programmes proposés").
 *
 * Each one is a generic, periodised structure adapted from a published coaching approach
 * (sources below, summarised in our own words). They are starting points, not
 * prescriptions or validated predictions: following one copies it into the climber's own
 * programmes, where every session can be edited. No personal data lives here.
 */

type Localized = { fr: string; en: string };

export const PROGRAMME_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type ProgrammeLevel = (typeof PROGRAMME_LEVELS)[number];
export type ProgrammeDiscipline = "BOULDER" | "ROUTE" | "BOTH";

type CatalogueSession = {
  day: number;
  methodId: string;
  minutes: number;
  place: PlanPlace;
  title: Localized;
  notes: Localized;
  optional?: boolean;
};

type CataloguePhase = {
  name: Localized;
  kind: PhaseKind;
  weeks: number;
  objective: Localized;
  sessions: CatalogueSession[];
};

export type CatalogueProgramme = {
  id: string;
  title: Localized;
  /** One line: what it is for and how it is built. */
  summary: Localized;
  goal: Localized;
  /** Lowest level it suits; it also suits the next one up unless `levelMax` says otherwise. */
  level: ProgrammeLevel;
  levelMax: ProgrammeLevel;
  discipline: ProgrammeDiscipline;
  source: { label: string; url: string };
  phases: CataloguePhase[];
};

// Reusable sessions. Notes name the matching session family of the shared library when there is one.
const s = {
  technique: (day: number, minutes: number, place: PlanPlace = "BOULDER_GYM"): CatalogueSession => ({
    day, methodId: "technique", minutes, place,
    title: { fr: "Technique et volume facile", en: "Technique and easy volume" },
    notes: {
      fr: "Beaucoup de blocs ou voies 2 à 3 niveaux sous ton max, pieds précis, placements, lecture. Modèle conseillé : « Technique au mur ».",
      en: "Plenty of problems or routes 2–3 grades below your max: precise feet, positioning, reading. Suggested template: “Technique au mur”.",
    },
  }),
  volume: (day: number, minutes: number, place: PlanPlace = "ROUTE_GYM"): CatalogueSession => ({
    day, methodId: "easy-volume", minutes, place,
    title: { fr: "Volume facile (continuité)", en: "Easy volume (continuity)" },
    notes: {
      fr: "Grimpe continue à faible intensité : 3 à 4 passages de 10 à 15 min, léger essoufflement, jamais de grosse « bouteille ». Modèle conseillé : « Endurance en voie » (facile).",
      en: "Low-intensity continuous climbing: 3–4 bouts of 10–15 min, slightly out of breath, never deeply pumped. Suggested template: “Endurance en voie” (easy).",
    },
  }),
  limit: (day: number, minutes: number): CatalogueSession => ({
    day, methodId: "limit-bouldering", minutes, place: "BOULDER_GYM",
    title: { fr: "Bloc à ta limite", en: "Limit bouldering" },
    notes: {
      fr: "Après un bon échauffement : 4 à 6 blocs durs (1 à 3 mouvements de ton max), essais courts et 3 min de repos complet. Arrête dès que la qualité baisse. Modèle conseillé : « Puissance en bloc ».",
      en: "After a thorough warm-up: 4–6 hard problems (moves near your max), short attempts and 3 min full rest. Stop when quality drops. Suggested template: “Puissance en bloc”.",
    },
  }),
  maxHangs: (day: number, minutes: number): CatalogueSession => ({
    day, methodId: "max-hangs", minutes, place: "HOME",
    title: { fr: "Poutre : suspensions max", en: "Hangboard: max hangs" },
    notes: {
      fr: "Préhension semi-arquée, 10 s de suspension sur une réglette où tu en tiendrais environ 13, 3 min de repos, 3 à 5 séries. Charge ajustée par lest ou décharge. Modèle conseillé : « Force des doigts ».",
      en: "Half crimp, 10 s hangs on an edge you could hold for about 13 s, 3 min rest, 3–5 sets. Adjust load with weight or assistance. Suggested template: “Force des doigts”.",
    },
  }),
  repeaters: (day: number, minutes: number): CatalogueSession => ({
    day, methodId: "repeaters", minutes, place: "HOME",
    title: { fr: "Poutre : suspensions intermittentes", en: "Hangboard: intermittent hangs" },
    notes: {
      fr: "Séries de 4 à 6 suspensions de 10 s avec 5 s de pause, 1 min entre les séries, 3 à 5 séries. Charge modérée, aucune douleur aux doigts. Modèle conseillé : « Force des doigts ».",
      en: "Sets of 4–6 × 10 s hangs with 5 s pauses, 1 min between sets, 3–5 sets. Moderate load, no finger pain. Suggested template: “Force des doigts”.",
    },
  }),
  fourByFour: (day: number, minutes: number, place: PlanPlace = "BOULDER_GYM"): CatalogueSession => ({
    day, methodId: "four-by-four", minutes, place,
    title: { fr: "Résistance : 4×4 ou intervalles", en: "Power endurance: 4×4 or intervals" },
    notes: {
      fr: "4 blocs moyens enchaînés sans repos (ou une voie dure), 4 tours avec 3 à 4 min de récupération. Fini en net « bouteille », sans perdre la technique.",
      en: "4 moderate problems back to back (or one hard route), 4 rounds with 3–4 min recovery. Finish clearly pumped, keeping technique clean.",
    },
  }),
  strength: (day: number, minutes: number): CatalogueSession => ({
    day, methodId: "strength-conditioning", minutes, place: "HOME",
    title: { fr: "Renfo hors mur : tirage, gainage, antagonistes", en: "Off-wall strength: pull, core, antagonists" },
    notes: {
      fr: "Tractions ou tirage, gainage, pompes et épaules, jambes. 2 à 3 exercices clés en séries courtes et lourdes, pas jusqu’à l’épuisement. Modèles conseillés : « Haut et bas du corps », « Gainage et tension du corps ».",
      en: "Pull-ups or rows, core, push and shoulders, legs. 2–3 key exercises in short, heavy sets, never to exhaustion. Suggested templates: “Haut et bas du corps”, “Gainage et tension du corps”.",
    },
  }),
  mobility: (day: number, minutes: number, optional = true): CatalogueSession => ({
    day, methodId: "mobility", minutes, place: "HOME", optional,
    title: { fr: "Mobilité et récupération", en: "Mobility and recovery" },
    notes: {
      fr: "Hanches, épaules, chaîne postérieure, à faible intensité. Modèles conseillés : « Souplesse et mobilité pour grimpeurs », « Récupération active ».",
      en: "Hips, shoulders, posterior chain, at low intensity. Suggested templates: “Souplesse et mobilité pour grimpeurs”, “Récupération active”.",
    },
  }),
  free: (day: number, minutes: number, place: PlanPlace = "BOULDER_GYM", optional = false): CatalogueSession => ({
    day, methodId: "easy-volume", minutes, place, optional,
    title: { fr: "Grimpe libre, sans forcer", en: "Free climbing, no forcing" },
    notes: {
      fr: "Semaine allégée : grimpe pour le plaisir, environ la moitié du volume habituel, rien à ton max.",
      en: "Lighter week: climb for fun, about half the usual volume, nothing at your max.",
    },
  }),
  outdoor: (day: number, minutes: number): CatalogueSession => ({
    day, methodId: "limit-bouldering", minutes, place: "CRAG", optional: true,
    title: { fr: "Sortie falaise ou blocs (si possible)", en: "Crag or boulder day (if possible)" },
    notes: {
      fr: "Remplace une séance de salle quand la météo le permet : essais sur projet puis volume plus facile.",
      en: "Replaces one gym session when weather allows: tries on a project, then easier volume.",
    },
  }),
};

const deload = (days: CatalogueSession[]): CataloguePhase => ({
  name: { fr: "Semaine allégée", en: "Deload week" },
  kind: "DELOAD",
  weeks: 1,
  objective: { fr: "Récupérer : moitié du volume, aucune séance à fond.", en: "Recover: half the volume, no maximal session." },
  sessions: days,
});

export const PROGRAMME_CATALOGUE: readonly CatalogueProgramme[] = [
  {
    id: "foundations-4w-2d",
    title: { fr: "Bases solides — 2 jours", en: "Solid foundations — 2 days" },
    summary: {
      fr: "Technique et volume facile 3 semaines, puis une semaine allégée : pour reprendre ou grimper peu mais bien.",
      en: "Technique and easy volume for 3 weeks, then a deload week: to restart, or to climb little but well.",
    },
    goal: { fr: "Grimper plus juste et plus régulier, sans se blesser", en: "Climb more precisely and consistently, injury-free" },
    level: "BEGINNER", levelMax: "INTERMEDIATE", discipline: "BOTH",
    source: { label: "Lattice Training — Do climbers need deload weeks?", url: "https://latticetraining.com/blog/do_climbers_need_deload_weeks" },
    phases: [
      {
        name: { fr: "Bases", en: "Base" }, kind: "BASE", weeks: 3,
        objective: { fr: "Enchaîner 15 blocs ou 6 voies faciles sans erreur de pied.", en: "Climb 15 easy problems or 6 routes with no foot mistakes." },
        sessions: [s.technique(1, 90), { ...s.strength(3, 30), optional: true }, s.volume(5, 90, "BOULDER_GYM"), s.mobility(6, 30)],
      },
      deload([s.free(1, 60), s.free(5, 60)]),
    ],
  },
  {
    id: "horst-321-6w-3d",
    title: { fr: "Cycle 3-2-1 bloc — 3 jours", en: "3-2-1 bouldering cycle — 3 days" },
    summary: {
      fr: "3 semaines de force et puissance, 2 de résistance, 1 de repos : le cycle court d’Eric Hörst pour le bloc.",
      en: "3 weeks of strength and power, 2 of power endurance, 1 of rest: Eric Hörst’s short cycle for bouldering.",
    },
    goal: { fr: "Gagner en force et en puissance sur les blocs durs", en: "Gain strength and power on hard boulders" },
    level: "INTERMEDIATE", levelMax: "ADVANCED", discipline: "BOULDER",
    source: { label: "Eric Hörst, Training for Climbing — programmes 4-3-2-1 / 3-2-1", url: "https://trainingforclimbing.com/training-programs/" },
    phases: [
      {
        name: { fr: "Force et puissance", en: "Strength and power" }, kind: "BUILD", weeks: 3,
        objective: { fr: "Réussir un bloc de ton niveau max qui te résistait.", en: "Send a max-grade problem that used to stop you." },
        sessions: [s.limit(1, 90), s.maxHangs(3, 40), s.limit(5, 90), s.mobility(6, 30)],
      },
      {
        name: { fr: "Résistance", en: "Power endurance" }, kind: "BUILD", weeks: 2,
        objective: { fr: "Tenir 4 tours de 4×4 sans perdre la technique.", en: "Hold 4 rounds of 4×4 with clean technique." },
        sessions: [s.limit(1, 75), s.fourByFour(3, 60), s.fourByFour(5, 75), s.mobility(6, 30)],
      },
      deload([s.free(1, 60), s.mobility(4, 30, false)]),
    ],
  },
  {
    id: "horst-4321-10w-3d",
    title: { fr: "Cycle 4-3-2-1 voie — 3 jours", en: "4-3-2-1 route cycle — 3 days" },
    summary: {
      fr: "Volume 4 semaines, force et puissance 3, résistance 2, repos 1 : le cycle complet d’Eric Hörst, idéal en voie.",
      en: "Volume 4 weeks, strength and power 3, power endurance 2, rest 1: Eric Hörst’s full cycle, ideal for routes.",
    },
    goal: { fr: "Progresser en voie : continuité, force puis résistance", en: "Progress on routes: stamina, strength, then power endurance" },
    level: "INTERMEDIATE", levelMax: "ADVANCED", discipline: "ROUTE",
    source: { label: "Eric Hörst, Training for Climbing — programmes 4-3-2-1 / 3-2-1", url: "https://trainingforclimbing.com/training-programs/" },
    phases: [
      {
        name: { fr: "Volume et technique", en: "Volume and technique" }, kind: "BASE", weeks: 4,
        objective: { fr: "Grimper 30 à 40 min en continu sans grosse bouteille.", en: "Climb 30–40 min continuously without getting deeply pumped." },
        sessions: [s.technique(1, 90, "ROUTE_GYM"), s.volume(3, 90), s.volume(5, 90), s.outdoor(6, 240)],
      },
      {
        name: { fr: "Force et puissance", en: "Strength and power" }, kind: "BUILD", weeks: 3,
        objective: { fr: "Réussir des mouvements durs isolés que tu ne passais pas.", en: "Do hard single moves you could not do before." },
        sessions: [s.limit(1, 90), s.maxHangs(3, 40), s.limit(5, 90), s.outdoor(6, 240)],
      },
      {
        name: { fr: "Résistance", en: "Power endurance" }, kind: "BUILD", weeks: 2,
        objective: { fr: "Enchaîner une voie dure deux fois avec 10 min de repos.", en: "Climb a hard route twice with 10 min rest in between." },
        sessions: [s.fourByFour(1, 75, "ROUTE_GYM"), s.technique(3, 60, "ROUTE_GYM"), s.fourByFour(5, 75, "ROUTE_GYM"), s.outdoor(6, 240)],
      },
      deload([s.free(1, 60, "ROUTE_GYM"), s.mobility(4, 30, false)]),
    ],
  },
  {
    id: "fingers-lopez-8w-4d",
    title: { fr: "Doigts à la poutre — 2 grimpe + 2 poutre", en: "Hangboard fingers — 2 climbing + 2 hangboard" },
    summary: {
      fr: "Suspensions max 3 semaines puis intermittentes 3, chaque bloc suivi d’une semaine allégée, en gardant 2 séances de grimpe.",
      en: "Max hangs for 3 weeks then intermittent hangs for 3, each block followed by a deload week, keeping 2 climbing sessions.",
    },
    goal: { fr: "Des doigts plus forts pour les réglettes", en: "Stronger fingers for crimps" },
    level: "INTERMEDIATE", levelMax: "ADVANCED", discipline: "BOTH",
    source: { label: "López-Rivera & González-Badillo (2019), J. Hum. Kinet. — suspensions max vs intermittentes, 8 semaines", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6458579/" },
    phases: [
      {
        name: { fr: "Suspensions max", en: "Max hangs" }, kind: "BUILD", weeks: 3,
        objective: { fr: "Ajouter un peu de lest à charge égale de 10 s.", en: "Add a little load for the same 10 s hang." },
        sessions: [s.maxHangs(0, 30), s.technique(1, 90), s.maxHangs(3, 30), s.limit(5, 90)],
      },
      deload([s.technique(1, 60), s.free(5, 60)]),
      {
        name: { fr: "Suspensions intermittentes", en: "Intermittent hangs" }, kind: "BUILD", weeks: 3,
        objective: { fr: "Tenir une série de plus à la même charge.", en: "Hold one more set at the same load." },
        sessions: [s.repeaters(0, 30), s.technique(1, 90), s.repeaters(3, 30), s.fourByFour(5, 90)],
      },
      deload([s.free(1, 60), s.free(5, 60)]),
    ],
  },
  {
    id: "linear-8w-4d",
    title: { fr: "Périodisation linéaire — 4 jours", en: "Linear periodisation — 4 days" },
    summary: {
      fr: "Base, force à la poutre, puissance puis résistance, et une semaine de repos : le modèle linéaire des frères Anderson, condensé en 8 semaines.",
      en: "Base, hangboard strength, power then power endurance, and a rest week: the Anderson brothers’ linear model, condensed to 8 weeks.",
    },
    goal: { fr: "Monter d’un cran sur ton projet, bloc ou voie", en: "Step up a grade on your project, boulder or route" },
    level: "INTERMEDIATE", levelMax: "ADVANCED", discipline: "BOTH",
    source: { label: "Mark & Mike Anderson, The Rock Climber’s Training Manual (périodisation linéaire)", url: "https://rockclimberstrainingmanual.com/" },
    phases: [
      {
        name: { fr: "Base", en: "Base" }, kind: "BASE", weeks: 2,
        objective: { fr: "Reprendre du volume sans douleur.", en: "Rebuild volume pain-free." },
        sessions: [s.technique(0, 90), s.strength(2, 45), s.volume(3, 90), s.technique(5, 120)],
      },
      {
        name: { fr: "Force (poutre)", en: "Strength (hangboard)" }, kind: "BUILD", weeks: 2,
        objective: { fr: "Progresser en charge sur les suspensions max.", en: "Increase load on max hangs." },
        sessions: [s.maxHangs(0, 40), s.limit(1, 90), s.maxHangs(3, 40), s.limit(5, 120)],
      },
      {
        name: { fr: "Puissance", en: "Power" }, kind: "BUILD", weeks: 2,
        objective: { fr: "Réussir des blocs courts et durs plus vite.", en: "Send short, hard problems in fewer tries." },
        sessions: [s.limit(1, 90), s.strength(2, 45), s.limit(3, 90), s.outdoor(5, 240)],
      },
      {
        name: { fr: "Résistance", en: "Power endurance" }, kind: "BUILD", weeks: 1,
        objective: { fr: "Enchaîner ton projet ou ses longues sections.", en: "Link your project or its long sections." },
        sessions: [s.fourByFour(1, 75), s.technique(3, 60), s.fourByFour(5, 75), s.outdoor(6, 240)],
      },
      deload([s.free(1, 60), s.mobility(3, 30, false), s.free(5, 60)]),
    ],
  },
  {
    id: "nonlinear-6w-3d",
    title: { fr: "Non linéaire — 3 jours", en: "Nonlinear — 3 days" },
    summary: {
      fr: "Chaque semaine mêle force, bloc dur et résistance, l’accent change toutes les 2 semaines : souple, pour une vie chargée.",
      en: "Every week mixes strength, hard bouldering and power endurance, the emphasis shifting every 2 weeks: flexible, for a busy life.",
    },
    goal: { fr: "Progresser sur tous les fronts sans grand bloc spécialisé", en: "Progress on every front without long specialised blocks" },
    level: "INTERMEDIATE", levelMax: "ADVANCED", discipline: "BOTH",
    source: { label: "Steve Bechtel, Logical Progression — périodisation non linéaire (Climb Strong)", url: "https://climbstrong.com/education-center/tag/nonlinear-periodization" },
    phases: [
      {
        name: { fr: "Accent force", en: "Strength emphasis" }, kind: "BUILD", weeks: 2,
        objective: { fr: "2 séances de force, 1 de bloc par semaine.", en: "2 strength sessions, 1 bouldering session a week." },
        sessions: [s.maxHangs(0, 45), s.limit(2, 90), s.strength(4, 45)],
      },
      {
        name: { fr: "Accent bloc", en: "Bouldering emphasis" }, kind: "BUILD", weeks: 2,
        objective: { fr: "2 séances de bloc à ta limite, 1 de force ou de technique.", en: "2 limit bouldering sessions, 1 of strength or technique." },
        sessions: [s.limit(0, 90), s.technique(2, 60), s.limit(4, 90)],
      },
      {
        name: { fr: "Accent résistance", en: "Power endurance emphasis" }, kind: "BUILD", weeks: 1,
        objective: { fr: "2 séances de résistance, 1 de technique.", en: "2 power endurance sessions, 1 of technique." },
        sessions: [s.fourByFour(0, 75), s.technique(2, 60), s.fourByFour(4, 75)],
      },
      deload([s.free(1, 60), s.mobility(3, 30, false)]),
    ],
  },
];

export function catalogueProgramme(id: string): CatalogueProgramme | undefined {
  return PROGRAMME_CATALOGUE.find((p) => p.id === id);
}

/** Total length in weeks. */
export function catalogueWeeks(p: Pick<CatalogueProgramme, "phases">): number {
  return p.phases.reduce((sum, phase) => sum + phase.weeks, 0);
}

/** Training days a week outside the lighter weeks (optional sessions not counted): the most a regular week asks. */
export function catalogueDaysPerWeek(p: Pick<CatalogueProgramme, "phases">): number {
  const hard = p.phases.filter((phase) => phase.kind === "BASE" || phase.kind === "BUILD");
  return Math.max(0, ...hard.map((phase) => new Set(phase.sessions.filter((x) => !x.optional).map((x) => x.day)).size));
}

/** The programme as one of the climber's own plans, in their language (sessions sorted by day). */
export function cataloguePlan(p: CatalogueProgramme, locale: Locale): TrainingPlanInput {
  const phases = p.phases.map((phase) => ({
    name: phase.name[locale],
    kind: phase.kind,
    weeks: phase.weeks,
    objective: phase.objective[locale],
    sessions: [...phase.sessions].sort((a, b) => a.day - b.day).map((x) => ({
      day: x.day, methodId: x.methodId, minutes: x.minutes, place: x.place,
      title: x.title[locale], notes: x.notes[locale], ...(x.optional ? { optional: true } : {}),
    })),
  }));
  const weeks = catalogueWeeks(p);
  return {
    name: p.title[locale],
    goal: p.goal[locale],
    weeks,
    duration: { value: weeks, unit: "WEEKS" },
    mode: "MANUAL",
    sessions: phases[0].sessions,
    ...(phases.length > 1 ? { phases } : {}),
  };
}

export type CatalogueTexts = {
  /** "{weeks} semaines · {days} jours par semaine · {level} · {discipline}" */
  catalogueFacts: string;
  catalogueLevels: Record<ProgrammeLevel, string>;
  /** "{from} à {to}" */
  catalogueLevelRange: string;
  catalogueDisciplines: Record<ProgrammeDiscipline, string>;
};

/** One line of facts: length, days a week, level and discipline. */
export function catalogueFacts(p: CatalogueProgramme, t: CatalogueTexts): string {
  const level = p.level === p.levelMax ? t.catalogueLevels[p.level]
    : fmt(t.catalogueLevelRange, { from: t.catalogueLevels[p.level], to: t.catalogueLevels[p.levelMax] });
  return fmt(t.catalogueFacts, { weeks: catalogueWeeks(p), days: catalogueDaysPerWeek(p), level, discipline: t.catalogueDisciplines[p.discipline] });
}

/** The catalogue as the picker lists it, in the viewer's language. */
export function catalogueChoices(locale: Locale, t: CatalogueTexts) {
  return PROGRAMME_CATALOGUE.map((p) => ({
    id: p.id, title: p.title[locale], summary: p.summary[locale], facts: catalogueFacts(p, t), source: p.source,
  }));
}
