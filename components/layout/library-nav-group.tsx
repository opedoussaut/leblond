"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import { areasDictionary } from "@/lib/i18n/areas";
import { LIBRARY_TABS, libraryHref, parseLibraryTab } from "@/lib/navigation/library-tabs";

/** Sections listed under Bibliothèque in the sidebar; the Bibliothèque link itself opens the overview. */
const SIDEBAR_SECTIONS = LIBRARY_TABS.filter((tab) => tab !== "overview");

/**
 * Bibliothèque in the sidebar, with its sections as a third level while the
 * library is open. Same rule as the rest of the sidebar: only the current page
 * is filled (Bibliothèque on the overview and on a sheet, otherwise the section).
 */
export function LibraryNavGroup({ href, active, label, icon, itemClass }: {
  href: string;
  active: boolean;
  label: string;
  icon: ReactNode;
  itemClass: (filled: boolean) => string;
}) {
  const pathname = usePathname();
  const tab = parseLibraryTab(useSearchParams().get("tab") ?? undefined);
  const { locale } = useI18n();
  const labels = areasDictionary(locale).library.tabs;
  const onLibraryPage = pathname === "/atlas";
  const sectionOpen = onLibraryPage && tab !== "overview";

  return <>
    <Link href={href} aria-current={active ? (sectionOpen ? "true" : "page") : undefined}
      className={cn(itemClass(active && !sectionOpen), active && sectionOpen && "text-accent")}>
      {icon}
      <span>{label}</span>
    </Link>
    {active ? <ul className="mb-1 ml-[1.125rem] mt-0.5 space-y-0.5 border-l border-line pl-2">
      {SIDEBAR_SECTIONS.map((section) => {
        const current = onLibraryPage && tab === section;
        return <li key={section}>
          <Link href={libraryHref(section)} aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold transition-colors",
              current ? "bg-accent text-accent-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
            )}>
            {labels[section]}
          </Link>
        </li>;
      })}
    </ul> : null}
  </>;
}
