import Link from "next/link";
import type { Pact, PactProgress } from "@/lib/analytics/alter-ego";
import { boulderGrade } from "@/lib/grading/display";
import { fmt, type Locale } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";
import { IconNext } from "@/components/ui/icons";
import type { RivalPortrait as RivalPortraitId } from "@/lib/analytics/rival";
import { RivalPortrait } from "./rival-portrait";
import { AvatarPortrait } from "./avatar-portrait";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

/** The race at a glance. It states the gap and never prescribes work to close it. */
export function AlterEgoScore({ locale, pact, progress, observed, href, portrait, avatar }: {
  locale: Locale; pact: Pact; progress: PactProgress; portrait?: RivalPortraitId;
  /** The climber's avatar level, shown facing the rival. */
  avatar?: number;
  observed?: { boulder: string | null; route: string | null }; href?: "/train/alter-ego";
}) {
  const t = alterEgoDictionary(locale);
  const { standing: s } = progress;
  const name = pact.displayName;
  const verdict = fmt({ ahead: t.ahead, level: t.level, behind: t.behind }[s.state], { name });
  const rows = [
    { label: t.sessions, you: s.you.sessions, ego: s.ego.sessions },
    { label: t.reps, you: s.you.reps, ego: s.ego.reps },
    { label: t.minutes, you: s.you.minutes, ego: s.ego.minutes },
  ];
  const paces = [
    { label: t.boulder, pace: progress.boulderPace && boulderGrade(progress.boulderPace), you: observed?.boulder ? boulderGrade(observed.boulder) : null },
    { label: t.route, pace: progress.routePace, you: observed?.route ?? null },
  ].filter((p) => p.pace);
  return <section aria-labelledby="ego-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <div className="flex items-center gap-3">
      {avatar !== undefined || portrait ? <div className="flex shrink-0 items-center -space-x-2">
        {avatar !== undefined ? <AvatarPortrait level={avatar} size={48} /> : null}
        {portrait ? <RivalPortrait portrait={portrait} size={48} /> : null}
      </div> : null}
      <div>
      <h2 id="ego-heading" className="text-lg font-bold">{fmt(t.scoreTitle, { name })}</h2>
      <p className="mt-1 text-sm text-ink-2">
        {fmt(t.weekOf, { week: progress.week + 1, total: pact.horizonWeeks })}{pact.status === "PAUSED" ? ` · ${t.paused}` : ""}
      </p>
      </div>
    </div>
    <p className={"rounded-xl px-4 py-3 text-sm font-semibold " + "bg-accent-soft text-ink"}>{verdict}</p>
    <table className="w-full text-sm">
      <caption className="sr-only">{t.tableCaption}</caption>
      <thead>
        <tr className="text-xs text-ink-3">
          <td />
          <th scope="col" className="pb-1 text-right font-bold">{t.you}</th>
          <th scope="col" className="max-w-24 truncate pb-1 pl-4 text-right font-bold">{name}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => <tr key={r.label} className="border-t border-line">
          <th scope="row" className="py-2 text-left font-semibold text-ink-2">{r.label}</th>
          <td className="py-2 text-right text-base font-black tabular-nums">{r.you}</td>
          <td className="py-2 pl-4 text-right text-base font-black tabular-nums text-ink-2">{r.ego}</td>
        </tr>)}
      </tbody>
    </table>
    {paces.length ? <div>
      <h3 className="text-sm font-bold">{t.pace}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {paces.map((p) => <li key={p.label} className="flex items-center justify-between gap-3">
          <span className="text-ink-2">{p.label}</span>
          <span className="text-right">
            <strong className="tabular-nums">{p.pace}</strong>
            {observed ? <span className="ml-2 text-xs text-ink-3">{t.observedYou} : {p.you ?? t.notEnough}</span> : null}
          </span>
        </li>)}
      </ul>
      <p className="mt-2 text-xs text-ink-3">{t.paceHint}</p>
    </div> : null}
    {href ? <Link href={href} className={cn(linkClass, "text-sm")}>{t.see} <IconNext /></Link> : null}
  </section>;
}
