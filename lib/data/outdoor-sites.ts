import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import type { OutdoorSiteInput } from "@/lib/climbing/outdoor-projects";
import { outdoorSiteSchema } from "@/lib/climbing/outdoor-projects";

export type ProjectDiscipline = "BOULDER" | "ROUTE";

type SiteResult = { ok: true; gymId: string } | { ok: false; error: "invalid" | "notFound" | "siteNoRoutes" | "siteNoBoulders" | "unknownError" };

/**
 * The outdoor site a project is at: an existing outdoor site (brand OUTDOOR —
 * a Boolder area, a site added by migration or by a climber) or a new one typed
 * by the climber, created in the shared catalogue like the session flow does
 * (lib/actions/gyms.ts createGym) and added to their favourites. A new name that
 * matches an existing outdoor site (case-insensitive) reuses that site.
 */
export async function resolveOutdoorSite(viewer: Viewer, input: OutdoorSiteInput, discipline: ProjectDiscipline): Promise<SiteResult> {
  const parsed = outdoorSiteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const site = parsed.data;

  /** null when the site fits the project, else the refusal. */
  const refuse = (g: { brand: string; has_routes: boolean; has_bouldering: boolean }): SiteResult | null => {
    if (g.brand !== "OUTDOOR") return { ok: false, error: "invalid" };
    if (discipline === "ROUTE" && !g.has_routes) return { ok: false, error: "siteNoRoutes" };
    if (discipline === "BOULDER" && !g.has_bouldering) return { ok: false, error: "siteNoBoulders" };
    return null;
  };

  if ("gymId" in site) {
    const { data: gym } = await viewer.supabase.from("gyms").select("id, brand, has_routes, has_bouldering, active")
      .eq("id", site.gymId).maybeSingle();
    if (!gym || !gym.active) return { ok: false, error: "notFound" };
    return refuse(gym) ?? { ok: true, gymId: gym.id };
  }

  const { name, city, sourceUrl } = site.newSite;
  const { data: same } = await viewer.supabase.from("gyms").select("id, brand, has_routes, has_bouldering")
    .eq("brand", "OUTDOOR").eq("active", true).ilike("name", name.replace(/[\\%_]/g, (c) => "\\" + c)).limit(1).maybeSingle();
  if (same) {
    const no = refuse(same);
    if (no) return no;
    await viewer.supabase.from("favourite_gyms").upsert({ user_id: viewer.userId, gym_id: same.id });
    return { ok: true, gymId: same.id };
  }

  const { data: created, error } = await viewer.supabase.from("gyms").insert({
    name, brand: "OUTDOOR", city: city || null, country: "FR", grading_system: "FONT",
    has_bouldering: discipline === "BOULDER", has_routes: discipline === "ROUTE",
    created_by: viewer.userId, source_url: sourceUrl || null,
  }).select("id").single();
  if (error || !created) return { ok: false, error: "unknownError" };
  await viewer.supabase.from("favourite_gyms").upsert({ user_id: viewer.userId, gym_id: created.id });
  return { ok: true, gymId: created.id };
}
