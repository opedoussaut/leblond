import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { CoachSessionsList } from "@/components/training/coach-sessions-list";
import { LibraryCatalogue } from "@/components/training/library-catalogue";
import { LibraryCompare } from "@/components/training/library-compare";
import { LibraryOverview } from "@/components/training/library-overview";
import { LibraryLegacyHash } from "@/components/training/library-legacy-hash";
import { LibraryTabs } from "@/components/training/library-tabs";
import { requireViewer } from "@/lib/auth/viewer";
import { listCoachSessions } from "@/lib/data/coach-sessions";
import { areasDictionary } from "@/lib/i18n/areas";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { getI18n } from "@/lib/i18n/server";
import { CATALOGUE_TABS, isCatalogueTab, parseCompareIds, parseLibraryTab } from "@/lib/navigation/library-tabs";

export const metadata = { title: "Bibliothèque" };

/**
 * Bibliothèque, in sections with their own address (?tab=…): a light overview,
 * the coach's session templates, methods, coaching systems, tools and the radar.
 */
export default async function LibraryPage({ searchParams }: PageProps<"/atlas">) {
  const sp = await searchParams;
  const tab = parseLibraryTab(sp.tab);
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const a = areasDictionary(locale).library;
  const c = coachSessionsDictionary(locale);
  const templates = tab === "overview" || tab === "templates" ? await listCoachSessions(viewer.supabase) : [];

  return <div className="space-y-6">
    <PageHeader icon={<PAGE_ICONS.library />} title={a.title} subtitle={a.subtitle} />
    <LibraryTabs current={tab} label={a.sections} labels={a.tabs} />

    {tab === "overview" ? <><LibraryLegacyHash /><LibraryOverview locale={locale} templates={templates.length} /></> : null}

    {tab === "templates" ? <section aria-labelledby="templates-heading" className="space-y-3">
      <div>
        <h2 id="templates-heading" className="text-lg font-bold">{c.title}</h2>
        <p className="mt-1 text-sm text-ink-2">{c.subtitle}</p>
      </div>
      {templates.length
        ? <CoachSessionsList locale={locale} sessions={templates} viewerId={viewer.userId} />
        : <p className="rounded-2xl border border-line p-6 text-sm text-ink-2">{a.templatesEmpty}</p>}
    </section> : null}

    {isCatalogueTab(tab) ? <LibraryCatalogue key={tab} locale={locale} category={CATALOGUE_TABS[tab]} heading={a.tabs[tab]} /> : null}

    {tab === "compare" ? <LibraryCompare locale={locale} initial={parseCompareIds(sp.ids)} /> : null}
  </div>;
}
