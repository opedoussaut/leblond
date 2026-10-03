import "server-only";
import { z } from "zod";
import { resolveCoachConfig } from "@/lib/coach/config";

/**
 * Server-side environment access.
 *
 * Everything here is read lazily so that `next build` works without secrets,
 * and so that missing optional integrations degrade to an honest
 * "not configured" state instead of crashing the app.
 */

const optional = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optional,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  NEXT_PUBLIC_SITE_URL: optional,

  OPENAI_API_KEY: optional,
  OPENAI_MODEL: optional,
  MAX_COACH_REQUESTS_PER_USER_PER_DAY: optional,

  TOKEN_ENCRYPTION_KEY: optional,
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function serverEnv(): ServerEnv {
  return serverSchema.parse(process.env);
}

export function isSupabaseConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function coachConfig() {
  const env = serverEnv();
  const limit = Number.parseInt(env.MAX_COACH_REQUESTS_PER_USER_PER_DAY ?? "", 10);
  return {
    ...resolveCoachConfig(process.env),
    dailyLimit: Number.isFinite(limit) && limit > 0 ? limit : 30,
  };
}

export function siteUrl(): string {
  const env = serverEnv();
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
