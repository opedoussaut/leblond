import Link from "next/link";
import { GradeChip } from "@/components/climbing/grade-chip";
import { LinkButton } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { summarizeSession, type HighestGrade } from "@/lib/analytics";
import type { Viewer } from "@/lib/auth/viewer";
import { toAttemptFact, toProblemFact, toSessionFact } from "@/lib/data/climbing";
import type { loadSessionView } from "@/lib/data/session";
import { tagSlugs } from "@/lib/data/session";
import { formatDateTime, formatDuration } from "@/lib/format";
import { fmt, type Dictionary } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import type { StyleTag } from "@/lib/climbing/types";
import { SessionDetailsForm } from "./details-form";
import { SessionWearable } from "./session-wearable";

type View = NonNullable<Awaited<ReturnType<typeof loadSessionView>>>;

function HighestRow({ t, items }: { t: Dictionary; items: HighestGrade[] }) {
  return (
    <span className="flex flex-col items-end gap-1">
      {items.map((h) => (
        <span key={h.system} className="flex items-center gap-2">
          <GradeChip t={t} system={h.system} grade={h.grade} />
          {h.normalized && h.system !== "FONT" ? (
            <span className="text-sm text-ink-3">/ {fmt(t.grades.estimatedFont, { grade: h.normalized.grade })}</span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

export async function SessionSummaryView({ viewer, view }: { viewer: Viewer; view: View }) {
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const problems = view.problems.map((p) => toProblemFact({ ...p, tags: tagSlugs(p) as StyleTag[] }));
  const summary = summarizeSession(
    toSessionFact(view.session, view.activity),
    problems,
    view.attempts.map(toAttemptFact),
  );
  const sessionProblemIds = new Set(view.attempts.filter((a) => a.session_id === view.session.id).map((a) => a.problem_id));
  const rows: Array<[string, React.ReactNode]> = [];
  if (summary.highestSent.length) rows.push([t.session.highestSend, <HighestRow key="hs" t={t} items={summary.highestSent} />]);
  if (summary.highestFlashed.length)
    rows.push([t.session.highestFlash, <HighestRow key="hf" t={t} items={summary.highestFlashed} />]);
  if (summary.mostSuccessfulStyle) rows.push([t.session.mostSuccessfulStyle, t.styles[summary.mostSuccessfulStyle.key]]);
  if (summary.hardestStyle) rows.push([t.session.hardestStyle, t.styles[summary.hardestStyle.key]]);
  if (summary.bestWallAngle) rows.push([t.session.bestAngle, t.wallAngles[summary.bestWallAngle.key]]);
  if (summary.hardestWallAngle) rows.push([t.session.hardestAngle, t.wallAngles[summary.hardestWallAngle.key]]);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{t.session.summaryTitle}</p>
        <h1 className="mt-1 text-xl font-black">{view.gym.name}</h1>
        <p className="text-sm text-ink-3">
          {formatDateTime(view.session.started_at, locale)} · {t.session.source}: {t.session.sourceManual}
        </p>
      </header>

      <Card>
        <div className="text-4xl font-black tabular-nums">{formatDuration(summary.durationMinutes)}</div>
        <div className="mt-4 grid grid-cols-4 gap-3">
          <Stat value={summary.problems} label={t.session.problems} />
          <Stat value={summary.tops} label={t.session.tops} />
          <Stat value={summary.flashes} label={t.session.flashes} />
          <Stat value={summary.attempts} label={t.session.attempts} />
        </div>
      </Card>

      {rows.length ? (
        <Card>
          <dl className="divide-y divide-line">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-sm text-ink-2">{label}</dt>
                <dd className="text-right font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      <SessionWearable sessionId={view.session.id} activity={view.activity} />

      <LinkButton
        href={`/patrick?session=${view.session.id}&q=lastSession`}
        size="lg"
        className="w-full"
      >
        {t.session.askPatrick}
      </LinkButton>

      {sessionProblemIds.size ? (
        <section className="space-y-2">
          <SectionTitle>{t.session.recent}</SectionTitle>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {view.problems
              .filter((p) => sessionProblemIds.has(p.id))
              .map((p) => {
                const pa = view.attempts.filter((a) => a.problem_id === p.id && a.session_id === view.session.id);
                const best = pa.some((a) => a.result === "FLASH") ? "FLASH" : pa.some((a) => a.result === "TOP") ? "TOP" : null;
                return (
                  <li key={p.id}>
                    <Link href={`/problem/${p.id}`} className="flex min-h-12 items-center gap-3 px-4 hover:bg-surface-2">
                      <GradeChip t={t} system={p.native_grade_system} grade={p.native_grade} size="sm" />
                      <span className="text-sm text-ink-3">{fmt(t.session.attemptsShort, { n: pa.length })}</span>
                      <span className="ml-auto text-xs font-bold uppercase">{best ? t.results[best] : ""}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      <SessionDetailsForm
        sessionId={view.session.id}
        initial={{
          notes: view.session.notes ?? "",
          perceivedEnergyBefore: view.session.perceived_energy_before,
          perceivedEnergyAfter: view.session.perceived_energy_after,
          fatigue: view.session.fatigue,
          motivation: view.session.motivation,
        }}
      />
    </div>
  );
}
