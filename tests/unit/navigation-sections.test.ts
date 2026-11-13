import { describe, expect, it } from "vitest";
import { ACCOUNT_PAGES, AREAS, SECTION_IDS, activeSubPage, isAreaOverview, pagesFor, sectionForPath } from "@/lib/navigation/sections";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";

describe("five areas (structure v2)", () => {
  it("has exactly Today, Séances, Programmes, Progress and Patrick, in that order", () => {
    expect(AREAS.map((a) => a.id)).toEqual(["today", "sessions", "programmes", "progress", "patrick"]);
    expect([...SECTION_IDS]).toEqual(AREAS.map((a) => a.id));
    expect(AREAS.map((a) => a.href)).toEqual(["/home", "/session", "/programmes", "/follow-up", "/patrick"]);
  });
  it("lists the agreed pages", () => {
    const pages = Object.fromEntries(AREAS.map((a) => [a.id, a.children.map((c) => c.href)]));
    expect(pages).toEqual({
      today: [],
      sessions: ["/session", "/calendar", "/projects"],
      programmes: ["/programmes", "/atlas"],
      progress: ["/progress", "/follow-up/training", "/follow-up/mobility", "/training-assessment"],
      patrick: [],
    });
  });
  it("labels every area and page in French and English", () => {
    for (const dict of [fr, en]) {
      for (const area of AREAS) {
        expect(dict.nav[area.id]).toBeTruthy();
        for (const c of area.children) expect(dict.nav[c.key]).toBeTruthy();
      }
      for (const c of ACCOUNT_PAGES) expect(dict.nav[c.key]).toBeTruthy();
    }
    expect([fr.nav.today, fr.nav.sessions, fr.nav.programmes, fr.nav.progress]).toEqual(["Aujourd’hui", "Séances", "Programmes", "Progrès"]);
    expect([fr.nav.journal, fr.nav.calendar, fr.nav.myProgrammes, fr.nav.library]).toEqual(["Journal", "Agenda", "Mes programmes", "Bibliothèque"]);
  });
});

describe("every URL keeps working and maps to its area", () => {
  it("puts today's form in Today", () => {
    for (const path of ["/", "/home", "/train/today"]) expect(sectionForPath(path)).toBe("today");
  });
  it("puts every séance, grimpe and entraînement, the agenda and projects in Séances", () => {
    for (const path of ["/session", "/session/new", "/session/abc", "/session/abc/edit", "/climbing",
      "/problem/abc", "/route/abc", "/projects", "/projects/abc", "/projects/routes/abc",
      "/train/sessions", "/train/sessions/abc", "/calendar"]) {
      expect(sectionForPath(path)).toBe("sessions");
    }
  });
  it("puts programmes, the assessment wizard, mobility, the rival and the library in Programmes", () => {
    for (const path of ["/programmes", "/train", "/train/assess", "/train/alter-ego", "/train/mobility", "/train/mobility/assess",
      "/training-plans", "/atlas", "/atlas/max-hangs", "/training"]) {
      expect(sectionForPath(path)).toBe("programmes");
    }
  });
  it("keeps results, training history and evaluation results in Progress", () => {
    for (const path of ["/follow-up", "/follow-up/training", "/follow-up/mobility", "/progress", "/training-assessment",
      "/training/evaluate"]) {
      expect(sectionForPath(path)).toBe("progress");
    }
  });
  it("gives Patrick its own area and keeps profile and settings in the account menu", () => {
    expect(sectionForPath("/patrick")).toBe("patrick");
    for (const path of ["/profile", "/settings", "/settings/connections", "/settings/admin"]) {
      expect(sectionForPath(path)).toBe("account");
    }
  });
  it("does not confuse look-alike prefixes", () => {
    expect(sectionForPath("/training-plans")).toBe("programmes");
    expect(sectionForPath("/training-assessment")).toBe("progress");
    expect(sectionForPath("/train/todayx")).toBe("programmes");
    expect(sectionForPath("/sessionx")).not.toBe("sessions");
    expect(sectionForPath("/programmesx")).not.toBe("programmes");
  });
});

describe("one current page", () => {
  it("picks the most specific listed page", () => {
    expect(activeSubPage("/session")?.href).toBe("/session");
    expect(activeSubPage("/session/new")?.href).toBe("/session");
    expect(activeSubPage("/session/abc")?.href).toBe("/session");
    expect(activeSubPage("/train/sessions/abc")?.href).toBe("/session");
    expect(activeSubPage("/problem/x")?.href).toBe("/session");
    expect(activeSubPage("/route/x")?.href).toBe("/session");
    expect(activeSubPage("/climbing")?.href).toBe("/session");
    expect(activeSubPage("/calendar")?.href).toBe("/calendar");
    expect(activeSubPage("/projects/routes/x")?.href).toBe("/projects");
    expect(activeSubPage("/programmes")?.href).toBe("/programmes");
    expect(activeSubPage("/train/alter-ego")?.href).toBe("/programmes");
    expect(activeSubPage("/train/mobility")?.href).toBe("/programmes");
    expect(activeSubPage("/train/assess")?.href).toBe("/programmes");
    expect(activeSubPage("/training-plans")?.href).toBe("/programmes");
    expect(activeSubPage("/atlas/max-hangs")?.href).toBe("/atlas");
    expect(activeSubPage("/training")?.href).toBe("/atlas");
    expect(activeSubPage("/follow-up/training")?.href).toBe("/follow-up/training");
    expect(activeSubPage("/progress")?.href).toBe("/progress");
    expect(activeSubPage("/follow-up/mobility")?.href).toBe("/follow-up/mobility");
    expect(activeSubPage("/training/evaluate")?.href).toBe("/training-assessment");
    expect(activeSubPage("/settings/connections")?.href).toBe("/settings/connections");
    expect(activeSubPage("/settings")?.href).toBe("/settings");
    expect(activeSubPage("/profile")?.href).toBe("/profile");
    expect(activeSubPage("/train/today")).toBeNull();
  });
  it("marks the listed page, not the area link, when the area opens on a listed page", () => {
    const [today, sessions, programmes, progress, patrick] = AREAS;
    expect(isAreaOverview(today, "/home")).toBe(true);
    expect(isAreaOverview(today, "/")).toBe(true);
    expect(isAreaOverview(sessions, "/session")).toBe(false);
    expect(isAreaOverview(programmes, "/programmes")).toBe(false);
    expect(isAreaOverview(progress, "/follow-up")).toBe(true);
    expect(activeSubPage("/follow-up")).toBeNull();
    expect(isAreaOverview(patrick, "/patrick")).toBe(true);
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
