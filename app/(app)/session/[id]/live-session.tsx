"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { isColorSystem } from "@/lib/grading/systems";
import { QuickBoulderEntry } from "./quick-boulder-entry";
import { ResultBadge, boulderTone, toneButtonStyle, RESULT_TONES } from "@/components/climbing/result-badge";
import { loggingDictionary } from "@/lib/i18n/logging";
import { markProblemProject, type LiveProblem } from "@/lib/actions/sessions";
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
import {
  correctAttempt,
  createProblem,
  deleteLatestAttempt,
  endSession,
  logAttempt,
  removeProblemFromSession,
  removeProblemsFromSession,
  updateProblem,
} from "@/lib/actions/sessions";
import { logTopoBoulder, pickOutdoorProblem } from "@/lib/actions/outdoor";
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
import { fmt, plural } from "@/lib/i18n";
import type { Tables } from "@/lib/supabase/database.types";

type Attempt = Tables<"attempts">;
type Outcome = "FLASH" | "TOP" | "ATTEMPT" | "PROJECT";
export type LiveProblemItem = {
  id: string;
  native_grade: string;
  /** The scale the problem was logged with (may predate a change of the gym's scale). */
  native_grade_system?: GradeSystem;
  notes?: string | null;
  wall_angle: WallAngle;
  tags: StyleTag[];
  created_at: string;
  name: string | null;
  outdoor_problem_id: number | null;
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
  projectsOpenedHere = [],
  outdoor = null,
  mode = "live",
}: {
  sessionId: string;
  userId: string;
  gym: { id: string; name: string; system: GradeSystem; outdoor?: boolean };
  startedAt: string;
  initialProblems: LiveProblemItem[];
  initialAttempts: Attempt[];
  projectProblemIds: string[];
  /** Boulders whose project was opened in this session. */
  projectsOpenedHere?: string[];
  /** Set when the session is in a Fontainebleau area from the Boolder catalogue. */
  outdoor?: { area: AreaItem; problems: CatalogueItem[] } | null;
  /** "edit": filling in or correcting a finished session — no timer, no end button. */
  mode?: "live" | "edit";
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [problems, setProblems] = useState(initialProblems);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [currentId, setCurrentId] = useState<string | null>(() => {
    const last = [...initialAttempts].filter((a) => a.session_id === sessionId).at(-1);
    return last?.problem_id ?? null;
  });
  const [adding, setAdding] = useState(initialProblems.length === 0);
  // Outdoor: pick from the topo by default; the grade grid is the fallback.
  const [gradeFallback, setGradeFallback] = useState(false);
  const catalogue = useMemo(() => new Map((outdoor?.problems ?? []).map((p) => [p.id, p])), [outdoor]);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [flashPrompt, setFlashPrompt] = useState<Attempt | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [quick, setQuick] = useState(false);
  const [projectIds, setProjectIds] = useState(projectProblemIds);
  const [openedHere, setOpenedHere] = useState(projectsOpenedHere);
  /** A project created now is linked to this session; an existing one keeps its own session. */
  const addProjects = (problemIds: string[]) => {
    const fresh = problemIds.filter((pid) => !projectIds.includes(pid));
    if (!fresh.length) return;
    setProjectIds((ids) => [...ids, ...fresh.filter((pid) => !ids.includes(pid))]);
    setOpenedHere((ids) => [...ids, ...fresh.filter((pid) => !ids.includes(pid))]);
  };
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
  const L = loggingDictionary(locale);

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
    start(async () => {
      const res = await createProblem({ gymId: gym.id, nativeGrade: grade, ...(gym.outdoor ? manual : {}) });
      if (!res.ok || !res.data) return say("error", t.common.unknownError);
      const p = res.data;
      setProblems((list) => [
        ...list,
        {
          id: p.id,
          native_grade: p.native_grade,
          wall_angle: p.wall_angle,
          tags: [],
          created_at: p.created_at,
          name: p.name,
          notes: p.notes,
          outdoor_problem_id: p.outdoor_problem_id,
        },
      ]);
      setCurrentId(p.id);
      setAdding(false);
      setFlashPrompt(null);
      setManual({ name: "", sector: manual.sector });
    });
  }

  /** A topo boulder was chosen: ask for its grade, tries and result. */
  function pickFromTopo(item: CatalogueItem) {
    setPicked(item);
    setLastAdded(null);
  }

  const asItem = (p: LiveProblem): LiveProblemItem => ({
    id: p.id,
    native_grade: p.native_grade,
    native_grade_system: p.native_grade_system,
    notes: p.notes,
    wall_angle: p.wall_angle as WallAngle,
    tags: p.tags as StyleTag[],
    created_at: p.created_at,
    name: p.name,
    outdoor_problem_id: p.outdoor_problem_id,
  });

  /** Adds the topo boulder with its tries and result in one go; the topo stays open for the next one. */
  function addFromTopo(item: CatalogueItem, choice: { grade: string; outcome: Outcome; tries: number }) {
    start(async () => {
      const res = await logTopoBoulder({ sessionId, gymId: gym.id, outdoorProblemId: item.id, ...choice });
      if (!res.ok || !res.data) {
        return say("error", !res.ok && res.error === "flashOnlyFirst" ? t.session.flashOnlyFirst : t.common.unknownError);
      }
      const { problem: p, attempts: added } = res.data;
      setProblems((list) =>
        list.some((x) => x.id === p.id)
          ? list.map((x) => (x.id === p.id ? { ...x, native_grade: p.native_grade } : x))
          : [...list, asItem(p)],
      );
      setAttempts((list) => [...list, ...added]);
      const newProject = choice.outcome === "PROJECT" && !projectIds.includes(p.id);
      if (choice.outcome === "PROJECT") addProjects([p.id]);
      setCurrentId(p.id);
      setPicked(null);
      setFlashPrompt(null);
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
    });
  }

  /** The former behaviour: select the boulder and log it try by try. */
  function selectFromTopo(item: CatalogueItem) {
    setPicked(null);
    const known = problems.find((p) => p.outdoor_problem_id === item.id);
    if (known) {
      setCurrentId(known.id);
      setAdding(false);
      setFlashPrompt(null);
      return;
    }
    start(async () => {
      const res = await pickOutdoorProblem({ gymId: gym.id, outdoorProblemId: item.id });
      if (!res.ok || !res.data) return say("error", t.common.unknownError);
      const p = res.data;
      setProblems((list) => (list.some((x) => x.id === p.id) ? list : [...list, asItem(p)]));
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

  /** Record several unsuccessful tries on the current problem in one tap. */
  function logTries(n: number) {
    if (!current) return;
    const problemId = current.id;
    start(async () => {
      for (let i = 0; i < n; i++) {
        const res = await logAttempt({ sessionId, problemId, result: "ATTEMPT" });
        if (!res.ok || !res.data) return say("error", t.common.unknownError);
        const saved = res.data.attempt;
        setAttempts((list) => [...list, saved]);
      }
      say("ok", fmt(L.triesShort, { n }) + " ✓");
    });
  }

  function makeProject() {
    if (!current) return;
    const problemId = current.id;
    start(async () => {
      const res = await markProblemProject(problemId, sessionId);
      if (!res.ok) return say("error", t.common.unknownError);
      addProjects([problemId]);
      say("ok", L.projectSavedHere);
    });
  }

  function saveComment() {
    if (!current || commentDraft === null) return;
    const problemId = current.id;
    const notes = commentDraft.trim();
    setProblems((list) => list.map((p) => (p.id === problemId ? { ...p, notes } : p)));
    setCommentDraft(null);
    start(async () => {
      const res = await updateProblem({ problemId, notes: notes || null });
      say(res.ok ? "ok" : "error", res.ok ? L.saved : t.common.unknownError);
    });
  }

  function onQuickLogged(created: LiveProblem[], newAttempts: Attempt[], outcome: string) {
    setProblems((list) => [...list, ...created.map((p) => ({
      id: p.id, native_grade: p.native_grade, native_grade_system: p.native_grade_system, notes: p.notes,
      wall_angle: p.wall_angle as WallAngle, tags: [] as StyleTag[], created_at: p.created_at, name: p.name,
      outdoor_problem_id: p.outdoor_problem_id,
    }))]);
    setAttempts((list) => [...list, ...newAttempts]);
    if (outcome === "PROJECT") addProjects(created.map((p) => p.id));
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

  /** Mirrors the database after boulders were taken out of this session. */
  function applyRemoval(ids: string[], problemsDeleted: string[], projectsDeleted: string[]) {
    const out = new Set(ids);
    // Same renumbering as the database: the remaining tries count from 1 again.
    setAttempts((list) => {
      const rest = list.filter((a) => !(out.has(a.problem_id) && a.session_id === sessionId));
      const numbers = new Map<string, number>();
      for (const pid of out) {
        rest.filter((a) => a.problem_id === pid).sort((a, b) => a.attempt_number - b.attempt_number)
          .forEach((a, i) => numbers.set(a.id, i + 1));
      }
      return rest.map((a) => (numbers.has(a.id) ? { ...a, attempt_number: numbers.get(a.id)! } : a));
    });
    const projectGone = new Set(projectsDeleted);
    const stillProject = (pid: string) => projectIds.includes(pid) && !projectGone.has(pid);
    setProblems((list) => list.filter((p) => !problemsDeleted.includes(p.id) && !(out.has(p.id) && !stillProject(p.id))));
    setProjectIds((list) => list.filter((pid) => !projectGone.has(pid) && !problemsDeleted.includes(pid)));
    setOpenedHere((list) => list.filter((pid) => !projectGone.has(pid) && !problemsDeleted.includes(pid)));
    if (currentId && out.has(currentId)) setCurrentId(null);
    setFlashPrompt(null);
  }

  /** Takes the current boulder out of this session (logged by mistake). */
  function removeCurrent() {
    if (!current) return;
    const problemId = current.id;
    start(async () => {
      const res = await removeProblemFromSession({ sessionId, problemId });
      if (!res.ok || !res.data) return say("error", t.common.unknownError);
      const { problemDeleted, projectDeleted } = res.data;
      applyRemoval([problemId], problemDeleted ? [problemId] : [], projectDeleted ? [problemId] : []);
      setConfirmRemoveId(null);
      say("ok", projectDeleted ? L.removedWithProject : problemDeleted ? L.removedDeleted : L.removed);
    });
  }

  /** Takes the selected boulders out of this session, all or nothing. */
  function removeSelected() {
    const ids = selected.filter((pid) => inSession.some((p) => p.id === pid));
    if (!ids.length) return;
    start(async () => {
      const res = await removeProblemsFromSession({ sessionId, problemIds: ids });
      if (!res.ok || !res.data) return say("error", t.common.unknownError);
      applyRemoval(ids, res.data.problemsDeleted, res.data.projectsDeleted);
      setSelected([]);
      setSelecting(false);
      setConfirmMany(false);
      say("ok", fmt(plural(locale, ids.length, { one: L.removedManyOne, other: L.removedManyOther }), { n: ids.length }));
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

  function openProblem(problemId: string) {
    setCurrentId(problemId);
    setAdding(false);
    setPicked(null);
    setLastAdded(null);
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
  const canFlash = current !== null && currentAttempts.length === 0;
  const pickedKnown = picked ? problems.find((p) => p.outdoor_problem_id === picked.id) ?? null : null;

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
          {flashPrompt && flashPrompt.problem_id === current.id ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-accent-soft p-3 text-sm">
              <span>{t.session.suggestFlash}</span>
              <Button onClick={() => markFlash(flashPrompt)} disabled={pending}>
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
            <Button variant="secondary" disabled={pending} onClick={() => logTries(bulkTries)}>{fmt(L.logTries, { n: bulkTries })}</Button>
            {projectIds.includes(current.id)
              ? <Link href="/projects" className="ml-auto" title={L.seeProjects}>
                  <ResultBadge tone="project" label={projectLabel(current.id)} />
                </Link>
              : <button type="button" disabled={pending} onClick={makeProject} style={toneButtonStyle("project")}
                  className="ml-auto min-h-11 rounded-full border px-3 text-sm font-bold">{L.markProject}</button>}
          </div>
          <div className="mt-3">
            {commentDraft !== null ? <div className="flex gap-2">
              <input value={commentDraft} maxLength={2000} autoFocus aria-label={L.comment} placeholder={L.commentPlaceholder}
                onChange={(ev) => setCommentDraft(ev.target.value)}
                className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3 text-sm" />
              <Button onClick={saveComment} disabled={pending}>{L.save}</Button>
            </div> : <>
              {current.notes ? <p className="text-sm italic text-ink-2">“{current.notes}”</p> : null}
              <button type="button" onClick={() => setCommentDraft(current.notes ?? "")}
                className="text-sm font-bold text-accent underline underline-offset-2">{current.notes ? L.editComment : L.addComment}</button>
            </>}
          </div>
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
                <Button variant="danger" onClick={removeCurrent} disabled={pending}>
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
          currentGrade={pickedKnown?.native_grade ?? null}
          priorTries={pickedKnown ? attempts.filter((a) => a.problem_id === pickedKnown.id).length : 0}
          pending={pending}
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
            pending={pending}
            onPick={pickFromTopo}
            inSession={inSessionTopo}
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
          <GradeGrid system={gym.system} onPick={addProblem} onCancel={problems.length ? () => setAdding(false) : undefined} pending={pending} />
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
        <QuickBoulderEntry sessionId={sessionId} system={gym.system} onLogged={onQuickLogged} onClose={() => setQuick(false)} />
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
              <Button variant="danger" className="ml-auto" disabled={pending || selected.length === 0} onClick={() => setConfirmMany(true)}>
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
                <Button variant="danger" onClick={removeSelected} disabled={pending}>{L.removeConfirm}</Button>
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
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{t.session.pickGrade}</h2>
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
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border border-line px-1 text-center font-bold disabled:opacity-50",
              isColorSystem(system) ? "min-h-16" : "min-h-12",
            )}
            style={g.swatch ? { backgroundColor: g.swatch, color: g.swatchText } : undefined}
          >
            <span className={cn("text-sm tracking-[0.12em]", isColorSystem(system) && "uppercase")}>
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
