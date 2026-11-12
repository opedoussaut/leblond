import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AtlasDiagramFigure } from "@/components/training/atlas-diagram";
import { atlasDictionary, diagramFacts, formatDuration } from "@/lib/i18n/atlas";
import { ATLAS_DETAILS, METHOD_PROTOCOL_KEYS, atlasDetail } from "@/lib/training/atlas";
import {
  circuitDurationRange, continuousSegments, forceTestBars, intervalSegments, ladderMoves, niceTicks, phaseLayout,
  scale, setDuration, wrapLabel, zoomSegments,
} from "@/lib/training/atlas-diagram";
import type { AtlasDiagram, IntervalsDiagram } from "@/lib/training/atlas-types";
import { TRAINING_CATALOGUE } from "@/lib/training/catalogue";
import { templateFor } from "@/lib/training/session-templates";

const LOCALES = ["fr", "en"] as const;

/** Every {fr, en} pair anywhere inside a value, with its path. */
function localizedPairs(value: unknown, path = ""): { path: string; fr: unknown; en: unknown }[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => localizedPairs(v, path + "[" + i + "]"));
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 2 && keys.includes("fr") && keys.includes("en")) {
      const v = value as { fr: unknown; en: unknown };
      return [{ path, fr: v.fr, en: v.en }];
    }
    return Object.entries(value).flatMap(([k, v]) => localizedPairs(v, path + "." + k));
  }
  return [];
}

function mainOf(id: string) {
  const main = templateFor(id, 60).filter((e) => e.block === "MAIN" && e.methodId === id);
  expect(main.length, id + " has a MAIN template").toBeGreaterThan(0);
  return main;
}

function diagramOf<K extends AtlasDiagram["kind"]>(id: string, kind: K): Extract<AtlasDiagram, { kind: K }> {
  const spec = ATLAS_DETAILS[id].diagram;
  expect(spec.kind).toBe(kind);
  return spec as Extract<AtlasDiagram, { kind: K }>;
}

describe("atlas content", () => {
  it("covers every catalogue entry and nothing else", () => {
    const ids = TRAINING_CATALOGUE.map((e) => e.id).sort();
    expect(Object.keys(ATLAS_DETAILS).sort()).toEqual(ids);
    for (const entry of TRAINING_CATALOGUE) expect(atlasDetail(entry)).toBeDefined();
    expect(atlasDetail({ id: "unknown" })).toBeUndefined();
  });

  it("has non-empty French and English text everywhere", () => {
    for (const [id, detail] of Object.entries(ATLAS_DETAILS)) {
      const pairs = localizedPairs(detail);
      expect(pairs.length, id).toBeGreaterThan(20);
      for (const pair of pairs) {
        expect(typeof pair.fr === "string" && pair.fr.trim().length > 0, id + pair.path + ".fr").toBe(true);
        expect(typeof pair.en === "string" && pair.en.trim().length > 0, id + pair.path + ".en").toBe(true);
      }
    }
  });

  it("gives every entry substantial content", () => {
    for (const [id, d] of Object.entries(ATLAS_DETAILS)) {
      expect(d.summary.fr.length, id).toBeGreaterThan(120);
      expect(d.evidenceNote.en.length, id).toBeGreaterThan(60);
      expect(d.prerequisites.length, id).toBeGreaterThanOrEqual(3);
      expect(d.steps.length, id).toBeGreaterThanOrEqual(3);
      expect(d.progression.length, id).toBeGreaterThanOrEqual(2);
      expect(d.mistakes.length, id).toBeGreaterThanOrEqual(2);
      expect(d.safety.length, id).toBeGreaterThanOrEqual(1);
      expect(d.variants.length, id).toBeGreaterThanOrEqual(2);
      expect(d.protocol.length, id).toBeGreaterThanOrEqual(5);
      expect(new Set(d.protocol.map((r) => r.key)).size, id + " unique protocol rows").toBe(d.protocol.length);
    }
  });

  it("fills the full protocol table and cites peer-reviewed work for every method", () => {
    for (const entry of TRAINING_CATALOGUE.filter((e) => e.category === "methods")) {
      const d = ATLAS_DETAILS[entry.id];
      expect(d.protocol.map((r) => r.key), entry.id).toEqual([...METHOD_PROTOCOL_KEYS]);
      expect(d.sources.length, entry.id).toBeGreaterThanOrEqual(2);
      expect(d.sources.some((s) => s.kind === "study" || s.kind === "review"), entry.id).toBe(true);
    }
  });

  it("uses unique https sources with a citation and a finding", () => {
    for (const [id, d] of Object.entries(ATLAS_DETAILS)) {
      const urls = d.sources.map((s) => s.url);
      expect(new Set(urls).size, id).toBe(urls.length);
      for (const s of d.sources) {
        expect(new URL(s.url).protocol, id + " " + s.url).toBe("https:");
        expect(s.citation.length, id).toBeGreaterThan(20);
      }
    }
  });
});

describe("atlas diagrams match the executable session templates", () => {
  it("intervals: limit bouldering, max hangs and repeaters", () => {
    const limit = diagramOf("limit-bouldering", "intervals"), [lt] = mainOf("limit-bouldering");
    expect([limit.sets, limit.reps, limit.setRest, limit.pause]).toEqual([lt.targetSets, lt.targetReps, lt.restSeconds, lt.restSeconds]);

    const max = diagramOf("max-hangs", "intervals"), [mt] = mainOf("max-hangs");
    expect([max.sets, max.reps, max.work, max.setRest]).toEqual([mt.targetSets, 1, mt.targetSeconds, mt.restSeconds]);

    const rep = diagramOf("repeaters", "intervals"), [rt] = mainOf("repeaters");
    expect([rep.sets, rep.reps, rep.work, rep.setRest]).toEqual([rt.targetSets, rt.targetReps, rt.targetSeconds, rt.restSeconds]);
  });

  it("continuous, circuit, rounds and ladder", () => {
    const arc = diagramOf("easy-volume", "continuous"), [at] = mainOf("easy-volume");
    expect([arc.blocks, arc.blockMinutes * 60, arc.restMinutes * 60]).toEqual([at.targetSets, at.targetSeconds, at.restSeconds]);

    const c = diagramOf("four-by-four", "circuit"), [ct] = mainOf("four-by-four");
    expect([c.rounds, c.problems, c.roundRest]).toEqual([ct.targetSets, ct.targetReps, ct.restSeconds]);

    const r = diagramOf("constraints", "rounds"), [rt] = mainOf("constraints");
    expect([r.rounds.length, r.attempts, r.rest]).toEqual([rt.targetSets, rt.targetReps, rt.restSeconds]);

    const l = diagramOf("campus", "ladder"), [lt] = mainOf("campus");
    expect([l.sets, l.reps, l.rest]).toEqual([lt.targetSets, lt.targetReps, lt.restSeconds]);
    for (const ladder of l.ladders) for (const rung of ladder) expect(rung).toBeLessThanOrEqual(l.rungs);
  });

  it.each(["strength-conditioning", "mobility", "hip-mobility"])("%s sets, one per template exercise", (id) => {
    const s = diagramOf(id, "sets"), templates = mainOf(id);
    expect(s.exercises.map((e) => e.name.en)).toEqual(templates.map((t) => t.name.en));
    expect(s.exercises.map((e) => e.name.fr)).toEqual(templates.map((t) => t.name.fr));
    s.exercises.forEach((e, i) => {
      const t = templates[i];
      expect([e.sets, e.rest], e.name.en).toEqual([t.targetSets, t.restSeconds]);
      if (t.modality === "HOLD") expect(e.seconds).toBe(t.targetSeconds);
      else expect(e.reps).toBe(t.targetReps);
    });
  });

  it("mobility: links the video, warms up briefly and has no extra cool-down", () => {
    const entry = TRAINING_CATALOGUE.find((e) => e.id === "mobility")!;
    const info = atlasDetail(entry)!;
    expect(info.video?.url).toBe("https://www.youtube.com/watch?v=mKUle2yBYq0");
    expect(info.sources.some((s) => s.url === info.video?.url)).toBe(true);
    const plan = templateFor("mobility", 30);
    expect(plan[0].key).toBe("general-warmup");
    expect(plan.filter((t) => t.block === "COOLDOWN")).toEqual([]);
    expect(plan.filter((t) => t.block === "MAIN").every((t) => t.methodId === "mobility" && t.modality === "HOLD")).toBe(true);
  });

  it("technique loop centre states the template's sets, reps and rest", () => {
    const loop = diagramOf("technique", "loop"), [t] = mainOf("technique");
    const centre = loop.center.map((c) => c.en).join(" ");
    expect(centre).toContain(t.targetSets + " sets × " + t.targetReps);
    expect(centre).toContain(formatDuration(t.restSeconds ?? 0, "en"));
  });

  it("periodized cycle is 4-3-2-1 weeks", () => {
    const p = diagramOf("periodized", "phases");
    expect(p.phases.map((x) => x.weeks)).toEqual([4, 3, 2, 1]);
    expect(phaseLayout(p).totalWeeks).toBe(10);
  });
});

describe("atlas diagram geometry", () => {
  const maxHangs = ATLAS_DETAILS["max-hangs"].diagram as IntervalsDiagram;
  const repeaters = ATLAS_DETAILS["repeaters"].diagram as IntervalsDiagram;

  it("computes exact interval totals", () => {
    expect(intervalSegments(maxHangs).total).toBe(5 * 10 + 4 * 180);
    expect(setDuration(repeaters)).toBe(6 * 7 + 5 * 3);
    expect(intervalSegments(repeaters).total).toBe(3 * 57 + 2 * 180);
  });

  it("lays segments end to end, so widths are proportional to durations", () => {
    for (const spec of [maxHangs, repeaters, ATLAS_DETAILS["limit-bouldering"].diagram as IntervalsDiagram]) {
      const { total, segments } = intervalSegments(spec);
      let t = 0;
      for (const seg of segments) {
        expect(seg.start).toBe(t);
        t += seg.duration;
      }
      expect(t).toBe(total);
      const width = 340;
      const pixels = segments.reduce((sum, seg) => sum + (scale(seg.start + seg.duration, total, 10, width) - scale(seg.start, total, 10, width)), 0);
      expect(pixels).toBeCloseTo(width, 6);
      const work = segments.find((s) => s.type === "work")!, rest = segments.find((s) => s.type === "setRest")!;
      const ratio = (scale(rest.duration, total, 0, width)) / (scale(work.duration, total, 0, width));
      expect(ratio).toBeCloseTo(rest.duration / work.duration, 9);
    }
  });

  it("zooms on one set and shows the unused reserve of a single hang", () => {
    const z = zoomSegments(maxHangs);
    expect(z.total).toBe(13);
    expect(z.segments.map((s) => s.type)).toEqual(["work", "reserve"]);
    expect(zoomSegments(repeaters).total).toBe(57);
  });

  it("builds continuous blocks, circuit ranges and force-test timing", () => {
    expect(continuousSegments(ATLAS_DETAILS["easy-volume"].diagram as never).totalMinutes).toBe(3 * 10 + 2 * 5);
    expect(circuitDurationRange(ATLAS_DETAILS["four-by-four"].diagram as never)).toEqual([16 * 30 + 3 * 240, 16 * 60 + 3 * 240]);
    const f = forceTestBars(ATLAS_DETAILS["force-sensor"].diagram as never);
    expect(f.total).toBe(24 * 7 + 23 * 3);
    expect(f.bars.filter((b) => b.counted).map((b) => f.bars.indexOf(b))).toEqual([21, 22, 23]);
    for (let i = 1; i < f.bars.length; i++) expect(f.bars[i].relative).toBeLessThan(f.bars[i - 1].relative);
  });

  it("alternates hands on campus ladders from a matched start", () => {
    expect(ladderMoves([1, 3, 5])).toEqual([
      { hand: "L", rung: 1, order: 0 }, { hand: "R", rung: 1, order: 0 },
      { hand: "L", rung: 3, order: 1 }, { hand: "R", rung: 5, order: 2 },
    ]);
    expect(ladderMoves([])).toEqual([]);
  });

  it("picks readable time ticks and wraps labels", () => {
    expect(niceTicks(770)).toEqual([0, 180, 360, 540, 720]);
    expect(niceTicks(57)).toEqual([0, 10, 20, 30, 40, 50]);
    expect(niceTicks(0)).toEqual([0]);
    expect(wrapLabel("Tête : 1–2 m au-dessus", 12)).toEqual(["Tête : 1–2 m", "au-dessus"]);
    const cut = wrapLabel("one two three four five six seven", 7, 2);
    expect(cut).toHaveLength(2);
    expect(cut[1].endsWith("…")).toBe(true);
  });

  it("keeps short in-diagram labels short enough for a phone-width SVG", () => {
    for (const [id, d] of Object.entries(ATLAS_DETAILS)) {
      for (const locale of LOCALES) {
        if (d.diagram.kind === "loop") for (const c of d.diagram.center) expect(c[locale].length, id).toBeLessThanOrEqual(16);
        if (d.diagram.kind === "edges") for (const e of d.diagram.edges) expect(e.note[locale].length, id).toBeLessThanOrEqual(22);
      }
    }
  });

  it("formats durations per locale", () => {
    expect(formatDuration(10, "fr")).toBe("10 s");
    expect(formatDuration(180, "en")).toBe("3 min");
    expect(formatDuration(90, "fr")).toBe("1 min 30 s");
  });
});

describe("atlas diagram rendering", () => {
  it("lists the protocol numbers as text for max hangs", () => {
    const values = diagramFacts(maxHangsSpec(), "en").map((f) => f.value);
    expect(values).toContain("10 s");
    expect(values).toContain("3 s");
    expect(values).toContain("12 min 50 s");
  });

  it("renders every diagram in both languages with accessible text and theme colours only", () => {
    for (const [id, detail] of Object.entries(ATLAS_DETAILS)) {
      for (const locale of LOCALES) {
        const html = renderToStaticMarkup(createElement(AtlasDiagramFigure, { spec: detail.diagram, locale, uid: id, title: id }));
        expect(html, id).toContain('role="img"');
        expect(html, id).toContain(escapeHtml(atlasDictionary(locale).diagramFor.replace("{title}", id)));
        expect(html, id).toContain("aria-describedby");
        expect(html, id).not.toMatch(/NaN|undefined|Infinity/);
        expect(html, id + " hard-coded colour").not.toMatch(/(fill|stroke)="#|(fill|stroke)="(rgb|hsl)/);
        for (const fact of diagramFacts(detail.diagram, locale)) expect(html, id).toContain(escapeHtml(fact.label));
        expect(html).toContain(escapeHtml(atlasDictionary(locale).diagram));
      }
    }
  });
});

function maxHangsSpec() {
  return ATLAS_DETAILS["max-hangs"].diagram;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}
