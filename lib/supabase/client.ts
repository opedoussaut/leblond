"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./public-env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client acting as the signed-in user. Used for direct-to-storage uploads. */
export function getBrowserClient() {
  if (client) return client;
  const env = publicSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured.");
  client = createBrowserClient<Database>(env.url, env.anonKey);
  return client;
}
