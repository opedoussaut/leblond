import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";

export interface Viewer {
  supabase: ServerSupabase;
  userId: string;
  email: string;
  profile: Tables<"profiles">;
  role: "admin" | "beta_tester";
  active: boolean;
}

/**
 * The signed-in climber for this request (deduplicated per request), or null.
 * Combines the validated auth user, their profile and their whitelist entry.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!publicSupabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const [{ data: profile }, { data: beta }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("beta_users").select("role, active").eq("email", user.email.toLowerCase()).maybeSingle(),
  ]);
  if (!profile) return null;
  return {
    supabase,
    userId: user.id,
    email: user.email,
    profile,
    role: beta?.role ?? "beta_tester",
    active: beta?.active ?? false,
  };
});

/**
 * Guard for private pages. Redirects to /login when signed out, to /revoked
 * when removed from the whitelist, and to /onboarding until onboarding is done.
 */
export async function requireViewer(options: { allowIncompleteOnboarding?: boolean } = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.active) redirect("/revoked");
  if (!options.allowIncompleteOnboarding && !viewer.profile.onboarding_completed_at) redirect("/onboarding");
  return viewer;
}
