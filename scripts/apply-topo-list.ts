/**
 * Replaces a team topo (source 'LEBLOND') with a written list, from the
 * "Deploy database" workflow (mode topo-list). The list is the whole topo:
 * boulders it does not mention are removed (climbers' logged problems keep
 * their tries; only their link to the topo is cleared). Boulders matched by
 * name, or by circuit and number, keep their key and position.
 *
 * Inputs come from the workflow_dispatch event file, never from the command
 * line or the environment, so the list is not echoed in the public logs:
 *   topo_site  part of the site name, matching exactly one team-topo site
 *   topo_list  the written list (see lib/integrations/outdoor/topo-list.ts)
 * Requires SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID (Management API).
 * Prints counts only. The import runs through admin_import_leblond_topo() as
 * the active admin, exactly as the admin form would.
 */
import { readFileSync } from "node:fs";
import { circuitsOf, mergeTopoList, parseTopoList, type ListedProblem } from "../lib/integrations/outdoor/topo-list";
import type { CircuitColor } from "../lib/integrations/outdoor/boolder";
import type { FontGrade } from "../lib/grading/systems";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const project = process.env.SUPABASE_PROJECT_ID;
const eventPath = process.env.GITHUB_EVENT_PATH;
if (!token || !project || !eventPath) throw new Error("SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID and GITHUB_EVENT_PATH are required");

const inputs = (JSON.parse(readFileSync(eventPath, "utf8")) as { inputs?: Record<string, string> }).inputs ?? {};
const site = (inputs.topo_site ?? "").trim();
const listText = inputs.topo_list ?? "";
if (!/^[\p{L}\p{N} '’-]{3,80}$/u.test(site)) throw new Error("topo_site: 3 to 80 letters");
if (!listText.trim()) throw new Error("topo_list is empty");

async function query<T>(sql: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`query failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T[];
}

/** A dollar-quoted literal whose tag cannot occur in the value. */
function literal(value: string): string {
  let tag = "v";
  while (value.includes(`$${tag}$`)) tag += "v";
  return `$${tag}$${value}$${tag}$`;
}

async function main() {
  const sites = await query<{ gym_id: string; name: string }>(
    `select g.id as gym_id, g.name from public.gyms g join public.outdoor_areas a on a.gym_id = g.id and a.source = 'LEBLOND'
     where g.name ilike '%' || ${literal(site)} || '%'`,
  );
  if (sites.length !== 1) throw new Error(`topo_site must match exactly one team-topo site (matched ${sites.length})`);
  const gymId = sites[0].gym_id;
  if (!/^[0-9a-f-]{36}$/.test(gymId)) throw new Error("unexpected site id");
  console.log(`Site: ${sites[0].name}`);

  const rows = await query<{
    source_key: string | null; name: string; name_searchable: string; grade: string;
    circuit_color: string | null; circuit_number: string | null; latitude: number | null; longitude: number | null;
  }>(
    `select op.source_key, op.name, op.name_searchable, op.grade, op.circuit_color, op.circuit_number, op.latitude, op.longitude
     from public.outdoor_problems op join public.outdoor_areas a on a.id = op.area_id
     where a.gym_id = '${gymId}' and a.source = 'LEBLOND' and op.source = 'LEBLOND'`,
  );
  const pins: ListedProblem[] = rows.filter((p) => p.source_key).map((p) => ({
    key: p.source_key as string,
    name: p.name,
    name_searchable: p.name_searchable,
    grade: p.grade as FontGrade,
    circuit_color: p.circuit_color as CircuitColor | null,
    circuit_number: p.circuit_number,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const list = parseTopoList(listText);
  if (list.entries.length === 0) throw new Error("no boulder could be read from topo_list");
  const { problems, report } = mergeTopoList(pins, list, { replace: true });
  // Keep the site's current credit.
  const [current] = await query<{ credit: string | null }>(
    `select credit from public.outdoor_areas where gym_id = '${gymId}' and source = 'LEBLOND'`,
  );
  const topo = { credit: current?.credit ?? null, circuits: circuitsOf(problems), problems, skipped: 0 };

  const [result] = await query<{ result: Record<string, number> }>(
    `select public.admin_import_leblond_topo('${gymId}'::uuid, ${literal(JSON.stringify(topo))}::jsonb) as result
     from (
       select set_config('request.jwt.claims', json_build_object('sub', u.id, 'email', lower(u.email), 'role', 'authenticated')::text, true) as claims
       from auth.users u join public.beta_users b on b.email = lower(u.email)
       where b.active and b.role = 'admin'
       order by b.created_at
       limit 1
     ) s
     where s.claims is not null`,
  );
  if (!result) throw new Error("no active admin account to run the import as");

  console.log(`Before: ${pins.length} boulders. List: ${list.entries.length} boulders, ${list.circuits.length} circuits.`);
  console.log(`Import: ${JSON.stringify(result.result)}`);
  console.log(`Kept with their position: ${report.placed}. Without position: ${report.withoutPosition.length}. Removed (not in the list): ${report.droppedPins.length}.`);
  if (list.unreadable.length) console.log(`Unreadable lines: ${list.unreadable.length}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
