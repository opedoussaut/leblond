#!/usr/bin/env node
// Sends coach sessions to a climber's LEBLOND account with their personal coach key.
//
//   node scripts/coach-session.mjs list
//   node scripts/coach-session.mjs push session.json [more.json…]
//   node scripts/coach-session.mjs remove <slug>
//
// The key is read from LEBLOND_COACH_KEY or from ~/.leblond/coach-key (created by
// the climber in Settings → Coach access). It is never printed. The site is
// LEBLOND_URL (default https://leblond.vercel.app). Session files follow
// coachSessionSchema in lib/training/coach-sessions.ts and contain the
// climber's personal training: keep them OUT of this repository.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const base = (process.env.LEBLOND_URL ?? "https://leblond.vercel.app").replace(/\/$/, "");
const endpoint = base + "/api/coach-sessions";

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

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { authorization: "Bearer " + key(), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const [command, ...args] = process.argv.slice(2);
let failed = false;
if (command === "list") {
  const r = await call("GET", endpoint);
  if (r.status !== 200) { console.error(r.status, r.data); failed = true; } else {
  for (const s of r.data.sessions) console.log(`${s.slug}\t${s.minutes} min\t${s.title}\t${s.updated_at}`);
  if (!r.data.sessions.length) console.log("(no coach sessions)");
  }
} else if (command === "push" && args.length) {
  for (const file of args) {
    const session = JSON.parse(readFileSync(file, "utf8"));
    const r = await call("POST", endpoint, session);
    if (r.status === 200) console.log(`✓ ${r.data.slug} (${file})`);
    else { failed = true; console.error(`✗ ${file}: ${r.status}`, JSON.stringify(r.data, null, 2)); }
  }
} else if (command === "remove" && args.length === 1) {
  const r = await call("DELETE", endpoint + "?slug=" + encodeURIComponent(args[0]));
  if (r.status === 200) console.log(`✓ removed ${args[0]}`);
  else { failed = true; console.error(r.status, r.data); }
} else {
  console.error("Usage: node scripts/coach-session.mjs list | push <file.json…> | remove <slug>");
  process.exit(2);
}
// exitCode, not exit(): exiting while fetch sockets close crashes Node on Windows.
process.exitCode = failed ? 1 : 0;
