import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { requireViewer } from "@/lib/auth/viewer";
import { arkoseImportDictionary } from "@/lib/i18n/arkose-import";
import { getI18n } from "@/lib/i18n/server";
import { HISTORY_SYSTEMS, isHistorySystem } from "@/lib/climbing/arkose-history";
import { ArkoseImport } from "./arkose-import";

export const metadata = { title: "Importer ton historique Arkose" };

/** Import past sends counted by Arkose (a file of day, colour, count). */
export default async function ArkoseImportPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const a = arkoseImportDictionary(locale);
  const { data } = await viewer.supabase.from("gyms").select("id, name, grading_system")
    .eq("active", true).in("grading_system", [...HISTORY_SYSTEMS]).eq("has_bouldering", true).is("external_provider", null).order("name");
  const gyms = (data ?? []).flatMap((g) => isHistorySystem(g.grading_system) ? [{ id: g.id, name: g.name, system: g.grading_system }] : []);
  return <div className="space-y-6">
    <PageHeader icon={<PAGE_ICONS.newSession />} title={a.title} subtitle={a.intro} />
    <div className="space-y-2 text-sm text-ink-2">
      <p>{a.what}</p>
      <p>{a.format}</p>
      <p className="text-xs text-ink-3">{a.again}</p>
    </div>
    <ArkoseImport gyms={gyms} />
  </div>;
}
