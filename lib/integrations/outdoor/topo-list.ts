import { FONT_SCALE, type FontGrade } from "@/lib/grading/systems";
import { searchable, type CircuitColor } from "./boolder";
import { folderColor, myMapsGrade, type TeamTopoProblem } from "./mymaps";

/**
 * The written list of a site's topo, as copied from a guide page (bleau.info
 * style): one block per circuit, headed by its colour ("Bleu TD- Dampierre
 * Maincourt"), one line per boulder ("2 bisLa Sittelle 6a  Jean Pillot …"),
 * then the off-circuit boulders ("Agartha 8a  surplomb …"), possibly mixed
 * with the circuit boulders again and grade headings ("7c+").
 *
 * The list is the reference for circuits, numbers, names and grades; the My
 * Maps pins give the positions. A boulder of the list without a pin is kept
 * without a position (listed, not on the map). Nothing is guessed: a line
 * without a readable grade is reported, never imported.
 */

export type TopoListEntry = { color: CircuitColor | null; number: string | null; name: string; grade: FontGrade };

export interface TopoList {
  circuits: CircuitColor[];
  entries: TopoListEntry[];
  /** Lines that looked like a boulder but could not be read. */
  unreadable: string[];
}

const GRADE = /(?<![\p{L}\p{N}'’])([1-9](?:[abc]\+?|[+-])?)(?![\p{L}\p{N}'’+-])/iu;
const SUFFIX: Record<string, string> = { bis: "b", ter: "c", quater: "d" };

/** "2 bisLa Sittelle 6a  Jean Pillot" → number 2b. The name is glued to the number in copies of bleau.info. */
const CIRCUIT_LINE = /^(\d{1,3})(?:\s*([Bb]is|[Tt]er|[Qq]uater)(?=[\p{Lu}\d\s"'’«])\s*|\t\s*|(?=[^\s\d]))(.+)$/u;

/** "Le GR 11 4+  Philippe Andrieux † mur" → name "Le GR 11", grade 4+. The first grade-like word ends the name. */
function nameAndGrade(rest: string): { name: string; grade: FontGrade } | null {
  const m = GRADE.exec(rest);
  if (!m || m.index === 0) return null;
  const grade = myMapsGrade(m[1]);
  const name = rest.slice(0, m.index).replace(/\s+/g, " ").trim();
  return grade && name ? { name: name.slice(0, 160), grade } : null;
}

export function parseTopoList(text: string): TopoList {
  const circuits: CircuitColor[] = [];
  const entries: TopoListEntry[] = [];
  const unreadable: string[] = [];
  let color: CircuitColor | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/ /g, " ").trim();
    if (!line) continue;
    // A grade heading or a grade range line ("7c+", "4+").
    if (/^[1-9](?:[abc]\+?|[+-])?$/i.test(line)) continue;

    const circuit = line.match(CIRCUIT_LINE);
    if (circuit) {
      const parsed = nameAndGrade(circuit[3]);
      if (!color || !parsed) {
        unreadable.push(line.slice(0, 160));
        continue;
      }
      const number = `${Number(circuit[1])}${circuit[2] ? SUFFIX[circuit[2].toLowerCase()] : ""}`;
      entries.push({ color, number, ...parsed });
      continue;
    }

    // A circuit heading: a colour word first, a difficulty or the site after ("Rouge TD+ Dampierre Maincourt").
    // No grade on it: "L'Orange ta Fierté 5+" is a boulder, not the orange circuit.
    const parsed = nameAndGrade(line);
    const heading = folderColor(line.split(/\s+/)[0]);
    if (heading && !parsed) {
      color = heading;
      if (!circuits.includes(heading)) circuits.push(heading);
      continue;
    }

    // An off-circuit boulder: a short name (no punctuation of prose), then its grade, then details.
    if (parsed && parsed.name.length <= 80 && !/[,:;]/.test(parsed.name)) {
      entries.push({ color: null, number: null, ...parsed });
    }
    // Anything else is prose (circuit notes, "Auteur : …").
  }

  // The off-circuit part of a guide also lists the circuit boulders: only the others are off-circuit.
  const onCircuits = new Set(entries.filter((e) => e.color).map((e) => searchable(e.name)));
  const seen = new Set<string>();
  const kept = entries.filter((e) => {
    if (e.color) return true;
    const key = searchable(e.name);
    if (!key || onCircuits.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { circuits, entries: kept, unreadable };
}

/** A topo boulder whose position may be unknown (on the list, not on the map). */
export type ListedProblem = Omit<TeamTopoProblem, "latitude" | "longitude"> & {
  latitude: number | null;
  longitude: number | null;
};

export interface MergeReport {
  /** Boulders of the list matched to a pin (position known). */
  placed: number;
  /** Boulders of the list without a pin: listed, not on the map. */
  withoutPosition: string[];
  /** Pins of a listed circuit that match no boulder of the list: kept, off-circuit. */
  unmatchedPins: string[];
}

const label = (e: { color: CircuitColor | null; number: string | null; name: string }) =>
  e.color && e.number ? `${e.color} ${e.number} · ${e.name}` : e.name;

/**
 * Merges the written list into the pins. A pin is matched by name first
 * (same circuit preferred), then by circuit and number. A matched pin keeps
 * its key, so the climbers' logged problems stay linked across imports.
 */
export function mergeTopoList(pins: ListedProblem[], list: TopoList): { problems: ListedProblem[]; report: MergeReport } {
  const used = new Set<number>();
  const byName = new Map<string, number[]>();
  pins.forEach((p, i) => byName.set(p.name_searchable, [...(byName.get(p.name_searchable) ?? []), i]));

  const match: Array<number | null> = list.entries.map((e) => {
    const candidates = (byName.get(searchable(e.name)) ?? []).filter((i) => !used.has(i));
    const pick = candidates.find((i) => pins[i].circuit_color === e.color) ?? candidates[0];
    if (pick === undefined) return null;
    used.add(pick);
    return pick;
  });
  list.entries.forEach((e, n) => {
    if (match[n] !== null || !e.color || !e.number) return;
    const i = pins.findIndex((p, j) => !used.has(j) && p.circuit_color === e.color && p.circuit_number === e.number);
    if (i >= 0) {
      used.add(i);
      match[n] = i;
    }
  });

  const keys = new Set(match.filter((i): i is number => i !== null).map((i) => pins[i].key));
  const problems: ListedProblem[] = [];
  const withoutPosition: string[] = [];
  list.entries.forEach((e, n) => {
    const pin = match[n] === null ? null : pins[match[n] as number];
    let key = pin?.key ?? (e.color ? `${e.color}:${e.number}` : `hc:${searchable(e.name)}`).slice(0, 190);
    if (!pin) {
      for (let k = 2; keys.has(key); k++) key = `${key.replace(/#\d+$/, "")}#${k}`;
      keys.add(key);
      withoutPosition.push(label(e));
    }
    problems.push({
      key,
      name: e.name,
      name_searchable: searchable(e.name),
      grade: e.grade,
      circuit_color: e.color,
      circuit_number: e.color ? e.number : null,
      latitude: pin?.latitude ?? null,
      longitude: pin?.longitude ?? null,
    });
  });

  // Pins the list does not mention: kept. On a listed circuit they leave it (the list is the reference).
  const listed = new Set(list.circuits);
  const unmatchedPins: string[] = [];
  pins.forEach((p, i) => {
    if (used.has(i)) return;
    if (p.circuit_color && listed.has(p.circuit_color)) {
      unmatchedPins.push(label({ color: p.circuit_color, number: p.circuit_number, name: p.name }));
      problems.push({ ...p, circuit_color: null, circuit_number: null });
    } else {
      problems.push(p);
    }
  });

  return { problems, report: { placed: list.entries.length - withoutPosition.length, withoutPosition, unmatchedPins } };
}

/** One circuit per colour, its average grade being the median of its boulders. */
export function circuitsOf(problems: Array<{ circuit_color: CircuitColor | null; grade: FontGrade }>) {
  const order = (g: FontGrade) => FONT_SCALE.indexOf(g);
  return [...new Set(problems.map((p) => p.circuit_color).filter((c): c is CircuitColor => c !== null))].map((color) => {
    const grades = problems.filter((p) => p.circuit_color === color).map((p) => p.grade).sort((a, b) => order(a) - order(b));
    return { color, average_grade: grades[Math.floor((grades.length - 1) / 2)] };
  });
}
