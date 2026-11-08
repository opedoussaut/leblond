import { BOOLDER_PROVIDER, type CatalogueImport } from "./boolder";

/**
 * The Boolder catalogue as plain SQL batches, for hosts where the import runs
 * through the database (Supabase Management API / psql) rather than the REST
 * API with a service-role key. Same effect as scripts/import-boolder.ts:
 * upserts gyms, areas, circuits and problems; removes what disappeared
 * upstream (climbers' own problems keep their attempts, only the catalogue link
 * is cleared by the foreign key); records the import. Each batch is a single
 * statement list that can be sent on its own; the last one only runs once all
 * upserts succeeded.
 */

const TAG = "$boolder$";

function json(rows: unknown[]): string {
  const text = JSON.stringify(rows);
  if (text.includes(TAG)) throw new Error("Boolder data contains the SQL quoting tag; refusing to build SQL.");
  return `${TAG}${text}${TAG}::jsonb`;
}

function literal(value: string | null): string {
  return value === null ? "null" : `'${value.replace(/'/g, "''")}'`;
}

function intArray(ids: number[]): string {
  if (!ids.every((id) => Number.isSafeInteger(id))) throw new Error("Non-integer id in the catalogue.");
  return `'{${ids.join(",")}}'::integer[]`;
}

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function upsert(table: string, columns: string[], rows: object[], conflict: string, select?: { join: string; overrides: Record<string, string> }) {
  const cols = columns.join(", ");
  const exprs = columns.map((c) => select?.overrides[c] ?? `r.${c}`).join(", ");
  const updates = columns.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
  return [
    `insert into public.${table} (${cols})`,
    `select ${exprs} from jsonb_populate_recordset(null::public.${table}, ${json(rows)}) r`,
    select ? select.join : "",
    `on conflict (${conflict}) do update set ${updates};`,
  ].filter(Boolean).join("\n");
}

export function catalogueSql(
  catalogue: CatalogueImport,
  source: { version: string | null; date: string | null },
  sizes = { areas: 500, problems: 1000 },
): string[] {
  const batches: string[] = [];
  const now = new Date().toISOString();

  // 1. One gym per area (so sessions, analytics and favourites work unchanged).
  const gyms = catalogue.areas.map((a) => ({
    name: a.name.length >= 2 ? a.name : `${a.name} (Bleau)`,
    brand: "OUTDOOR",
    city: "Fontainebleau",
    country: "FR",
    grading_system: "FONT",
    external_provider: BOOLDER_PROVIDER,
    external_id: String(a.id),
    latitude: a.south_west_lat != null && a.north_east_lat != null ? (a.south_west_lat + a.north_east_lat) / 2 : null,
    longitude: a.south_west_lon != null && a.north_east_lon != null ? (a.south_west_lon + a.north_east_lon) / 2 : null,
    active: true,
  }));
  const gymCols = ["name", "brand", "city", "country", "grading_system", "external_provider", "external_id", "latitude", "longitude", "active"];
  for (const part of chunk(gyms, sizes.areas)) {
    batches.push(
      [
        `insert into public.gyms (${gymCols.join(", ")})`,
        `select ${gymCols.map((c) => `r.${c}`).join(", ")} from jsonb_populate_recordset(null::public.gyms, ${json(part)}) r`,
        `on conflict (external_provider, external_id) do update set name = excluded.name, city = excluded.city,`,
        `  latitude = excluded.latitude, longitude = excluded.longitude, active = true;`,
      ].join("\n"),
    );
  }

  // 2. Catalogue rows, parents before children. Areas take their gym's id.
  const areaCols = [
    "id", "gym_id", "name", "name_searchable", "cluster_name", "priority", "tags", "description_fr", "description_en",
    "warning_fr", "warning_en", "south_west_lat", "south_west_lon", "north_east_lat", "north_east_lon", "problems_count", "updated_at",
  ];
  for (const part of chunk(catalogue.areas.map((a) => ({ ...a, updated_at: now })), sizes.areas)) {
    batches.push(
      upsert("outdoor_areas", areaCols, part, "id", {
        join: `join public.gyms g on g.external_provider = '${BOOLDER_PROVIDER}' and g.external_id = r.id::text`,
        overrides: { gym_id: "g.id" },
      }),
    );
  }
  const circuitCols = ["id", "color", "average_grade", "beginner_friendly", "dangerous", "updated_at"];
  for (const part of chunk(catalogue.circuits.map((c) => ({ ...c, updated_at: now })), sizes.problems)) {
    batches.push(upsert("outdoor_circuits", circuitCols, part, "id"));
  }
  const problemCols = [
    "id", "area_id", "name", "name_en", "name_searchable", "grade", "circuit_id", "circuit_number", "circuit_color", "steepness",
    "wall_angle", "sit_start", "latitude", "longitude", "popularity", "featured", "parent_id", "bleau_info_id", "updated_at",
  ];
  for (const part of chunk(catalogue.problems.map((p) => ({ ...p, updated_at: now })), sizes.problems)) {
    batches.push(upsert("outdoor_problems", problemCols, part, "id"));
  }

  // 3. Remove what disappeared upstream (children before parents), deactivate
  //    their gyms, record the import and report counts.
  const areaIds = catalogue.areas.map((a) => a.id);
  batches.push(
    [
      `delete from public.outdoor_problems where not (id = any (${intArray(catalogue.problems.map((p) => p.id))}));`,
      `delete from public.outdoor_circuits where not (id = any (${intArray(catalogue.circuits.map((c) => c.id))}));`,
      `delete from public.outdoor_areas where not (id = any (${intArray(areaIds)}));`,
      `update public.gyms set active = false where external_provider = '${BOOLDER_PROVIDER}'`,
      `  and not (external_id = any (${intArray(areaIds)}::text[]));`,
      `insert into public.outdoor_data_imports (source, source_version, source_date, areas, circuits, problems, skipped)`,
      `values ('${BOOLDER_PROVIDER}', ${literal(source.version)}, ${source.date ? `${literal(source.date)}::timestamptz` : "null"},`,
      `  ${catalogue.areas.length}, ${catalogue.circuits.length}, ${catalogue.problems.length}, ${catalogue.skipped.length});`,
      `select (select count(*) from public.outdoor_areas) as areas, (select count(*) from public.outdoor_circuits) as circuits,`,
      `  (select count(*) from public.outdoor_problems) as problems,`,
      `  (select count(*) from public.gyms where external_provider = '${BOOLDER_PROVIDER}' and active) as active_gyms;`,
    ].join("\n"),
  );
  return batches;
}
