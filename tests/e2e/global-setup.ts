import { createClient } from "@supabase/supabase-js";

/**
 * Resets the synthetic demo climbers before the E2E run so the suite always
 * starts from "never signed in". Only *@leblond.local demo accounts are touched.
 * Requires the LOCAL stack's URL and service-role key (never a hosted project).
 */
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.E2E_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.E2E_BASE_URL || !key) return;
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("E2E reset refuses to run against a non-local Supabase");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of data?.users ?? []) {
    if (u.email?.endsWith("@leblond.local")) await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from("beta_users").upsert(
    [
      { email: "alex@leblond.local", display_name: "Alex", role: "admin", active: true },
      { email: "sam@leblond.local", display_name: "Sam", role: "beta_tester", active: true },
    ],
    { onConflict: "email" },
  );
}
