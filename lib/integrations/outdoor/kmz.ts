import { inflateRawSync } from "node:zlib";

/**
 * Reads the KML text out of a Google My Maps export: a .kmz (a zip holding
 * doc.kml) or a plain .kml. Minimal zip reader (stored or deflated entries,
 * no zip64, no encryption), with a cap on the inflated size.
 */

export const MAX_KML_BYTES = 5 * 1024 * 1024;

export class KmzError extends Error {
  constructor(public readonly code: "notKml" | "tooLarge") {
    super(code);
  }
}

const isZip = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

export function kmlText(bytes: Uint8Array): string {
  if (!isZip(bytes)) {
    if (bytes.length > MAX_KML_BYTES) throw new KmzError("tooLarge");
    const text = new TextDecoder("utf-8").decode(bytes);
    if (!/<kml[\s>]/i.test(text.slice(0, 2000))) throw new KmzError("notKml");
    return text;
  }
  return new TextDecoder("utf-8").decode(kmlEntry(bytes));
}

function kmlEntry(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory: last 22 bytes + an optional comment of up to 64 KiB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new KmzError("notKml");
  const entries = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);

  const found: Array<{ name: string; method: number; size: number; packed: number; local: number }> = [];
  for (let n = 0; n < entries; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new KmzError("notKml");
    const nameLength = view.getUint16(at + 28, true);
    const name = new TextDecoder("utf-8").decode(bytes.subarray(at + 46, at + 46 + nameLength));
    found.push({
      name,
      method: view.getUint16(at + 10, true),
      packed: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      local: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  const entry =
    found.find((e) => e.name.toLowerCase() === "doc.kml") ?? found.find((e) => e.name.toLowerCase().endsWith(".kml"));
  if (!entry) throw new KmzError("notKml");
  if (entry.size > MAX_KML_BYTES) throw new KmzError("tooLarge");

  const local = entry.local;
  if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw new KmzError("notKml");
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const data = bytes.subarray(start, start + entry.packed);
  if (data.length !== entry.packed) throw new KmzError("notKml");
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new KmzError("notKml");
  try {
    return inflateRawSync(data, { maxOutputLength: MAX_KML_BYTES });
  } catch (e) {
    if (e instanceof RangeError || (e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") throw new KmzError("tooLarge");
    throw new KmzError("notKml");
  }
}
