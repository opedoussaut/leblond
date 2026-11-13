import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { requireViewer } from "@/lib/auth/viewer";
import { boardsDictionary } from "@/lib/i18n/boards";
import { getI18n } from "@/lib/i18n/server";
import { BoardImport } from "./board-import";

export const metadata = { title: "Importer un carnet BoardLib" };

/** Import a BoardLib logbook file the climber exported themself (LEBLOND never talks to the board apps). */
export default async function BoardImportPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const b = boardsDictionary(locale);
  return <div className="space-y-6">
    <PageHeader icon={<PAGE_ICONS.newSession />} title={b.importTitle} subtitle={b.importIntro} />
    <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
      {b.importSteps.map((s, i) => <li key={i}>{s}</li>)}
    </ol>
    <p className="text-xs text-ink-3">{b.importNote}</p>
    <BoardImport />
  </div>;
}
