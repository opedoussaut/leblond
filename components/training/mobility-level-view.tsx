import { fmt, type Locale } from "@/lib/i18n";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { TEST_BY_ID } from "@/lib/training/hip-mobility/assessment";
import { LEVEL_LABELS, LEVELS, type Level } from "@/lib/training/hip-mobility/content";
import { TEST_LEVEL_MAX, splitLevelName, type LevelView, type TargetView, type TestView } from "@/lib/training/hip-mobility/levels";
import { pick } from "@/lib/training/sessions";
import { IconCheck } from "@/components/ui/icons";

/**
 * The "where I am / what I aim for" blocks of /train/mobility. Server-rendered,
 * no logic of its own: everything comes from `levelView` (lib/training/hip-mobility/levels).
 */

const levelName = (stage: Level, locale: Locale) => splitLevelName(pick(LEVEL_LABELS[stage].name, locale));

/** The five programme levels as one calm ladder: filled up to you, next and goal marked. */
export function MobilityLadder({ view, locale }: { view: LevelView; locale: Locale }) {
  const m = mobilityDictionary(locale);
  return <ol aria-label={m.ladderLabel} className="grid grid-cols-5 gap-1.5 sm:gap-2">
    {LEVELS.map((l) => {
      const reached = view.assessed && l <= view.stage;
      const isYou = view.assessed && l === view.stage;
      const isNext = l === view.next;
      const isGoal = l === view.final && l !== view.stage;
      const tag = isYou ? m.ladderYou : isNext ? m.ladderNext : isGoal ? m.ladderGoal : null;
      return <li key={l} aria-current={isYou ? "step" : undefined} className="min-w-0">
        <span aria-hidden="true" className={"block h-2 rounded-full "
          + (reached ? "bg-accent" : isNext ? "bg-accent/25 ring-1 ring-accent/60" : "bg-surface-2 ring-1 ring-line")} />
        <span className={"mt-2 block text-xs tabular-nums " + (isYou ? "font-bold text-ink" : "text-ink-3")}>
          {l}
        </span>
        {tag ? <span className={"block truncate text-[11px] font-semibold " + (isYou ? "text-accent" : "text-ink-2")}>{tag}</span> : null}
      </li>;
    })}
  </ol>;
}

/** The big "Level N" of the hero, with its plain name and meaning. */
export function MobilityLevelHeadline({ view, locale }: { view: LevelView; locale: Locale }) {
  const name = levelName(view.stage, locale);
  return <div>
    <p className="text-5xl font-black tracking-tight sm:text-6xl">{name.short}</p>
    <p className="mt-2 text-xl font-semibold tracking-tight">{name.title}</p>
    <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">{pick(LEVEL_LABELS[view.stage].detail, locale)}</p>
  </div>;
}

function StatusChip({ t, locale }: { t: TargetView; locale: Locale }) {
  const m = mobilityDictionary(locale);
  if (t.met) return <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-xs font-semibold text-ok"><IconCheck /> {m.reqMet}</span>;
  if (t.gap === null) return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2 ring-1 ring-line">{m.reqUntested}</span>;
  return <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{fmt(m.reqGap, { n: t.gap })}</span>;
}

function AimCard({ view, stage, kind, locale }: { view: LevelView; stage: Level; kind: "next" | "final"; locale: Locale }) {
  const m = mobilityDictionary(locale);
  const name = levelName(stage, locale);
  const rows = view.tests.map((t) => ({ t, target: kind === "next" ? t.next! : t.final })).filter((x) => x.target.required !== null);
  const met = rows.filter((x) => x.target.met).length;
  const headingId = "aim-" + kind;
  return <article aria-labelledby={headingId} className={"rounded-2xl p-5 sm:p-6 " + (kind === "next" ? "bg-accent-soft/60 ring-1 ring-accent/30" : "bg-surface ring-1 ring-line")}>
    <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">{kind === "next" ? m.aimNext : m.aimFinal}</p>
    <h3 id={headingId} className="mt-2 text-2xl font-black tracking-tight">{name.short}</h3>
    <p className="text-base font-semibold">{name.title}</p>
    <p className="mt-1 text-sm leading-relaxed text-ink-2">{pick(LEVEL_LABELS[stage].detail, locale)}</p>
    <p className="mt-4 text-sm font-semibold">{fmt(m.aimProgress, { met, total: rows.length })}</p>
    <div aria-hidden="true" className="mt-2 flex gap-1">
      {rows.map((x) => <span key={x.t.id} className={"h-1.5 flex-1 rounded-full " + (x.target.met ? "bg-accent" : "bg-line")} />)}
    </div>
    <ul className="mt-4 divide-y divide-line">
      {rows.map(({ t, target }) => {
        const def = TEST_BY_ID.get(t.id)!;
        return <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="font-semibold">{pick(def.name, locale)}</span>
            <span className="block text-xs text-ink-3">{fmt(m.reqLevel, { n: target.required! })}
              {t.id === "D" && t.level === null ? " · " + m.reqWall : ""}</span>
          </span>
          <StatusChip t={target} locale={locale} />
        </li>;
      })}
    </ul>
  </article>;
}

/** "What you aim for": the next step and the final goal, test by test. */
export function MobilityAim({ view, locale }: { view: LevelView; locale: Locale }) {
  const m = mobilityDictionary(locale);
  return <section aria-labelledby="aim-heading" className="space-y-3">
    <h2 id="aim-heading" className="text-lg font-bold">{m.aimTitle}</h2>
    {view.next === null ? <p className="rounded-2xl bg-accent-soft/60 p-5 text-sm font-semibold ring-1 ring-accent/30">{m.aimTop}</p>
      : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AimCard view={view} stage={view.next} kind="next" locale={locale} />
        {view.next !== view.final ? <AimCard view={view} stage={view.final} kind="final" locale={locale} /> : null}
      </div>}
  </section>;
}

/** One test's 0–4 track: filled up to the weaker side, next step ringed, goal at 4. */
function TestTrack({ t, locale }: { t: TestView; locale: Locale }) {
  const m = mobilityDictionary(locale);
  const next = t.next?.required ?? null;
  const label = fmt(m.trackAria, {
    test: t.id, now: t.level === null ? m.trackNone : t.level,
    next: next === null ? "—" : next,
  });
  const steps = Array.from({ length: TEST_LEVEL_MAX + 1 }, (_, i) => i);
  return <div role="img" aria-label={label} className="mt-4">
    <div className="relative flex items-center justify-between">
      <span aria-hidden="true" className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line" />
      {t.level !== null && t.level > 0 ? <span aria-hidden="true" className="absolute left-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accent"
        style={{ width: `calc((100% - 1rem) * ${t.level / TEST_LEVEL_MAX})` }} /> : null}
      {steps.map((i) => {
        const filled = t.level !== null && i <= t.level;
        const isNow = t.level === i;
        const isNext = next !== null && i === next && !t.next?.met;
        return <span key={i} aria-hidden="true" className={"relative z-10 flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums transition "
          + (isNow ? "h-7 w-7 bg-accent text-accent-ink shadow-sm" : "h-5 w-5 ")
          + (!isNow && filled ? "bg-accent text-accent-ink" : "")
          + (!filled && isNext ? "bg-surface text-accent ring-2 ring-accent" : "")
          + (!filled && !isNext ? "bg-surface text-ink-3 ring-1 ring-line" : "")}>{i}</span>;
      })}
    </div>
    <div aria-hidden="true" className="mt-1.5 flex justify-between text-[11px] text-ink-3">
      {steps.map((i) => {
        const isNext = next !== null && i === next && !t.next?.met;
        const tag = t.level === i ? m.ladderYou : isNext ? m.ladderNext : i === TEST_LEVEL_MAX ? m.ladderGoal : "";
        const align = i === 0 ? "justify-start" : i === TEST_LEVEL_MAX ? "justify-end" : "justify-center";
        return <span key={i} className={"flex w-7 whitespace-nowrap " + align + (t.level === i ? " font-semibold text-accent" : "")}>{tag}</span>;
      })}
    </div>
  </div>;
}

function TestCard({ t, locale }: { t: TestView; locale: Locale }) {
  const m = mobilityDictionary(locale);
  const def = TEST_BY_ID.get(t.id)!;
  const sideName = (s: "LEFT" | "RIGHT") => m.sides[s];
  const tested = t.sides.some((s) => s.level !== null || s.skipped === "PAIN");
  const nextTarget = t.next && t.next.required !== null && !t.next.met ? t.next : null;
  const aim = nextTarget ?? (t.final.met ? null : t.final);
  const headingId = "test-" + t.id;
  return <article aria-labelledby={headingId} className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 id={headingId} className="text-base font-bold">{pick(def.name, locale)}</h3>
      {t.limiting ? <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-ink">{m.limiting}</span> : null}
    </div>
    <p className="mt-2 text-sm leading-relaxed text-ink-2"><span className="font-semibold text-ink">{m.measures} · </span>{m.testMeasures[t.id]}</p>

    <TestTrack t={t} locale={locale} />

    <div className="mt-4 rounded-xl bg-surface-2 p-4">
      <p className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        <span>{m.latestResult}</span>
        {tested ? <span className="rounded-full bg-surface px-2 py-0.5 normal-case tracking-normal text-ink-2 ring-1 ring-line">{m.selfReported}</span> : null}
      </p>
      {tested ? <>
        <ul className="mt-2 space-y-1 text-sm">
          {t.sides.map((s) => <li key={s.side}>
            {s.level !== null ? fmt(m.sideLevel, { side: sideName(s.side), n: s.level })
              : s.skipped === "PAIN" ? fmt(m.sidePain, { side: sideName(s.side) }) : fmt(m.sideNotDone, { side: sideName(s.side) })}
            {s.value !== null ? <span className="text-ink-2"> · {fmt(m.valueLine, { label: pick(def.value.label, locale), value: s.value })}</span> : null}
            {s.support ? <span className="text-ink-2"> · {m.support} : {m.supports[s.support]}</span> : null}
          </li>)}
          {t.both !== null && def.both ? <li className="text-ink-2">{fmt(m.valueLine, { label: pick(def.both.label, locale), value: t.both })}</li> : null}
        </ul>
        {t.level !== null ? <p className="mt-2 text-sm font-semibold">{fmt(m.weakerSide, { n: t.level })}</p> : null}
        {t.level !== null ? <p className="mt-2 text-sm text-ink-2">{fmt(m.nowDescribes, { text: pick(def.levels[t.level], locale) })}</p> : null}
      </> : <p className="mt-2 text-sm text-ink-2">{m.notTested}</p>}
      {aim ? <p className="mt-2 text-sm"><span className="font-semibold text-accent">
        {fmt(m.toReach, { level: fmt(m.levelOf, { n: aim.stage }).toLocaleLowerCase(locale) })}
      </span> {pick(def.levels[aim.required!], locale)}</p> : null}
    </div>

    <details className="mt-3 rounded-xl px-1">
      <summary className="cursor-pointer py-2 text-sm font-bold text-accent">{m.howDone}</summary>
      <p className="text-sm font-semibold">{pick(def.question, locale)}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-2">{def.setup.map((s, i) => <li key={i}>{pick(s, locale)}</li>)}</ol>
      <p className="mt-2 text-sm text-ink-2"><strong className="text-ink">{m.stopRule} :</strong> {pick(def.stop, locale)}</p>
    </details>
  </article>;
}

/** "Your tests, explained": what each measures, how it is done, the latest self-reported result and the track to the goal. */
export function MobilityTests({ view, locale }: { view: LevelView; locale: Locale }) {
  const m = mobilityDictionary(locale);
  return <section aria-labelledby="tests-heading" className="space-y-3">
    <h2 id="tests-heading" className="text-lg font-bold">{m.testsTitle}</h2>
    <p className="max-w-prose text-sm leading-relaxed text-ink-2">{m.testsHint}</p>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {view.tests.map((t) => <TestCard key={t.id} t={t} locale={locale} />)}
    </div>
  </section>;
}
