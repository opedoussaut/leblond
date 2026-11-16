import { describe, expect, it } from "vitest";
import { progressAreaDictionary } from "@/lib/i18n/progress-area";
import { FOLLOW_UP_TABS, followUpHref, parseFollowUpTab } from "@/lib/navigation/follow-up-tabs";

describe("Progrès sections", () => {
  it("reads the section from ?tab=, falling back to the overview", () => {
    expect(parseFollowUpTab(undefined)).toBe("overview");
    expect(parseFollowUpTab("load")).toBe("load");
    expect(parseFollowUpTab(["compare", "load"])).toBe("compare");
    expect(parseFollowUpTab("records")).toBe("overview");
  });

  it("gives each section a shareable address that keeps the period", () => {
    expect(followUpHref("overview")).toBe("/follow-up");
    expect(followUpHref("overview", 12)).toBe("/follow-up");
    expect(followUpHref("overview", 26)).toBe("/follow-up?weeks=26");
    expect(followUpHref("training", 52)).toBe("/follow-up?tab=training&weeks=52");
    for (const tab of FOLLOW_UP_TABS) {
      expect(parseFollowUpTab(new URL(followUpHref(tab), "http://x").searchParams.get("tab") ?? undefined)).toBe(tab);
    }
  });

  it("names every section in both languages", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const tab of FOLLOW_UP_TABS) expect(progressAreaDictionary(locale).followUp.tabs[tab]).toBeTruthy();
    }
  });
});
