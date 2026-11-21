import Link from "next/link";
import { ClinicalReviewForm, RebuildDaysForm, RebuildFollowUp, RebuildPostponeButton } from "@/components/training/rebuild-forms";
import { RebuildClinicalBadge, RebuildStatusChip, sessionDateLabel } from "@/components/training/rebuild-view";
import { MobilityIllustration } from "@/components/training/mobility-illustrations";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { buttonClass, linkClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { IconBack, IconNext } from "@/components/ui/icons";
import { requireViewer } from "@/lib/auth/viewer";
import { loadRebuild } from "@/lib/data/mobility-rebuild";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { rebuildDictionary } from "@/lib/i18n/mobility-rebuild";
import { getI18n } from "@/lib/i18n/server";
import { LETTERS, PHASES, PHASE_MINUTES, reassessments } from "@/lib/training/mobility-rebuild/engine";
import { currentPhase } from "@/lib/training/mobility-rebuild/state";
import { templateFor } from "@/lib/training/mobility-rebuild/templates";

export const metadata = { title: "LEBLOND — Mobility Rebuild" };

/** Entraînement › Programmes › Reconquête mobilité: the plan, its calendar and the safeguards. */
export default async function RebuildPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const r = rebuildDictionary(locale);
  const state = await loadRebuild(viewer.supabase);
  const dateLabel = (d: string) => formatDate(d + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" });

  if (!state) {
    return <div className="space-y-6">
      <p className="text-sm"><Link href="/train/mobility" className={linkClass}><IconBack /> {r.short}</Link></p>
      <PageHeader icon={<PAGE_ICONS.mobility />} title={r.title} subtitle={r.subtitle} />
      <p className="text-sm text-ink-2">{r.notEnrolled}</p>
    </div>;
  }
  const { enrollment, view, today } = state;
  const phase = currentPhase(view);
  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);

  return <div className="space-y-6">
    <p className="text-sm"><Link href="/train/mobility" className={linkClass}><IconBack /> {r.short}</Link></p>
    <PageHeader icon={<PAGE_ICONS.mobility />} title={r.title} subtitle={r.subtitle} />

    <section aria-labelledby="rebuild-status" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
      <h2 id="rebuild-status" className="sr-only">{r.short}</h2>
      <RebuildClinicalBadge locale={locale} reviewOn={enrollment.clinicalReviewOn} />
      {!enrollment.clinicalReviewOn ? <p className="text-sm text-ink-2">{r.clinicalPendingDetail}</p> : null}
      {enrollment.clinicalRestrictions ? <p className="text-sm"><strong>{r.clinicalRestrictions} :</strong> {enrollment.clinicalRestrictions}</p> : null}
      <p className="text-sm font-semibold" data-testid="rebuild-adherence">{fmt(r.adherence, view.adherence)}</p>
      {view.next ? <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm"><strong>{r.next} :</strong> {sessionDateLabel(view.next, locale)} · {r.letter[view.next.letter]} · {fmt(r.phase, { n: view.next.phase })} · {fmt(r.minutes, { n: view.next.plannedMinutes ?? 0 })}</p>
        <Link href={"/train/sessions/" + view.next.id} className={buttonClass("primary", "md")}>{r.open_session} <IconNext /></Link>
      </div> : <p className="text-sm text-ink-2">{r.noNext}</p>}
      <p className="text-xs text-ink-3">{r.notMedical}</p>
    </section>

    {view.followUps.length ? <section aria-labelledby="rebuild-followups" className="space-y-3">
      <h2 id="rebuild-followups" className="text-lg font-bold">{r.followUpsTitle}</h2>
      {view.followUps.map((s) => <div key={s.id} className="space-y-1">
        <p className="text-sm font-semibold">{sessionDateLabel(s, locale)} · {r.letter[s.letter]}</p>
        <RebuildFollowUp locale={locale} sessionId={s.id} />
      </div>)}
    </section> : null}

    <section aria-labelledby="rebuild-safety" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="rebuild-safety" className="text-lg font-bold">{r.safetyTitle}</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-2">{r.safetyList.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mt-3 text-sm text-ink-2">{r.progressRule}</p>
      </div>
      <div className="rounded-2xl border border-danger/40 bg-danger/5 p-5">
        <h2 className="text-lg font-bold text-danger">{r.emergencyTitle}</h2>
        <p className="mt-2 text-sm">{r.emergency}</p>
      </div>
    </section>

    <section aria-labelledby="rebuild-cycle" className="space-y-3">
      <h2 id="rebuild-cycle" className="text-lg font-bold">{r.cycle} · {fmt(r.phase, { n: phase })} · {fmt(r.minutes, { n: PHASE_MINUTES[phase] })}</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {LETTERS.map((letter) => {
          const t = enrollment.content ? templateFor(enrollment.content, letter, phase) : null;
          return <article key={letter} className="rounded-2xl border border-line bg-surface p-5" aria-labelledby={"cycle-" + letter}>
            <h3 id={"cycle-" + letter} className="text-base font-bold">{r.letter[letter]}</h3>
            {t ? <>
              <p className="text-xs text-ink-3">{t.title} · {fmt(r.minutes, { n: t.minutes })}</p>
              <ol className="mt-3 space-y-3">
                {t.exercises.map((e, i) => <li key={i} className="text-sm">
                  <p className="font-semibold">{e.name} <span className="font-normal text-ink-3">· {fmt(r.minutes, { n: e.minutes })}</span></p>
                  <p className="text-xs text-ink-2">{[e.sets && e.reps ? `${e.sets} × ${e.reps}` : null, e.seconds ? (e.modality === "TIME" || e.modality === "FREE" ? fmt(r.minutes, { n: Math.round(e.seconds / 60) }) : `${e.seconds} s`) : null,
                    e.restSeconds ? `${e.restSeconds} s ↺` : null, e.intensity].filter(Boolean).join(" · ")}</p>
                  {e.illustration ? <MobilityIllustration exerciseId={e.illustration} title={e.name} className="mt-1" /> : null}
                  {e.summary ? <p className="mt-1 text-xs text-ink-2">{e.summary}</p> : null}
                  {e.alternative ? <p className="mt-1 text-xs text-ink-2"><strong>{r.alternative} :</strong> {e.alternative}</p> : null}
                </li>)}
              </ol>
            </> : <p className="mt-2 text-sm text-ink-3">–</p>}
          </article>;
        })}
      </div>
      <p className="text-xs text-ink-3">{PHASES.map((p) => `${fmt(r.phase, { n: p })} ${fmt(r.weeksRange, { a: p * 2 - 1, b: p * 2 })} : ${PHASE_MINUTES[p]} min`).join(" · ")}</p>
    </section>

    <section aria-labelledby="rebuild-calendar" className="space-y-3">
      <h2 id="rebuild-calendar" className="text-lg font-bold">{r.calendar}</h2>
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="rebuild-calendar">
        {weeks.map((w) => <li key={w} className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{fmt(r.week, { n: w })} · {fmt(r.phase, { n: Math.ceil(w / 2) })}</p>
          <ul className="mt-2 space-y-2">
            {view.sessions.filter((s) => s.week === w).map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm" data-slot={s.slot}>
              <span><strong>{s.letter}</strong> · {sessionDateLabel(s, locale)} · {fmt(r.minutes, { n: s.plannedMinutes ?? 0 })}</span>
              <span className="flex flex-wrap items-center gap-2">
                <RebuildStatusChip locale={locale} status={s.view} />
                {s.status === "PLANNED" && s.scheduledDate && s.scheduledDate < today ? <RebuildPostponeButton locale={locale} sessionId={s.id} /> : null}
                <Link href={"/train/sessions/" + s.id} className={linkClass}>{r.open_session}</Link>
              </span>
            </li>)}
          </ul>
        </li>)}
      </ol>
    </section>

    <section aria-labelledby="rebuild-reassess" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="rebuild-reassess" className="text-lg font-bold">{r.reassessTitle}</h2>
      <ul className="mt-2 space-y-1 text-sm">{reassessments(enrollment.startedOn).map((x) => <li key={x.key}>{fmt(r.reassessFrom, { key: x.key, date: dateLabel(x.from) })}</li>)}</ul>
      <p className="mt-2 text-xs text-ink-3">{r.reassessHint}</p>
      <Link href="/train/mobility/battery" className={buttonClass("secondary", "sm", "mt-3")}>{r.reassessOpen} <IconNext /></Link>
    </section>

    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-5"><RebuildDaysForm locale={locale} days={enrollment.days} /></div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <ClinicalReviewForm locale={locale} date={enrollment.clinicalReviewOn} restrictions={enrollment.clinicalRestrictions} today={today} />
      </div>
    </section>

    <Link href="/follow-up/mobility" className={buttonClass("secondary", "md")}>{r.trackTitle} <IconNext /></Link>
  </div>;
}
