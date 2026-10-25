import Link from "next/link";
import { formatDuration } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { summarize, type TrainingExercise, type TrainingSession } from "@/lib/training/sessions";

function Tile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-surface-2 p-4">
    <p className="text-xs font-semibold text-ink-3">{label}</p>
    <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
  </div>;
}

/** Planned-versus-actual record of a finished (or interrupted) training session. */
export function SessionSummary({ locale, session, exercises }: { locale: Locale; session: TrainingSession; exercises: TrainingExercise[] }) {
  const t = trainingSessionDictionary(locale);
  const s = summarize(session, exercises);
  const fmtTarget = (e: TrainingExercise) => [
    e.targetSets ? `${e.targetSets} × ` : "",
    e.targetReps ? `${e.targetReps}` : "",
    e.targetSeconds ? (e.modality === "TIME" || e.modality === "FREE" ? `${Math.round(e.targetSeconds / 60)} min` : `${e.targetSeconds} s`) : "",
  ].join("").trim() || "—";
  const fmtActual = (e: TrainingExercise) => {
    const done = e.sets.filter((x) => x.completed);
    if (!done.length) return "—";
    return done.map((x) => [x.reps !== null ? String(x.reps) : null,
      x.seconds !== null ? (e.modality === "TIME" || e.modality === "FREE" ? `${Math.round(x.seconds / 60)} min` : `${x.seconds} s`) : null,
      x.loadKg !== null ? `${x.loadKg > 0 ? "+" : ""}${x.loadKg} kg` : null].filter(Boolean).join(" ")).join(" · ");
  };
  return <section aria-labelledby="summary-title" className="space-y-5">
    <h2 id="summary-title" className="text-xl font-black">{t.summary}</h2>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label={t.duration} value={exercises.length
        ? `${formatDuration(s.actualMinutes)}${s.plannedMinutes ? " / " + formatDuration(s.plannedMinutes) : ""}`
        : formatDuration(s.actualMinutes)} />
      {exercises.length ? <>
        <Tile label={t.exercisesDone} value={`${s.done + s.modified} / ${s.exercises}`} />
        <Tile label={t.setsDone} value={`${s.completedSets} / ${s.plannedSets}`} />
      </> : null}
      <Tile label={t.rpe.split(" (")[0]} value={session.rpe ? `${session.rpe} / 10` : "—"} />
    </div>
    {session.pain && session.pain > 0 ? <p role="note" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
      <strong>{t.painReported} : {session.pain}/10.</strong> {session.painNotes}
    </p> : null}
    {session.notes ? <section aria-label={t.descriptionTitle} className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="text-sm font-extrabold">{t.descriptionTitle}</h3>
      <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{session.notes}</p>
    </section> : null}
    {exercises.length ? <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">{t.plannedVsActual}</caption>
        <thead className="text-xs uppercase tracking-wider text-ink-3">
          <tr><th className="px-4 py-3">{t.exercises}</th><th className="px-4 py-3">{t.planned}</th><th className="px-4 py-3">{t.actual}</th><th className="px-4 py-3">Status</th></tr>
        </thead>
        <tbody>
          {exercises.map((e) => <tr key={e.id} className="border-t border-line align-top">
            <td className="px-4 py-3 font-semibold">{e.name}{e.methodId ? <> <Link className="text-xs text-accent underline" href={"/atlas/" + e.methodId}>Atlas</Link></> : null}</td>
            <td className="px-4 py-3 tabular-nums text-ink-2">{fmtTarget(e)}</td>
            <td className="px-4 py-3 tabular-nums">{fmtActual(e)}</td>
            <td className="px-4 py-3"><span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-bold text-accent">{t.exStatus[e.status]}</span></td>
          </tr>)}
        </tbody>
      </table>
    </div> : null}
    {session.climbingSessionId ? <Link className="inline-block text-sm font-bold text-accent underline underline-offset-4" href={"/session/" + session.climbingSessionId}>{t.linkClimb.split(" (")[0]} ↗</Link> : null}
  </section>;
}
