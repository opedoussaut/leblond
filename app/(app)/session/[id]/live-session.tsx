"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { isColorSystem } from "@/lib/grading/systems";
import { gradeSpokenLabel } from "@/lib/grading/labels";
import { QuickBoulderEntry, type QuickChoice } from "./quick-boulder-entry";
import { ScaleSwitch } from "./scale-switch";
import { useBoulderLog, type Rejection } from "./use-boulder-log";
import { ResultBadge, boulderTone, toneButtonStyle, RESULT_TONES } from "@/components/climbing/result-badge";
import { loggingDictionary } from "@/lib/i18n/logging";
import { fontRangeFor, formatFontRange } from "@/lib/grading/conversions";
import { GradeChip } from "@/components/climbing/grade-chip";
import { MediaUploader } from "@/components/climbing/media-uploader";
import {
  BoolderProblemPicker,
  CircuitBadge,
  CircuitTag,
  areaWarning,
  type AreaItem,
  type CatalogueItem,
} from "@/components/climbing/outdoor";
import { useI18n } from "@/components/i18n-provider";
import { Select, fieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { countActivity, type AttemptFact } from "@/lib/analytics";
import {
  canFlash as canFlashOn,
  nextAttemptNumber,
  removeProblems,
  type Attempt,
  type KnownBoulder,
  type LiveProblemItem,
  type NewBoulderOp,
} from "@/lib/climbing/offline-session";
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
import { fmt, plural } from "@/lib/i18n";

export type { LiveProblemItem };
type Outcome = "FLASH" | "TOP" | "ATTEMPT" | "PROJECT";

/** The tries of a boulder logged in one step: tries − 1 misses, then the outcome. */
function triesFor(tries: number, outcome: Outcome): Array<{ id: string; result: AttemptResult }> {
  return Array.from({ length: tries }, (_, j) => ({
    id: crypto.randomUUID(),
    result: j === tries - 1 && (outcome === "FLASH" || outcome === "TOP") ? outcome : "ATTEMPT",
  }));
}

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
  projectsOpenedHere = [],
  outdoor = null,
  known = {},
  renderedAt,
  mode = "live",
}: {
  sessionId: string;
  userId: string;
  /** `system`: the scale this session logs new boulders in; `systems`: all the gym's scales (current first). */
  gym: { id: string; name: string; system: GradeSystem; systems?: GradeSystem[]; outdoor?: boolean };
  startedAt: string;
  initialProblems: LiveProblemItem[];
  initialAttempts: Attempt[];
  projectProblemIds: string[];
  /** Boulders whose project was opened in this session. */
  projectsOpenedHere?: string[];
  /** Set when the session is in a Fontainebleau area from the Boolder catalogue. */
  outdoor?: { area: AreaItem; problems: CatalogueItem[] } | null;
  /** Topo id → the climber's boulder there, tried in another session (outdoor). */
  known?: Record<string, KnownBoulder>;
  /** When the server made the page: tells fresh data from the copy kept for use without signal. */
  renderedAt: string;
  /** "edit": filling in or correcting a finished session — no timer, no end button. */
  mode?: "live" | "edit";
}) {
  const { t, locale } = useI18n();
  const L = loggingDictionary(locale);
  const logger = useBoulderLog({
    sessionId, userId, gymName: gym.name, renderedAt, live: mode === "live",
    server: {
      problems: initialProblems, attempts: initialAttempts, projectIds: projectProblemIds, openedHere: projectsOpenedHere,
      scale: gym.system, endedAt: null, known,
    },
  });
  const { state } = logger;
  const { problems, attempts, projectIds, openedHere, scale } = state;
  const ctx = { sessionId, userId };
  const [currentId, setCurrentId] = useState<string | null>(() => {
    const last = [...initialAttempts].filter((a) => a.session_id === sessionId).at(-1);
    return last?.problem_id ?? null;
  });
  const [adding, setAdding] = useState(initialProblems.length === 0);
  // Outdoor: pick from the topo by default; the grade grid is the fallback.
  const [gradeFallback, setGradeFallback] = useState(false);
  const catalogue = useMemo(() => new Map((outdoor?.problems ?? []).map((p) => [p.id, p])), [outdoor]);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  /** A top on try 1 just logged: offer to make it a flash. */
  const [flashPromptId, setFlashPromptId] = useState<string | null>(null);
  const flashPrompt = flashPromptId ? attempts.find((a) => a.id === flashPromptId) ?? null : null;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [quick, setQuick] = useState(false);
  const projectLabel = (problemId: string) => (openedHere.includes(problemId) ? L.projectHere : L.project);
  const [bulkTries, setBulkTries] = useState(2);
  const [commentDraft, setCommentDraft] = useState<string | null>(null);
  // A topo boulder being added in one step, and what was added last.
  const [picked, setPicked] = useState<CatalogueItem | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  // Several boulders taken out at once.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmMany, setConfirmMany] = useState(false);
  // The scale new boulders are logged in; existing boulders keep their own.
  const scales = gym.systems ?? [gym.system];

  /** Applies changes on screen and queues them for the server; says why when they are refused. */
  function run(ops: NewBoulderOp[]): boolean {
    const error = logger.enqueue(ops);
    if (error) {
      say("error", error === "flashOnlyFirst" ? t.session.flashOnlyFirst : t.common.unknownError);
      return false;
    }
    return true;
  }

  function switchScale(next: GradeSystem) {
    run([{ kind: "scale", system: next }]);
  }

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

  // What this session holds, apart from the projects opened elsewhere and not tried here yet.
  const touchedHere = useMemo(() => new Set(sessionAttempts.map((a) => a.problem_id)), [sessionAttempts]);
  const inSession = useMemo(
    () => ordered.filter((p) => touchedHere.has(p.id) || !projectIds.includes(p.id) || openedHere.includes(p.id)),
    [ordered, touchedHere, projectIds, openedHere],
  );
  const otherProjects = useMemo(() => ordered.filter((p) => !inSession.includes(p)), [ordered, inSession]);
  /** Topo boulders already in this session → tries logged here (marked in the topo list). */
  const inSessionTopo = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of inSession) if (p.outdoor_problem_id != null) m.set(p.outdoor_problem_id, sessionAttempts.filter((a) => a.problem_id === p.id).length);
    return m;
  }, [inSession, sessionAttempts]);
  const tagOf = (p: LiveProblemItem) => {
    if (!gym.outdoor) return null;
    const item = p.outdoor_problem_id != null ? catalogue.get(p.outdoor_problem_id) : undefined;
    return <CircuitTag color={item?.circuit_color ?? null} number={item?.circuit_number ?? null} inTopo={item !== undefined} />;
  };

  // Outdoor boulder outside the topo: optional name and sector, typed before the grade (the sector is kept for the next one).
  const [manual, setManual] = useState({ name: "", sector: "" });
  const current = problems.find((p) => p.id === currentId) ?? null;
  const say = (tone: "ok" | "error", text: string) => setStatus({ tone, text });

  function addProblem(grade: string) {
    const id = crypto.randomUUID();
    const extra = gym.outdoor
      ? { ...(manual.name.trim() ? { name: manual.name.trim() } : {}), ...(manual.sector.trim() ? { sector: manual.sector.trim() } : {}) }
      : {};
    if (!run([{ kind: "createProblem", problemId: id, grade, system: scale, ...extra }])) return;
    setCurrentId(id);
    setAdding(false);
    setFlashPromptId(null);
    setManual({ name: "", sector: manual.sector });
  }

  /** A topo boulder was chosen: ask for its grade, tries and result. */
  function pickFromTopo(item: CatalogueItem) {
    setPicked(item);
    setLastAdded(null);
  }

  /** The climber's boulder for a topo boulder: already listed, tried in another session, or new. */
  function topoProblem(item: CatalogueItem): { id: string; listed: boolean; grade: string | null } {
    const listed = problems.find((p) => p.outdoor_problem_id === item.id);
    if (listed) return { id: listed.id, listed: true, grade: listed.native_grade };
    const before = state.known[String(item.id)];
    return { id: before?.id ?? crypto.randomUUID(), listed: false, grade: before?.grade ?? null };
  }
  const pickOp = (item: CatalogueItem, problemId: string): NewBoulderOp => ({
    kind: "pickTopo", problemId, outdoorProblemId: item.id, name: item.name, grade: item.grade,
  });

  /** Adds the topo boulder with its tries and result in one go; the topo stays open for the next one. */
  function addFromTopo(item: CatalogueItem, choice: { grade: string; outcome: Outcome; tries: number }) {
    const target = topoProblem(item);
    const ops: NewBoulderOp[] = [];
    if (!target.listed) ops.push(pickOp(item, target.id));
    if (choice.grade !== (target.grade ?? item.grade)) ops.push({ kind: "updateProblem", problemId: target.id, nativeGrade: choice.grade });
    ops.push({ kind: "attempts", problemId: target.id, items: triesFor(choice.tries, choice.outcome) });
    const newProject = choice.outcome === "PROJECT" && !projectIds.includes(target.id);
    if (choice.outcome === "PROJECT") ops.push({ kind: "project", problemId: target.id });
    if (!run(ops)) return;
    setCurrentId(target.id);
    setPicked(null);
    setFlashPromptId(null);
    const what =
      choice.outcome === "FLASH"
        ? L.flash
        : choice.outcome === "TOP"
          ? choice.tries === 1 ? L.top : fmt(L.topIn, { n: choice.tries })
          : plural(locale, choice.tries, choice.outcome === "PROJECT"
            ? { one: L.projectTriesOne, other: L.projectTriesOther }
            : { one: L.notSentOne, other: L.notSentOther });
    const text = fmt(L.topoAdded, { name: item.name, what }) + (newProject ? " " + L.projectLinked : "");
    setLastAdded(text);
    say("ok", text);
  }

  /** The former behaviour: select the boulder and log it try by try. */
  function selectFromTopo(item: CatalogueItem) {
    setPicked(null);
    const target = topoProblem(item);
    if (!target.listed && !run([pickOp(item, target.id)])) return;
    setCurrentId(target.id);
    setAdding(false);
    setFlashPromptId(null);
  }

  function log(result: AttemptResult) {
    if (!current) return;
    const id = crypto.randomUUID();
    const first = nextAttemptNumber(state, current.id) === 1;
    if (!run([{ kind: "attempts", problemId: current.id, items: [{ id, result }] }])) return;
    setFlashPromptId(result === "TOP" && first ? id : null);
    say("ok", fmt(t.session.logged, { result: t.results[result] }));
  }

  /** Record several unsuccessful tries on the current problem in one tap. */
  function logTries(n: number) {
    if (!current) return;
    const items = Array.from({ length: n }, () => ({ id: crypto.randomUUID(), result: "ATTEMPT" as const }));
    if (!run([{ kind: "attempts", problemId: current.id, items }])) return;
    say("ok", fmt(L.triesShort, { n }) + " ✓");
  }

  function makeProject() {
    if (!current) return;
    if (run([{ kind: "project", problemId: current.id }])) say("ok", L.projectSavedHere);
  }

  function saveComment() {
    if (!current || commentDraft === null) return;
    const notes = commentDraft.trim();
    setCommentDraft(null);
    if (run([{ kind: "updateProblem", problemId: current.id, notes: notes || null }])) say("ok", L.saved);
  }

  /** Several boulders of one grade, each with its tries and outcome (quick entry). */
  function quickAdd(c: QuickChoice): boolean {
    const ops: NewBoulderOp[] = [];
    for (let i = 0; i < c.count; i++) {
      const id = crypto.randomUUID();
      ops.push({ kind: "createProblem", problemId: id, grade: c.grade, system: scale, ...(c.notes.trim() ? { notes: c.notes.trim() } : {}) });
      ops.push({ kind: "attempts", problemId: id, items: triesFor(c.outcome === "FLASH" ? 1 : c.tries, c.outcome) });
      if (c.outcome === "PROJECT") ops.push({ kind: "project", problemId: id });
    }
    return run(ops);
  }

  function markFlash(a: Attempt) {
    if (!run([{ kind: "correctAttempt", attemptId: a.id, result: "FLASH" }])) return;
    setFlashPromptId(null);
    say("ok", fmt(t.session.logged, { result: t.results.FLASH }));
  }

  function undo() {
    if (!current) return;
    const latest = attempts
      .filter((a) => a.problem_id === current.id && a.session_id === sessionId)
      .sort((a, b) => b.attempt_number - a.attempt_number)[0];
    if (!latest) return;
    if (!run([{ kind: "deleteAttempt", attemptId: latest.id }])) return;
    setFlashPromptId(null);
    say("ok", t.session.undone);
  }

  /** Takes the current boulder out of this session (logged by mistake). */
  function removeCurrent() {
    if (!current) return;
    const problemId = current.id;
    // Same rules as the database: what will be deleted with it, for the message.
    const { problemsDeleted, projectsDeleted } = removeProblems(state, [problemId], ctx);
    if (!run([{ kind: "remove", problemIds: [problemId] }])) return;
    setCurrentId(null);
    setFlashPromptId(null);
    setConfirmRemoveId(null);
    say("ok", projectsDeleted.includes(problemId) ? L.removedWithProject : problemsDeleted.includes(problemId) ? L.removedDeleted : L.removed);
  }

  /** Takes the selected boulders out of this session, all or nothing. */
  function removeSelected() {
    const ids = selected.filter((pid) => inSession.some((p) => p.id === pid));
    if (!ids.length) return;
    if (!run([{ kind: "remove", problemIds: ids }])) return;
    if (currentId && ids.includes(currentId)) setCurrentId(null);
    setFlashPromptId(null);
    setSelected([]);
    setSelecting(false);
    setConfirmMany(false);
    say("ok", fmt(plural(locale, ids.length, { one: L.removedManyOne, other: L.removedManyOther }), { n: ids.length }));
  }

  function patchCurrent(patch: { wallAngle?: WallAngle; tags?: StyleTag[] }) {
    if (!current) return;
    run([{ kind: "updateProblem", problemId: current.id, ...patch }]);
  }

  function finish() {
    if (run([{ kind: "end" }])) setConfirmEnd(false);
  }

  function openProblem(problemId: string) {
    setCurrentId(problemId);
    setAdding(false);
    setPicked(null);
    setLastAdded(null);
  }

  const syncBar = <SyncBar log={logger} L={L} locale={locale} />;

  // Ended on this phone, not stored yet: nothing more to log, only to send.
  if (mode === "live" && state.endedAt) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-black leading-tight">{gym.name}</h1>
        <p className="rounded-2xl bg-surface-2 p-4 font-semibold">
          {fmt(logger.online ? L.endedSaving : L.endedOffline, { time: new Date(state.endedAt).toLocaleTimeString(locale === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit" }) })}
        </p>
        {syncBar}
      </div>
    );
  }

  /** One boulder in the lists: grade, circuit (outdoor), name, this session's tries and badges. */
  function problemRow(p: LiveProblemItem) {
    const pa = sessionAttempts.filter((a) => a.problem_id === p.id);
    const sent = pa.find((a) => isSend(a.result));
    const flashed = pa.some((a) => a.result === "FLASH");
    return <>
      <span className={cn("shrink-0", gym.outdoor ? "w-12" : "w-32")}>
        <GradeChip t={t} system={p.native_grade_system ?? gym.system} grade={p.native_grade} size="sm" showFont />
      </span>
      {gym.outdoor ? (
        <span className="flex min-w-0 items-center gap-2">
          {tagOf(p)}
          {p.name ? <span className="truncate text-sm">{p.name}</span> : null}
        </span>
      ) : null}
      <AttemptDots attempts={pa} />
      <span className="ml-auto text-xs font-bold uppercase tracking-[0.12em]">
        {sent ? <ResultBadge tone={flashed ? "flash" : "top"} label={t.results[flashed ? "FLASH" : "TOP"]} /> : null}
        {projectIds.includes(p.id) ? <ResultBadge tone="project" label={projectLabel(p.id)} className="ml-1" /> : null}
      </span>
    </>;
  }

  const currentAttempts = current ? attempts.filter((a) => a.problem_id === current.id) : [];
  const currentSessionAttempts = currentAttempts.filter((a) => a.session_id === sessionId);
  // A topo boulder tried in another session cannot be flashed any more.
  const canFlash = current !== null && canFlashOn(state, current.id);
  const pickedListed = picked ? problems.find((p) => p.outdoor_problem_id === picked.id) ?? null : null;
  const pickedBefore = picked ? state.known[String(picked.id)] ?? null : null;
  // Boulders made on this phone and not on the server yet: no photo, no link to their page.
  const currentUnsent = current !== null && logger.unsentProblems.has(current.id);

  return (
    <div className="space-y-5">
      <header>
        {mode === "live" ? <>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ok">● {t.session.active}</p>
          <h1 className="mt-1 text-xl font-black leading-tight">{gym.name}</h1>
        </> : <h2 className="text-lg font-black leading-tight">{gym.name}</h2>}
        {outdoor && areaWarning(outdoor.area, locale) ? (
          <p className="mt-1 text-sm font-semibold text-danger">
            ⚠ {t.outdoor.warning} : {areaWarning(outdoor.area, locale)}
          </p>
        ) : null}
        {mode === "live" ? <p className="font-mono text-3xl font-bold tabular-nums" aria-label={t.session.elapsed}>
          {elapsed(startedAt, now)}
        </p> : null}
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
              <dd aria-hidden className="mt-1 text-xs uppercase tracking-[0.12em] text-ink-3">
                {label}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {syncBar}
      <p aria-live="polite" className={cn("min-h-5 text-sm", status?.tone === "error" ? "text-danger" : "text-ink-2")}>
        {status?.text}
      </p>

      {current && !adding ? (
        <section aria-label={t.session.current} className="rounded-2xl border-2 border-ink/80 bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <GradeChip t={t} system={current.native_grade_system ?? gym.system} grade={current.native_grade} size="lg" showFont />
            <AttemptDots attempts={currentSessionAttempts} />
          </div>
          {current.outdoor_problem_id != null ? (
            <TopoLine item={catalogue.get(current.outdoor_problem_id)} fallbackName={current.name} />
          ) : current.name || gym.outdoor ? (
            <p className="mt-1 flex min-w-0 items-center gap-2 text-sm">
              {tagOf(current)}
              {current.name ? <span className="truncate font-semibold">{current.name}</span> : null}
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button size="xl" variant="secondary" onClick={() => log("ATTEMPT")} aria-label={t.results.ATTEMPT}>
              {t.results.try}
            </Button>
            <Button size="xl" onClick={() => log("TOP")} aria-label={t.results.TOP} style={toneButtonStyle("top")}>
              ✓ {t.results.top}
            </Button>
            <Button
              size="xl"
              onClick={() => log("FLASH")}
              disabled={!canFlash}
              aria-label={t.results.FLASH}
              style={toneButtonStyle("flash")}
            >
              ⚡ {t.results.flash}
            </Button>
          </div>
          {flashPrompt && flashPrompt.problem_id === current.id && flashPrompt.attempt_number === 1 ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-accent-soft p-3 text-sm">
              <span>{t.session.suggestFlash}</span>
              <Button onClick={() => markFlash(flashPrompt)}>
                {t.session.markFlash}
              </Button>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-2">
            <span className="text-sm font-semibold">{L.tries}</span>
            <button type="button" aria-label={L.tries + " −"} disabled={bulkTries <= 2} onClick={() => setBulkTries((n) => Math.max(2, n - 1))}
              className="h-10 w-10 rounded-full border border-line bg-surface font-bold disabled:opacity-40">−</button>
            <span className="w-6 text-center font-black tabular-nums">{bulkTries}</span>
            <button type="button" aria-label={L.tries + " +"} disabled={bulkTries >= 20} onClick={() => setBulkTries((n) => Math.min(20, n + 1))}
              className="h-10 w-10 rounded-full border border-line bg-surface font-bold disabled:opacity-40">+</button>
            <Button variant="secondary" onClick={() => logTries(bulkTries)}>{fmt(L.logTries, { n: bulkTries })}</Button>
            {projectIds.includes(current.id)
              ? <Link href="/projects" className="ml-auto" title={L.seeProjects}>
                  <ResultBadge tone="project" label={projectLabel(current.id)} />
                </Link>
              : <button type="button" onClick={makeProject} style={toneButtonStyle("project")}
                  className="ml-auto min-h-11 rounded-full border px-3 text-sm font-bold">{L.markProject}</button>}
          </div>
          <div className="mt-3">
            {commentDraft !== null ? <div className="flex gap-2">
              <input value={commentDraft} maxLength={2000} autoFocus aria-label={L.comment} placeholder={L.commentPlaceholder}
                onChange={(ev) => setCommentDraft(ev.target.value)}
                className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-sm" />
              <Button onClick={saveComment}>{L.save}</Button>
            </div> : <>
              {current.notes ? <p className="text-sm italic text-ink-2">“{current.notes}”</p> : null}
              <button type="button" onClick={() => setCommentDraft(current.notes ?? "")}
                className="text-sm font-bold text-accent underline underline-offset-2">{current.notes ? L.editComment : L.addComment}</button>
            </>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {currentSessionAttempts.length > 0 ? (
              <Button variant="ghost" onClick={undo}>
                ↶ {t.session.undo}
              </Button>
            ) : null}
            {logger.online && !currentUnsent ? (
              <MediaUploader
                userId={userId}
                problemId={current.id}
                sessionId={sessionId}
                compact
                onUploaded={() => say("ok", "✓")}
              />
            ) : !logger.online ? (
              <span className="text-xs text-ink-3">{L.needsNetwork}</span>
            ) : null}
            {currentUnsent ? null : (
              <Link href={`/problem/${current.id}`} className="ml-auto text-sm text-accent underline-offset-2 hover:underline">
                {t.session.viewProblem}
              </Link>
            )}
          </div>
          {confirmRemoveId === current.id ? (
            <div className="mt-3 space-y-2 rounded-xl border border-danger p-3">
              <p className="text-sm font-semibold">{L.removeTitle}</p>
              <p className="text-sm text-ink-2">
                {currentSessionAttempts.length === 0
                  ? L.removeNoTries
                  : plural(locale, currentSessionAttempts.length, { one: L.removeTriesOne, other: L.removeTriesOther })}{" "}
                {currentAttempts.length > currentSessionAttempts.length
                  ? L.removeKeepsOthers
                  : openedHere.includes(current.id)
                    ? L.removeDeletesProject
                    : projectIds.includes(current.id)
                      ? L.removeKeepsProject
                      : L.removeDeletes}
              </p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={removeCurrent}>
                  {L.removeConfirm}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRemoveId(null)}>
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmRemoveId(current.id)}
              className="mt-3 min-h-11 text-sm font-bold text-danger underline underline-offset-2">
              {L.removeFromSession}
            </button>
          )}
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

      {picked ? (
        <TopoQuickAdd
          key={picked.id}
          item={picked}
          currentGrade={pickedListed?.native_grade ?? pickedBefore?.grade ?? null}
          priorTries={pickedListed ? nextAttemptNumber(state, pickedListed.id) - 1 : pickedBefore?.lastNumber ?? 0}
          pending={false}
          onAdd={(choice) => addFromTopo(picked, choice)}
          onOneByOne={() => selectFromTopo(picked)}
          onCancel={() => setPicked(null)}
        />
      ) : null}
      {adding && outdoor && outdoor.problems.length > 0 && !gradeFallback ? (
        // Kept mounted under the form so the search, filters and map stay as they were.
        <div hidden={picked !== null} className="space-y-2">
          {lastAdded ? (
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold">✓ {lastAdded}</p>
          ) : null}
          <BoolderProblemPicker
            problems={outdoor.problems}
            source={outdoor.area.source}
            credit={outdoor.area.credit}
            pending={false}
            onPick={pickFromTopo}
            inSession={inSessionTopo}
            offline={!logger.online}
            onCancel={problems.length ? () => { setAdding(false); setLastAdded(null); } : undefined}
            onNotInTopo={() => setGradeFallback(true)}
          />
        </div>
      ) : adding ? (
        <div className="space-y-2">
          {gym.outdoor ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-semibold">{t.problem.name}
                <input className={fieldClass} maxLength={120} value={manual.name} placeholder={t.common.optional}
                  onChange={(e) => setManual({ ...manual, name: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">{t.problem.sector}
                <input className={fieldClass} maxLength={80} value={manual.sector} placeholder={t.common.optional}
                  onChange={(e) => setManual({ ...manual, sector: e.target.value })} />
              </label>
            </div>
          ) : null}
          {gym.outdoor ? null : <ScaleSwitch systems={scales} value={scale} onChange={switchScale} pending={false} />}
          <GradeGrid system={scale} onPick={addProblem} onCancel={problems.length ? () => setAdding(false) : undefined} pending={false} />
          {outdoor && outdoor.problems.length > 0 ? (
            <button type="button" onClick={() => setGradeFallback(false)} className="text-sm text-accent underline-offset-2 hover:underline">
              ← {t.outdoor.backToTopo}
            </button>
          ) : null}
        </div>
      ) : (
        <Button size="xl" variant="secondary" className="w-full border-2 border-dashed border-line" onClick={() => setAdding(true)}>
          + {t.session.addProblem}
        </Button>
      )}
      {quick ? (
        <div className="space-y-2">
          {gym.outdoor ? null : <ScaleSwitch systems={scales} value={scale} onChange={switchScale} pending={false} />}
          <QuickBoulderEntry key={scale} system={scale} onSubmit={quickAdd} onClose={() => setQuick(false)} />
        </div>
      ) : (
        <Button size="lg" variant="secondary" className="w-full" onClick={() => { setQuick(true); setAdding(false); }}>
          ⚡ {L.quickTitle}
        </Button>
      )}

      {inSession.length > 0 ? (
        <section className="space-y-2" aria-labelledby="in-session-title">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle><span id="in-session-title">{L.inSessionTitle} · {inSession.length}</span></SectionTitle>
            <button type="button" aria-pressed={selecting}
              onClick={() => { setSelecting((on) => !on); setSelected([]); setConfirmMany(false); }}
              className="min-h-11 rounded-full px-3 text-sm font-bold text-accent underline underline-offset-2">
              {selecting ? L.selectDone : L.select}
            </button>
          </div>
          {selecting ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-2 text-sm">
              <span className="font-semibold" aria-live="polite">
                {fmt(plural(locale, selected.length, { one: L.selectedOne, other: L.selectedOther }), { n: selected.length })}
              </span>
              <button type="button" onClick={() => setSelected(inSession.map((p) => p.id))}
                className="min-h-11 px-2 font-bold text-accent underline underline-offset-2">{L.selectAll}</button>
              <Button variant="danger" className="ml-auto" disabled={selected.length === 0} onClick={() => setConfirmMany(true)}>
                {fmt(L.removeSelected, { n: selected.length })}
              </Button>
            </div>
          ) : null}
          {selecting && confirmMany ? (
            <div role="alertdialog" aria-labelledby="remove-many-title" className="space-y-2 rounded-xl border border-danger p-3">
              <p id="remove-many-title" className="text-sm font-semibold">
                {fmt(plural(locale, selected.length, { one: L.removeManyOne, other: L.removeManyOther }), { n: selected.length })}
              </p>
              <p className="text-sm text-ink-2">{L.removeManyBody}</p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={removeSelected}>{L.removeConfirm}</Button>
                <Button variant="ghost" onClick={() => setConfirmMany(false)}>{t.common.cancel}</Button>
              </div>
            </div>
          ) : null}
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {inSession.map((p) => {
              const content = problemRow(p);
              const isOn = selected.includes(p.id);
              return (
                <li key={p.id}>
                  {selecting ? (
                    <label className={cn("flex min-h-14 w-full cursor-pointer items-center gap-3 px-4", isOn && "bg-surface-2")}>
                      <input type="checkbox" checked={isOn} className="h-5 w-5 shrink-0 accent-accent"
                        onChange={() => setSelected((list) => (list.includes(p.id) ? list.filter((x) => x !== p.id) : [...list, p.id]))} />
                      {content}
                    </label>
                  ) : (
                    <button type="button" onClick={() => openProblem(p.id)}
                      aria-current={p.id === currentId ? "true" : undefined}
                      className={cn("flex min-h-14 w-full items-center gap-3 px-4 text-left", p.id === currentId && "bg-surface-2")}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-ink-2">{t.session.emptyLive}</p>
      )}

      {otherProjects.length > 0 && !selecting ? (
        <section className="space-y-2" aria-labelledby="other-projects-title">
          <SectionTitle><span id="other-projects-title">★ {L.otherProjectsTitle}</span></SectionTitle>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {otherProjects.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => openProblem(p.id)}
                  aria-current={p.id === currentId ? "true" : undefined}
                  className={cn("flex min-h-14 w-full items-center gap-3 px-4 text-left", p.id === currentId && "bg-surface-2")}>
                  {problemRow(p)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {mode === "live" ? <div className="pt-4">
        {confirmEnd ? (
          <div className="space-y-2 rounded-2xl border border-line p-4">
            <p className="font-semibold">{t.session.endConfirm}</p>
            <div className="flex gap-2">
              <Button size="lg" className="flex-1" onClick={finish}>
                {t.session.end}
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
      </div> : null}
    </div>
  );
}

/**
 * A topo boulder in one step: the topo's grade or the climber's own, how it
 * ended and the number of tries. "Log try by try" keeps the former flow.
 */
function TopoQuickAdd({
  item,
  currentGrade,
  priorTries,
  pending,
  onAdd,
  onOneByOne,
  onCancel,
}: {
  item: CatalogueItem;
  /** The grade this boulder already has, when it was logged before. */
  currentGrade: string | null;
  /** Tries already logged on it (a flash is then impossible). */
  priorTries: number;
  pending: boolean;
  onAdd: (choice: { grade: string; outcome: Outcome; tries: number }) => void;
  onOneByOne: () => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const L = loggingDictionary(locale);
  const fontGrades = useMemo(() => listGrades("FONT").map((g) => g.id), []);
  const [own, setOwn] = useState(currentGrade !== null && currentGrade !== item.grade);
  const [ownGrade, setOwnGrade] = useState(currentGrade ?? (fontGrades.includes(item.grade) ? item.grade : "5a"));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [tries, setTries] = useState(1);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    box.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const canFlash = priorTries === 0;
  const n = outcome === "FLASH" ? 1 : tries;
  const outcomes: Array<{ value: Outcome; tone: "flash" | "top" | "attempt" | "project"; label: string }> = [
    { value: "FLASH", tone: "flash", label: L.flash },
    { value: "TOP", tone: "top", label: L.top },
    { value: "ATTEMPT", tone: "attempt", label: L.notSent },
    { value: "PROJECT", tone: "project", label: L.project },
  ];
  const choiceClass = (on: boolean) =>
    cn("min-h-11 rounded-full border px-3 text-sm", on ? "border-accent bg-accent-soft font-semibold" : "border-line text-ink-2");

  return (
    <section ref={box} aria-label={L.topoAddTitle} className="space-y-4 rounded-2xl border-2 border-accent bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0">
          <CircuitBadge color={item.circuit_color} number={item.circuit_number} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{item.name}</span>
          <span className="block text-xs text-ink-3">
            {(t.outdoor.steepness as Record<string, string>)[item.steepness] ?? item.steepness}
            {item.sit_start ? ` · ${t.outdoor.sitStart}` : ""}
          </span>
        </span>
        <span className="shrink-0 font-black tabular-nums">{item.grade}</span>
      </div>
      {priorTries > 0 ? (
        <p className="text-xs text-ink-2">{plural(locale, priorTries, { one: L.priorOne, other: L.priorOther })}</p>
      ) : null}

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{L.grade}</legend>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={!own} onClick={() => setOwn(false)} className={choiceClass(!own)}>
            {fmt(L.gradeTopo, { grade: item.grade })}
          </button>
          <button type="button" aria-pressed={own} onClick={() => setOwn(true)} className={choiceClass(own)}>
            {L.gradeMine}
          </button>
          {own ? (
            <Select aria-label={L.gradeMine} value={ownGrade} onChange={(e) => setOwnGrade(e.target.value)} className="w-28">
              {fontGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{L.outcome}</legend>
        <div className="grid grid-cols-2 gap-2">
          {outcomes.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={outcome === o.value}
              disabled={o.value === "FLASH" && !canFlash}
              onClick={() => setOutcome(o.value)}
              style={outcome === o.value ? toneButtonStyle(o.tone) : undefined}
              className={cn(
                "min-h-12 rounded-2xl border px-3 font-bold disabled:opacity-40",
                outcome === o.value ? "" : "border-line",
              )}
            >
              <span aria-hidden>{RESULT_TONES[o.tone].symbol} </span>
              {o.label}
            </button>
          ))}
        </div>
        {!canFlash ? <p className="mt-1 text-xs text-ink-3">{L.flashOnlyOne}</p> : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{L.tries}</span>
        <button type="button" aria-label={L.tries + " −"} disabled={n <= 1 || outcome === "FLASH"} onClick={() => setTries((x) => Math.max(1, x - 1))}
          className="h-10 w-10 rounded-full border border-line bg-surface font-bold disabled:opacity-40">−</button>
        <span className="w-8 text-center font-black tabular-nums" aria-live="polite">{n}</span>
        <button type="button" aria-label={L.tries + " +"} disabled={n >= 50 || outcome === "FLASH"} onClick={() => setTries((x) => Math.min(50, x + 1))}
          className="h-10 w-10 rounded-full border border-line bg-surface font-bold disabled:opacity-40">+</button>
        <span className="text-xs text-ink-3">{L.topoTriesHint}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          className="flex-1"
          disabled={pending || outcome === null}
          onClick={() => outcome && onAdd({ grade: own ? ownGrade : item.grade, outcome, tries: n })}
        >
          {L.add}
        </Button>
        <Button size="lg" variant="secondary" disabled={pending} onClick={onOneByOne}>
          {L.oneByOne}
        </Button>
        <Button size="lg" variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </section>
  );
}

function TopoLine({ item, fallbackName }: { item: CatalogueItem | undefined; fallbackName: string | null }) {
  const { t } = useI18n();
  if (!item) return (
    <p className="mt-1 flex min-w-0 items-center gap-2 text-sm">
      <CircuitTag color={null} number={null} inTopo={false} />
      {fallbackName ? <span className="truncate font-semibold">{fallbackName}</span> : null}
    </p>
  );
  return (
    <p className="mt-2 flex min-w-0 items-center gap-2 text-sm">
      <CircuitTag color={item.circuit_color} number={item.circuit_number} inTopo />
      <span className="truncate font-semibold">{item.name}</span>
      <span className="shrink-0 text-xs text-ink-3">
        {(t.outdoor.steepness as Record<string, string>)[item.steepness] ?? item.steepness}
        {item.sit_start ? ` · ${t.outdoor.sitStart}` : ""}
      </span>
    </p>
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
          )}
          style={{ backgroundColor: RESULT_TONES[boulderTone(a.result)].bg === "#E5E7EB" ? "#9CA3AF" : RESULT_TONES[boulderTone(a.result)].bg }}
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
  // Climbing District levels: twelve big numerals (other scales keep their layout).
  const levels = system === "CLIMBING_DISTRICT_LEVEL";
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{levels ? t.session.pickLevel : t.session.pickGrade}</h2>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        ) : null}
      </div>
      <div className={cn("grid gap-2", isColorSystem(system) ? "grid-cols-3" : system === "FONT" ? "grid-cols-6" : "grid-cols-4")}>
        {grades.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={pending}
            onClick={() => onPick(g.id)}
            aria-label={levels ? gradeSpokenLabel(t, system, g.id) : undefined}
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border border-line px-1 text-center font-bold disabled:opacity-50",
              isColorSystem(system) || levels ? "min-h-16" : "min-h-12",
            )}
            style={g.swatch ? { backgroundColor: g.swatch, color: g.swatchText } : undefined}
          >
            <span className={cn(levels ? "text-2xl font-black tabular-nums" : "text-sm tracking-[0.12em]", isColorSystem(system) && "uppercase")}>
              {isColorSystem(system) ? (t.grades.colors as Record<string, string>)[g.id] : g.id}
            </span>
            {g.kind === "MYSTERY" ? <span className="text-xs font-medium">{t.grades.mystery}</span> : null}
            {fontRangeFor(system, g.id) ? <span className="text-xs font-medium opacity-90">{formatFontRange(fontRangeFor(system, g.id)!)}</span> : null}
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
                "min-h-11 rounded-full border px-3 text-sm",
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

/** Signal, changes waiting on this phone, and what the server refused. */
function SyncBar({ log, L, locale }: {
  log: ReturnType<typeof useBoulderLog>;
  L: ReturnType<typeof loggingDictionary>;
  locale: "fr" | "en";
}) {
  const reason = (r: Rejection) =>
    r.error === "flashOnlyFirst" ? L.reasonFlash
      : r.error === "notFound" ? L.reasonGone
        : r.error === "notLatest" ? L.reasonLatest
          : L.reasonOther;
  const n = log.pending;
  let text: string | null = null;
  if (log.gone) text = L.sessionGone;
  else if (!log.online) text = n ? fmt(plural(locale, n, { one: L.offlinePendingOne, other: L.offlinePendingOther }), { n }) : L.offlineEmpty;
  else if (n && log.syncing) text = fmt(plural(locale, n, { one: L.sendingOne, other: L.sendingOther }), { n });
  else if (n) text = fmt(plural(locale, n, { one: L.waitingOne, other: L.waitingOther }), { n });
  const rejected = log.rejections.length;
  if (!text && !rejected) return null;
  return (
    <div className="space-y-2">
      {text ? (
        <div role="status" className={cn(
          "flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
          log.online && !log.gone ? "bg-surface-2 text-ink-2" : "bg-accent-soft text-ink",
        )}>
          <span className="min-w-0 flex-1">{text}</span>
          {n && log.online && !log.syncing ? (
            <button type="button" onClick={log.retry} className="min-h-11 rounded-full px-3 font-bold text-accent underline underline-offset-2">
              {L.sendNow}
            </button>
          ) : null}
        </div>
      ) : null}
      {rejected ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-danger px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            {fmt(plural(locale, rejected, { one: L.rejectedOne, other: L.rejectedOther }), {
              n: rejected,
              reason: [...new Set(log.rejections.map(reason))].join(", "),
            })}
          </span>
          <button type="button" onClick={log.dismissRejections} aria-label="OK" className="min-h-11 rounded-full px-3 font-bold">OK</button>
        </div>
      ) : null}
    </div>
  );
}
