import { describe, expect, it } from "vitest";
import { arkoseBatches, arkoseColour, daySends, historyColours, importArkoseHistorySchema, parseArkoseHistory } from "@/lib/climbing/arkose-history";

const TODAY = "2026-11-14";

describe("arkoseColour", () => {
  it("reads French and English names, with or without accents and case", () => {
    expect(arkoseColour("Jaune")).toBe("YELLOW");
    expect(arkoseColour(" bleu ")).toBe("BLUE");
    expect(arkoseColour("purple")).toBe("PURPLE");
    expect(arkoseColour("RED")).toBe("RED");
    expect(arkoseColour("rose")).toBeNull();
  });
});

describe("parseArkoseHistory", () => {
  it("groups lines by day and adds up the same colour", () => {
    const p = parseArkoseHistory("date,couleur,nombre\n2025-09-02,jaune,11\n2025-09-02,bleu,2\n2025-09-02,jaune,1\n2024-09-26,bleu,8\n", TODAY);
    expect(p.missingColumns).toEqual([]);
    expect(p.days).toEqual([
      { date: "2024-09-26", counts: { BLUE: 8 } },
      { date: "2025-09-02", counts: { YELLOW: 12, BLUE: 2 } },
    ]);
    expect(p.sends).toBe(22);
    expect(daySends(p.days[1])).toBe(14);
  });

  it("accepts semicolons and English headers, skips zero counts", () => {
    const p = parseArkoseHistory("Date;Colour;Count\r\n2025-07-16;blue;10\r\n2025-07-16;red;0\r\n", TODAY);
    expect(p.days).toEqual([{ date: "2025-07-16", counts: { BLUE: 10 } }]);
  });

  it("refuses bad dates, future days, unknown colours and invalid counts", () => {
    const p = parseArkoseHistory("date,couleur,nombre\n2025-02-30,bleu,1\n2027-01-01,bleu,1\n2025-01-01,rose,1\n2025-01-01,bleu,-2\n2025-01-01,bleu,999\n", TODAY);
    expect(p.days).toEqual([]);
    expect(p.rejected.map((r) => r.reason)).toEqual(["date", "future", "colour", "count", "count"]);
    expect(p.rejected[0].line).toBe(2);
  });

  it("names missing columns", () => {
    expect(parseArkoseHistory("jour,nombre\n2025-01-01,3", TODAY).missingColumns).toEqual(["couleur"]);
  });
});

describe("import payload", () => {
  it("batches days and validates the payload", () => {
    const days = Array.from({ length: 85 }, (_, i) => ({ date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`, counts: { BLUE: 1 } }));
    expect(arkoseBatches(days).map((b) => b.length)).toEqual([40, 40, 5]);
    const gymId = "00000000-0000-4000-8000-000000000001";
    expect(importArkoseHistorySchema.safeParse({ gymId, days: days.slice(0, 2) }).success).toBe(true);
    expect(importArkoseHistorySchema.safeParse({ gymId, days: [{ date: "2025-01-01", counts: { PINK: 1 } }] }).success).toBe(false);
    expect(importArkoseHistorySchema.safeParse({ gymId, days: [{ date: "2025-01-01", counts: { BLUE: 0 } }] }).success).toBe(false);
  });
});

describe("other gyms on the Arkose statistics site", () => {
  it("reads Le Labo's light and dark greens and orange, and refuses a plain green there", () => {
    expect(arkoseColour("vert clair", "LELABO_COLOR")).toBe("LIGHT_GREEN");
    expect(arkoseColour("Vert foncé", "LELABO_COLOR")).toBe("DARK_GREEN");
    expect(arkoseColour("orange", "LELABO_COLOR")).toBe("ORANGE");
    expect(arkoseColour("vert", "LELABO_COLOR")).toBeNull();
    expect(arkoseColour("orange", "ARKOSE_COLOR")).toBeNull();
  });
  it("reads MROC colours in its own scale", () => {
    const p = parseArkoseHistory("date,couleur,nombre\n2023-12-15,jaune,5\n2023-12-15,violet,2\n2023-12-15,orange,1", "2026-11-15", "MROC_COLOR");
    expect(p.sends).toBe(7);
    expect(p.days[0].counts).toEqual({ YELLOW: 5, PURPLE: 2 });
    expect(p.rejected).toEqual([{ line: 4, reason: "colour" }]);
  });
  it("lists each scale easiest first", () => {
    expect(historyColours("LELABO_COLOR")).toEqual(["LIGHT_GREEN", "DARK_GREEN", "YELLOW", "ORANGE", "RED", "PURPLE", "BLUE", "BLACK"]);
    expect(historyColours("MROC_COLOR")).toEqual(["YELLOW", "GREEN", "BLUE", "PURPLE", "RED", "BLACK"]);
  });
});
