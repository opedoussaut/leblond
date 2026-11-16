import { describe, expect, it } from "vitest";
import { parseProgrammeTab, programmeHref } from "@/lib/navigation/programme-tabs";

describe("programme tabs", () => {
  it("reads the section from the URL, falling back to the overview", () => {
    expect(parseProgrammeTab("checks")).toBe("checks");
    expect(parseProgrammeTab(["guide", "checks"])).toBe("guide");
    // The rival has its own area now (/rival); the page redirects the old tab.
    expect(parseProgrammeTab("rival")).toBe("overview");
    expect(parseProgrammeTab("nope")).toBe("overview");
    expect(parseProgrammeTab(undefined)).toBe("overview");
  });

  it("opens the editor when a method is added from the library", () => {
    expect(parseProgrammeTab(undefined, "max-hangs")).toBe("editor");
    expect(parseProgrammeTab("guide", "max-hangs")).toBe("guide");
  });

  it("builds shareable addresses", () => {
    expect(programmeHref("overview")).toBe("/programmes");
    expect(programmeHref("editor", "max-hangs")).toBe("/programmes?tab=editor&add=max-hangs");
    expect(programmeHref("checks")).toBe("/programmes?tab=checks");
  });
});
