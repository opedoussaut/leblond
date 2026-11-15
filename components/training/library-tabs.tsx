import { SectionTabs } from "@/components/layout/section-tabs";
import { LIBRARY_TABS, libraryHref, type LibraryTab } from "@/lib/navigation/library-tabs";

/** The Bibliothèque sections on phones; from md up the sidebar lists them under Bibliothèque. */
export function LibraryTabs({ current, label, labels }: { current: LibraryTab; label: string; labels: Record<LibraryTab, string> }) {
  return <SectionTabs label={label} current={current}
    tabs={LIBRARY_TABS.map((tab) => ({ id: tab, href: libraryHref(tab), label: labels[tab] }))} />;
}
