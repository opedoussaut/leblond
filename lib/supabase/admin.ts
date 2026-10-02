import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. BYPASSES RLS — use only in server code for the few
 * operations that must not be performed with the user's privileges:
 *  - whitelist checks before sending a sign-in email,
 *  - storing/reading encrypted wearable tokens,
 *  - admin roster management.
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
