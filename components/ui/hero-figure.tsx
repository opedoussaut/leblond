import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "./cn";

/**
 * One quiet colour per kind of figure (bloc, voie, board…), defined as
 * --tone-* in app/globals.css. Never a grade colour.
 */
export type Tone = "blue" | "green" | "violet" | "teal" | "amber" | "sky" | "rose" | "gold";

/** Icon on a tinted tile, on a light surface. Full class names, so Tailwind sees them. */
const TONE_TILE: Record<Tone, string> = {
  blue: "bg-tone-blue-soft text-tone-blue",
  green: "bg-tone-green-soft text-tone-green",
  violet: "bg-tone-violet-soft text-tone-violet",
  teal: "bg-tone-teal-soft text-tone-teal",
  amber: "bg-tone-amber-soft text-tone-amber",
  sky: "bg-tone-sky-soft text-tone-sky",
  rose: "bg-tone-rose-soft text-tone-rose",
  gold: "bg-tone-gold-soft text-tone-gold",
};

/** The same tones, lightened for the deep-blue hero panel. */
const TONE_ON_PANEL: Record<Tone, string> = {
  blue: "text-sky-200", green: "text-emerald-200", violet: "text-violet-200", teal: "text-teal-200",
  amber: "text-amber-200", sky: "text-sky-200", rose: "text-rose-200", gold: "text-yellow-200",
};

/** The thin accent bar in front of a list's heading, so headings read the same across Progrès. */
export function HeadingMark() {
  return <span aria-hidden="true" className="inline-block h-[0.9em] w-1 shrink-0 rounded-full bg-accent" />;
}

/** A small icon tile in a section's tone. Decorative: the label next to it names the figure. */
export function ToneIcon({ icon: Icon, tone, onPanel = false, size = "md", className }: {
  icon: LucideIcon; tone: Tone; onPanel?: boolean; size?: "sm" | "md"; className?: string;
}) {
  return <span aria-hidden="true" className={cn(
    "inline-flex shrink-0 items-center justify-center",
    size === "sm" ? "size-7 rounded-lg" : "size-10 rounded-xl",
    onPanel ? cn("bg-white/10 ring-1 ring-white/15", TONE_ON_PANEL[tone]) : TONE_TILE[tone],
    className,
  )}>
    <Icon className={size === "sm" ? "size-4" : "size-5"} strokeWidth={2} />
  </span>;
}

export type HeroStat = { label: string; value: ReactNode; hint?: string; icon?: LucideIcon; tone?: Tone };

/**
 * One clear figure for a section, with up to three supporting figures beside
 * it. Each label sits next to its value in the same element, so a figure is
 * read with its label.
 */
export function HeroFigure({ eyebrow, value, label, note, stats = [], badge, size = "card", variant = "plain", art, className }: {
  eyebrow: string; value: ReactNode; label: string;
  /** A short line under the label (kept apart so the label reads alone). */
  note?: string;
  stats?: HeroStat[]; badge?: ReactNode;
  /** "page": on the page itself, no card around it, a larger figure. */
  size?: "card" | "page";
  /** "panel": on the deep-blue hero panel (a page's lead figure). */
  variant?: "plain" | "panel";
  /** A large decorative icon behind the panel's top corner. */
  art?: LucideIcon;
  className?: string;
}) {
  const panel = variant === "panel";
  const Art = art;
  return <div className={cn("space-y-4", panel && "leblond-hero-panel relative isolate p-5 sm:p-7", className)}>
    {panel && Art ? <Art aria-hidden="true" strokeWidth={1.25}
      className="pointer-events-none absolute -right-6 -top-8 -z-10 size-44 text-white/[0.07] sm:size-56" /> : null}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className={cn("leblond-eyebrow", panel ? "text-blue-200" : "text-ink-3")}>{eyebrow}</p>
      {badge}
    </div>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0">
        <p className={cn("leblond-number break-words leading-none", size === "page" ? "text-6xl sm:text-7xl" : "text-5xl sm:text-6xl", panel && "text-white")}>{value}</p>
        <p className={cn("mt-2 text-sm font-semibold", panel ? "text-blue-100" : "text-ink-2")}>{label}</p>
        {note ? <p className={cn("mt-0.5 text-xs", panel ? "text-blue-200" : "text-ink-3")}>{note}</p> : null}
      </div>
      {stats.length ? <dl className={cn("grid grid-cols-3 gap-4 border-t pt-4 sm:min-w-[22rem] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0",
        panel ? "border-white/15" : "border-line")}>
        {stats.map((s) => <div key={s.label} className="min-w-0">
          {s.icon && s.tone ? <ToneIcon icon={s.icon} tone={s.tone} onPanel={panel} size="sm" className="mb-2" /> : null}
          <dt className={cn("text-xs font-semibold", panel ? "text-blue-200" : "text-ink-3")}>{s.label}</dt>
          <dd className={cn("leblond-number mt-1 text-2xl leading-none", panel && "text-white")}>{s.value}</dd>
          {s.hint ? <dd className={cn("mt-1 text-xs", panel ? "text-blue-200" : "text-ink-3")}>{s.hint}</dd> : null}
        </div>)}
      </dl> : null}
    </div>
  </div>;
}

export type SectionRow = {
  href: string; title: string; value: ReactNode; detail: string; muted?: boolean;
  /** The section's icon, on a tile in its tone. */
  icon?: LucideIcon; tone?: Tone;
};

/**
 * A page's sections as one calm list: the section, one figure and what it
 * means, then a chevron. Each row opens its section; nothing else is shown here.
 * `title` shows the list's name above it (otherwise it only names the nav).
 */
export function SectionRows({ label, rows, title }: { label: string; rows: readonly SectionRow[]; title?: string }) {
  return <nav aria-label={label} className="space-y-3">
    {title ? <h2 className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">
      <HeadingMark />{title}
    </h2> : null}
    <ul className={cn("leblond-premium-surface divide-y divide-line overflow-hidden", rows.some((r) => r.icon) && "leblond-elevated")}>
      {rows.map((r) => <li key={r.href}>
        <Link href={r.href} className="group flex min-h-[4.25rem] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
          {r.icon && r.tone ? <ToneIcon icon={r.icon} tone={r.tone} className={cn("-ml-1", r.muted && "opacity-55 saturate-50")} /> : null}
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
