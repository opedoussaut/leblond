import { describe, expect, it } from "vitest";
import { ACCOUNT_PAGES, AREAS, SECTION_IDS, activeSubPage, isAreaOverview, pagesFor, sectionForPath } from "@/lib/navigation/sections";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";

describe("five intent-based areas", () => {
  it("has exactly Today, Climbing, Training, Progress and Patrick, in that order", () => {
    expect(AREAS.map((a) => a.id)).toEqual(["today", "climbing", "training", "progress", "patrick"]);
    expect([...SECTION_IDS]).toEqual(AREAS.map((a) => a.id));
    expect(AREAS.map((a) => a.href)).toEqual(["/home", "/climbing", "/train", "/follow-up", "/patrick"]);
  });
  it("lists the agreed pages, with no overview entry (the area link is the overview)", () => {
    const pages = Object.fromEntries(AREAS.map((a) => [a.id, a.children.map((c) => c.href)]));
    expect(pages).toEqual({
      today: ["/train/today", "/calendar"],
      climbing: ["/session", "/projects"],
      training: ["/train/sessions", "/training-plans", "/atlas"],
      progress: ["/progress", "/follow-up/training", "/follow-up/mobility", "/training-assessment"],
      patrick: [],
    });
    for (const area of AREAS) expect(area.children.some((c) => c.href === area.href)).toBe(false);
  });
  it("labels every area and page in French and English", () => {
    for (const dict of [fr, en]) {
      for (const area of AREAS) {
        expect(dict.nav[area.id]).toBeTruthy();
        for (const c of area.children) expect(dict.nav[c.key]).toBeTruthy();
      }
      for (const c of ACCOUNT_PAGES) expect(dict.nav[c.key]).toBeTruthy();
    }
    expect([fr.nav.today, fr.nav.progress, fr.nav.dayCheck]).toEqual(["Aujourd’hui", "Progrès", "Forme du jour"]);
  });
});

describe("every URL keeps working and maps to its area", () => {
  it("puts today's form and the agenda in Today", () => {
    for (const path of ["/", "/home", "/train/today", "/calendar"]) expect(sectionForPath(path)).toBe("today");
  });
  it("keeps journals, boulders, routes and projects in Climbing", () => {
    for (const path of ["/climbing", "/session", "/session/new", "/session/abc", "/session/abc/edit",
      "/problem/abc", "/route/abc", "/projects", "/projects/abc", "/projects/routes/abc"]) {
      expect(sectionForPath(path)).toBe("climbing");
    }
  });
  it("keeps training execution, plans and the Atlas in Training", () => {
    for (const path of ["/train", "/train/sessions", "/train/sessions/abc", "/train/alter-ego", "/train/mobility",
      "/training-plans", "/atlas", "/atlas/max-hangs", "/training"]) {
      expect(sectionForPath(path)).toBe("training");
    }
  });
  it("keeps results, training history and evaluations in Progress", () => {
    for (const path of ["/follow-up", "/follow-up/training", "/follow-up/mobility", "/progress", "/training-assessment",
      "/train/assess", "/training/evaluate"]) {
      expect(sectionForPath(path)).toBe("progress");
    }
  });
  it("gives Patrick its own area and moves profile and settings to the account menu", () => {
    expect(sectionForPath("/patrick")).toBe("patrick");
    for (const path of ["/profile", "/settings", "/settings/connections", "/settings/admin"]) {
      expect(sectionForPath(path)).toBe("account");
    }
  });
  it("does not confuse look-alike prefixes", () => {
    expect(sectionForPath("/training-plans")).toBe("training");
    expect(sectionForPath("/training-assessment")).toBe("progress");
    expect(sectionForPath("/train/todayx")).toBe("training");
    expect(sectionForPath("/sessionx")).not.toBe("climbing");
  });
});

describe("one current page", () => {
  it("picks the most specific listed page", () => {
    expect(activeSubPage("/train/today")?.href).toBe("/train/today");
    expect(activeSubPage("/calendar")?.href).toBe("/calendar");
    expect(activeSubPage("/train/sessions")?.href).toBe("/train/sessions");
    expect(activeSubPage("/train/sessions/abc")?.href).toBe("/train/sessions");
    expect(activeSubPage("/atlas/max-hangs")?.href).toBe("/atlas");
    expect(activeSubPage("/training")?.href).toBe("/atlas");
    expect(activeSubPage("/problem/x")?.href).toBe("/session");
    expect(activeSubPage("/route/x")?.href).toBe("/session");
    expect(activeSubPage("/projects/routes/x")?.href).toBe("/projects");
    expect(activeSubPage("/follow-up/training")?.href).toBe("/follow-up/training");
    expect(activeSubPage("/progress")?.href).toBe("/progress");
    expect(activeSubPage("/follow-up/mobility")?.href).toBe("/follow-up/mobility");
    expect(activeSubPage("/training/evaluate")?.href).toBe("/training-assessment");
    expect(activeSubPage("/train/assess")?.href).toBe("/training-assessment");
    expect(activeSubPage("/settings/connections")?.href).toBe("/settings/connections");
    expect(activeSubPage("/settings")?.href).toBe("/settings");
    expect(activeSubPage("/profile")?.href).toBe("/profile");
  });
  it("selects no sub-page on an area overview: the area link is the current page", () => {
    for (const area of AREAS) {
      expect(activeSubPage(area.href)).toBeNull();
      expect(isAreaOverview(area, area.href)).toBe(true);
    }
    expect(isAreaOverview(AREAS[0], "/")).toBe(true);
    expect(isAreaOverview(AREAS[2], "/train/sessions")).toBe(false);
    expect(activeSubPage("/train/alter-ego")).toBeNull();
  });
  it("lists every page under exactly one area, and the account pages under the account menu", () => {
    const hrefs = AREAS.flatMap((a) => a.children.map((c) => c.href));
    for (const area of AREAS) {
      expect(sectionForPath(area.href)).toBe(area.id);
      for (const c of area.children) expect(sectionForPath(c.href)).toBe(area.id);
      expect(pagesFor(area.id)).toBe(area.children);
    }
    for (const c of ACCOUNT_PAGES) expect(sectionForPath(c.href)).toBe("account");
    expect(pagesFor("account")).toBe(ACCOUNT_PAGES);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
