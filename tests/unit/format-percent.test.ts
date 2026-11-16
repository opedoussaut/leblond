import { describe, expect, it } from "vitest";
import { formatPercent, formatRatio } from "@/lib/format";

describe("formatPercent", () => {
  it("gives the share alone, rounded, and a dash when there is none", () => {
    expect(formatPercent({ value: 64 / 72 })).toBe("89 %");
    expect(formatPercent({ value: 0 })).toBe("0 %");
    expect(formatPercent({ value: null })).toBe("—");
  });

  it("agrees with formatRatio on the share", () => {
    const r = { numerator: 64, denominator: 72, value: 64 / 72 };
    expect(formatRatio(r).startsWith(formatPercent(r))).toBe(true);
  });
});

describe("formatCounts", () => {
  it("gives the counts behind a share, nothing without a share", async () => {
    const { formatCounts } = await import("@/lib/format");
    expect(formatCounts({ numerator: 64, denominator: 72, value: 64 / 72 })).toBe("64/72");
    expect(formatCounts({ numerator: 0, denominator: 0, value: null })).toBeUndefined();
  });
});
