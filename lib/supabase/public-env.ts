/**
 * Public Supabase configuration (safe for the browser: URL + anon key only).
 * The anon key grants nothing on its own — every table is protected by RLS.
 */
export function publicSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
