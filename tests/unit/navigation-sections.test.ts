import { describe, expect, it } from "vitest";
import { AREAS, activeSubPage, sectionForPath } from "@/lib/navigation/sections";

describe("LEBLOND areas remain distinct", () => {
  it("keeps journals and projects in the climbing area", () => {
    for (const path of ["/climbing", "/session", "/session/new", "/session/abc", "/projects", "/problem/abc"]) {
      expect(sectionForPath(path)).toBe("climbing");
    }
  });
  it("keeps the atlas, calendar and coaching plans inside training", () => {
    for (const path of ["/train", "/atlas", "/atlas/technique", "/calendar",
      "/training-plans", "/training", "/patrick"]) {
      expect(sectionForPath(path)).toBe("training");
    }
  });
  it("keeps retrospective results and personal assessments in follow-up", () => {
    for (const path of ["/follow-up", "/progress", "/training-assessment", "/training/evaluate"]) {
      expect(sectionForPath(path)).toBe("followUp");
    }
  });
  it("keeps personal settings in profile", () => {
    expect(sectionForPath("/settings")).toBe("profile");
    expect(sectionForPath("/profile")).toBe("profile");
    expect(sectionForPath("/home")).toBe("home");
  });
});

describe("one selected page per area", () => {
  it("picks the most specific sub-page and never the overview for nested pages", () => {
    expect(activeSubPage("/train")?.href).toBe("/train");
    expect(activeSubPage("/train/sessions")?.href).toBe("/train/sessions");
    expect(activeSubPage("/train/sessions/abc")?.href).toBe("/train/sessions");
    expect(activeSubPage("/train/assess")?.href).toBe("/train/assess");
    expect(activeSubPage("/atlas/max-hangs")?.href).toBe("/atlas");
    expect(activeSubPage("/training")?.href).toBe("/atlas");
    expect(activeSubPage("/problem/x")?.href).toBe("/session");
    expect(activeSubPage("/follow-up/training")?.href).toBe("/follow-up/training");
    expect(activeSubPage("/follow-up")?.href).toBe("/follow-up");
    expect(activeSubPage("/training/evaluate")?.href).toBe("/training-assessment");
    expect(activeSubPage("/settings/connections")?.href).toBe("/settings/connections");
    expect(activeSubPage("/home")).toBeNull();
  });
  it("keeps training execution in Training and its history in Follow-up", () => {
    expect(sectionForPath("/train/sessions/abc")).toBe("training");
    expect(sectionForPath("/follow-up/training")).toBe("followUp");
  });
  it("lists every sub-page under exactly one area", () => {
    const hrefs = AREAS.flatMap((a) => a.children.map((c) => c.href));
    for (const area of AREAS) for (const c of area.children) expect(sectionForPath(c.href)).toBe(area.id);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
