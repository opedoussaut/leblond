/**
 * Imports Boolder's Fontainebleau open data into the LEBLOND catalogue.
 *
 *   npx tsx scripts/import-boolder.ts --db path/to/boolder.db [--source-version <git sha>] [--source-date <ISO>]
 *   npx tsx scripts/import-boolder.ts --json tests/fixtures/boolder-sample.json     # small sample (tests, local dev)
 *   add --dry-run to only print what would be imported.
 *
 * Data: https://github.com/boolder-org/boolder-data — © Boolder, CC BY 4.0.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role:
 * the catalogue is not writable by climbers). Idempotent: re-running updates
 * rows in place; areas, circuits and problems that disappeared upstream are
 * removed from the catalogue (climbers' own problems and attempts are kept,
 * only their link to the catalogue is cleared) and their gyms are deactivated.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BOOLDER_PROVIDER,
  buildCatalogue,
  type BoolderDataset,
  type CatalogueImport,
} from "../lib/integrations/outdoor/boolder";

const { values: args } = parseArgs({
  options: {
    db: { type: "string" },
    json: { type: "string" },
    "source-version": { type: "string" },
    "source-date": { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

async function readSqlite(path: string): Promise<BoolderDataset> {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path, { readOnly: true });
  const all = <T>(sql: string) => db.prepare(sql).all() as unknown as T[];
  try {
    return {
      areas: all("select * from areas"),
      clusters: all("select id, name from clusters"),
      circuits: all("select * from circuits"),
      problems: all("select * from problems"),
    };
  } finally {
    db.close();
  }
}

function readJson(path: string): BoolderDataset & { source?: { version?: string; date?: string } } {
  return JSON.parse(readFileSync(path, "utf8"));
}

function summary(c: CatalogueImport) {
  const reasons: Record<string, number> = {};
  for (const s of c.skipped) reasons[`${s.kind}:${s.reason}`] = (reasons[`${s.kind}:${s.reason}`] ?? 0) + 1;
  return { areas: c.areas.length, circuits: c.circuits.length, problems: c.problems.length, skipped: reasons };
}

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function existingIds(sb: SupabaseClient, table: string): Promise<number[]> {
  const ids: number[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = ((await must(sb.from(table).select("id").order("id").range(from, from + 999), `read ${table}`)) ??
      []) as Array<{ id: number }>;
    ids.push(...rows.map((r) => r.id));
    if (rows.length < 1000) return ids;
  }
}

async function removeMissing(sb: SupabaseClient, table: string, keep: Set<number>) {
  const stale = (await existingIds(sb, table)).filter((id) => !keep.has(id));
  for (const part of chunk(stale, 200)) await must(sb.from(table).delete().in("id", part), `delete ${table}`);
  return stale;
}

async function main() {
  if (!args.db && !args.json) throw new Error("Pass --db <boolder.db> or --json <file>.");
  const raw = args.db ? await readSqlite(args.db) : readJson(args.json!);
  const source = "source" in raw ? (raw as { source?: { version?: string; date?: string } }).source : undefined;
  const sourceVersion = args["source-version"] ?? source?.version ?? null;
  const sourceDate = args["source-date"] ?? source?.date ?? null;

  const catalogue = buildCatalogue(raw);
  console.log("Boolder data (© Boolder, CC BY 4.0)", sourceVersion ? `@ ${sourceVersion}` : "");
  console.log(JSON.stringify(summary(catalogue), null, 2));
  if (args["dry-run"]) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. One gym per area (so sessions, analytics and favourites work unchanged).
  const gymRows = catalogue.areas.map((a) => ({
    name: a.name.length >= 2 ? a.name : `${a.name} (Bleau)`,
    brand: "OUTDOOR" as const,
    city: "Fontainebleau",
    country: "FR",
    grading_system: "FONT" as const,
    external_provider: BOOLDER_PROVIDER,
    external_id: String(a.id),
    latitude: a.south_west_lat != null && a.north_east_lat != null ? (a.south_west_lat + a.north_east_lat) / 2 : null,
    longitude: a.south_west_lon != null && a.north_east_lon != null ? (a.south_west_lon + a.north_east_lon) / 2 : null,
    active: true,
    created_by: null,
  }));
  for (const part of chunk(gymRows, 500))
    await must(sb.from("gyms").upsert(part, { onConflict: "external_provider,external_id" }), "upsert gyms");
  const gyms = (await must(
    sb.from("gyms").select("id, external_id").eq("external_provider", BOOLDER_PROVIDER),
    "read gyms",
  )) as Array<{ id: string; external_id: string }>;
  const gymByArea = new Map(gyms.map((g) => [Number(g.external_id), g.id]));

  // 2. Catalogue rows (parents before children).
  const now = new Date().toISOString();
  const areaRows = catalogue.areas.map((a) => ({ ...a, gym_id: gymByArea.get(a.id)!, updated_at: now }));
  for (const part of chunk(areaRows, 500)) await must(sb.from("outdoor_areas").upsert(part), "upsert areas");
  for (const part of chunk(catalogue.circuits.map((c) => ({ ...c, updated_at: now })), 500))
    await must(sb.from("outdoor_circuits").upsert(part), "upsert circuits");
  for (const part of chunk(catalogue.problems.map((p) => ({ ...p, updated_at: now })), 1000))
    await must(sb.from("outdoor_problems").upsert(part), "upsert problems");

  // 3. Remove what disappeared upstream (children before parents).
  const goneProblems = await removeMissing(sb, "outdoor_problems", new Set(catalogue.problems.map((p) => p.id)));
  const goneCircuits = await removeMissing(sb, "outdoor_circuits", new Set(catalogue.circuits.map((c) => c.id)));
  const goneAreas = await removeMissing(sb, "outdoor_areas", new Set(catalogue.areas.map((a) => a.id)));
  const keepGyms = new Set(catalogue.areas.map((a) => String(a.id)));
  const staleGyms = gyms.filter((g) => !keepGyms.has(g.external_id)).map((g) => g.id);
  for (const part of chunk(staleGyms, 200))
    await must(sb.from("gyms").update({ active: false }).in("id", part), "deactivate gyms");

  await must(
    sb.from("outdoor_data_imports").insert({
      source: BOOLDER_PROVIDER,
      source_version: sourceVersion,
      source_date: sourceDate,
      areas: catalogue.areas.length,
      circuits: catalogue.circuits.length,
      problems: catalogue.problems.length,
      skipped: catalogue.skipped.length,
    }),
    "record import",
  );
  console.log(
    `✓ imported. Removed upstream: ${goneProblems.length} problems, ${goneCircuits.length} circuits, ${goneAreas.length} areas; deactivated ${staleGyms.length} gyms.`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
