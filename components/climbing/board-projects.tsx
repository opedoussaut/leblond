"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { fieldClass as field } from "@/components/ui/field";
import {
  createBoardGoal, createBoardProject, deleteBoardGoal, deleteBoardProject, setBoardProjectStatus, updateBoardGoal, updateBoardProjectNotes,
} from "@/lib/actions/boards";
import {
  boardAngles, boardGrades, BOARD_NAMES, BOARD_SCALES, BOARD_SHORT, BOARDS, clampAngle, DEFAULT_ANGLE,
  type Board, type BoardGoalStatus, type BoardProjectStatus, type BoardScale,
} from "@/lib/climbing/boards";
import type { BoardGoalRow, BoardProjectRow } from "@/lib/data/boards";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { boardsDictionary } from "@/lib/i18n/boards";
import { useI18n } from "@/components/i18n-provider";
import { boulderGrade } from "@/lib/grading/display";

export type BoardGoalItem = BoardGoalRow & { best: string | null; reached: boolean; reachedAt: string | null; climbsAtGoal: number };
type Dict = ReturnType<typeof boardsDictionary>;

/**
 * Board projects: level goals per board (a grade to reach at one angle or any
 * angle) and precise climbs (board, name, angle) not sent yet. Sending a climb
 * in a séance closes its project; goals are reached by the climbs logged.
 */
export function BoardProjects({ locale, projects, goals = [] }: { locale: Locale; projects: BoardProjectRow[]; goals?: BoardGoalItem[] }) {
  const b = boardsDictionary(locale);
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean }>) => start(async () => {
    setError(false);
    const r = await fn();
    if (r.ok) router.refresh(); else setError(true);
  });

  return <section aria-labelledby="board-projects" className="mt-8 space-y-3">
    <h2 id="board-projects" className="text-lg font-bold">{b.projectsTitle}</h2>

    <h3 className="text-base font-bold">{b.goalsTitle}</h3>
    {goals.length ? <ul className="space-y-2">
      {goals.map((g) => <GoalItem key={g.id} goal={g} b={b} locale={locale} pending={pending} run={run} />)}
    </ul> : <p className="text-sm text-ink-2">{b.goalsEmpty}</p>}
    <details className="rounded-2xl border border-line bg-surface p-4">
      <summary className="min-h-11 cursor-pointer font-bold text-accent">+ {b.newGoal}</summary>
      <div className="mt-3"><BoardGoalForm b={b} /></div>
    </details>

    <h3 className="pt-2 text-base font-bold">{b.climbsTitle}</h3>
    {projects.length ? <ul className="space-y-2">
      {projects.map((p) => <li key={p.id} className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-black tabular-nums">{boulderGrade(p.grade)}</span>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{b.projectStatus[p.status as BoardProjectStatus]}</span>
        </div>
        <p className="mt-1 font-semibold">{p.climb_name}</p>
        <p className="text-sm text-ink-3">
          {BOARD_SHORT[p.board as Board]} · {p.angle}° · {fmt(t.projects.since, { date: formatDate(p.started_at, locale) })}
        </p>
        <NotesEditor id={p.id} notes={p.notes} b={b} />
        <div className="leblond-actions mt-3">
          {p.status === "ACTIVE" ? <>
            <button type="button" disabled={pending} onClick={() => run(() => setBoardProjectStatus(p.id, "SENT"))} className={buttonClass("secondary", "sm")}>{b.markSent}</button>
            <button type="button" disabled={pending} onClick={() => run(() => setBoardProjectStatus(p.id, "ABANDONED"))} className={buttonClass("ghost", "sm")}>{b.abandon}</button>
          </> : <button type="button" disabled={pending} onClick={() => run(() => setBoardProjectStatus(p.id, "ACTIVE"))} className={buttonClass("ghost", "sm")}>{b.reopen}</button>}
          <button type="button" disabled={pending} onClick={() => { if (window.confirm(b.removeConfirm)) run(() => deleteBoardProject(p.id)); }} className={buttonClass("ghost", "sm")}>{b.remove}</button>
        </div>
      </li>)}
    </ul> : <p className="text-sm text-ink-2">{b.projectsEmpty}</p>}
    <details className="rounded-2xl border border-line bg-surface p-4">
      <summary className="min-h-11 cursor-pointer font-bold text-accent">+ {b.newProject}</summary>
      <div className="mt-3"><BoardProjectForm b={b} /></div>
    </details>
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{b.error}</p> : null}
  </section>;
}

function GoalItem({ goal: g, b, locale, pending, run }: {
  goal: BoardGoalItem; b: Dict; locale: Locale; pending: boolean; run: (fn: () => Promise<{ ok: boolean }>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [scale, setScale] = useState(g.grade_scale as BoardScale);
  const [grade, setGrade] = useState(g.grade);
  const [notes, setNotes] = useState(g.notes);
  const status = g.status as BoardGoalStatus;
  const save = (next: BoardGoalStatus) => run(async () => {
    const r = await updateBoardGoal({ id: g.id, grade, gradeScale: scale, status: next, notes });
    if (r.ok) setEditing(false);
    return r;
  });
  return <li className="rounded-2xl border border-line bg-surface p-4">
    <div className="flex items-center justify-between gap-2">
      <span className="text-lg font-black tabular-nums">{b.goalTarget} {boulderGrade(g.grade)}</span>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">
        {g.reached && status === "ACTIVE" && g.reachedAt ? fmt(b.goalReached, { date: formatDate(g.reachedAt, locale) }) : b.goalStatus[status]}
      </span>
    </div>
    <p className="mt-1 font-semibold">{BOARD_NAMES[g.board as Board]} · {g.angle === null ? b.anyAngle : `${g.angle}°`} · {b.scales[g.grade_scale as BoardScale]}</p>
    <p className="text-sm text-ink-2">
      {g.best ? fmt(b.goalBest, { grade: boulderGrade(g.best) }) : b.goalNoSend}
      {g.climbsAtGoal ? ` · ${fmt(b.goalAtLevel, { n: g.climbsAtGoal })}` : ""}
    </p>
    {g.notes && !editing ? <p className="mt-1 whitespace-pre-line text-sm text-ink-3">{g.notes}</p> : null}
    {editing ? <div className="mt-3 space-y-3">
      <ScaleGrade b={b} idPrefix={"goal-" + g.id} scale={scale} grade={grade}
        onChange={(s, gr) => { setScale(s); setGrade(gr); }} />
      <label className="block text-sm font-semibold">{b.notes}
        <textarea className={field} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button type="button" disabled={pending} onClick={() => save(status)} className={buttonClass("primary", "sm")}>{b.saveGoal}</button>
    </div> : null}
    <div className="leblond-actions mt-3">
      {!editing ? <button type="button" disabled={pending} onClick={() => setEditing(true)} className={buttonClass("secondary", "sm")}>{b.editGoal}</button> : null}
      {status === "ACTIVE"
        ? <button type="button" disabled={pending} onClick={() => save("ABANDONED")} className={buttonClass("ghost", "sm")}>{b.abandon}</button>
        : <button type="button" disabled={pending} onClick={() => save("ACTIVE")} className={buttonClass("ghost", "sm")}>{b.reopen}</button>}
      <button type="button" disabled={pending} onClick={() => { if (window.confirm(b.removeConfirm)) run(() => deleteBoardGoal(g.id)); }} className={buttonClass("ghost", "sm")}>{b.remove}</button>
    </div>
    <p className="mt-2 text-xs text-ink-3">{b.goalRule}</p>
  </li>;
}

function NotesEditor({ id, notes, b }: { id: string; notes: string; b: Dict }) {
  const router = useRouter();
  const [value, setValue] = useState(notes);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return <div className="mt-2">
    <label className="block text-sm font-semibold">{b.notes}
      <textarea className={field} rows={2} maxLength={2000} value={value} onChange={(e) => { setValue(e.target.value); setMsg(null); }} />
    </label>
    {value !== notes ? <button type="button" disabled={pending} className={buttonClass("secondary", "sm") + " mt-2"} onClick={() => start(async () => {
      const r = await updateBoardProjectNotes({ id, notes: value });
      setMsg(r.ok ? b.notesSaved : b.error);
      if (r.ok) router.refresh();
    })}>{b.saveNotes}</button> : null}
    {msg ? <p role="status" className="mt-1 text-sm text-ink-2">{msg}</p> : null}
  </div>;
}

/** Scale (Font / V) then a grade of that scale — as the board app shows it, never converted. */
function ScaleGrade({ b, idPrefix, scale, grade, onChange }: {
  b: Dict; idPrefix: string; scale: BoardScale; grade: string; onChange: (scale: BoardScale, grade: string) => void;
}) {
  return <div className="grid grid-cols-2 gap-3">
    <label className="text-sm font-semibold" htmlFor={idPrefix + "-scale"}>{b.scale}
      <select id={idPrefix + "-scale"} className={field} value={scale} onChange={(e) => {
        const s = e.target.value as BoardScale;
        onChange(s, s === "FONT" ? "6C" : "V5");
      }}>
        {BOARD_SCALES.map((s) => <option key={s} value={s}>{b.scales[s]}</option>)}
      </select>
    </label>
    <label className="text-sm font-semibold" htmlFor={idPrefix + "-grade"}>{b.grade}
      <select id={idPrefix + "-grade"} className={field} value={grade} onChange={(e) => onChange(scale, e.target.value)}>
        {boardGrades(scale).map((g) => <option key={g} value={g}>{boulderGrade(g)}</option>)}
      </select>
    </label>
  </div>;
}

function BoardAngle({ b, idPrefix, board, angle, any, onBoard, onAngle }: {
  b: Dict; idPrefix: string; board: Board; angle: number | null; any: boolean;
  onBoard: (board: Board) => void; onAngle: (angle: number | null) => void;
}) {
  return <div className="grid grid-cols-2 gap-3">
    <label className="text-sm font-semibold" htmlFor={idPrefix + "-board"}>{b.board}
      <select id={idPrefix + "-board"} className={field} value={board} onChange={(e) => onBoard(e.target.value as Board)}>
        {BOARDS.map((x) => <option key={x} value={x}>{BOARD_NAMES[x]}</option>)}
      </select>
    </label>
    <label className="text-sm font-semibold" htmlFor={idPrefix + "-angle"}>{b.angle}
      <select id={idPrefix + "-angle"} className={field} value={angle === null ? "" : String(angle)}
        onChange={(e) => onAngle(e.target.value === "" ? null : Number(e.target.value))}>
        {any ? <option value="">{b.anyAngle}</option> : null}
        {boardAngles(board).map((a) => <option key={a} value={a}>{a}°</option>)}
      </select>
    </label>
  </div>;
}

function useCreate(b: Dict, duplicate: string) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const submit = (fn: () => Promise<{ ok: boolean; error?: string }>, done: () => void) => start(async () => {
    setError("");
    const r = await fn();
    if (!r.ok) { setError(r.error === "duplicate" ? duplicate : r.error === "invalid" ? b.errorInvalid : b.error); return; }
    done();
    router.refresh();
  });
  return { error, pending, submit };
}

function BoardGoalForm({ b }: { b: Dict }) {
  const [board, setBoard] = useState<Board>("KILTER");
  const [angle, setAngle] = useState<number | null>(DEFAULT_ANGLE);
  const [scale, setScale] = useState<BoardScale>("FONT");
  const [grade, setGrade] = useState("7A");
  const [notes, setNotes] = useState("");
  const { error, pending, submit } = useCreate(b, b.duplicateGoal);
  return <form aria-label={b.newGoal} className="space-y-3" onSubmit={(e) => {
    e.preventDefault();
    submit(() => createBoardGoal({ board, angle, grade, gradeScale: scale, notes }), () => setNotes(""));
  }}>
    <BoardAngle b={b} idPrefix="bg" board={board} angle={angle} any
      onBoard={(x) => { setBoard(x); if (angle !== null) setAngle(clampAngle(x, angle)); }} onAngle={setAngle} />
    <ScaleGrade b={b} idPrefix="bg" scale={scale} grade={grade} onChange={(s, g) => { setScale(s); setGrade(g); }} />
    <p className="text-xs text-ink-3">{b.gradeNote}</p>
    <label className="block text-sm font-semibold">{b.notes}
      <textarea className={field} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </label>
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>{b.createGoal}</button>
  </form>;
}

function BoardProjectForm({ b }: { b: Dict }) {
  const [board, setBoard] = useState<Board>("KILTER");
  const [angle, setAngle] = useState<number>(DEFAULT_ANGLE);
  const [name, setName] = useState("");
  const [scale, setScale] = useState<BoardScale>("FONT");
  const [grade, setGrade] = useState("6C");
  const [notes, setNotes] = useState("");
  const { error, pending, submit } = useCreate(b, b.duplicateProject);
  return <form aria-label={b.newProject} className="space-y-3" onSubmit={(e) => {
    e.preventDefault();
    submit(() => createBoardProject({ board, climbName: name, angle, grade, gradeScale: scale, notes }), () => { setName(""); setNotes(""); });
  }}>
    <BoardAngle b={b} idPrefix="bp" board={board} angle={angle} any={false}
      onBoard={(x) => { setBoard(x); setAngle(clampAngle(x, angle)); }} onAngle={(a) => setAngle(a ?? DEFAULT_ANGLE)} />
    <label className="block text-sm font-semibold" htmlFor="bp-name">{b.climbName}
      <input id="bp-name" className={field} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
    </label>
    <ScaleGrade b={b} idPrefix="bp" scale={scale} grade={grade} onChange={(s, g) => { setScale(s); setGrade(g); }} />
    <p className="text-xs text-ink-3">{b.gradeNote}</p>
    <label className="block text-sm font-semibold">{b.notes}
      <textarea className={field} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </label>
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <button type="submit" disabled={pending || !name.trim()} className={buttonClass("primary", "md")}>{b.createProject}</button>
  </form>;
}
