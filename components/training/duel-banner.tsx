import Link from "next/link";
import { WORK_KINDS, type KindTally, type Standing, type WorkKind } from "@/lib/analytics/alter-ego";
import { formatDuration } from "@/lib/duration";
import type { RivalPortrait as RivalPortraitId } from "@/lib/analytics/rival";
import { fmt, type Locale } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";
import { chartsDictionary } from "@/lib/i18n/charts";
import { IconNext } from "@/components/ui/icons";
import { ProfilePicture } from "./profile-picture";
import { RivalPortrait } from "./rival-portrait";

/**
 * The duel on Aujourd'hui: the climber and the rival face to face, the score
 * in séances and a tug bar of the séances done since signing. It states the
 * gap and never prescribes work to close it.
 */
export function DuelBanner({ locale, name, standing, week, total, portrait, avatar, photo = null, paused, breakdown }: {
  locale: Locale; name: string; standing: Standing; week: number; total: number;
  portrait: RivalPortraitId; avatar: number; paused: boolean;
  /** The climber's séances by type since signing. */
  breakdown?: Record<WorkKind, KindTally>;
  /** The climber's uploaded photo (signed URL); without one, the avatar. */
  photo?: string | null;
}) {
  const t = alterEgoDictionary(locale);
  const c = chartsDictionary(locale);
  const { you, ego } = standing;
  const sum = you.sessions + ego.sessions;
  const share = sum ? Math.round((you.sessions / sum) * 100) : 50;
  const verdict = fmt({ ahead: t.ahead, level: t.level, behind: t.behind }[standing.state], { name });
  const side = (label: string, l: Standing["you"]) => <span className="block text-xs text-blue-100 tabular-nums">
    <span className="sr-only">{label} : </span>{l.reps} {c.repsShort} · {formatDuration(l.minutes)}
  </span>;

  return <section aria-labelledby="duel-banner-heading" className="leblond-hero-panel p-5 sm:p-6">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="duel-banner-heading" className="leblond-eyebrow text-blue-200">{c.bannerEyebrow}</h2>
      <p className="text-xs text-blue-100">{fmt(c.bannerWeek, { week, total })}{paused ? ` · ${t.paused}` : ""}</p>
    </div>

    <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-full ring-2 ring-white/80"><ProfilePicture photoUrl={photo} level={avatar} size={56} /></span>
        <span className="min-w-0"><strong className="block text-base">{c.you}</strong>{side(c.you, you)}</span>
      </div>
      <p className="text-center" aria-label={fmt(c.bannerScore, { you: you.sessions, rival: ego.sessions, name })}>
        <span aria-hidden="true" className="leblond-number block text-4xl font-black tracking-tight sm:text-5xl">
          {you.sessions}<span className="mx-2 text-blue-200">–</span>{ego.sessions}
        </span>
        <span aria-hidden="true" className="text-[11px] uppercase tracking-[0.14em] text-blue-200">{c.bannerSessions}</span>
      </p>
      <div className="flex min-w-0 flex-row-reverse items-center gap-3 text-right">
        <span className="rounded-full ring-2 ring-white/40"><RivalPortrait portrait={portrait} size={56} /></span>
        <span className="min-w-0"><strong className="block truncate text-base">{name}</strong>{side(name, ego)}</span>
      </div>
    </div>

    <div aria-hidden="true" className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
      <span className="rounded-l-full bg-white transition-[width]" style={{ width: `${share}%` }} />
      <span className="flex-1 rounded-r-full bg-white/25" />
    </div>

    {breakdown ? <ul aria-label={c.you} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {WORK_KINDS.map((k) => <li key={k} className="rounded-xl bg-white/10 px-3 py-2">
        <span className="block text-[11px] uppercase tracking-[0.12em] text-blue-200">{c.workKinds[k]}</span>
        <span className="block text-sm font-bold tabular-nums">{breakdown[k].sessions}
          <span className="font-normal text-blue-100"> · {formatDuration(breakdown[k].minutes)}</span></span>
      </li>)}
    </ul> : null}

    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold">{verdict}</p>
      <Link href="/train/alter-ego" className="text-sm font-bold text-white underline underline-offset-4">
        {c.bannerSee} <IconNext />
      </Link>
    </div>
  </section>;
}
