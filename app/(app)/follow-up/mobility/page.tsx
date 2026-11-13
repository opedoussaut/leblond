import Link from "next/link";
import { buttonClass, linkClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import {
  changesSinceBaseline, discomfortReports, exerciseProgress, hardestMovement, mobilityOverview, mobilityPeriods, sideComparison,
} from "@/lib/analytics/mobility";
import { requireViewer } from "@/lib/auth/viewer";
import { loadMobility } from "@/lib/data/mobility";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { getI18n } from "@/lib/i18n/server";
import { MOBILITY_TESTS } from "@/lib/training/hip-mobility/assessment";
import { EXERCISE_BY_ID, LEVEL_LABELS, NOT_CLINICAL } from "@/lib/training/hip-mobility/content";
import { VARIANT_NAMES } from "@/lib/training/hip-mobility/prescription";
import { pick } from "@/lib/training/sessions";
import { IconBack, IconNext } from "@/components/ui/icons";

export const metadata = { title: "LEBLOND — Hip mobility follow-up" };

function Evidence({ label }: { label: string }) {
  return <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-2">{label}</span>;
}

function Bars({ items, label }: { items: { key: string; label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return <figure>
    <figcaption className="text-sm font-semibold">{label}</figcaption>
    <ol className="mt-2 flex h-28 items-end gap-1.5" aria-label={label}>
      {items.map((i) => <li key={i.key} className="flex flex-1 flex-col items-center justify-end gap-1">
        <span className="text-xs font-bold tabular-nums">{i.value || ""}</span>
        <span className="w-full rounded-t-md bg-accent" style={{ height: `${Math.max(2, (i.value / max) * 80)}px` }} aria-hidden="true" />
        <span className="text-[10px] text-ink-3">{i.label}</span>
        <span className="sr-only">{i.label}: {i.value}</span>
      </li>)}
    </ol>
  </figure>;
}

export default async function MobilityFollowUpPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const m = mobilityDictionary(locale);
  const state = await loadMobility(viewer.supabase);
  const { records, assessments, today } = state;
  const empty = records.length === 0 && assessments.length === 0;
  const overview = mobilityOverview(records, assessments, today);
  const weeks = mobilityPeriods(records, today, "week", 8);
  const months = mobilityPeriods(records, today, "month", 6);
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
    <PageHeader icon={<PAGE_ICONS.mobility />} title={m.fuTitle} subtitle={m.fuSubtitle} />

    {empty ? <div className="rounded-2xl border border-dashed border-line p-6 text-center">
      <p className="text-sm text-ink-2">{m.fuEmpty}</p>
      <Link href="/train/mobility" className={buttonClass("primary", "md", "mt-4")}>{m.fuStart} <IconNext /></Link>
    </div> : <>
      <section aria-labelledby="fu-sessions" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="fu-sessions" className="text-lg font-bold">{m.fuSessions}</h2>
          <Evidence label={m.fuRecorded} />
        </div>
        <p className="text-sm text-ink-2">{fmt(m.fuLast28, { n: overview.sessionsLast28 })} · {fmt(m.fuTotal, { n: overview.sessionsTotal })}</p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Bars label={m.fuPerWeek} items={weeks.map((w) => ({ key: w.start, label: shortDate(w.start), value: w.sessions }))} />
          <Bars label={m.fuPerMonth} items={months.map((p) => ({ key: p.start, label: formatDate(p.start + "T12:00:00", locale, { month: "short" }), value: p.sessions }))} />
        </div>
        {hardest ? <p className="text-sm font-semibold">{fmt(m.fuHardest, { name: EXERCISE_BY_ID.get(hardest.exerciseId)!.name[locale] })}</p> : null}
      </section>

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

      <section aria-labelledby="fu-assess" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="fu-assess" className="text-lg font-bold">{m.fuAssessments}</h2>
          <Evidence label={m.fuMeasured} />
        </div>
        {assessments.length ? <ul className="space-y-1 text-sm">
          {assessments.slice(0, 6).map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2">
            <span>{formatDate(a.date + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" })}</span>
            <span className="text-ink-2">{m.fuStageLabel} : <strong className="text-ink">{pick(LEVEL_LABELS[a.stage].name, locale)}</strong></span>
          </li>)}
        </ul> : <p className="text-sm text-ink-2">{m.stageNone}</p>}
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
        <h3 className="pt-2 text-sm font-bold">{m.fuFunctional}</h3>
        {functional.length ? <ul className="space-y-1 text-sm">
          {functional.map(({ a, r }) => <li key={a.id + r.side}>
            {shortDate(a.date)} · {m.sides[r.side]} : {r.done ? `${m.level.replace("{n}", String(r.level ?? "—"))}${r.value !== null ? ` · ${r.value}` : ""}` : m.skipReasons[r.skipReason ?? "NOT_POSSIBLE"]}
            {a.conditions?.wall ? <span className="text-ink-3"> ({m.wallKinds[a.conditions.wall.kind]}, {a.conditions.wall.angleDeg}°, {a.conditions.wall.spacingCm} cm)</span> : null}
          </li>)}
        </ul> : <p className="text-sm text-ink-2">{m.fuFunctionalNone}</p>}
      </section>

      <section aria-labelledby="fu-discomfort" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="fu-discomfort" className="text-lg font-bold">{m.fuDiscomfort}</h2>
          <Evidence label={m.fuSelfReported} />
        </div>
        {reports.length ? <ul className="space-y-1 text-sm">
          {reports.map((d, i) => <li key={d.sessionId + i}>
            {shortDate(d.date)} · {d.exerciseId ? EXERCISE_BY_ID.get(d.exerciseId)?.name[locale] ?? d.exerciseId : m.fuWholeSession}
            {d.side && d.side !== "BOTH" ? ` · ${m.sides[d.side]}` : ""} : <strong>{d.discomfort}/10</strong>
            {d.flags.length ? <span className="text-danger"> · {d.flags.map((f) => m.flagNames[f]).join(", ")}</span> : null}
          </li>)}
        </ul> : <p className="text-sm text-ink-2">{m.fuDiscomfortNone}</p>}
      </section>
    </>}

    <div className="flex flex-wrap gap-3">
      <Link href="/train/mobility" className={buttonClass("secondary", "md")}>{m.title} <IconNext /></Link>
      <Link href="/patrick?q=mobility" className={buttonClass("secondary", "md")}>{m.patrick} <IconNext /></Link>
    </div>
  </div>;
}
