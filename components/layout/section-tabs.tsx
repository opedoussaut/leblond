import Link from "next/link";
import { segmentClass, segmentGroupClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

/**
 * The sections of a page as in-page tabs: real links (shareable, keyboard and
 * back-button friendly), the current one marked with aria-current. Phones only
 * (three by two): from md up the sidebar lists the same sections under the page.
 */
export function SectionTabs({ label, tabs, current }: {
  label: string;
  tabs: ReadonlyArray<{ id: string; href: string; label: string }>;
  current: string;
}) {
  return <nav aria-label={label} className="md:hidden">
    <ul className={cn(segmentGroupClass, "grid-cols-3 rounded-3xl")}>
      {tabs.map((tab) => <li key={tab.id} className="flex">
        <Link href={tab.href} aria-current={tab.id === current ? "page" : undefined} scroll={false}
          className={segmentClass(tab.id === current, "inline-flex w-full min-w-0 items-center justify-center text-center leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent")}>
          {tab.label}
        </Link>
      </li>)}
    </ul>
  </nav>;
}
