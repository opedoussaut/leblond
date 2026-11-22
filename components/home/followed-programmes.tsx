import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AREA_ICONS, PAGE_ICONS } from "@/components/layout/nav-icons";
import { cn } from "@/components/ui/cn";
import { linkClass } from "@/components/ui/button";
import { IconNext } from "@/components/ui/icons";
import type { FollowedKind, FollowedProgramme } from "@/lib/analytics/followed-programmes";
import { formatDate } from "@/lib/format";
import { fmt, plural, type Locale } from "@/lib/i18n";
import { areasDictionary } from "@/lib/i18n/areas";

/** Each kind of programme keeps its own colour, from the app's palette. */
const TONE: Record<FollowedKind, { ring: string; soft: string; ink: string }> = {
  PLAN: { ring: "var(--accent)", soft: "var(--accent-soft)", ink: "var(--accent)" },
  REBUILD: { ring: "var(--ok)", soft: "color-mix(in srgb, var(--ok) 12%, var(--surface))", ink: "var(--ok)" },
  HIP: { ring: "var(--train)", soft: "var(--train-soft)", ink: "var(--train-ink)" },
};

function Ring({ ratio, tone, children }: { ratio: number | null; tone: (typeof TONE)[FollowedKind]; children: React.ReactNode }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return <div className="relative grid size-16 shrink-0 place-items-center">
    <svg viewBox="0 0 64 64" className="absolute inset-0 size-16 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke={tone.soft} strokeWidth="6" />
      {ratio !== null ? <circle cx="32" cy="32" r={r} fill="none" stroke={tone.ring} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${Math.max(0.02, ratio) * c} ${c}`} /> : null}
    </svg>
    <span className="relative grid size-10 place-items-center rounded-full" style={{ background: tone.soft, color: tone.ink }}>{children}</span>
  </div>;
}

const ICON: Record<FollowedKind, LucideIcon> = {
  PLAN: AREA_ICONS.programmes,
  REBUILD: PAGE_ICONS.mobility,
  HIP: PAGE_ICONS.mobility,
};

export function FollowedProgrammes({ locale, programmes }: { locale: Locale; programmes: FollowedProgramme[] }) {
  if (!programmes.length) return null;
  const a = areasDictionary(locale).today;
  const date = (d: string) => formatDate(d + "T12:00:00", locale, { weekday: "short", day: "numeric", month: "short" });
  return <section aria-labelledby="followed-heading" className="space-y-3" data-testid="followed-programmes">
    <div className="flex items-baseline justify-between gap-3">
      <h2 id="followed-heading" className="leblond-eyebrow text-ink-3">{a.followed}</h2>
      <Link href="/programmes" className={cn(linkClass, "text-sm")}>{a.followedManage} <IconNext /></Link>
    </div>
    <ul className={cn("grid grid-cols-1 gap-3", programmes.length > 1 && "md:grid-cols-2", programmes.length > 2 && "xl:grid-cols-3")}>
      {programmes.map((p) => {
        const tone = TONE[p.kind];
        const Icon = ICON[p.kind];
        const progress = p.progress.unit === "WEEK" ? fmt(a.followedWeek, { current: p.progress.current, total: p.progress.total })
          : p.progress.unit === "SESSIONS" ? fmt(plural(locale, p.progress.done, a.followedSessions), { total: p.progress.total })
          : fmt(a.followedLevel, { level: p.progress.level });
        return <li key={p.kind}>
          <Link href={p.href} data-kind={p.kind}
            className="group relative flex h-full items-center gap-4 overflow-hidden rounded-[1.25rem] border border-line bg-surface p-4 transition-colors hover:border-[color:var(--tone)] sm:p-5"
            style={{ ["--tone" as string]: tone.ring }}>
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: tone.ring }} />
            <Ring ratio={p.ratio} tone={tone}><Icon aria-hidden="true" className="size-5" /></Ring>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: tone.ink }}>{a.followedKinds[p.kind]}</span>
              <span className="mt-0.5 line-clamp-2 text-base font-bold leading-snug text-ink">{p.title}</span>
              <span className="mt-1 block text-sm text-ink-2">{p.finished ? a.followedFinished : progress}</span>
              <span className="mt-0.5 block text-xs text-ink-3">{p.next ? fmt(a.followedNext, { date: date(p.next) }) : p.finished ? "" : a.followedNoNext}</span>
            </span>
            <span className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5"><IconNext /></span>
          </Link>
        </li>;
      })}
    </ul>
  </section>;
}
