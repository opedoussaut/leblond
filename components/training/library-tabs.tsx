import Link from "next/link";
import { segmentClass, segmentGroupClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { LIBRARY_TABS, libraryHref, type LibraryTab } from "@/lib/navigation/library-tabs";

/**
 * The Bibliothèque sections: real links (shareable, keyboard and back-button
 * friendly), the current one marked with aria-current. Three by two on a
 * phone, one row from tablet width.
 */
export function LibraryTabs({ current, label, labels }: { current: LibraryTab; label: string; labels: Record<LibraryTab, string> }) {
  return <nav aria-label={label}>
    <ul className={cn(segmentGroupClass, "grid-cols-3 rounded-3xl sm:grid-cols-6 sm:rounded-full")}>
      {LIBRARY_TABS.map((tab) => <li key={tab} className="flex">
        <Link href={libraryHref(tab)} aria-current={tab === current ? "page" : undefined} scroll={false}
          className={segmentClass(tab === current, "inline-flex w-full items-center justify-center whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent")}>
          {labels[tab]}
        </Link>
      </li>)}
    </ul>
  </nav>;
}
