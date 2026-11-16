import type { ReactNode } from "react";
import Link from "next/link";
import { IconNext } from "./icons";
import { cn } from "./cn";

export type HeroStat = { label: string; value: ReactNode; hint?: string };

/**
 * One clear figure for a section, with up to three supporting figures beside
 * it. Each label sits next to its value in the same element, so a figure is
 * read with its label.
 */
export function HeroFigure({ eyebrow, value, label, note, stats = [], badge, className }: {
  eyebrow: string; value: ReactNode; label: string;
  /** A short line under the label (kept apart so the label reads alone). */
  note?: string;
  stats?: HeroStat[]; badge?: ReactNode; className?: string;
}) {
  return <div className={cn("space-y-4", className)}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="leblond-eyebrow text-ink-3">{eyebrow}</p>
      {badge}
    </div>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0">
        <p className="leblond-number break-words text-5xl leading-none sm:text-6xl">{value}</p>
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

/** A section of a page summed up in one figure, opening that section. */
export function SectionLink({ href, title, value, detail }: { href: string; title: string; value: ReactNode; detail: string }) {
  return <Link href={href} className="leblond-premium-surface group flex min-w-0 flex-col justify-between gap-3 p-4 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5">
    <span className="flex items-center justify-between gap-2 text-sm font-bold">
      {title}
      <span className="text-accent transition-transform group-hover:translate-x-0.5"><IconNext /></span>
    </span>
    <span>
      <span className={cn("leblond-number block break-words leading-tight", typeof value === "string" && !/^[\d\s/%,.]+$/.test(value) ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl")}>{value}</span>
      <span className="mt-1 block text-xs leading-snug text-ink-2">{detail}</span>
    </span>
  </Link>;
}
