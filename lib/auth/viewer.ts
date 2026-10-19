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
 * Validates the authenticated user and their private profile. Admin role is
 * still assigned explicitly, never inferred from open account registration.
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
    active: true,
  };
});

/**
 * Guard for private pages. Redirects to /login when signed out,
 * and to /onboarding until profile setup is done.
 */
export async function requireViewer(options: { allowIncompleteOnboarding?: boolean } = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  // Every authenticated account can access its own data. Admin privileges
  // remain separately gated by is_admin() and the legacy admin roster.
  if (!options.allowIncompleteOnboarding && !viewer.profile.onboarding_completed_at) redirect("/onboarding");
  return viewer;
}
