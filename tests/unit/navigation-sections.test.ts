import { describe, expect, it } from "vitest";
import { sectionForPath } from "@/lib/navigation/sections";

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
