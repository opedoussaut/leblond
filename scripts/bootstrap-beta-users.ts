/**
 * Seeds / updates the closed-beta whitelist from environment variables.
 *
 *   BETA_OLIVIER_EMAIL=… BETA_THOMAS_EMAIL=… … npm run beta:bootstrap
 *
 * Emails are read from the environment (e.g. .env.local or your shell),
 * never from the repository. Olivier is the admin; the others are testers.
 * Re-running is idempotent. Requires NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";

const ROSTER = [
  { env: "BETA_OLIVIER_EMAIL", display_name: "Olivier", role: "admin" },
  { env: "BETA_THOMAS_EMAIL", display_name: "Thomas", role: "beta_tester" },
  { env: "BETA_MARC_EMAIL", display_name: "Marc", role: "beta_tester" },
  { env: "BETA_HOUSSEM_EMAIL", display_name: "Houssem", role: "beta_tester" },
  { env: "BETA_DAVID_EMAIL", display_name: "David", role: "beta_tester" },
] as const;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const rows = ROSTER.flatMap(({ env, display_name, role }) => {
  const email = process.env[env]?.trim().toLowerCase();
  if (!email) {
    console.warn(`- ${display_name}: ${env} not set, skipped`);
    return [];
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`- ${display_name}: ${env} is not a valid email, skipped`);
    return [];
  }
  return [{ email, display_name, role, active: true }];
});

if (rows.length === 0) {
  console.error("No beta emails configured. Nothing to do.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error } = await supabase.from("beta_users").upsert(rows, { onConflict: "email" });
if (error) {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
}
// Print names and roles only — never echo email addresses into logs.
for (const r of rows) console.log(`✓ ${r.display_name} (${r.role})`);
