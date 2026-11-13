import Link from "next/link";
import { MobilityIllustration } from "@/components/training/mobility-illustrations";
import {
  MobilityEnrollForm, MobilityNextSession, MobilityScheduleForm, MobilitySettingsForm,
} from "@/components/training/mobility-forms";
import { doseText } from "@/lib/training/hip-mobility/display";
import { buttonClass, linkClass } from "@/components/ui/button";
import { Notice, PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { requireViewer } from "@/lib/auth/viewer";
import { currentPlan, loadMobility } from "@/lib/data/mobility";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { getI18n } from "@/lib/i18n/server";
import { classifyStage, MOBILITY_TESTS } from "@/lib/training/hip-mobility/assessment";
import { EXERCISES, LEVEL_LABELS, NOT_CLINICAL, ROADMAP, contentLevel } from "@/lib/training/hip-mobility/content";
import { pick } from "@/lib/training/sessions";
import { IconBack, IconExternal, IconNext } from "@/components/ui/icons";

export const metadata = { title: "LEBLOND — Hip mobility" };

export default async function HipMobilityPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const m = mobilityDictionary(locale);
  const state = await loadMobility(viewer.supabase);
  const enrollment = state.enrollment;
  const plan = currentPlan(state);
  const latest = state.assessments[0] ?? null;
  const stage = latest ? classifyStage(latest.results) : null;
  const testName = (id: string) => pick(MOBILITY_TESTS.find((t) => t.id === id)!.name, locale);
  const dateLabel = (d: string) => formatDate(d + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" });
  const live = state.upcoming.find((u) => u.status === "IN_PROGRESS") ?? null;
  const { data: otherLive } = live ? { data: null } : await viewer.supabase.from("training_sessions").select("id").eq("status", "IN_PROGRESS").maybeSingle();
  const liveId = live?.id ?? otherLive?.id ?? null;
  const planned = state.upcoming.filter((u) => u.status !== "IN_PROGRESS");

  return <div className="space-y-6">
    <p className="text-sm"><Link href="/train" className={linkClass}><IconBack /> {locale === "fr" ? "S’entraîner" : "Training"}</Link></p>
    <PageHeader icon={<PAGE_ICONS.mobility />} title={m.title} subtitle={m.subtitle} />

    {plan.clinician.recommended ? <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-5">
      <h2 className="text-base font-bold text-danger">{m.clinicianTitle}</h2>
      <p className="mt-1 text-sm text-ink">{m.clinicianText}</p>
      <ul className="mt-2 list-disc pl-5 text-sm text-ink-2">
        {plan.clinician.reasons.map((r) => <li key={r}>{m.clinicianReasons[r]}</li>)}
      </ul>
    </div> : null}

    <section aria-labelledby="stage-heading" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
      <h2 id="stage-heading" className="text-xs font-bold uppercase tracking-[0.12em] text-accent">{m.stageTitle}</h2>
      {latest && stage ? <>
        <p className="text-xl font-black">{pick(LEVEL_LABELS[latest.stage].name, locale)}</p>
        <p className="text-sm text-ink-2">{pick(LEVEL_LABELS[latest.stage].detail, locale)}</p>
        <p className="text-xs text-ink-3">{fmt(m.stageAssessed, { date: dateLabel(latest.date) })}</p>
        {stage.limitedBy.length ? <p className="text-sm text-ink-2">{fmt(m.limitedBy, { tests: stage.limitedBy.map(testName).join(", ") })}</p> : null}
        {stage.missing.length ? <p className="text-sm text-ink-2">{fmt(m.missingTests, { tests: stage.missing.map(testName).join(", ") })}</p> : null}
        {!stage.functionalTested && latest.stage >= 2 ? <p className="text-sm text-ink-2">{m.noFunctional}</p> : null}
      </> : <p className="text-sm text-ink-2">{m.stageNone}</p>}
      {enrollment ? <p className="text-sm font-semibold">{fmt(m.workingLevel, { level: pick(LEVEL_LABELS[contentLevel(enrollment.workingLevel)].name, locale) })}</p> : null}
      <p className="text-xs text-ink-3">{pick(NOT_CLINICAL, locale)}</p>
      <Link href="/train/mobility/assess" className={buttonClass(latest ? "secondary" : "primary", "md")}>{latest ? m.assessAgain : m.assessCta} <IconNext /></Link>
    </section>

    {!enrollment ? <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-bold">{m.introTitle}</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          {m.intro.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </div>
      <div className="leblond-premium-surface p-5 sm:p-6"><MobilityEnrollForm locale={locale} /></div>
    </section> : <>
      {enrollment.status === "PAUSED" ? <Notice tone="warn">{m.paused}</Notice> : null}
      <section aria-labelledby="next-heading" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
        <h2 id="next-heading" className="text-lg font-bold">{m.nextTitle}</h2>
        <p className="text-sm text-ink-2">{fmt(m.nextLevel, { level: fmt(m.level, { n: plan.level }), min: plan.minutes })}</p>
        <MobilityNextSession locale={locale} plan={plan} today={state.today} liveId={liveId} />
      </section>

      <section aria-labelledby="schedule-heading" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="schedule-heading" className="text-lg font-bold">{m.scheduleTitle}</h2>
          <MobilityScheduleForm locale={locale} today={state.today} length={enrollment.sessionLength}
            taken={planned.flatMap((u) => u.date ? [u.date] : [])} />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-bold">{m.upcomingTitle}</h2>
          {state.upcoming.length === 0 ? <p className="mt-2 text-sm text-ink-2">{m.upcomingNone}</p> : <ul className="mt-2 space-y-2">
            {state.upcoming.map((u) => <li key={u.id} className="flex items-center justify-between gap-3 text-sm">
              <span>{u.date ? formatDate(u.date + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" }) : u.title}
                {u.status === "IN_PROGRESS" ? <span className="ml-2 text-xs font-bold text-accent">{m.inProgress}</span> : null}</span>
              <Link href={"/train/sessions/" + u.id} className={linkClass}>{m.open}</Link>
            </li>)}
          </ul>}
        </div>
      </section>
    </>}

    <section aria-labelledby="library-heading" className="space-y-3">
      <h2 id="library-heading" className="text-lg font-bold">{m.libraryTitle}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {EXERCISES.filter((e) => e.level === 0).map((e) => <article key={e.id} className="rounded-2xl border border-line bg-surface p-5" aria-labelledby={"ex-" + e.id}>
          <h3 id={"ex-" + e.id} className="text-base font-bold">{e.name[locale]}</h3>
          <MobilityIllustration exerciseId={e.id} title={e.name[locale]} className="mt-2" />
          <p className="mt-2 text-sm text-ink-2"><strong>{m.purpose} :</strong> {e.purpose[locale]}</p>
          <p className="mt-1 text-sm text-ink-2"><strong>{m.dose} :</strong> {doseText(locale, e.id, { variant: "STANDARD", reps: e.reps.start })}
            {e.perSide && e.restSeconds ? " · " + fmt(m.rest, { s: e.restSeconds }) : ""}</p>
          <details className="mt-3 rounded-xl border border-line bg-surface-2 px-3 open:pb-3">
            <summary className="cursor-pointer py-3 text-sm font-bold text-accent">{m.howTo}</summary>
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-2">{e.steps.map((s, i) => <li key={i}>{s[locale]}</li>)}</ol>
            <p className="mt-3 text-sm font-bold">{m.mistakes}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">{e.mistakes.map((s, i) => <li key={i}>{s[locale]}</li>)}</ul>
            <p className="mt-3 text-sm font-bold">{m.safety}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">{e.safety.map((s, i) => <li key={i}>{s[locale]}</li>)}</ul>
            <p className="mt-3 text-sm"><strong>{m.easier} — {e.easier.name[locale]} :</strong> <span className="text-ink-2">{e.easier.how[locale]}</span></p>
            <p className="mt-2 text-sm"><strong>{m.harder} — {e.harder.name[locale]} :</strong> <span className="text-ink-2">{e.harder.how[locale]}</span></p>
          </details>
        </article>)}
      </div>
    </section>

    <section aria-labelledby="roadmap-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="roadmap-heading" className="text-lg font-bold">{m.roadmapTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{m.roadmapHint}</p>
      <ol className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {ROADMAP.map((r) => <li key={r.key} className={"rounded-xl border p-4 " + (r.available ? "border-accent/40 bg-accent-soft" : "border-line bg-surface-2")}>
          <p className="flex flex-wrap items-baseline justify-between gap-2">
            <strong>{r.title[locale]}</strong>
            <span className="text-xs font-bold text-ink-3">{r.available ? m.roadmapNow : m.roadmapSoon}</span>
          </p>
          <p className="text-xs text-ink-3">{r.typicalWeeks[locale]} · {r.levels.map((l) => fmt(m.level, { n: l })).join(", ")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{r.focus.map((f, i) => <li key={i}>{f[locale]}</li>)}</ul>
        </li>)}
      </ol>
    </section>

    <div className="flex flex-wrap gap-3">
      <Link href="/follow-up/mobility" className={buttonClass("secondary", "md")}>{m.followUp} <IconNext /></Link>
      <Link href="/patrick?q=mobility" className={buttonClass("secondary", "md")}>{m.patrick} <IconNext /></Link>
      <Link href="/atlas/hip-mobility" className={buttonClass("secondary", "md")}>Atlas <IconExternal /></Link>
    </div>

    {enrollment ? <details className="rounded-2xl border border-line bg-surface p-5 text-sm">
      <summary className="cursor-pointer font-bold">{m.settingsTitle}</summary>
      <div className="mt-3"><MobilitySettingsForm locale={locale} enrollment={enrollment} /></div>
    </details> : null}
  </div>;
}
