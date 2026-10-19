/**
 * Public, editorially curated climbing-training atlas.
 *
 * Radar scores describe WHAT A METHOD EMPHASISES, not its proven effectiveness
 * or the safety/quality of an individual commercial provider.
 * Evidence labels belong to methods; provider descriptions are claims from
 * their official pages and are not independent clinical validation.
 */
export const TRAINING_AXES = [
  "technique",
  "fingers",
  "power",
  "endurance",
  "mental",
  "structure",
] as const;

export type TrainingAxis = (typeof TRAINING_AXES)[number];
export type TrainingCategory = "methods" | "programs" | "tools";
export type TrainingGoal = "boulder" | "sport" | "technique" | "strength";
export type Localized = { en: string; fr: string };
export type Evidence = "controlled" | "limited" | "practice" | "provider";
export type Score = readonly [number, number, number, number, number, number];

export type TrainingEntry = {
  id: string;
  category: TrainingCategory;
  title: string;
  description: Localized;
  goals: readonly TrainingGoal[];
  evidence: Evidence;
  scores: Score;
  source: { label: string; url: string };
  caution?: Localized;
};

export const TRAINING_CATALOGUE: readonly TrainingEntry[] = [
  {
    id: "technique", category: "methods", title: "Technique drills & video feedback",
    description: { en: "Deliberate footwork, positioning and movement review.", fr: "Travail délibéré des pieds, des placements et analyse vidéo des mouvements." },
    goals: ["boulder", "sport", "technique"], evidence: "practice",
    scores: [5, 1, 2, 2, 3, 2],
    source: { label: "Hooper's Beta — coaching", url: "https://www.hoopersbeta.com/coaching" },
  },
  {
    id: "constraints", category: "methods", title: "Constraints-led practice",
    description: { en: "Vary task constraints to explore effective movement solutions.", fr: "Varier les contraintes pour explorer des solutions gestuelles adaptées." },
    goals: ["boulder", "sport", "technique"], evidence: "limited",
    scores: [5, 1, 3, 2, 3, 2],
    source: { label: "Research search — ecological dynamics in climbing", url: "https://scholar.google.com/scholar?q=climbing+constraints+led+approach+ecological+dynamics" },
  },
  {
    id: "limit-bouldering", category: "methods", title: "Limit bouldering",
    description: { en: "Work difficult individual moves near your current limit with ample recovery.", fr: "Travailler des mouvements isolés très difficiles, avec une récupération suffisante." },
    goals: ["boulder", "strength"], evidence: "practice",
    scores: [3, 3, 5, 1, 3, 2],
    source: { label: "Power Company — Proven Plans", url: "https://www.powercompanyclimbing.com/proven-plans" },
  },
  {
    id: "max-hangs", category: "methods", title: "Max hangs",
    description: { en: "High-intensity fingerboard loading aimed primarily at maximum finger force.", fr: "Suspensions à haute intensité visant principalement la force maximale des doigts." },
    goals: ["boulder", "sport", "strength"], evidence: "controlled",
    scores: [1, 5, 2, 1, 1, 2],
    source: { label: "Randomized comparison — PubMed (2022)", url: "https://pubmed.ncbi.nlm.nih.gov/35498522/" },
    caution: { en: "For appropriately experienced climbers; progress load conservatively.", fr: "Pour grimpeurs suffisamment expérimentés ; augmenter la charge progressivement." },
  },
  {
    id: "repeaters", category: "methods", title: "Fingerboard repeaters",
    description: { en: "Intermittent hangs emphasizing finger endurance and sustained force.", fr: "Suspensions intermittentes axées sur l'endurance des doigts et la force répétée." },
    goals: ["sport", "strength"], evidence: "controlled",
    scores: [1, 3, 1, 5, 1, 2],
    source: { label: "Devise et al. 2022 — randomized hangboard training intensity study", url: "https://pubmed.ncbi.nlm.nih.gov/35498522/" },
    caution: { en: "Adjust edge size, support and load to your experience and recovery.", fr: "Adapter la prise, l'assistance et la charge à son expérience et à sa récupération." },
  },
  {
    id: "easy-volume", category: "methods", title: "Easy climbing volume / ARC",
    description: { en: "Sustained easy climbing to practice economy and lower-intensity endurance.", fr: "Volume facile et prolongé pour travailler l'économie gestuelle et l'endurance de base." },
    goals: ["sport", "technique"], evidence: "practice",
    scores: [3, 1, 1, 5, 2, 2],
    source: { label: "Crimpd — workout categories", url: "https://www.crimpd.com/docs/" },
  },
  {
    id: "four-by-four", category: "methods", title: "4×4 climbing intervals",
    description: { en: "Repeated climbing circuits designed to challenge power endurance.", fr: "Circuits répétés destinés à solliciter la résistance et la continuité." },
    goals: ["boulder", "sport"], evidence: "practice",
    scores: [2, 2, 3, 5, 2, 2],
    source: { label: "Crimpd — training documentation", url: "https://www.crimpd.com/docs/" },
  },
  {
    id: "campus", category: "methods", title: "Campus-board training",
    description: { en: "Advanced explosive pulling and contact-strength practice.", fr: "Entraînement avancé de la puissance de traction et de la force de contact." },
    goals: ["boulder", "strength"], evidence: "limited",
    scores: [1, 3, 5, 1, 1, 1],
    source: { label: "Climbing training research — PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/?term=campus+board+rock+climbing" },
    caution: { en: "High loading; not a beginner default. Avoid if painful.", fr: "Charge élevée, non adaptée par défaut aux débutants. Éviter en cas de douleur." },
  },
  {
    id: "strength-conditioning", category: "methods", title: "Strength & conditioning",
    description: { en: "General pulling, pushing, core and lower-body capacity supporting climbing.", fr: "Renforcement général : tirage, poussée, gainage et membres inférieurs." },
    goals: ["boulder", "sport", "strength"], evidence: "practice",
    scores: [1, 3, 4, 2, 1, 3],
    source: { label: "Hooper's Beta — strength training", url: "https://www.hoopersbeta.com/library/how-to-train-for-climbing-full-body-guide" },
  },
  {
    id: "mental", category: "methods", title: "Mental skills & lead tactics",
    description: { en: "Decision-making, pacing, confidence and appropriately managed exposure.", fr: "Prise de décision, rythme, confiance et exposition progressive sécurisée." },
    goals: ["sport", "technique"], evidence: "limited",
    scores: [2, 1, 1, 2, 5, 2],
    source: { label: "The Warrior's Way", url: "https://warriorsway.com/" },
    caution: { en: "Do not use uncontrolled falls as a confidence exercise.", fr: "Ne pas utiliser de chutes non maîtrisées pour travailler la confiance." },
  },
  {
    id: "periodized", category: "methods", title: "Integrated periodized coaching",
    description: { en: "Assess needs, balance training qualities and adjust recovery over time.", fr: "Évaluer les besoins, équilibrer les qualités et adapter la récupération dans le temps." },
    goals: ["boulder", "sport", "technique", "strength"], evidence: "practice",
    scores: [4, 4, 4, 4, 4, 5],
    source: { label: "Power Company — plan methodology", url: "https://www.powercompanyclimbing.com/proven-plans" },
  },
  {
    id: "lattice", category: "programs", title: "Lattice Training",
    description: { en: "Assessment-based app-led plans and individually coached options.", fr: "Bilans physiques, programmes via application et options avec coach individuel." },
    goals: ["boulder", "sport", "strength"], evidence: "provider",
    scores: [3, 5, 4, 4, 3, 5],
    source: { label: "Official Lattice plans", url: "https://www.latticetraining.com/climbing-training-plans" },
  },
  {
    id: "power-company", category: "programs", title: "Power Company Climbing",
    description: { en: "Movement, tactics, strength and structured Proven Plans.", fr: "Mouvement, tactique, force et programmes structurés Proven Plans." },
    goals: ["boulder", "sport", "technique"], evidence: "provider",
    scores: [5, 4, 4, 4, 5, 4],
    source: { label: "Official Proven Plans", url: "https://www.powercompanyclimbing.com/proven-plans" },
  },
  {
    id: "crimpd", category: "programs", title: "Crimpd+",
    description: { en: "Workout library, logs and configurable multiweek training plans.", fr: "Bibliothèque d'exercices, suivi et programmes personnalisables sur plusieurs semaines." },
    goals: ["boulder", "sport", "strength"], evidence: "provider",
    scores: [3, 5, 4, 5, 2, 4],
    source: { label: "Official plan builder documentation", url: "https://crimpd.com/docs/build-a-training-plan/" },
  },
  {
    id: "hoopers", category: "programs", title: "Hooper's Beta",
    description: { en: "Education, coaching, movement analysis and conditioning.", fr: "Ressources éducatives, coaching, analyse gestuelle et renforcement." },
    goals: ["boulder", "sport", "technique", "strength"], evidence: "provider",
    scores: [4, 4, 3, 2, 3, 4],
    source: { label: "Official coaching", url: "https://www.hoopersbeta.com/coaching" },
  },
  {
    id: "hangboard", category: "tools", title: "Fingerboard / hangboard",
    description: { en: "An adjustable training surface for progressive finger loading.", fr: "Support de prises pour charger progressivement les doigts." },
    goals: ["boulder", "sport", "strength"], evidence: "controlled",
    scores: [1, 5, 2, 4, 1, 2],
    source: { label: "Hangboard intervention study — PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/35571743/" },
  },
  {
    id: "training-board", category: "tools", title: "Training board / spray wall",
    description: { en: "Repeatable hard movements, specific coordination and body tension.", fr: "Mouvements répétables, coordination spécifique et gainage." },
    goals: ["boulder", "technique", "strength"], evidence: "practice",
    scores: [4, 3, 5, 2, 2, 2],
    source: { label: "Power Company — training", url: "https://www.powercompanyclimbing.com/proven-plans" },
  },
  {
    id: "force-sensor", category: "tools", title: "Portable force sensor",
    description: { en: "Measure finger-pulling force for testing and load prescription; does not train by itself.", fr: "Mesurer la force des doigts pour les bilans et charges ; ne constitue pas un entraînement en soi." },
    goals: ["strength"], evidence: "practice",
    scores: [1, 5, 1, 1, 1, 4],
    source: { label: "Hooper's Beta — devices", url: "https://www.hoopersbeta.com/store/training" },
  },
  {
    id: "video-tool", category: "tools", title: "Video movement review",
    description: { en: "Record, annotate and revisit attempts with a coach or partner.", fr: "Filmer, annoter et revoir les essais avec un coach ou un partenaire." },
    goals: ["boulder", "sport", "technique"], evidence: "practice",
    scores: [5, 1, 2, 1, 3, 3],
    source: { label: "Hooper's Beta — video analysis", url: "https://www.hoopersbeta.com/coaching" },
  },
];

export const METHODS_FOR_PLANS = TRAINING_CATALOGUE.filter((entry) => entry.category === "methods");

export function compareTrainingEntries(ids: readonly string[]): TrainingEntry[] {
  return ids.map((id) => TRAINING_CATALOGUE.find((entry) => entry.id === id)).filter((entry): entry is TrainingEntry => Boolean(entry));
}
