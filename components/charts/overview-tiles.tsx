import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/cn";

export type OverviewTile = {
  href: string;
  /** The section the tile opens (also part of the link's name). */
  section: string;
  title: string; value: ReactNode;
  /** One line saying what the figure means. */
  caption: string;
  /** A small trend over the chosen period (decorative: the caption says it in words). */
  spark: ReactNode;
  muted?: boolean;
};

/**
 * Progrès at a glance: one tile per marker, each a link to its section with
 * one figure, one line of meaning and a small trend. Nothing is computed here.
 */
export function OverviewTiles({ title, hint, tiles }: { title: string; hint: string; tiles: readonly OverviewTile[] }) {
  return <nav aria-labelledby="overview-tiles-heading" className="space-y-3">
    <div className="px-1">
      <h2 id="overview-tiles-heading" className="text-lg font-bold">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-2">{hint}</p>
    </div>
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {tiles.map((tile) => <li key={tile.title} className="leblond-premium-surface overflow-hidden">
        <Link href={tile.href} className="group flex h-full flex-col gap-3 p-4 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
          <div className="flex items-center justify-between gap-2">
            <span className="leblond-eyebrow text-ink-3">{tile.section}</span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-2">{tile.title}</p>
              <p className={cn("leblond-number mt-1 text-4xl leading-none", tile.muted && "text-ink-3")}>{tile.value}</p>
            </div>
            {tile.spark}
          </div>
          <p className="text-xs text-ink-3">{tile.caption}</p>
        </Link>
      </li>)}
    </ul>
  </nav>;
}
