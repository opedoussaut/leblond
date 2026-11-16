import { describe, expect, it } from "vitest";
import { parseProgrammeTab, programmeHref } from "@/lib/navigation/programme-tabs";

describe("programme tabs", () => {
  it("reads the section from the URL, falling back to the overview", () => {
    expect(parseProgrammeTab("rival")).toBe("rival");
    expect(parseProgrammeTab(["guide", "rival"])).toBe("guide");
    expect(parseProgrammeTab("nope")).toBe("overview");
    expect(parseProgrammeTab(undefined)).toBe("overview");
  });

  it("opens the editor when a method is added from the library", () => {
    expect(parseProgrammeTab(undefined, "max-hangs")).toBe("editor");
    expect(parseProgrammeTab("rival", "max-hangs")).toBe("rival");
  });

  it("builds shareable addresses", () => {
    expect(programmeHref("overview")).toBe("/programmes");
    expect(programmeHref("editor", "max-hangs")).toBe("/programmes?tab=editor&add=max-hangs");
    expect(programmeHref("checks")).toBe("/programmes?tab=checks");
  });
});
