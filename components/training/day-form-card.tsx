import Link from "next/link";
import type { CSSProperties } from "react";
import { BatteryMedium, Clock3, Eye, HeartPulse, Moon, MoonStar, Pencil, Stethoscope, Zap, type LucideIcon } from "lucide-react";
import { dayForm, type DayFormLevel } from "@/lib/analytics/day-form";
import { fmt, type Locale } from "@/lib/i18n";
import { dayFormDictionary } from "@/lib/i18n/day-form";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import type { DayCheckInput } from "@/lib/training/day-check";
import type { DayOutcome } from "@/lib/training/programme";

const TONE: Record<DayFormLevel, string> = { GOOD: "var(--ok)", WATCH: "var(--warn)", REST: "var(--danger)" };
const LEVEL_ICON: Record<DayFormLevel, LucideIcon> = { GOOD: Zap, WATCH: Eye, REST: Moon };

/** Three arcs with clear gaps, starting at the top; `lit` of them in the level's tone. */
function FormRing({ lit, level, label }: { lit: number; level: DayFormLevel; label: string }) {
  const Icon = LEVEL_ICON[level];
  return <span role="img" aria-label={label} className="relative grid size-24 shrink-0 place-items-center">
    <span aria-hidden="true" className="absolute inset-2 rounded-full blur-xl"
      style={{ background: `color-mix(in srgb, ${TONE[level]} 28%, transparent)` }} />
    <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
      {[0, 1, 2].map((i) => <circle key={i} cx="50" cy="50" r="42" fill="none" pathLength={360}
        strokeWidth="8" strokeLinecap="round" strokeDasharray="90 270" strokeDashoffset={-(i * 120 + 15)}
        stroke={i < lit ? TONE[level] : "var(--line)"} />)}
    </svg>
    <span aria-hidden="true" className="relative grid size-14 place-items-center rounded-full bg-surface text-white shadow-[0_8px_20px_-10px_rgba(12,60,112,0.55)]"
      style={{ background: `linear-gradient(145deg, color-mix(in srgb, ${TONE[level]} 78%, white), ${TONE[level]})` }}>
      <Icon className="size-7" strokeWidth={2.25} />
    </span>
  </span>;
}

/**
 * Filled "Forme du jour" card on Aujourd'hui: the self-reported form as a
 * 3-segment ring with icon and label (never colour alone), the answers in
 * short, today's adapted session and a link to edit the check-in. The level
 * comes from `dayForm` and is labelled as a self-assessment, not a measurement.
 */
export function DayFormCard({ locale, answers, outcome }: {
  locale: Locale;
  answers: Pick<DayCheckInput, "sleep" | "fatigue" | "soreness" | "pain" | "minutes">;
  outcome: DayOutcome | null;
}) {
  const t = dayFormDictionary(locale);
  const j = journeyDictionary(locale);
  const form = dayForm(answers);
  const level = t.levels[form.level];
  const firstPain = answers.pain[0];
  const pain = firstPain
    ? fmt(answers.pain.length > 1 ? t.painMore : "{first}", {
      first: `${j.areas[firstPain.area]} · ${t.painLevels[firstPain.level]}`, n: answers.pain.length - 1,
    })
    : t.painNone;
  const items: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: MoonStar, label: t.sleep, value: j.day.sleep[answers.sleep - 1] },
    { icon: BatteryMedium, label: t.fatigue, value: j.day.fatigue[answers.fatigue - 1] },
    { icon: Stethoscope, label: t.pain, value: pain },
    { icon: Clock3, label: t.time, value: answers.minutes ? fmt(t.minutes, { n: answers.minutes }) : t.noTime },
  ];
  const tone = { "--tone": TONE[form.level] } as CSSProperties;

  return <section aria-labelledby="day-form-heading" style={tone}
    className="relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-line p-5 shadow-[0_18px_40px_-30px_rgba(12,60,112,0.45)]">
    <span aria-hidden="true" className="pointer-events-none absolute inset-0"
      style={{ background: "linear-gradient(140deg, color-mix(in srgb, var(--tone) 13%, var(--surface)) 0%, var(--surface) 62%)" }} />

    <div className="relative flex flex-wrap items-center justify-between gap-2">
      <h3 id="day-form-heading" className="flex items-center gap-2 text-base font-bold text-ink">
        <HeartPulse aria-hidden="true" className="size-6 text-accent" />{t.eyebrow}
      </h3>
      <span className="rounded-full border border-line bg-surface/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-2">
        {t.declarative}
      </span>
    </div>

    <div className="relative flex items-center gap-4">
      <FormRing lit={form.segments} level={form.level} label={fmt(t.ringLabel, { level: level.label, lit: form.segments })} />
      <div className="min-w-0">
        <p className="leblond-number text-2xl leading-tight sm:text-[1.7rem]" style={{ color: "var(--tone)" }}>{level.label}</p>
        <p className="mt-1 text-sm leading-snug text-ink-2">{level.hint}</p>
      </div>
    </div>

    <dl aria-label={t.summary} className="relative grid grid-cols-2 gap-2">
      {items.map(({ icon: Icon, label, value }) => <div key={label}
        className="flex min-w-0 items-center gap-2 rounded-xl border border-line/70 bg-surface/85 px-3 py-2">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <span className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</dt>
          <dd className="text-sm font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{value}</dd>
        </span>
      </div>)}
    </dl>

    <div className="relative mt-auto flex flex-wrap items-center justify-between gap-3">
      {outcome ? <p className="min-w-0 text-xs text-ink-2">
        <span className="font-semibold text-ink">{t.session}</span> {j.outcomes[outcome]}
      </p> : <span />}
      <Link href="/train/today" aria-label={t.editLabel}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent/30 bg-surface px-4 text-sm font-bold text-accent hover:border-accent">
        <Pencil aria-hidden="true" className="size-4" />{t.edit}
      </Link>
    </div>
    <p className="relative -mt-2 text-[11px] leading-snug text-ink-3">{t.declarativeHint}</p>
  </section>;
}
