import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import type { TopoProblemRow } from "@/lib/actions/team-topo";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { topoEditorDictionary } from "@/lib/i18n/topo-editor";
import { TopoEditor } from "./topo-editor";

export const metadata = { title: "Topo" };

/** Admin: the boulders of one team topo, to correct, add or delete one at a time. */
export default async function TopoEditorPage({ params }: PageProps<"/settings/admin/topos/[gymId]">) {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") notFound();
  const { gymId } = await params;
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const e = topoEditorDictionary(locale);
  const { data: area } = await viewer.supabase.from("outdoor_areas")
    .select("id, name").eq("gym_id", gymId).eq("source", "LEBLOND").maybeSingle();
  if (!area) notFound();
  const [{ data: problems }, { data: links }] = await Promise.all([
    viewer.supabase.from("outdoor_problems")
      .select("id, name, grade, circuit_color, circuit_number, steepness, sit_start, latitude, longitude")
      .eq("area_id", area.id).eq("source", "LEBLOND").order("name"),
    viewer.supabase.rpc("admin_topo_link_counts", { p_gym_id: gymId }),
  ]);
  const logged = Object.fromEntries((links ?? []).map((l) => [l.outdoor_problem_id, l.logged])) as Record<number, number>;

  return (
    <div className="space-y-4">
      <Link href="/settings/admin" className="text-sm font-semibold text-accent underline">{e.back}</Link>
      <PageHeader title={`${e.title} · ${area.name}`} subtitle={e.intro} />
      <TopoEditor gymId={gymId} initial={(problems ?? []) as TopoProblemRow[]} logged={logged} />
    </div>
  );
}
