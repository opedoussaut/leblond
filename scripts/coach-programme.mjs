#!/usr/bin/env node
// Assigns a personal programme (Mobility Rebuild | 12 Weeks) to a climber's LEBLOND account
// with their personal coach key, and reads it back to verify.
//
//   node scripts/coach-programme.mjs status
//   node scripts/coach-programme.mjs assign programme.json
//
// The key is read from LEBLOND_COACH_KEY or from ~/.leblond/coach-key (created by the
// climber in Settings → Coach access). It is never printed. The site is LEBLOND_URL
// (default https://leblond.vercel.app). The programme file follows rebuildProgrammeSchema
// in lib/training/mobility-rebuild/templates.ts and contains the climber's personal
// training: keep it OUT of this repository. Assigning twice creates no duplicate.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const base = (process.env.LEBLOND_URL ?? "https://leblond.vercel.app").replace(/\/$/, "");
const endpoint = base + "/api/coach-programmes";

function key() {
  let k = process.env.LEBLOND_COACH_KEY;
  if (!k) {
    try { k = readFileSync(join(homedir(), ".leblond", "coach-key"), "utf8"); } catch { /* reported below */ }
  }
  k = (k ?? "").trim();
  if (!/^lbk_[0-9a-f]{48}$/.test(k)) {
    console.error("No coach key: create one in LEBLOND → Settings → Coach access and save it in ~/.leblond/coach-key.");
    process.exit(2);
  }
  return k;
}

async function call(method, body) {
  const res = await fetch(endpoint, {
    method,
    headers: { authorization: "Bearer " + key(), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const [command, file] = process.argv.slice(2);
let failed = false;
if (command === "status") {
  const r = await call("GET");
  if (r.status !== 200) { failed = true; console.error(r.status, r.data); } else console.log(JSON.stringify(r.data.programme, null, 2));
} else if (command === "assign" && file) {
  const r = await call("POST", JSON.parse(readFileSync(file, "utf8")));
  if (r.status !== 200) { failed = true; console.error(r.status, JSON.stringify(r.data, null, 2)); } else console.log(JSON.stringify(r.data, null, 2));
} else {
  console.error("Usage: node scripts/coach-programme.mjs status | assign <programme.json>");
  process.exit(2);
}
// exitCode, not exit(): exiting while fetch sockets close crashes Node on Windows.
process.exitCode = failed ? 1 : 0;
