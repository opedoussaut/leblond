import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { requireViewer } from "@/lib/auth/viewer";
import { arkoseImportDictionary } from "@/lib/i18n/arkose-import";
import { getI18n } from "@/lib/i18n/server";
import { ArkoseImport } from "./arkose-import";

export const metadata = { title: "Importer ton historique Arkose" };

/** Import past sends counted by Arkose (a file of day, colour, count). */
export default async function ArkoseImportPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const a = arkoseImportDictionary(locale);
  const { data: gyms } = await viewer.supabase.from("gyms").select("id, name")
    .eq("active", true).eq("brand", "ARKOSE").eq("grading_system", "ARKOSE_COLOR").eq("has_bouldering", true).order("name");
  return <div className="space-y-6">
    <PageHeader icon={<PAGE_ICONS.newSession />} title={a.title} subtitle={a.intro} />
    <div className="space-y-2 text-sm text-ink-2">
      <p>{a.what}</p>
      <p>{a.format}</p>
      <p className="text-xs text-ink-3">{a.again}</p>
    </div>
    <ArkoseImport gyms={gyms ?? []} />
  </div>;
}
