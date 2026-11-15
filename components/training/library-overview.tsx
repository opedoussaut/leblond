import Link from "next/link";
import { IconNext } from "@/components/ui/icons";
import { fmt, type Locale } from "@/lib/i18n";
import { areasDictionary } from "@/lib/i18n/areas";
import { CATALOGUE_TABS, isCatalogueTab, libraryHref, type LibraryTab } from "@/lib/navigation/library-tabs";
import { TRAINING_CATALOGUE } from "@/lib/training/catalogue";

const SECTIONS = ["templates", "methods", "coaching", "tools", "compare"] as const satisfies readonly LibraryTab[];

/** The light front page of the Bibliothèque: one card per section, with what it holds. */
export function LibraryOverview({ locale, templates }: { locale: Locale; templates: number }) {
  const a = areasDictionary(locale).library;
  const count = (section: (typeof SECTIONS)[number]) => {
    if (section === "templates") return templates === 0 ? a.templatesNone : templates === 1 ? a.templatesOne : fmt(a.templatesMany, { n: templates });
    if (!isCatalogueTab(section)) return null;
    const n = TRAINING_CATALOGUE.filter((e) => e.category === CATALOGUE_TABS[section]).length;
    return n === 1 ? a.countOne : fmt(a.countMany, { n });
  };
  return <section aria-label={a.tabs.overview} className="space-y-3">
    <p className="text-sm text-ink-2">{a.overviewIntro}</p>
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {SECTIONS.map((section) => <li key={section} className="flex">
        <Link href={libraryHref(section)} className="leblond-premium-surface group flex w-full flex-col p-4 sm:p-5 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-bold group-hover:text-accent">{a.tabs[section]} <span className="text-accent" aria-hidden="true"><IconNext /></span></span>
            {count(section) ? <span className="text-xs font-semibold text-ink-3">{count(section)}</span> : null}
          </span>
          <span className="mt-1 flex-1 text-sm leading-relaxed text-ink-2">{a.hints[section]}</span>
        </Link>
      </li>)}
    </ul>
  </section>;
}
