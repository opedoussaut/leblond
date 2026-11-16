import { describe, expect, it } from "vitest";
import { fontTrend, scaleRows } from "@/lib/analytics/scale-rows";

const snap = {
  workingLevels: [
    { system: "BLOCKOUT_LEVEL", level: null, levels: [{ grade: "B3", sends: 2, problems: 2 }, { grade: "B8", sends: 1, problems: 2 }] },
    { system: "ARKOSE_COLOR", level: "BLUE", levels: [{ grade: "YELLOW", sends: 6, problems: 6 }, { grade: "BLUE", sends: 20, problems: 20 }, { grade: "RED", sends: 3, problems: 8 }] },
    { system: "FONT", level: null, levels: [{ grade: "4A", sends: 1, problems: 1 }] },
  ],
  highestSent: [{ system: "ARKOSE_COLOR", grade: "RED" }, { system: "BLOCKOUT_LEVEL", grade: "B8" }, { system: "FONT", grade: "4A" }],
  highestFlashed: [{ system: "ARKOSE_COLOR", grade: "BLUE" }],
  highestUnsent: [{ system: "FONT", grade: "6A" }, { system: "CLIMB_UP_COLOR", grade: "RED" }],
  trends: [{ scale: "ARKOSE_COLOR", direction: "improving" }, { scale: "FONT_NORMALIZED", direction: "insufficient_data" }],
} as unknown as Parameters<typeof scaleRows>[0];

describe("scaleRows", () => {
  it("puts each scale's figures on one row, never mixing scales", () => {
    const arkose = scaleRows(snap).find((r) => r.system === "ARKOSE_COLOR")!;
    expect(arkose).toEqual({
      system: "ARKOSE_COLOR", working: "BLUE", top: "RED", flash: "BLUE", tried: null, trend: "improving",
      levels: [{ grade: "YELLOW", sent: 6, attempted: 6 }, { grade: "BLUE", sent: 20, attempted: 20 }, { grade: "RED", sent: 3, attempted: 8 }],
    });
  });

  it("lists scales with a working level first, then the most climbed, and keeps scales seen only in records", () => {
    expect(scaleRows(snap).map((r) => r.system)).toEqual(["ARKOSE_COLOR", "BLOCKOUT_LEVEL", "FONT", "CLIMB_UP_COLOR"]);
    expect(scaleRows(snap).at(-1)).toMatchObject({ working: null, tried: "RED", levels: [], trend: null });
  });

  it("reads the Font estimate's trend apart", () => {
    expect(fontTrend(snap)).toBe("insufficient_data");
  });
});
