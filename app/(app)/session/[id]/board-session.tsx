"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { AngleStepper } from "@/components/climbing/board-start";
import { buttonClass, dangerLinkClass, iconButtonClass, linkClass, segmentClass, segmentGroupClass, toggleClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { fieldClass } from "@/components/ui/field";
import { LiveDot } from "@/components/ui/icons";
import { Minus, Plus } from "lucide-react";
import { deleteBoardAscent, logBoardAscent, setBoardAngle } from "@/lib/actions/boards";
import { endSession } from "@/lib/actions/sessions";
import { summarizeBoardSession, type BoardAscentFact } from "@/lib/analytics/boards";
import {
  BOARD_NAMES, BOARD_RESULTS, BOARD_SCALES, boardGrades, climbKey, hasMirror, type Board, type BoardResult, type BoardScale,
} from "@/lib/climbing/boards";
import type { BoardAscentRow } from "@/lib/data/boards";
import { fmt } from "@/lib/i18n";
import { boardsDictionary } from "@/lib/i18n/boards";
import { formatClock } from "@/lib/training/sessions";

/** A climb the climber already logged on this board: suggested by name, with its history. */
export type KnownBoardClimb = {
  name: string; key: string; angle: number; grade: string; scale: BoardScale; tries: number; sessions: number; sent: boolean;
};

type Pending = {
  clientId: string; climbName: string; grade: string; gradeScale: BoardScale; angle: number; tries: number; result: BoardResult;
  isBenchmark: boolean; isMirror: boolean; notes: string; asProject: boolean;
};

const outboxKey = (sessionId: string) => `leblond-board-outbox:${sessionId}`;
function readOutbox(sessionId: string): Pending[] {
  try { const v = JSON.parse(window.localStorage.getItem(outboxKey(sessionId)) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeOutbox(sessionId: string, items: Pending[]) {
  try {
    if (items.length) window.localStorage.setItem(outboxKey(sessionId), JSON.stringify(items));
    else window.localStorage.removeItem(outboxKey(sessionId));
  } catch { /* storage unavailable: the climbs stay on screen until sent */ }
}

const toFact = (r: BoardAscentRow): BoardAscentFact => ({
  id: r.id, sessionId: r.session_id, board: r.board as Board, climbKey: r.climb_key, climbName: r.climb_name, angle: r.angle,
  grade: r.grade, gradeScale: r.grade_scale as BoardScale, tries: r.tries, result: r.result as BoardResult,
  isBenchmark: r.is_benchmark, climbedAt: new Date(r.climbed_at),
});

/**
 * Live log of a board séance (Kilter, Tension, MoonBoard): set the angle once,
 * then add each climb with its name, grade, tries and result. Climbs added
 * without signal wait on the phone and are sent when the network is back; a
 * resent climb is never stored twice (client id).
 */
export function BoardSession({ sessionId, board, layout, initialAngle, startedAt, ended, initialAscents, known, defaultScale }: {
  sessionId: string; board: Board; layout: string | null; initialAngle: number; startedAt: string; ended: boolean;
  initialAscents: BoardAscentRow[]; known: KnownBoardClimb[]; defaultScale: BoardScale;
}) {
  const { locale } = useI18n();
  const b = boardsDictionary(locale);
  const router = useRouter();
  const [ascents, setAscents] = useState(initialAscents);
  const [pending, setPending] = useState<Pending[]>([]);
  const [angle, setAngle] = useState(initialAngle);
  const [name, setName] = useState("");
  const [scale, setScale] = useState<BoardScale>(defaultScale);
  const [grade, setGrade] = useState(defaultScale === "V" ? "V3" : "6A");
  const [tries, setTries] = useState(1);
  const [result, setResult] = useState<BoardResult>("SENT");
  const [benchmark, setBenchmark] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [asProject, setAsProject] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, start] = useTransition();

  useEffect(() => {
    if (ended) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ended]);

  /** Sends what waits in the outbox, oldest first; stops at the first failure. */
  const flush = useCallback(async () => {
    let queue = readOutbox(sessionId);
    setPending(queue);
    while (queue.length) {
      const item = queue[0];
      let res: Awaited<ReturnType<typeof logBoardAscent>>;
      try { res = await logBoardAscent({ sessionId, ...item }); } catch { break; } // offline: try again later
      if (res.ok && res.data) {
        const row = res.data.ascent;
        setAscents((list) => (list.some((a) => a.id === row.id) ? list : [row, ...list]));
      } else if (res.ok === false && res.error !== "invalid" && res.error !== "notFound") break;
      else setError(b.errorInvalid);
      queue = queue.slice(1);
      writeOutbox(sessionId, queue);
      setPending(queue);
    }
  }, [sessionId, b.errorInvalid]);

  useEffect(() => {
    // What waited on the phone (from an earlier visit without signal) is sent once the page is up.
    const first = window.setTimeout(() => void flush(), 0);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => { window.clearTimeout(first); window.removeEventListener("online", onOnline); };
  }, [flush]);

  const knownByName = useMemo(() => {
    const m = new Map<string, KnownBoardClimb>();
    for (const k of known) if (!m.has(k.key + "|" + k.angle)) m.set(k.key + "|" + k.angle, k);
    return m;
  }, [known]);
  const match = knownByName.get(climbKey(name) + "|" + angle) ?? null;

  function pickName(value: string) {
    setName(value);
    const k = knownByName.get(climbKey(value) + "|" + angle) ?? known.find((x) => x.key === climbKey(value));
    if (k) { setScale(k.scale); setGrade(k.grade); }
  }
  function changeScale(next: BoardScale) {
    setScale(next);
    setGrade(next === "V" ? "V3" : "6A");
  }
  function changeResult(next: BoardResult) {
    setResult(next);
    if (next === "FLASH") setTries(1);
    if (next !== "ATTEMPT") setAsProject(false);
  }
  function changeAngle(next: number) {
    setAngle(next);
    start(async () => { await setBoardAngle(sessionId, next); });
  }

  function add() {
    setError(null);
    const climbName = name.trim();
    if (!climbName) { setError(b.errorInvalid); return; }
    const item: Pending = {
      clientId: crypto.randomUUID(), climbName, grade, gradeScale: scale, angle, tries: result === "FLASH" ? 1 : tries, result,
      isBenchmark: benchmark, isMirror: hasMirror(board) && mirror, notes: notes.trim(), asProject: result === "ATTEMPT" && asProject,
    };
    writeOutbox(sessionId, [...readOutbox(sessionId), item]);
    setName(""); setTries(1); setNotes(""); setBenchmark(false); setMirror(false); setAsProject(false); setResult("SENT");
    void flush();
  }

  function remove(id: string) {
    if (!window.confirm(b.removeConfirm)) return;
    start(async () => {
      const r = await deleteBoardAscent(id);
      if (r.ok) setAscents((list) => list.filter((a) => a.id !== id)); else setError(b.error);
    });
  }

  function end() {
    if (!window.confirm(b.endConfirm)) return;
    start(async () => {
      await flush();
      const r = await endSession(sessionId);
      if (r.ok) router.refresh(); else setError(b.error);
    });
  }

  const summary = summarizeBoardSession(ascents.map(toFact));
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));

  return <div className="space-y-6">
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-accent">
            {ended ? b.ended : <><LiveDot /> {formatClock(elapsed)}</>}
          </p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">{fmt(b.liveTitle, { board: BOARD_NAMES[board], layout: layout ?? "" }).replace(/ · $/, "")}</h1>
        </div>
        <AngleStepper board={board} angle={angle} onChange={changeAngle} />
      </div>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {([[b.summary.climbs, summary.climbs], [b.summary.sends, summary.sends], [b.summary.flashes, summary.flashes], [b.summary.tries, summary.tries]] as const)
          .map(([label, n]) => <div key={label} className="rounded-xl bg-surface-2 p-2">
            <dt className="text-xs text-ink-3">{label}</dt><dd className="font-display text-xl font-black tabular-nums">{n}</dd>
          </div>)}
      </dl>
      {summary.top.length ? <p className="text-sm text-ink-2">{b.summary.top} : <strong className="text-ink">{summary.top.map((t) => t.grade).join(" · ")}</strong></p> : null}
    </header>

    <form aria-labelledby="add-climb-heading" className="leblond-premium-surface space-y-4 p-4 sm:p-5" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <h2 id="add-climb-heading" className="text-lg font-bold">{b.addClimb}</h2>
      <label className="block text-sm font-semibold">{b.climbName}
        <input className={fieldClass} list="board-climb-names" value={name} maxLength={120} required autoComplete="off"
          onChange={(e) => pickName(e.target.value)} data-testid="board-climb-name" />
        <datalist id="board-climb-names">{[...new Set(known.map((k) => k.name))].slice(0, 200).map((n) => <option key={n} value={n} />)}</datalist>
        {match ? <span className="mt-1 block text-xs font-normal text-ink-2">
          {fmt(b.history, { tries: match.tries, sessions: match.sessions })}{match.sent ? " · " + b.historySent : ""}
        </span> : <span className="mt-1 block text-xs font-normal text-ink-3">{b.climbNameHint}</span>}
      </label>
      <div className="grid grid-cols-[auto_1fr] items-end gap-3">
        <fieldset>
          <legend className="text-sm font-semibold">{b.scale}</legend>
          <div className={cn(segmentGroupClass, "mt-1 grid-cols-2")}>
            {BOARD_SCALES.map((s) => <button key={s} type="button" aria-pressed={scale === s} onClick={() => changeScale(s)} className={segmentClass(scale === s, "px-4")}>{b.scales[s]}</button>)}
          </div>
        </fieldset>
        <label className="text-sm font-semibold">{b.grade}
          <select className={fieldClass} value={grade} onChange={(e) => setGrade(e.target.value)} data-testid="board-grade">
            {boardGrades(scale).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">{b.result}</legend>
        <div className={cn(segmentGroupClass, "mt-1 grid-cols-3")}>
          {BOARD_RESULTS.map((r) => <button key={r} type="button" aria-pressed={result === r} onClick={() => changeResult(r)} className={segmentClass(result === r)}>{b.results[r]}</button>)}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-semibold">{b.tries}</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="−1" disabled={result === "FLASH" || tries <= 1} onClick={() => setTries((n) => Math.max(1, n - 1))} className={iconButtonClass()}><Minus aria-hidden="true" className="size-5" /></button>
          <output className="min-w-10 text-center font-display text-xl font-black tabular-nums" data-testid="board-tries">{result === "FLASH" ? 1 : tries}</output>
          <button type="button" aria-label="+1" disabled={result === "FLASH" || tries >= 999}
            onClick={() => setTries((n) => { const next = Math.min(999, n + 1); return next; })} className={iconButtonClass()}><Plus aria-hidden="true" className="size-5" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={benchmark} onClick={() => setBenchmark((v) => !v)} className={toggleClass(benchmark)}>{b.benchmark}</button>
        {hasMirror(board) ? <button type="button" aria-pressed={mirror} onClick={() => setMirror((v) => !v)} className={toggleClass(mirror)}>{b.mirror}</button> : null}
        {result === "ATTEMPT" ? <button type="button" aria-pressed={asProject} onClick={() => setAsProject((v) => !v)} className={toggleClass(asProject)}>{b.asProject}</button> : null}
      </div>
      <label className="block text-sm font-semibold">{b.notes}
        <input className={fieldClass} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
      <button type="submit" disabled={busy} className={buttonClass("primary", "xl", "w-full")}>{b.save}</button>
    </form>

    {pending.length ? <p role="status" className="rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm">{fmt(b.pendingCount, { n: pending.length })}</p> : null}

    <section aria-labelledby="climbs-heading" className="space-y-2">
      <h2 id="climbs-heading" className="text-lg font-bold">{b.summary.climbs}</h2>
      {ascents.length || pending.length ? <ul className="space-y-2" data-testid="board-climbs">
        {pending.map((p) => <li key={p.clientId} className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line bg-surface p-3 opacity-70">
          <span className="min-w-0"><strong className="block truncate">{p.climbName}</strong>
            <span className="text-xs text-ink-2">{p.grade} · {p.angle}° · {fmt(b.triesShort, { n: p.tries })}</span></span>
          <span className="shrink-0 text-xs font-semibold text-warn">{b.pending}</span>
        </li>)}
        {ascents.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
          <span className="min-w-0">
            <strong className="block truncate">{a.climb_name} <span className="font-display">{a.grade}</span></strong>
            <span className="text-xs text-ink-2">{a.angle}° · {fmt(b.triesShort, { n: a.tries })}{a.is_benchmark ? " · " + b.benchmark : ""}{a.is_mirror ? " · " + b.mirror : ""}{a.notes ? " · " + a.notes : ""}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", a.result === "ATTEMPT" ? "bg-surface-2 text-ink-2" : "bg-accent-soft text-accent")}>{b.results[a.result as BoardResult]}</span>
            <button type="button" disabled={busy} onClick={() => remove(a.id)} className={cn(dangerLinkClass, "text-xs")}>{b.remove}</button>
          </span>
        </li>)}
      </ul> : <p className="text-sm text-ink-3">{b.empty}</p>}
    </section>

    {ended ? <div className="flex flex-wrap gap-4">
      <Link href="/session?type=climb" className={linkClass}>{b.backToJournal}</Link>
      <Link href={`/session/${sessionId}/edit`} className={linkClass}>{b.editSession}</Link>
    </div>
      : <button type="button" disabled={busy} onClick={end} className={buttonClass("secondary", "lg", "w-full")}>{b.end}</button>}
  </div>;
}
