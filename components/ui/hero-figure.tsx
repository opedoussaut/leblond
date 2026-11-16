import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";

export type HeroStat = { label: string; value: ReactNode; hint?: string };

/**
 * One clear figure for a section, with up to three supporting figures beside
 * it. Each label sits next to its value in the same element, so a figure is
 * read with its label.
 */
export function HeroFigure({ eyebrow, value, label, note, stats = [], badge, size = "card", className }: {
  eyebrow: string; value: ReactNode; label: string;
  /** A short line under the label (kept apart so the label reads alone). */
  note?: string;
  stats?: HeroStat[]; badge?: ReactNode;
  /** "page": on the page itself, no card around it, a larger figure. */
  size?: "card" | "page";
  className?: string;
}) {
  return <div className={cn("space-y-4", className)}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="leblond-eyebrow text-ink-3">{eyebrow}</p>
      {badge}
    </div>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0">
        <p className={cn("leblond-number break-words leading-none", size === "page" ? "text-6xl sm:text-7xl" : "text-5xl sm:text-6xl")}>{value}</p>
        <p className="mt-2 text-sm font-semibold text-ink-2">{label}</p>
        {note ? <p className="mt-0.5 text-xs text-ink-3">{note}</p> : null}
      </div>
      {stats.length ? <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4 sm:min-w-[22rem] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
        {stats.map((s) => <div key={s.label} className="min-w-0">
          <dt className="text-xs font-semibold text-ink-3">{s.label}</dt>
          <dd className="leblond-number mt-1 text-2xl leading-none">{s.value}</dd>
          {s.hint ? <dd className="mt-1 text-xs text-ink-3">{s.hint}</dd> : null}
        </div>)}
      </dl> : null}
    </div>
  </div>;
}

export type SectionRow = { href: string; title: string; value: ReactNode; detail: string; muted?: boolean };

/**
 * A page's sections as one calm list: the section, one figure and what it
 * means, then a chevron. Each row opens its section; nothing else is shown here.
 */
export function SectionRows({ label, rows }: { label: string; rows: readonly SectionRow[] }) {
  return <nav aria-label={label}>
    <ul className="leblond-premium-surface divide-y divide-line overflow-hidden">
      {rows.map((r) => <li key={r.href}>
        <Link href={r.href} className="group flex min-h-[4.25rem] items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{r.title}</span>
            <span className="mt-0.5 block truncate text-xs text-ink-3">{r.detail}</span>
          </span>
          <span className={cn("leblond-number shrink-0 text-right text-xl", r.muted && "text-ink-3")}>{r.value}</span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
        </Link>
      </li>)}
    </ul>
  </nav>;
}
