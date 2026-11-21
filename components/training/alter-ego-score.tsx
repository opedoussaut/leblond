import Link from "next/link";
import { WORK_KINDS, type KindTally, type Pact, type PactProgress, type WorkKind } from "@/lib/analytics/alter-ego";
import { formatDuration } from "@/lib/duration";
import { chartsDictionary } from "@/lib/i18n/charts";
import { boulderGrade } from "@/lib/grading/display";
import { fmt, type Locale } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";
import { IconNext } from "@/components/ui/icons";
import type { RivalPortrait as RivalPortraitId } from "@/lib/analytics/rival";
import { RivalPortrait } from "./rival-portrait";
import { ProfilePicture } from "./profile-picture";
import { StandingMedal } from "./standing-medal";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

/** The race at a glance. It states the gap and never prescribes work to close it. */
export function AlterEgoScore({ locale, pact, progress, observed, href, portrait, avatar, photo = null, rivalPhoto = null, breakdown, twinPace = false, detailed = false, title }: {
  /** The duel page: a gap column and the rule that decides who leads. */
  detailed?: boolean;
  /** Replaces the "You vs …" heading. */
  title?: string;
  locale: Locale; pact: Pact; progress: PactProgress; portrait?: RivalPortraitId;
  /** The climber's avatar level, shown facing the rival. */
  avatar?: number;
  /** The climber's uploaded photo, shown instead of the avatar. */
  photo?: string | null;
  /** The photo the climber gave the rival, shown instead of its portrait. */
  rivalPhoto?: string | null;
  /** The climber's séances by type since signing. */
  breakdown?: Record<WorkKind, KindTally>;
  observed?: { boulder: string | null; route: string | null }; href?: "/rival";
  /** The grades are the twin's level (lib/analytics/twin), not a pace chosen at signing. */
  twinPace?: boolean;
}) {
  const t = alterEgoDictionary(locale);
  const { standing: s } = progress;
  const name = pact.displayName;
  const verdict = fmt({ ahead: t.ahead, level: t.level, behind: t.behind }[s.state], { name });
  const signed = (n: number, text: string) => n > 0 ? `+${text}` : n < 0 ? `−${text}` : "=";
  const rows = [
    { label: t.sessions, you: s.you.sessions, ego: s.ego.sessions, gap: s.gap.sessions, gapText: signed(s.gap.sessions, String(Math.abs(s.gap.sessions))) },
    { label: t.reps, you: s.you.reps, ego: s.ego.reps, gap: s.gap.reps, gapText: signed(s.gap.reps, String(Math.abs(s.gap.reps))) },
    { label: t.minutes, you: formatDuration(s.you.minutes), ego: formatDuration(s.ego.minutes), gap: s.gap.minutes, gapText: signed(s.gap.minutes, formatDuration(Math.abs(s.gap.minutes))) },
  ];
  const paces = [
    { label: t.boulder, pace: progress.boulderPace && boulderGrade(progress.boulderPace), you: observed?.boulder ? boulderGrade(observed.boulder) : null },
    { label: t.route, pace: progress.routePace, you: observed?.route ?? null },
  ].filter((p) => p.pace);
  return <section aria-labelledby="ego-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <div className="flex items-center gap-3">
      {avatar !== undefined || portrait ? <div className="flex shrink-0 items-center -space-x-2">
        {avatar !== undefined ? <ProfilePicture photoUrl={photo} level={avatar} size={48} /> : null}
        {portrait ? <RivalPortrait portrait={portrait} photoUrl={rivalPhoto} size={48} /> : null}
      </div> : null}
      <div>
      <h2 id="ego-heading" className="text-lg font-bold">{title ?? fmt(t.scoreTitle, { name })}</h2>
      <p className="mt-1 text-sm text-ink-2">
        {fmt(t.weekOf, { week: progress.week + 1, total: pact.horizonWeeks })}{pact.status === "PAUSED" ? ` · ${t.paused}` : ""}
      </p>
      </div>
    </div>
    <p className="flex items-center gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm font-semibold text-ink">
      <StandingMedal state={s.state} label={verdict} size={36} className="ring-2" /><span aria-hidden="true">{verdict}</span>
    </p>
    <table className="w-full text-sm">
      <caption className="sr-only">{t.tableCaption}</caption>
      <thead>
        <tr className="text-xs text-ink-3">
          <td />
          <th scope="col" className="pb-1 text-right font-bold">{t.you}</th>
          <th scope="col" className="max-w-24 truncate pb-1 pl-4 text-right font-bold">{name}</th>
          {detailed ? <th scope="col" className="pb-1 pl-4 text-right font-bold">{t.gapCol}</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => <tr key={r.label} className="border-t border-line">
          <th scope="row" className="py-2 text-left font-semibold text-ink-2">{r.label}</th>
          <td className="py-2 text-right text-base font-black tabular-nums">{r.you}</td>
          <td className="py-2 pl-4 text-right text-base font-black tabular-nums text-ink-2">{r.ego}</td>
          {detailed ? <td className={"py-2 pl-4 text-right text-sm font-bold tabular-nums " + (r.gap > 0 ? "text-ok" : r.gap < 0 ? "text-warn" : "text-ink-3")}>{r.gapText}</td> : null}
        </tr>)}
      </tbody>
    </table>
    {detailed ? <p className="text-xs leading-relaxed text-ink-3">{t.rule}</p> : null}
    {breakdown ? <div>
      <h3 className="text-sm font-bold">{t.breakdownTitle}</h3>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WORK_KINDS.map((k) => <li key={k} className="rounded-xl bg-surface-2 px-3 py-2">
          <span className="block text-xs font-semibold text-ink-3">{chartsDictionary(locale).workKinds[k]}</span>
          <span className="block font-black tabular-nums">{breakdown[k].sessions}
            <span className="font-normal text-ink-2"> · {formatDuration(breakdown[k].minutes)}</span></span>
        </li>)}
      </ul>
      <p className="mt-2 text-xs text-ink-3">{fmt(t.breakdownHint, { name })}</p>
    </div> : null}
    {paces.length ? <div>
      <h3 className="text-sm font-bold">{twinPace ? fmt(t.twinPace, { name }) : t.pace}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {paces.map((p) => <li key={p.label} className="flex items-center justify-between gap-3">
          <span className="text-ink-2">{p.label}</span>
          <span className="text-right">
            <strong className="tabular-nums">{p.pace}</strong>
            {observed ? <span className="ml-2 text-xs text-ink-3">{t.observedYou} : {p.you ?? t.notEnough}</span> : null}
          </span>
        </li>)}
      </ul>
      <p className="mt-2 text-xs text-ink-3">{twinPace ? t.twinPaceHint : t.paceHint}</p>
    </div> : null}
    {href ? <Link href={href} className={cn(linkClass, "text-sm")}>{t.see} <IconNext /></Link> : null}
  </section>;
}
