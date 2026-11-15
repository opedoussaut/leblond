"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/components/ui/cn";

export type NavTab = { id: string; href: string; label: string };

/**
 * A sidebar page with its sections (?tab=…) as a third level while the page's
 * area is open. Same rule as the rest of the sidebar: only the current page is
 * filled (the page itself on its overview and on its sub-pages, otherwise the
 * section). Sections are plain links: Tab reaches them, Enter opens them.
 */
export function NavTabGroup({ href, path, active, label, icon, itemClass, tabs }: {
  href: string;
  /** The page whose ?tab= selects a section (a sub-page such as a sheet has none). */
  path: string;
  active: boolean;
  label: string;
  icon: ReactNode;
  itemClass: (filled: boolean) => string;
  /** The sections, without the overview: the page link itself opens it. */
  tabs: readonly NavTab[];
}) {
  const pathname = usePathname();
  const param = useSearchParams().get("tab");
  const current = pathname === path ? tabs.find((tab) => tab.id === param)?.id ?? null : null;
  const sectionOpen = current !== null;

  return <>
    <Link href={href} aria-current={active ? (sectionOpen ? "true" : "page") : undefined}
      className={cn(itemClass(active && !sectionOpen), active && sectionOpen && "text-accent")}>
      {icon}
      <span>{label}</span>
    </Link>
    {active ? <ul className="mb-1 ml-[1.125rem] mt-0.5 space-y-0.5 border-l border-line pl-2">
      {tabs.map((tab) => <li key={tab.id}>
        <Link href={tab.href} aria-current={tab.id === current ? "page" : undefined}
          className={cn(
            "flex min-h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold transition-colors",
            tab.id === current ? "bg-accent text-accent-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
          )}>
          {tab.label}
        </Link>
      </li>)}
    </ul> : null}
  </>;
}
