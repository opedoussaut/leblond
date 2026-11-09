import { FONT_SCALE, type FontGrade } from "@/lib/grading/systems";
import { searchable, type CircuitColor } from "./boolder";

/**
 * Team topos drawn in Google My Maps (one layer per circuit colour, plus
 * off-circuit layers). Each pin is a boulder named "<name> <grade>", e.g.
 * "La Roncerie 5" or "Sourire 7a"; on a circuit layer the description starts
 * with the circuit code ("O12", "B5b: …"). Pins without a readable grade
 * (parking, notes) are reported as skipped, never guessed.
 *
 * Grades without a letter use the app's convention (docs/grading.md): the
 * lowest matching letter, "4-" and "4" → 4a, "4+" → 4c. From 6 up a letter is
 * required ("6" alone is ambiguous).
 */

export interface KmlPlacemark {
  folder: string | null;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
}

export interface KmlDocument {
  name: string | null;
  placemarks: KmlPlacemark[];
  /** The file only links to the online map (My Maps "keep data up to date" export). */
  networkLinkOnly: boolean;
}

/** A type alias (not an interface) so it can be sent as JSON to admin_import_leblond_topo(). */
export type TeamTopoProblem = {
  key: string;
  name: string;
  name_searchable: string;
  grade: FontGrade;
  circuit_color: CircuitColor | null;
  circuit_number: string | null;
  latitude: number;
  longitude: number;
};

export type SkipReason = "noGrade" | "noName" | "duplicate" | "noPosition";

export interface TeamTopo {
  name: string | null;
  circuits: Array<{ color: CircuitColor; average_grade: FontGrade }>;
  problems: TeamTopoProblem[];
  skipped: Array<{ name: string; folder: string | null; reason: SkipReason }>;
}

// ── KML ────────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Text content of an element: CDATA kept raw, other text entity-decoded. */
function textOf(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
    .map((part) => (part.startsWith("<![CDATA[") ? part.slice(9, -3) : decodeEntities(part)))
    .join("");
}

/** My Maps descriptions are small HTML snippets: keep the text, one line per <br>. */
function plain(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const child = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1];

export function parseKml(xml: string): KmlDocument {
  const placemarks: KmlPlacemark[] = [];
  const folders: Array<string | null> = [];
  const tags = /<Folder\b[^>]*>|<\/Folder>|<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/g;
  for (let m = tags.exec(xml); m; m = tags.exec(xml)) {
    if (m[0].startsWith("</Folder")) {
      folders.pop();
    } else if (m[0].startsWith("<Folder")) {
      // The folder's own <name> comes before its first placemark or sub-folder.
      const rest = xml.slice(tags.lastIndex);
      const next = rest.search(/<(?:Placemark|Folder)\b/);
      const head = next < 0 ? rest : rest.slice(0, next);
      const name = plain(textOf(child(head, "name"))).replace(/\n/g, " ");
      folders.push(name || null);
    } else {
      const body = m[1] ?? "";
      const coords = child(child(body, "Point") ?? "", "coordinates")?.trim().split(/\s+/)[0]?.split(",");
      const longitude = Number(coords?.[0]);
      const latitude = Number(coords?.[1]);
      placemarks.push({
        folder: folders.at(-1) ?? null,
        name: plain(textOf(child(body, "name"))).replace(/\n/g, " "),
        description: plain(textOf(child(body, "description"))),
        latitude: coords && coords.length >= 2 && Number.isFinite(latitude) ? latitude : Number.NaN,
        longitude: coords && coords.length >= 2 && Number.isFinite(longitude) ? longitude : Number.NaN,
      });
    }
  }
  // The map's own <name> comes before its first layer.
  const firstLayer = xml.search(/<(?:Placemark|Folder|NetworkLink)\b/);
  const documentHead = firstLayer < 0 ? xml : xml.slice(0, firstLayer);
  return {
    name: plain(textOf(child(documentHead, "name"))).replace(/\n/g, " ") || null,
    placemarks,
    networkLinkOnly: placemarks.length === 0 && /<NetworkLink\b/.test(xml),
  };
}

// ── Grades, circuits, names ────────────────────────────────────────────────

const FONT = new Set<string>(FONT_SCALE);

/** "4-", "4", "4+", "4c", "6a+", "6C" → a Font grade, or null when it is not one. */
export function myMapsGrade(raw: string): FontGrade | null {
  const m = raw.trim().match(/^([1-9])([abc])?([+-])?$/i);
  if (!m) return null;
  const [, n, letter, sign] = m;
  const level = Number(n);
  let grade: string;
  if (!letter) {
    if (level >= 6) return null;
    grade = `${n}${sign === "+" ? "c" : "a"}`;
  } else if (level <= 5) {
    if (sign === "+") return null;
    grade = `${n}${letter.toLowerCase()}`;
  } else {
    grade = `${n}${letter.toUpperCase()}${sign === "+" ? "+" : ""}`;
  }
  return FONT.has(grade) ? (grade as FontGrade) : null;
}

/** Splits "La Roncerie 5" into its name and grade. */
export function splitNameAndGrade(raw: string): { name: string; grade: FontGrade | null } {
  const m = raw.match(/^(?:(.*?)\s+)?([1-9][abc]?[+-]?)\s*$/i);
  const grade = m ? myMapsGrade(m[2]) : null;
  return grade && m ? { name: (m[1] ?? "").trim(), grade } : { name: raw.trim(), grade: null };
}

const FOLDER_COLORS: Array<[RegExp, CircuitColor]> = [
  [/\b(bleu ciel|sky ?blue)\b/, "skyblue"],
  [/\borange\b/, "orange"],
  [/\b(rouge|red)\b/, "red"],
  [/\b(jaune|yellow)\b/, "yellow"],
  [/\b(bleu|blue)\b/, "blue"],
  [/\b(blanc|white)\b/, "white"],
  [/\b(noir|black)\b/, "black"],
  [/\b(vert|green)\b/, "green"],
  [/\b(violet|purple|mauve)\b/, "purple"],
  [/\b(saumon|salmon)\b/, "salmon"],
];

/** "Orange", "rouge", "Circuit bleu" → circuit colour; off-circuit layers → null. */
export function folderColor(folder: string | null): CircuitColor | null {
  if (!folder) return null;
  const f = folder.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\b(hors|off|autres?|other)\b/.test(f)) return null;
  return FOLDER_COLORS.find(([re]) => re.test(f))?.[1] ?? null;
}

const CODE = /^([A-Za-z])(\d{1,3}[a-z]?)(?![0-9])/;
const NAME_CODE = /^([A-Za-z])(\d{1,3}[a-z]?)\s*:\s*/;

// ── Topo ───────────────────────────────────────────────────────────────────

export function buildTeamTopo(doc: KmlDocument): TeamTopo {
  // Which letter each colour's codes use ("O12" on the orange layer → O = orange).
  const votes = new Map<string, Map<CircuitColor, number>>();
  for (const p of doc.placemarks) {
    const color = folderColor(p.folder);
    const code = p.description.match(CODE);
    if (!color || !code) continue;
    const letter = code[1].toUpperCase();
    const byColor = votes.get(letter) ?? new Map<CircuitColor, number>();
    byColor.set(color, (byColor.get(color) ?? 0) + 1);
    votes.set(letter, byColor);
  }
  const letterColor = new Map(
    [...votes].map(([letter, byColor]) => [letter, [...byColor].sort((a, b) => b[1] - a[1])[0][0]] as const),
  );
  const colorLetter = new Map([...letterColor].map(([letter, color]) => [color, letter] as const));

  const problems: TeamTopoProblem[] = [];
  const skipped: TeamTopo["skipped"] = [];
  const keys = new Set<string>();
  for (const p of doc.placemarks) {
    const label = p.name || p.description.split("\n")[0] || "?";
    const skip = (reason: SkipReason) => skipped.push({ name: label.slice(0, 160), folder: p.folder, reason });

    let color = folderColor(p.folder);
    let number: string | null = null;
    let rawName = p.name;
    const prefix = rawName.match(NAME_CODE);
    if (prefix) {
      rawName = rawName.slice(prefix[0].length);
      const prefixColor = letterColor.get(prefix[1].toUpperCase()) ?? null;
      if (!color && prefixColor) color = prefixColor;
      if (color && color === prefixColor) number = prefix[2].toLowerCase();
    }
    if (color && !number) number = p.description.match(CODE)?.[2].toLowerCase() ?? null;

    const { name: bare, grade } = splitNameAndGrade(rawName);
    if (!grade) {
      skip("noGrade");
      continue;
    }
    if (!(Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180)) {
      skip("noPosition");
      continue;
    }
    const letter = color ? colorLetter.get(color) : undefined;
    const name = (bare || (number && letter ? `${letter}${number}` : "")).replace(/\s+/g, " ").slice(0, 160).trim();
    const nameKey = searchable(name);
    if (!name || !nameKey) {
      skip("noName");
      continue;
    }
    const key = (color ? `${color}:${number ?? nameKey}` : `hc:${nameKey}`).slice(0, 200);
    if (keys.has(key)) {
      skip("duplicate");
      continue;
    }
    keys.add(key);
    problems.push({
      key,
      name,
      name_searchable: nameKey,
      grade,
      circuit_color: color,
      circuit_number: color ? number : null,
      latitude: p.latitude,
      longitude: p.longitude,
    });
  }

  const order = (g: FontGrade) => FONT_SCALE.indexOf(g);
  const circuits = [...new Set(problems.map((p) => p.circuit_color).filter((c): c is CircuitColor => c !== null))].map(
    (color) => {
      const grades = problems.filter((p) => p.circuit_color === color).map((p) => p.grade).sort((a, b) => order(a) - order(b));
      return { color, average_grade: grades[Math.floor((grades.length - 1) / 2)] };
    },
  );
  return { name: doc.name, circuits, problems, skipped };
}
