import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ILLUSTRATIONS, ILLUSTRATION_SIZES, illustrationSrc, isIllustration } from "@/lib/training/illustrations";

const DIR = join(process.cwd(), "public", "illustrations");

/** Width and height from a WebP header (VP8, VP8L or VP8X). */
function webpSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4)).toBe("RIFF");
  expect(b.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

describe("exercise illustrations", () => {
  it("has one image per id, with the size the page reserves", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, "")).sort();
    expect(files).toEqual([...ILLUSTRATIONS].sort());
    for (const id of ILLUSTRATIONS) expect(webpSize(join(DIR, `${id}.webp`))).toEqual(ILLUSTRATION_SIZES[id]);
  });

  it("keeps the ids sessions already use and refuses unknown ones", () => {
    for (const id of ["supine-knee-sways", "seated-hip-rotations", "adductor-rock-backs", "low-step-placements",
      "lateral-weight-shifts", "butterfly", "wall-step", "knee-to-wall", "supine-hip-internal-rotation", "wall-slides", "wall-straddle"]) {
      expect(isIllustration(id)).toBe(true);
    }
    expect(isIllustration("nope")).toBe(false);
    expect(isIllustration(undefined)).toBe(false);
    expect(illustrationSrc("cat-cow")).toBe("/illustrations/cat-cow.webp");
  });
});
