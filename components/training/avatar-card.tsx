import Link from "next/link";
import { AVATAR_LEVELS, OUTDOOR_FROM_LEVEL, PILLARS, type AvatarProgress, type ClimbCriterion, type ClimbPillar, type ClimbPillarId, type Pillar, type PillarState } from "@/lib/analytics/avatar";
import { fmt, type Locale } from "@/lib/i18n";
import { avatarDictionary } from "@/lib/i18n/avatar";
import { TEST_BY_ID } from "@/lib/training/hip-mobility/assessment";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ChevronDown } from "lucide-react";
import { AVATAR_RING, AvatarPortrait } from "./avatar-portrait";
import { boulderGrade } from "@/lib/grading/display";

/**
 * The avatar at a glance: the current colour, the six pillars with their own
 * colour, which pillars decide the next unlock and what each one still needs.
 * Each climbing pillar lists its criteria (met or not) and spells out what is
 * missing, so a row can never be read as unlocked. Worded as the next step,
 * never as a failure.
 */
export function AvatarCard({ locale, progress, foldPillars }: {
  locale: Locale; progress: AvatarProgress;
  /** Folds the six pillars away behind this label (Progrès › Grimpe keeps the card short). */
  foldPillars?: string;
}) {
  const t = avatarDictionary(locale);
  const colourName = t.colour[progress.colour];
  const list = (items: string[]) => items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + t.list.and + items.at(-1);

  function detail(pillar: Pillar, state: PillarState) {
    if (state.kind === "body") {
      if (state.capped) return <p className="text-xs text-ink-3">{t.pillarCapped}</p>;
      const next = state.next!;
      const tests = next.weakest.map((id) => TEST_BY_ID.get(id)?.name[locale] ?? id);
      return <div className="space-y-1 text-xs text-ink-2">
        <p>{fmt(t.bodyNext, { colour: t.colour[AVATAR_LEVELS[next.level]!], level: next.level })}</p>
        {next.latest !== null ? <p className="text-ink-3">{fmt(t.bodyLatest, { level: next.latest })}{tests.length ? " · " + fmt(t.bodyWeakest, { tests: list(tests) }) : ""}</p> : null}
        <p className="font-semibold text-ink" data-testid="avatar-missing">{fmt(t.missing, {
          items: fmt(next.needed === 1 ? t.bodyMissing.one : t.bodyMissing.other, { n: next.needed, level: next.level }),
        })}</p>
        {next.assessments === 0 ? <p>{t.bodyNone}{" "}
          <Link href="/train/mobility/assess" className={cn(linkClass, "text-xs")}>{t.bodyLink}</Link></p> : null}
      </div>;
    }
    return climbDetail(pillar as ClimbPillarId, state);
  }

  function climbDetail(pillar: ClimbPillarId, state: ClimbPillar) {
    if (!state.next) return <p className="text-xs text-ink-3">{t.pillarTop}</p>;
    const { rule, have, missing, outdoorOnly, level } = state.next;
    const isBoulder = pillar === "boulderIndoor" || pillar === "boulderOutdoor";
    const isOutdoorPillar = pillar === "boulderOutdoor" || pillar === "routeOutdoor";
    const label = (c: ClimbCriterion) => c === "climbs" ? (isBoulder ? "boulder" : "route") : c === "sessions" && outdoorOnly ? "days" : c;
    const criteria = (["climbs", "sessions", "sites"] as const).filter((c) => c !== "sites" || rule.sites > 1);
    const more = missing.map((c) => {
      const n = rule[c] - have[c];
      const forms = t.more[label(c)];
      return fmt(n === 1 ? forms.one : forms.other, { n });
    });
    return <div className="space-y-1 text-xs text-ink-2">
      <p>{fmt(t.climbGoal, { colour: t.colour[AVATAR_LEVELS[level]!], grade: isBoulder ? boulderGrade(rule.grade) : rule.grade })}{isBoulder ? "" : t.routeStyle}{outdoorOnly ? t.outdoorOnly : ""}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label={t.pillar[pillar]}>
        {criteria.map((c) => {
          const ok = have[c] >= rule[c];
          return <li key={c} data-criterion={c} data-met={ok}
            className={cn("rounded-full px-2 py-0.5", ok ? "bg-surface-2 text-ink-3" : "bg-accent-soft font-semibold text-ink")}>
            <span aria-hidden>{ok ? "✓ " : "✗ "}</span>{fmt(t.count[label(c)], { have: Math.min(have[c], rule[c]), need: rule[c] })}
            <span className="sr-only"> ({ok ? t.met : t.short})</span>
          </li>;
        })}
      </ul>
      <p className="font-semibold text-ink" data-testid="avatar-missing">{fmt(t.missing, { items: list(more) })}</p>
      {isOutdoorPillar ? <p className="text-ink-3">{level < OUTDOOR_FROM_LEVEL ? t.indoorCounts : t.outdoorRequired}</p> : null}
      {pillar === "boulderIndoor" ? <Link href="/session/board-plan" className={cn(linkClass, "text-xs")}>{t.boardPlanLink}</Link> : null}
    </div>;
  }

  const pillars = <>
    <ul className="divide-y divide-line">
      {PILLARS.map((pillar) => {
        const state = progress.pillars[pillar];
        const colour = AVATAR_LEVELS[state.level]!;
        const blocking = progress.nextLevel !== null && progress.blocking.includes(pillar);
        return <li key={pillar} className="space-y-1 py-3" data-pillar={pillar}>
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden className="size-3 shrink-0 rounded-full ring-1 ring-line" style={{ backgroundColor: AVATAR_RING[colour] }} />
            <strong className="font-semibold">{t.pillar[pillar]}</strong>
            <span className="text-ink-2">{t.colour[colour]}</span>
            {blocking ? <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-ink">{t.toUnlock}</span> : null}
          </div>
          {detail(pillar, state)}
        </li>;
      })}
    </ul>
    <p className="text-xs leading-relaxed text-ink-3">{t.rule} {t.how}</p>
  </>;

  return <section aria-labelledby="avatar-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <div className="flex items-center gap-4">
      <AvatarPortrait level={progress.level} size={72} label={fmt(t.portraitLabel, { colour: colourName })} />
      <div className="min-w-0">
        <h2 id="avatar-heading" className="text-lg font-bold">{t.title}</h2>
        <p className="text-sm font-semibold" data-testid="avatar-colour">{colourName} · <span className="font-normal text-ink-2">{fmt(t.levelOf, { n: progress.level + 1 })}</span></p>
      </div>
    </div>
    {progress.nextLevel !== null
      ? <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm font-semibold text-ink">
        {fmt(t.nextUnlock, { colour: t.colour[AVATAR_LEVELS[progress.nextLevel]!] })}
        <span className="block font-normal text-ink-2">{fmt(t.holding, { pillars: list(progress.blocking.map((p) => t.pillar[p])) })}</span>
      </p>
      : <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">{progress.level === AVATAR_LEVELS.length - 1 ? t.allDone : t.capped}</p>}
    {foldPillars ? <details className="group border-t border-line pt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
        {foldPillars}
        <ChevronDown aria-hidden="true" className="size-5 text-ink-3 transition-transform group-open:rotate-180" strokeWidth={2.25} />
      </summary>
      {pillars}
    </details> : pillars}
  </section>;
}
