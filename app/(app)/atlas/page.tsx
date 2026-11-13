import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { CoachSessionsList } from "@/components/training/coach-sessions-list";
import { TrainingExplorer } from "@/components/training/training-explorer";
import { requireViewer } from "@/lib/auth/viewer";
import { listCoachSessions } from "@/lib/data/coach-sessions";
import { areasDictionary } from "@/lib/i18n/areas";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Bibliothèque" };

/** Bibliothèque: the climber's session templates, then every method with its sheet and sources. */
export default async function LibraryPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const a = areasDictionary(locale).library;
  const c = coachSessionsDictionary(locale);
  const templates = await listCoachSessions(viewer.supabase);
  return <div className="space-y-8">
    <PageHeader icon={<PAGE_ICONS.library />} title={a.title} subtitle={a.subtitle} />
    {templates.length ? <section aria-labelledby="templates-heading" className="space-y-3">
      <div>
        <h2 id="templates-heading" className="text-lg font-bold">{c.title}</h2>
        <p className="mt-1 text-sm text-ink-2">{c.subtitle}</p>
      </div>
      <CoachSessionsList locale={locale} sessions={templates} viewerId={viewer.userId} />
    </section> : null}
    <section aria-label={a.methods} className="space-y-3">
      <TrainingExplorer locale={locale} />
    </section>
  </div>;
}
