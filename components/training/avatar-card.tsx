import Link from "next/link";
import { AVATAR_LEVELS, BODY_RULE, CLIMB_RULE, PILLARS, type AvatarProgress, type Pillar, type PillarState } from "@/lib/analytics/avatar";
import { fmt, type Locale } from "@/lib/i18n";
import { avatarDictionary } from "@/lib/i18n/avatar";
import { TEST_BY_ID } from "@/lib/training/hip-mobility/assessment";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { AVATAR_RING, AvatarPortrait } from "./avatar-portrait";

/**
 * The avatar at a glance: the current colour, the four pillars with their own
 * colour, which pillars decide the next unlock and what each one still needs.
 * Worded as the next step, never as a failure.
 */
export function AvatarCard({ locale, progress }: { locale: Locale; progress: AvatarProgress }) {
  const t = avatarDictionary(locale);
  const colourName = t.colour[progress.colour];
  const list = (items: string[]) => items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + t.list.and + items.at(-1);

  function detail(pillar: Pillar, state: PillarState) {
    if (state.kind === "body") {
      if (state.capped) return <p className="text-xs text-ink-3">{t.pillarCapped}</p>;
      const next = state.next!;
      if (next.assessments === 0) return <p className="text-xs text-ink-2">{t.bodyNone}{" "}
        <Link href="/train/mobility/assess" className={cn(linkClass, "text-xs")}>{t.bodyLink}</Link></p>;
      const tests = next.weakest.map((id) => TEST_BY_ID.get(id)?.name[locale] ?? id);
      return <div className="space-y-0.5 text-xs text-ink-2">
        <p>{fmt(t.bodyNext, { level: next.level, assessments: next.assessments, need: BODY_RULE.assessments })}</p>
        {next.latest !== null ? <p className="text-ink-3">{fmt(t.bodyLatest, { level: next.latest })}{tests.length ? " · " + fmt(t.bodyWeakest, { tests: list(tests) }) : ""}</p> : null}
      </div>;
    }
    if (!state.next) return <p className="text-xs text-ink-3">{t.pillarTop}</p>;
    return <p className="text-xs text-ink-2">{fmt(pillar === "boulder" ? t.boulderNext : t.routeNext, {
      grade: state.next.grade, climbs: Math.min(state.next.climbs, CLIMB_RULE.minClimbs), needClimbs: CLIMB_RULE.minClimbs,
      sessions: Math.min(state.next.sessions, CLIMB_RULE.minSessions), needSessions: CLIMB_RULE.minSessions,
    })}</p>;
  }

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
  </section>;
}
