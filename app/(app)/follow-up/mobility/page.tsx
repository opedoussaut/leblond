import Link from "next/link";
import { CircleCheck, ClipboardCheck, ClipboardList, HeartPulse, MessageCircle, PersonStanding, type LucideIcon } from "lucide-react";
import { linkClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import {
  changesSinceBaseline, discomfortReports, exerciseProgress, hardestMovement, sideComparison,
} from "@/lib/analytics/mobility";
import { requireViewer } from "@/lib/auth/viewer";
import { loadMobility } from "@/lib/data/mobility";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { batteryDictionary } from "@/lib/i18n/mobility-battery";
import { getI18n } from "@/lib/i18n/server";
import { MOBILITY_TESTS } from "@/lib/training/hip-mobility/assessment";
import { EXERCISE_BY_ID, LEVEL_LABELS, NOT_CLINICAL } from "@/lib/training/hip-mobility/content";
import { VARIANT_NAMES } from "@/lib/training/hip-mobility/prescription";
import { pick } from "@/lib/training/sessions";
import { IconBack } from "@/components/ui/icons";
import { loadRebuild } from "@/lib/data/mobility-rebuild";
import { RebuildTrack } from "@/components/training/rebuild-view";
import { MobilityCompassPanel, MobilitySessionsDone } from "@/components/training/mobility-compass";
import { Fold } from "@/components/ui/fold";
import { HeadingMark, SectionRows, ToneIcon, type Tone } from "@/components/ui/hero-figure";
import { doneMobilitySessions, mobilityActivity, mobilityCompass, nextMobilitySession } from "@/lib/analytics/mobility-follow-up";
import { loadBilanDates, loadMobilitySessionFacts } from "@/lib/data/mobility-follow-up";
import { levelView } from "@/lib/training/hip-mobility/levels";
import { mobilityFollowUpDictionary } from "@/lib/i18n/mobility-follow-up";

export const metadata = { title: "LEBLOND — Mobility follow-up" };

function Evidence({ label }: { label: string }) {
  return <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-2">{label}</span>;
}

/** A details card's head: its icon on a tone tile, the title, and where the figures come from. */
function SectionHead({ id, title, icon, tone, evidence }: { id: string; title: string; icon: LucideIcon; tone: Tone; evidence: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
    <h2 id={id} className="flex items-center gap-3 text-lg font-bold"><ToneIcon icon={icon} tone={tone} />{title}</h2>
    <Evidence label={evidence} />
  </div>;
}

export default async function MobilityFollowUpPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const m = mobilityDictionary(locale);
  const b = batteryDictionary(locale);
  const t = mobilityFollowUpDictionary(locale);
  const [state, rebuild, facts, bilans] = await Promise.all([
    loadMobility(viewer.supabase), loadRebuild(viewer.supabase), loadMobilitySessionFacts(viewer.supabase), loadBilanDates(viewer.supabase),
  ]);
  const { records, assessments, today } = state;
  const empty = records.length === 0 && assessments.length === 0;
  // Every mobility séance (hip programme, Rebuild, coach and Atlas séances), not only the hip programme's.
  const done = doneMobilitySessions(facts, today);
  const activity = mobilityActivity(done, today);
  const next = nextMobilitySession(facts, today);
  const latest = assessments[0] ?? null;
  const view = levelView(latest ? latest.results : null);
  const compass = mobilityCompass({
    latestAssessment: latest ? { stage: latest.stage, date: latest.date } : null, view,
    bilans, rebuildStartedOn: rebuild?.enrollment.startedOn ?? null, today,
  });
  const changes = changesSinceBaseline(assessments);
  const sides = sideComparison(records);
  const reports = discomfortReports(records, 3, 12);
  const hardest = hardestMovement(records);
  const exerciseIds = [...new Set(records.flatMap((r) => r.exercises.map((e) => e.exerciseId)))].filter((id) => EXERCISE_BY_ID.has(id));
  const testName = (id: string) => pick(MOBILITY_TESTS.find((t) => t.id === id)!.name, locale);
  const unit = (test: string, side: string) => {
    const def = MOBILITY_TESTS.find((t) => t.id === test)!;
    const u = (side === "BOTH" ? def.both?.unit : def.value.unit) ?? "count";
    return u === "cm" ? " cm" : "";
  };
  const shortDate = (d: string) => formatDate(d + "T12:00:00", locale, { day: "numeric", month: "short" });
  const functional = assessments.flatMap((a) => a.results.filter((r) => r.test === "D" && r.side !== "BOTH").map((r) => ({ a, r })));

  return <div className="space-y-6">
    <p className="text-sm"><Link href="/follow-up" className={linkClass}><IconBack /> {locale === "fr" ? "Progrès" : "Progress"}</Link></p>
    <PageHeader icon={<PAGE_ICONS.mobility />} title={t.title} subtitle={t.subtitle} />

    <MobilityCompassPanel locale={locale} compass={compass} activity={activity} next={next}
      testNames={(compass.goal?.blockers ?? []).map(testName)} />

    <MobilitySessionsDone locale={locale} done={done} activity={activity} />

    {rebuild ? <RebuildTrack locale={locale} state={rebuild} /> : null}

    {empty ? null : <>
      <div className="px-1 pt-2">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-3"><HeadingMark />{t.details}</h2>
        <p className="mt-1.5 text-sm text-ink-2">{t.detailsHint}</p>
      </div>
      {exerciseIds.length || sides.length ? <Fold variant="card" title={m.fuExercises} hint={hardest ? fmt(m.fuHardest, { name: EXERCISE_BY_ID.get(hardest.exerciseId)!.name[locale] }) : m.fuExerciseHint}>
      {exerciseIds.length ? <section aria-labelledby="fu-exercises" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="fu-exercises" className="text-lg font-bold">{m.fuExercises}</h2>
          <Evidence label={m.fuRecorded} />
        </div>
        <p className="text-sm text-ink-2">{m.fuExerciseHint}</p>
        {exerciseIds.map((id) => {
          const ex = EXERCISE_BY_ID.get(id)!;
          const points = exerciseProgress(records, id).slice(-8);
          return <div key={id} className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <caption className="pb-2 text-left font-bold">{ex.name[locale]}</caption>
              <thead><tr className="text-left text-xs text-ink-3">
                <th scope="col" className="py-1 pr-3 font-semibold">{m.fuDate}</th>
                <th scope="col" className="py-1 pr-3 font-semibold">{m.version}</th>
                <th scope="col" className="py-1 pr-3 font-semibold">{ex.perSide ? `${m.left} / ${m.right}` : m.reps}</th>
                <th scope="col" className="py-1 pr-3 font-semibold">{m.fuControlled}</th>
                <th scope="col" className="py-1 font-semibold">{m.discomfort}</th>
              </tr></thead>
              <tbody>
                {points.map((p) => <tr key={p.sessionId} className="border-t border-line">
                  <td className="py-1.5 pr-3">{shortDate(p.date)}</td>
                  <td className="py-1.5 pr-3">{p.variant ? pick(VARIANT_NAMES[p.variant], locale) : "—"}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{ex.perSide ? `${p.reps.left ?? "—"} / ${p.reps.right ?? "—"}` : p.reps.both ?? "—"}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{p.controlledShare === null ? "—" : `${Math.round(p.controlledShare * 100)} %`}</td>
                  <td className="py-1.5 tabular-nums">{p.maxDiscomfort}/10{p.flags.length ? " ⚠" : ""}</td>
                </tr>)}
              </tbody>
            </table>
          </div>;
        })}
      </section> : null}

      {sides.length ? <section aria-labelledby="fu-sides" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="fu-sides" className="text-lg font-bold">{m.fuLeftRight}</h2>
          <Evidence label={m.fuRecorded} />
        </div>
        <p className="text-sm text-ink-2">{m.fuLeftRightHint}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead><tr className="text-left text-xs text-ink-3">
              <th scope="col" className="py-1 pr-3 font-semibold">&nbsp;</th>
              <th scope="col" className="py-1 pr-3 font-semibold">{m.fuAvgReps}</th>
              <th scope="col" className="py-1 pr-3 font-semibold">{m.fuEasierShare}</th>
              <th scope="col" className="py-1 pr-3 font-semibold">{m.fuAvgDiscomfort}</th>
              <th scope="col" className="py-1 font-semibold">{m.fuUncontrolled}</th>
            </tr></thead>
            <tbody>
              {sides.flatMap((c) => (["LEFT", "RIGHT"] as const).map((side) => {
                const s = side === "LEFT" ? c.left : c.right;
                return <tr key={c.exerciseId + side} className={"border-t border-line " + (c.harderSide === side ? "font-bold text-warn" : "")}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-semibold">{EXERCISE_BY_ID.get(c.exerciseId)!.name[locale]} · {m.sides[side]}</th>
                  <td className="py-1.5 pr-3 tabular-nums">{s.averageReps ?? "—"}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{Math.round(s.easierShare * 100)} %</td>
                  <td className="py-1.5 pr-3 tabular-nums">{s.averageDiscomfort ?? "—"}</td>
                  <td className="py-1.5 tabular-nums">{s.uncontrolled}</td>
                </tr>;
              }))}
            </tbody>
          </table>
        </div>
        <ul className="text-sm text-ink-2">
          {sides.map((c) => <li key={c.exerciseId}>{EXERCISE_BY_ID.get(c.exerciseId)!.name[locale]} : {c.harderSide ? fmt(m.fuHarder, { side: m.sides[c.harderSide] }) : m.fuAlike}</li>)}
        </ul>
      </section> : null}
      </Fold> : null}

      <section aria-labelledby="fu-assess" className="leblond-premium-surface overflow-hidden">
        <SectionHead id="fu-assess" title={m.fuAssessments} icon={ClipboardList} tone="violet" evidence={m.fuMeasured} />
        {assessments.length ? <ul className="divide-y divide-line border-t border-line">
          {assessments.slice(0, 6).map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 sm:px-6">
            <span className="text-sm font-semibold tabular-nums">{formatDate(a.date + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" })}</span>
            <span className="text-sm text-ink-3">{m.fuStageLabel} · <strong className="font-semibold text-ink">{pick(LEVEL_LABELS[a.stage].name, locale)}</strong></span>
          </li>)}
        </ul> : <p className="border-t border-line px-5 py-4 text-sm text-ink-2 sm:px-6">{m.stageNone}</p>}
        <div className="space-y-4 border-t border-line bg-surface-2/40 p-5 sm:p-6">
        <p className="text-xs text-ink-3">{pick(NOT_CLINICAL, locale)}</p>
        {changes.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="pb-2 text-left font-bold">{m.fuChanges}</caption>
            <thead><tr className="text-left text-xs text-ink-3">
              <th scope="col" className="py-1 pr-3 font-semibold">{m.test}</th>
              <th scope="col" className="py-1 pr-3 font-semibold">{m.fuBefore}</th>
              <th scope="col" className="py-1 pr-3 font-semibold">{m.fuAfter}</th>
              <th scope="col" className="py-1 font-semibold">&nbsp;</th>
            </tr></thead>
            <tbody>
              {changes.map((c) => <tr key={c.test + c.side} className="border-t border-line align-top">
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold">{testName(c.test)} · {m.sides[c.side]}<span className="block text-xs font-normal text-ink-3">{shortDate(c.since)} → {shortDate(c.until)}</span></th>
                <td className="py-1.5 pr-3 tabular-nums">{c.before.done ? `${c.before.level ?? "—"}${c.before.value !== null ? ` · ${c.before.value}${unit(c.test, c.side)}` : ""}` : "—"}<span className="block text-xs text-ink-3">{m.supports[c.before.support]}</span></td>
                <td className="py-1.5 pr-3 tabular-nums">{c.after.done ? `${c.after.level ?? "—"}${c.after.value !== null ? ` · ${c.after.value}${unit(c.test, c.side)}` : ""}` : "—"}<span className="block text-xs text-ink-3">{m.supports[c.after.support]}</span></td>
                <td className="py-1.5">{c.comparable ? <strong>{m.fuDirection[c.direction ?? "null"]}</strong>
                  : <span className="text-ink-3">{m.fuNotComparable} ({c.differences.map((d) => m.fuDifferences[d]).join(", ")})</span>}
                  {c.caveats.includes("timeOfDay") ? <span className="block text-xs text-ink-3">{m.fuCaveatTime}</span> : null}</td>
              </tr>)}
            </tbody>
          </table>
        </div> : null}
        <div>
          <h3 className="text-sm font-bold">{m.fuFunctional}</h3>
          {functional.length ? <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line">
            {functional.map(({ a, r }) => <li key={a.id + r.side} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
              <span className="w-14 shrink-0 font-semibold tabular-nums text-ink-2">{shortDate(a.date)}</span>
              <span className="min-w-0 flex-1"><strong className="font-semibold">{m.sides[r.side]}</strong> · {r.done ? `${m.level.replace("{n}", String(r.level ?? "—"))}${r.value !== null ? ` · ${r.value}` : ""}` : m.skipReasons[r.skipReason ?? "NOT_POSSIBLE"]}</span>
              {a.conditions?.wall ? <span className="text-xs text-ink-3">{m.wallKinds[a.conditions.wall.kind]}, {a.conditions.wall.angleDeg}°, {a.conditions.wall.spacingCm} cm</span> : null}
            </li>)}
          </ul> : <p className="mt-1 text-sm text-ink-2">{m.fuFunctionalNone}</p>}
        </div>
        </div>
      </section>

      <section aria-labelledby="fu-discomfort" className="leblond-premium-surface overflow-hidden">
        <SectionHead id="fu-discomfort" title={m.fuDiscomfort} icon={HeartPulse} tone="rose" evidence={m.fuSelfReported} />
        {reports.length ? <ul className="divide-y divide-line border-t border-line">
          {reports.map((d, i) => <li key={d.sessionId + i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm sm:px-6">
            <span className="w-14 shrink-0 font-semibold tabular-nums text-ink-2">{shortDate(d.date)}</span>
            <span className="min-w-0 flex-1">{d.exerciseId ? EXERCISE_BY_ID.get(d.exerciseId)?.name[locale] ?? d.exerciseId : m.fuWholeSession}
              {d.side && d.side !== "BOTH" ? ` · ${m.sides[d.side]}` : ""}
              {d.flags.length ? <span className="block text-xs font-semibold text-danger">{d.flags.map((f) => m.flagNames[f]).join(", ")}</span> : null}</span>
            <strong className="font-display text-base font-extrabold tabular-nums">{d.discomfort}/10</strong>
          </li>)}
        </ul> : <div className="flex items-center gap-3 border-t border-line px-5 py-4 sm:px-6">
          <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-ok" strokeWidth={2.25} />
          <div><p className="text-sm font-semibold">{t.noDiscomfort}</p><p className="text-xs text-ink-3">{m.fuDiscomfortNone}</p></div>
        </div>}
      </section>
    </>}

    <SectionRows label={t.more} title={t.more} rows={[
      { href: "/follow-up/mobility/battery", title: b.followTitle, detail: b.followText, value: "", icon: ClipboardCheck, tone: "teal" },
      { href: "/train/mobility", title: m.title, detail: t.hipsDetail, value: "", icon: PersonStanding, tone: "sky" },
      { href: "/patrick?q=mobility", title: m.patrick, detail: t.patrickDetail, value: "", icon: MessageCircle, tone: "violet" },
    ]} />
  </div>;
}
