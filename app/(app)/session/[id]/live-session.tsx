"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { GradeChip } from "@/components/climbing/grade-chip";
import { MediaUploader } from "@/components/climbing/media-uploader";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import {
  correctAttempt,
  createProblem,
  deleteLatestAttempt,
  endSession,
  logAttempt,
  updateProblem,
} from "@/lib/actions/sessions";
import { countActivity, type AttemptFact } from "@/lib/analytics";
import {
  STYLE_TAGS,
  WALL_ANGLES,
  isSend,
  type AttemptResult,
  type GradeSystem,
  type StyleTag,
  type WallAngle,
} from "@/lib/climbing/types";
import { listGrades } from "@/lib/grading";
import { fmt } from "@/lib/i18n";
import type { Tables } from "@/lib/supabase/database.types";

type Attempt = Tables<"attempts">;
export type LiveProblemItem = {
  id: string;
  native_grade: string;
  wall_angle: WallAngle;
  tags: StyleTag[];
  created_at: string;
  name: string | null;
};

function elapsed(startedAt: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveSession({
  sessionId,
  userId,
  gym,
  startedAt,
  initialProblems,
  initialAttempts,
  projectProblemIds,
}: {
  sessionId: string;
  userId: string;
  gym: { id: string; name: string; system: GradeSystem };
  startedAt: string;
  initialProblems: LiveProblemItem[];
  initialAttempts: Attempt[];
  projectProblemIds: string[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [problems, setProblems] = useState(initialProblems);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [currentId, setCurrentId] = useState<string | null>(() => {
    const last = [...initialAttempts].filter((a) => a.session_id === sessionId).at(-1);
    return last?.problem_id ?? null;
  });
  const [adding, setAdding] = useState(initialProblems.length === 0);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [flashPrompt, setFlashPrompt] = useState<Attempt | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sessionAttempts = useMemo(() => attempts.filter((a) => a.session_id === sessionId), [attempts, sessionId]);
  const stats = useMemo(
    () =>
      countActivity(
        sessionAttempts.map<AttemptFact>((a) => ({
          id: a.id,
          problemId: a.problem_id,
          sessionId: a.session_id,
          result: a.result,
          attemptNumber: a.attempt_number,
          createdAt: new Date(a.created_at),
        })),
      ),
    [sessionAttempts],
  );

  // Problems ordered by most recent activity in this session.
  const ordered = useMemo(() => {
    const lastTouch = new Map<string, number>();
    for (const p of problems) lastTouch.set(p.id, new Date(p.created_at).getTime());
    for (const a of sessionAttempts) lastTouch.set(a.problem_id, Math.max(lastTouch.get(a.problem_id) ?? 0, new Date(a.created_at).getTime()));
    return [...problems].sort((a, b) => (lastTouch.get(b.id) ?? 0) - (lastTouch.get(a.id) ?? 0));
  }, [problems, sessionAttempts]);

  const current = problems.find((p) => p.id === currentId) ?? null;
  const say = (tone: "ok" | "error", text: string) => setStatus({ tone, text });

  function addProblem(grade: string) {
    start(async () => {
      const res = await createProblem({ gymId: gym.id, nativeGrade: grade });
      if (!res.ok || !res.data) return say("error", t.common.unknownError);
      const p = res.data;
      setProblems((list) => [
        ...list,
        { id: p.id, native_grade: p.native_grade, wall_angle: p.wall_angle, tags: [], created_at: p.created_at, name: p.name },
      ]);
      setCurrentId(p.id);
      setAdding(false);
      setFlashPrompt(null);
    });
  }

  function log(result: AttemptResult) {
    if (!current) return;
    const problemId = current.id;
    const nextNumber = Math.max(0, ...attempts.filter((a) => a.problem_id === problemId).map((a) => a.attempt_number)) + 1;
    if (result === "FLASH" && nextNumber > 1) return say("error", t.session.flashOnlyFirst);
    const temp: Attempt = {
      id: `temp-${crypto.randomUUID()}`,
      session_id: sessionId,
      problem_id: problemId,
      user_id: userId,
      attempt_number: nextNumber,
      result,
      created_at: new Date().toISOString(),
      notes: null,
      perceived_difficulty: null,
      started_at: null,
    };
    setAttempts((list) => [...list, temp]); // optimistic: instant feedback
    setFlashPrompt(null);
    start(async () => {
      const res = await logAttempt({ sessionId, problemId, result });
      if (!res.ok || !res.data) {
        setAttempts((list) => list.filter((a) => a.id !== temp.id));
        return say("error", res.ok ? t.common.unknownError : res.error === "flashOnlyFirst" ? t.session.flashOnlyFirst : t.common.unknownError);
      }
      const saved = res.data.attempt;
      setAttempts((list) => list.map((a) => (a.id === temp.id ? saved : a)));
      say("ok", fmt(t.session.logged, { result: t.results[saved.result] }));
      if (res.data.suggestFlash) setFlashPrompt(saved);
    });
  }

  function markFlash(a: Attempt) {
    start(async () => {
      const res = await correctAttempt({ attemptId: a.id, result: "FLASH" });
      if (!res.ok || !res.data) return say("error", t.common.unknownError);
      const updated = res.data;
      setAttempts((list) => list.map((x) => (x.id === a.id ? updated : x)));
      setFlashPrompt(null);
      say("ok", fmt(t.session.logged, { result: t.results.FLASH }));
    });
  }

  function undo() {
    if (!current) return;
    const latest = attempts
      .filter((a) => a.problem_id === current.id && a.session_id === sessionId && !a.id.startsWith("temp-"))
      .sort((a, b) => b.attempt_number - a.attempt_number)[0];
    if (!latest) return;
    start(async () => {
      const res = await deleteLatestAttempt(latest.id);
      if (!res.ok) return say("error", t.common.unknownError);
      setAttempts((list) => list.filter((a) => a.id !== latest.id));
      setFlashPrompt(null);
      say("ok", t.session.undone);
    });
  }

  function patchCurrent(patch: { wallAngle?: WallAngle; tags?: StyleTag[] }) {
    if (!current) return;
    const id = current.id;
    setProblems((list) =>
      list.map((p) =>
        p.id === id ? { ...p, wall_angle: patch.wallAngle ?? p.wall_angle, tags: patch.tags ?? p.tags } : p,
      ),
    );
    start(async () => {
      const res = await updateProblem({ problemId: id, ...patch });
      if (!res.ok) say("error", t.common.unknownError);
    });
  }

  function finish() {
    start(async () => {
      const res = await endSession(sessionId);
      if (!res.ok) return say("error", t.common.unknownError);
      router.refresh();
    });
  }

  const currentAttempts = current ? attempts.filter((a) => a.problem_id === current.id) : [];
  const currentSessionAttempts = currentAttempts.filter((a) => a.session_id === sessionId);
  const canFlash = current !== null && currentAttempts.length === 0;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-ok">● {t.session.active}</p>
        <h1 className="mt-1 text-xl font-black leading-tight">{gym.name}</h1>
        <p className="font-mono text-3xl font-bold tabular-nums" aria-label={t.session.elapsed}>
          {elapsed(startedAt, now)}
        </p>
        <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
          {(
            [
              [stats.problems, t.session.problems],
              [stats.tops, t.session.tops],
              [stats.flashes, t.session.flashes],
              [stats.attempts, t.session.attempts],
            ] as const
          ).map(([v, label]) => (
            <div key={label} className="rounded-xl bg-surface-2 py-2">
              <dt className="sr-only">{label}</dt>
              <dd className="text-2xl font-black tabular-nums leading-none">{v}</dd>
              <dd aria-hidden className="mt-1 text-[11px] uppercase tracking-wide text-ink-3">
                {label}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <p aria-live="polite" className={cn("min-h-5 text-sm", status?.tone === "error" ? "text-danger" : "text-ink-2")}>
        {status?.text}
      </p>

      {current && !adding ? (
        <section aria-label={t.session.current} className="rounded-3xl border-2 border-ink/80 bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <GradeChip t={t} system={gym.system} grade={current.native_grade} size="lg" />
            <AttemptDots attempts={currentSessionAttempts} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button size="xl" variant="secondary" onClick={() => log("ATTEMPT")} aria-label={t.results.ATTEMPT}>
              {t.results.try}
            </Button>
            <Button size="xl" onClick={() => log("TOP")} aria-label={t.results.TOP}>
              {t.results.top}
            </Button>
            <Button
              size="xl"
              onClick={() => log("FLASH")}
              disabled={!canFlash}
              aria-label={t.results.FLASH}
              className="bg-ink! text-bg!"
            >
              {t.results.flash}
            </Button>
          </div>
          {flashPrompt && flashPrompt.problem_id === current.id ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-accent-soft p-3 text-sm">
              <span>{t.session.suggestFlash}</span>
              <Button onClick={() => markFlash(flashPrompt)} disabled={pending}>
                {t.session.markFlash}
              </Button>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {currentSessionAttempts.length > 0 ? (
              <Button variant="ghost" onClick={undo} disabled={pending}>
                ↶ {t.session.undo}
              </Button>
            ) : null}
            <MediaUploader
              userId={userId}
              problemId={current.id}
              sessionId={sessionId}
              compact
              onUploaded={() => say("ok", "✓")}
            />
            <Link href={`/problem/${current.id}`} className="ml-auto text-sm text-accent underline-offset-2 hover:underline">
              {t.session.viewProblem}
            </Link>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink-2">{t.session.optionalDetails}</summary>
            <div className="mt-3 space-y-3">
              <ChipRow
                label={t.session.wallAngle}
                options={WALL_ANGLES.filter((a) => a !== "UNKNOWN").map((a) => ({ value: a, label: t.wallAngles[a] }))}
                selected={[current.wall_angle]}
                onToggle={(a) => patchCurrent({ wallAngle: current.wall_angle === a ? "UNKNOWN" : (a as WallAngle) })}
              />
              <ChipRow
                label={t.session.styles}
                options={STYLE_TAGS.map((s) => ({ value: s, label: t.styles[s] }))}
                selected={current.tags}
                onToggle={(s) =>
                  patchCurrent({
                    tags: current.tags.includes(s as StyleTag)
                      ? current.tags.filter((x) => x !== s)
                      : [...current.tags, s as StyleTag],
                  })
                }
              />
            </div>
          </details>
        </section>
      ) : null}

      {adding ? (
        <GradeGrid system={gym.system} onPick={addProblem} onCancel={problems.length ? () => setAdding(false) : undefined} pending={pending} />
      ) : (
        <Button size="xl" variant="secondary" className="w-full border-2 border-dashed border-line" onClick={() => setAdding(true)}>
          + {t.session.addProblem}
        </Button>
      )}

      {ordered.length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>{t.session.recent}</SectionTitle>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {ordered.map((p) => {
              const pa = attempts.filter((a) => a.problem_id === p.id && a.session_id === sessionId);
              const sent = pa.find((a) => isSend(a.result));
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentId(p.id);
                      setAdding(false);
                    }}
                    aria-current={p.id === currentId ? "true" : undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 px-4 text-left",
                      p.id === currentId && "bg-surface-2",
                    )}
                  >
                    <span className="w-32 shrink-0">
                      <GradeChip t={t} system={gym.system} grade={p.native_grade} size="sm" />
                    </span>
                    <AttemptDots attempts={pa} />
                    <span className="ml-auto text-xs font-bold uppercase tracking-wider">
                      {sent ? t.results[pa.some((a) => a.result === "FLASH") ? "FLASH" : "TOP"] : ""}
                      {projectProblemIds.includes(p.id) ? <span className="ml-2 text-accent">★</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-ink-2">{t.session.emptyLive}</p>
      )}

      <div className="pt-4">
        {confirmEnd ? (
          <div className="space-y-2 rounded-2xl border border-line p-4">
            <p className="font-semibold">{t.session.endConfirm}</p>
            <div className="flex gap-2">
              <Button size="lg" className="flex-1" onClick={finish} disabled={pending}>
                {pending ? t.session.ending : t.session.end}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setConfirmEnd(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="lg" variant="danger" className="w-full" onClick={() => setConfirmEnd(true)}>
            {t.session.end}
          </Button>
        )}
      </div>
    </div>
  );
}

function AttemptDots({ attempts }: { attempts: Attempt[] }) {
  const { t } = useI18n();
  if (attempts.length === 0) return null;
  const label = attempts.map((a) => t.results[a.result]).join(", ");
  return (
    <span className="flex flex-wrap items-center gap-1" role="img" aria-label={label}>
      {attempts.map((a) => (
        <span
          key={a.id}
          className={cn(
            "inline-block h-2.5 w-2.5 rounded-full",
            a.result === "ATTEMPT" ? "bg-ink-3" : a.result === "TOP" ? "bg-accent" : "bg-ink ring-2 ring-accent",
          )}
        />
      ))}
    </span>
  );
}

function GradeGrid({
  system,
  onPick,
  onCancel,
  pending,
}: {
  system: GradeSystem;
  onPick: (grade: string) => void;
  onCancel?: () => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const grades = listGrades(system);
  return (
    <section className="rounded-3xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{t.session.pickGrade}</h2>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        ) : null}
      </div>
      <div className={cn("grid gap-2", system === "FONT" ? "grid-cols-4" : "grid-cols-3")}>
        {grades.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={pending}
            onClick={() => onPick(g.id)}
            className="flex min-h-16 flex-col items-center justify-center rounded-2xl border border-line px-1 text-center font-bold disabled:opacity-50"
            style={g.swatch ? { backgroundColor: g.swatch, color: g.swatchText } : undefined}
          >
            <span className="text-sm uppercase tracking-wide">
              {system === "FONT" ? g.id : (t.grades.colors as Record<string, string>)[g.id]}
            </span>
            {g.kind === "MYSTERY" ? <span className="text-[11px] font-medium">{t.grades.mystery}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.value)}
              className={cn(
                "min-h-10 rounded-full border px-3 text-sm",
                on ? "border-accent bg-accent-soft font-semibold" : "border-line text-ink-2",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
