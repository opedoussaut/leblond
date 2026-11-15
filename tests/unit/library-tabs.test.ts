import { describe, expect, it } from "vitest";
import { areasDictionary } from "@/lib/i18n/areas";
import { CATALOGUE_TABS, LIBRARY_TABS, catalogueTabFor, libraryHref, parseCompareIds, parseLibraryTab } from "@/lib/navigation/library-tabs";
import { TRAINING_CATALOGUE } from "@/lib/training/catalogue";

describe("Bibliothèque sections", () => {
  it("reads the section from ?tab=, falling back to the overview", () => {
    expect(parseLibraryTab(undefined)).toBe("overview");
    expect(parseLibraryTab("methods")).toBe("methods");
    expect(parseLibraryTab(["tools", "methods"])).toBe("tools");
    expect(parseLibraryTab("nope")).toBe("overview");
  });

  it("gives each section a shareable address", () => {
    expect(libraryHref("overview")).toBe("/atlas");
    expect(libraryHref("coaching")).toBe("/atlas?tab=coaching");
    expect(libraryHref("compare", ["lattice", "hangboard"])).toBe("/atlas?tab=compare&ids=lattice,hangboard");
    for (const tab of LIBRARY_TABS) expect(parseLibraryTab(new URL(libraryHref(tab), "http://x").searchParams.get("tab") ?? undefined)).toBe(tab);
  });

  it("keeps only known, distinct entries to compare, three at most", () => {
    expect(parseCompareIds(undefined)).toEqual(["technique", "max-hangs"]);
    expect(parseCompareIds("")).toEqual([]);
    expect(parseCompareIds("lattice,unknown,lattice,hangboard,max-hangs,technique")).toEqual(["lattice", "hangboard", "max-hangs"]);
  });

  it("covers every catalogue entry with exactly one section", () => {
    const categories = new Set(Object.values(CATALOGUE_TABS));
    for (const entry of TRAINING_CATALOGUE) {
      expect(categories.has(entry.category)).toBe(true);
      expect(CATALOGUE_TABS[catalogueTabFor(entry.category)]).toBe(entry.category);
    }
  });

  it("labels every section in French and English", () => {
    for (const locale of ["fr", "en"] as const) {
      const a = areasDictionary(locale).library;
      for (const tab of LIBRARY_TABS) expect(a.tabs[tab]).toBeTruthy();
    }
  });
});
