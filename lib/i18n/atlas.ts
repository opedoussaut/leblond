import type { Locale } from "./index";
import type { AtlasDiagram, ProtocolKey, SourceKind } from "@/lib/training/atlas-types";
import {
  circuitDurationRange, continuousSegments, forceTestBars, intervalSegments, phaseLayout, setDuration, workSeconds,
} from "@/lib/training/atlas-diagram";

/** Training Atlas detail page: section headings, diagram labels and the diagram fact list. */
const fr = {
  back: "Training Atlas",
  inBrief: "En bref",
  trains: "Ce que ça travaille",
  suits: "Pour qui",
  level: "Niveau conseillé",
  prerequisites: "Prérequis (niveau, âge, blessures)",
  diagram: "Le protocole en schéma",
  diagramFor: "Schéma du protocole : {title}",
  video: "Vidéo à suivre",
  videoBy: "par {author} · YouTube, lien externe ↗",
  diagramNote: "Schéma original LEBLOND, tracé à partir des chiffres du protocole : nombres exacts, et durées à l’échelle dès qu’un axe de temps est affiché. Les mêmes chiffres sont listés sous le schéma.",
  protocol: "Protocole",
  protocolNote: "Valeurs de départ issues des études et des coachs cités ci-dessous. Ce ne sont pas des prescriptions individuelles : adapte-les à ton niveau, ta récupération et l’absence de douleur.",
  protocolKeys: {
    intensity: "Intensité", effort: "Durée d’effort", rest: "Repos", reps: "Répétitions", sets: "Séries",
    session: "Durée de séance", frequency: "Fréquence", format: "Format", duration: "Durée",
    equipment: "Matériel", cost: "Coût",
  } satisfies Record<ProtocolKey, string>,
  setup: "Préparation et matériel",
  howTo: "Comment pratiquer",
  progression: "Comment progresser",
  mistakes: "Erreurs fréquentes",
  safety: "Sécurité",
  variants: "Variantes",
  observe: "Quoi mesurer ?",
  evidence: "Niveau de preuve",
  evidenceNote: "Aucune méthode ne garantit un résultat : les études portent sur de petits groupes, souvent de grimpeurs confirmés.",
  sources: "Sources",
  sourcesNote: "Résumés rédigés par LEBLOND ; ouvre la source pour le détail. Lien externe ↗.",
  mainSource: "Source de la fiche",
  sourceKinds: {
    study: "Étude", review: "Revue / méta-analyse", coach: "Coach", provider: "Fournisseur", video: "Vidéo",
  } satisfies Record<SourceKind, string>,
  compare: "Profil sur le radar",
  sampleSession: "Séance type et charge de départ",
  sampleNote: "Valeurs de départ prudentes issues de pratiques d’entraînement courantes, et non des prescriptions individuelles ou des optimums démontrés. Ajuste-les à ton expérience, ta récupération et l’absence de douleur.",
  progressionRegression: "Progression / régression",
  useMethod: "Utiliser cette méthode",
  scheduleCalendar: "Planifier dans mon calendrier",
  d: {
    session: "Séance complète, à l’échelle",
    zoomSet: "Zoom : une série",
    zoomRep: "Zoom : une suspension et sa marge",
    timeMin: "temps (min)",
    timeSec: "temps (s)",
    rest: "repos",
    reserve: "marge",
    legendWork: "Effort",
    legendRest: "Repos",
    legendReserve: "Marge non utilisée",
    effortAxis: "Effort perçu (0–10)",
    targetZone: "Zone visée",
    ceiling: "Plafond : pompage marqué",
    round: "Tour",
    problem: "Bloc",
    problemShort: "B",
    linked: "enchaînés sans repos",
    attempts: "essais",
    restBetween: "de repos entre chaque série",
    leftHand: "G",
    rightHand: "D",
    leftHandFull: "Main gauche (rond)",
    rightHandFull: "Main droite (carré)",
    ladder: "Échelle",
    rung: "Réglette",
    weeks: "Semaines",
    weekShort: "S",
    volume: "Volume (hauteur du bloc)",
    intensity: "Intensité (ligne pointillée)",
    edgeAxis: "Profondeur de réglette, à l’échelle (mm)",
    angleAxis: "Angle au-delà de la verticale, à l’échelle",
    floor: "sol",
    forceAxis: "Force (forme indicative, pas des données)",
    criticalForce: "force de fin de test ≈ force critique",
    lastN: "dernières",
    pull: "traction",
    camera: "caméra",
    wall: "mur",
    exposure: "exposition croissante →",
  },
  facts: {
    sets: "Séries", setLength: "Durée d’une série", repsPerSet: "Répétitions par série", work: "Effort", workApprox: "Effort (typique)",
    pause: "Pause entre répétitions", setRest: "Repos entre séries", reserve: "Marge gardée",
    workTotal: "Temps sous charge", total: "Durée totale (sans échauffement)",
    blocks: "Blocs continus", blockLength: "Durée d’un bloc", blockRest: "Repos entre blocs", effortBand: "Effort perçu visé",
    ceiling: "À ne pas dépasser", problems: "Blocs par tour", rounds: "Tours", roundRest: "Repos entre tours",
    perProblem: "Temps par bloc", attemptsPerRound: "Essais par série", ladders: "Échelles", exercises: "Exercices",
    steps: "Paliers", weeks: "Semaines", phases: "Phases", edges: "Réglettes", angles: "Angles",
    contractions: "Contractions", onOff: "Rythme", edge: "Réglette", endForce: "Force critique", loopSteps: "Étapes",
    notes: "Repères",
  },
  units: { sec: "s", min: "min", week: "sem.", weeks: "sem." },
  endForceRule: "moyenne des {n} dernières contractions",
  approx: "≈",
  sep: " : ",
};

type Dict = typeof fr;

const en: Dict = {
  back: "Training Atlas",
  inBrief: "At a glance",
  trains: "What it trains",
  suits: "Who it suits",
  level: "Suggested level",
  prerequisites: "Prerequisites (level, age, injuries)",
  diagram: "The protocol as a diagram",
  diagramFor: "Protocol diagram: {title}",
  video: "Video to follow",
  videoBy: "by {author} · YouTube, external link ↗",
  diagramNote: "Original LEBLOND diagram drawn from the protocol’s own numbers: counts are exact and durations are to scale wherever a time axis is shown. The same numbers are listed under the diagram.",
  protocol: "Protocol",
  protocolNote: "Starting values from the studies and coaches cited below. They are not individual prescriptions: adapt them to your level, recovery and the absence of pain.",
  protocolKeys: {
    intensity: "Intensity", effort: "Effort time", rest: "Rest", reps: "Reps", sets: "Sets",
    session: "Session length", frequency: "Frequency", format: "Format", duration: "Duration",
    equipment: "Equipment", cost: "Cost",
  },
  setup: "Setup and equipment",
  howTo: "How to practise",
  progression: "How to progress",
  mistakes: "Common mistakes",
  safety: "Safety",
  variants: "Variants",
  observe: "What to track",
  evidence: "Strength of evidence",
  evidenceNote: "No method guarantees a result: studies involve small groups, often of experienced climbers.",
  sources: "Sources",
  sourcesNote: "Summaries written by LEBLOND; open the source for details. External link ↗.",
  mainSource: "Entry source",
  sourceKinds: { study: "Study", review: "Review / meta-analysis", coach: "Coach", provider: "Provider", video: "Video" },
  compare: "Radar profile",
  sampleSession: "Sample session and starting workload",
  sampleNote: "Conservative starting values from common coaching practice — not individual prescriptions or proven optima. Adjust to your experience, recovery and the absence of pain.",
  progressionRegression: "Progression / regression",
  useMethod: "Use this method",
  scheduleCalendar: "Schedule in my calendar",
  d: {
    session: "Whole session, to scale",
    zoomSet: "Zoom: one set",
    zoomRep: "Zoom: one hang and its reserve",
    timeMin: "time (min)",
    timeSec: "time (s)",
    rest: "rest",
    reserve: "reserve",
    legendWork: "Effort",
    legendRest: "Rest",
    legendReserve: "Unused reserve",
    effortAxis: "Perceived effort (0–10)",
    targetZone: "Target zone",
    ceiling: "Ceiling: marked pump",
    round: "Round",
    problem: "Problem",
    problemShort: "P",
    linked: "linked without rest",
    attempts: "attempts",
    restBetween: "rest between sets",
    leftHand: "L",
    rightHand: "R",
    leftHandFull: "Left hand (circle)",
    rightHandFull: "Right hand (square)",
    ladder: "Ladder",
    rung: "Rung",
    weeks: "Weeks",
    weekShort: "W",
    volume: "Volume (block height)",
    intensity: "Intensity (dashed line)",
    edgeAxis: "Edge depth, to scale (mm)",
    angleAxis: "Angle past vertical, to scale",
    floor: "floor",
    forceAxis: "Force (illustrative shape, not data)",
    criticalForce: "end-test force ≈ critical force",
    lastN: "last",
    pull: "pull",
    camera: "camera",
    wall: "wall",
    exposure: "increasing exposure →",
  },
  facts: {
    sets: "Sets", setLength: "Set length", repsPerSet: "Reps per set", work: "Effort", workApprox: "Effort (typical)",
    pause: "Pause between reps", setRest: "Rest between sets", reserve: "Reserve kept",
    workTotal: "Time under load", total: "Total time (excluding warm-up)",
    blocks: "Continuous blocks", blockLength: "Block length", blockRest: "Rest between blocks", effortBand: "Target perceived effort",
    ceiling: "Do not exceed", problems: "Problems per round", rounds: "Rounds", roundRest: "Rest between rounds",
    perProblem: "Time per problem", attemptsPerRound: "Attempts per set", ladders: "Ladders", exercises: "Exercises",
    steps: "Steps", weeks: "Weeks", phases: "Phases", edges: "Edges", angles: "Angles",
    contractions: "Contractions", onOff: "Rhythm", edge: "Edge", endForce: "Critical force", loopSteps: "Steps",
    notes: "Key points",
  },
  units: { sec: "s", min: "min", week: "wk", weeks: "wks" },
  endForceRule: "mean of the last {n} contractions",
  approx: "≈",
  sep: ": ",
};

export const atlasDictionary = (locale: Locale): Dict => (locale === "en" ? en : fr);
export type AtlasDictionary = Dict;

/** "10 s", "3 min", "1 min 30 s", "12 min 50 s". */
export function formatDuration(seconds: number, locale: Locale): string {
  const u = atlasDictionary(locale).units;
  const s = Math.round(seconds);
  if (s < 60) return s + " " + u.sec;
  const m = Math.floor(s / 60), r = s % 60;
  return r === 0 ? m + " " + u.min : m + " " + u.min + " " + r + " " + u.sec;
}

export type DiagramFact = { label: string; value: string };

/**
 * The numbers a diagram is drawn from, as label/value pairs. Shown under the
 * drawing and used as its text alternative, so nothing depends on the picture.
 */
export function diagramFacts(spec: AtlasDiagram, locale: Locale): DiagramFact[] {
  const t = atlasDictionary(locale), f = t.facts, dur = (s: number) => formatDuration(s, locale);
  switch (spec.kind) {
    case "intervals": {
      const { total } = intervalSegments(spec);
      const rows: DiagramFact[] = [
        { label: f.sets, value: String(spec.sets) },
        { label: f.repsPerSet, value: String(spec.reps) },
        { label: spec.approximate ? f.workApprox : f.work, value: (spec.approximate ? t.approx + " " : "") + dur(spec.work) },
      ];
      if (spec.reps > 1 && spec.pause > 0) rows.push({ label: f.pause, value: dur(spec.pause) });
      if (spec.reserve) rows.push({ label: f.reserve, value: dur(spec.reserve) });
      if (spec.sets > 1) rows.push({ label: f.setRest, value: dur(spec.setRest) });
      rows.push({ label: f.workTotal, value: dur(workSeconds(spec)) });
      rows.push({ label: f.total, value: (spec.approximate ? t.approx + " " : "") + dur(total) });
      if (spec.reps > 1) rows.splice(2, 0, { label: f.setLength, value: dur(setDuration(spec)) });
      return rows;
    }
    case "continuous": {
      const { totalMinutes } = continuousSegments(spec);
      return [
        { label: f.blocks, value: String(spec.blocks) },
        { label: f.blockLength, value: dur(spec.blockMinutes * 60) },
        { label: f.blockRest, value: dur(spec.restMinutes * 60) },
        { label: f.effortBand, value: spec.rpe[0] + "–" + spec.rpe[1] + "/10" },
        { label: f.ceiling, value: spec.ceiling + "/10" },
        { label: f.total, value: dur(totalMinutes * 60) },
      ];
    }
    case "circuit": {
      const [lo, hi] = circuitDurationRange(spec);
      return [
        { label: f.problems, value: String(spec.problems) },
        { label: f.rounds, value: String(spec.rounds) },
        { label: f.perProblem, value: t.approx + " " + spec.problemSeconds[0] + "–" + spec.problemSeconds[1] + " " + t.units.sec },
        { label: f.roundRest, value: dur(spec.roundRest) },
        { label: f.total, value: t.approx + " " + Math.round(lo / 60) + "–" + dur(Math.round(hi / 60) * 60) },
      ];
    }
    case "rounds":
      return [
        { label: f.sets, value: String(spec.rounds.length) },
        { label: f.attemptsPerRound, value: String(spec.attempts) },
        { label: f.setRest, value: dur(spec.rest) },
      ];
    case "loop":
      return [{ label: f.loopSteps, value: spec.steps.map((s, i) => i + 1 + ". " + s[locale]).join(" → ") }];
    case "ladder":
      return [
        { label: f.ladders, value: spec.ladders.map((l) => l.join("-")).join(", ") },
        { label: f.sets, value: String(spec.sets) },
        { label: f.repsPerSet, value: String(spec.reps) },
        { label: f.setRest, value: dur(spec.rest) },
      ];
    case "sets":
      return [{
        label: f.exercises,
        value: spec.exercises.map((e) => e.name[locale] + " " + e.sets + " × " + (e.reps ?? dur(e.seconds ?? 0)) + " (" + t.d.rest + " " + dur(e.rest) + ")").join(" · "),
      }];
    case "staircase":
      return [{ label: f.steps, value: spec.steps.map((s, i) => i + 1 + ". " + s.label[locale] + (s.detail ? " (" + s.detail[locale] + ")" : "")).join(" → ") }];
    case "phases": {
      const { totalWeeks } = phaseLayout(spec);
      return [
        { label: f.weeks, value: String(totalWeeks) },
        { label: f.phases, value: spec.phases.map((p) => p.label[locale] + " (" + p.weeks + " " + (p.weeks > 1 ? t.units.weeks : t.units.week) + ")").join(" → ") },
      ];
    }
    case "edges":
      return [{ label: f.edges, value: spec.edges.map((e) => e.mm + " mm (" + e.note[locale] + ")").join(", ") }];
    case "angles":
      return [{ label: f.angles, value: spec.angles.map((a) => a.deg + "° (" + a.note[locale] + ")").join(", ") }];
    case "forceTest": {
      const { total } = forceTestBars(spec);
      return [
        { label: f.contractions, value: String(spec.reps) },
        { label: f.onOff, value: dur(spec.on) + " / " + dur(spec.off) },
        { label: f.edge, value: spec.edgeMm + " mm" },
        { label: f.endForce, value: t.endForceRule.replace("{n}", String(spec.lastN)) },
        { label: f.total, value: dur(total) },
      ];
    }
    case "camera":
      return [{ label: f.notes, value: spec.notes.map((n, i) => i + 1 + ". " + n[locale]).join(" · ") }];
  }
}
