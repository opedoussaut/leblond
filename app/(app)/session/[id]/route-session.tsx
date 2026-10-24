"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import { endSession } from "@/lib/actions/sessions";
import { deleteRouteAscent, logRouteAscent, updateRouteAscent, type RouteAscentRow } from "@/lib/actions/routes";
import { ResultBadge, routeTone, toneButtonStyle } from "@/components/climbing/result-badge";
import { loggingDictionary } from "@/lib/i18n/logging";
import { createRouteProject } from "@/lib/actions/route-projects";
import { ROUTE_RESULTS, ROUTE_STYLES, completesProject, isClean, routeKey, type RouteResult, type RouteStyle } from "@/lib/climbing/routes";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { fmt } from "@/lib/i18n";
import { routeDictionary } from "@/lib/i18n/routes";
import { formatClock } from "@/lib/training/sessions";
import { GradeChip } from "@/components/climbing/grade-chip";
import type { GradeSystem } from "@/lib/climbing/types";
import { listGrades } from "@/lib/grading";
import { isColourSystem } from "@/lib/grading/conversions";
import { sessionEditDictionary } from "@/lib/i18n/session-edit";

type Grade = (typeof FRENCH_ROUTE_GRADES)[number];

/** Live logger for a ROUTE session: grade + style, then one tap on the result. */
export type ActiveRouteProject = { id: string; route_name: string; grade: string; goal_style: RouteStyle };

export function RouteSession({ sessionId, gymId, gymName, startedAt, initialAscents, defaultGrade, initialProjects,
  gymSystem = "FONT", colourEquivalents = {}, mode = "live" }: {
  sessionId: string; gymId: string; gymName: string; startedAt: string; initialAscents: RouteAscentRow[];
  defaultGrade: Grade; initialProjects: ActiveRouteProject[];
  /** The gym's grading system; colour systems log the colour plus a French equivalent. */
  gymSystem?: GradeSystem;
  /** The climber's last French grade for each colour at this gym. */
  colourEquivalents?: Record<string, string>;
  /** "edit": filling in or correcting a finished session — no timer, no end button. */
  mode?: "live" | "edit";
}) {
  const { t, locale } = useI18n();
  const r = routeDictionary(locale);
  const router = useRouter();
  const [ascents, setAscents] = useState(initialAscents);
  const [grade, setGrade] = useState<Grade>(defaultGrade);
  const [style, setStyle] = useState<RouteStyle>("LEAD");
  const [name, setName] = useState("");
  const [falls, setFalls] = useState(0);
  const [count, setCount] = useState(1);
  const [tries, setTries] = useState(1);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<{ id: string; notes: string } | null>(null);
  const L = loggingDictionary(locale);
  const [projects, setProjects] = useState(initialProjects);
  const [project, setProject] = useState<ActiveRouteProject | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const e = sessionEditDictionary(locale);
  const colours = isColourSystem(gymSystem) ? listGrades(gymSystem) : [];
  const [colour, setColour] = useState<string | null>(null);
  const [equivalents, setEquivalents] = useState(colourEquivalents);
  function chooseColour(c: string) {
    setColour(c);
    const known = equivalents[c];
    if (known && (FRENCH_ROUTE_GRADES as readonly string[]).includes(known)) setGrade(known as Grade);
  }

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);

  const index = FRENCH_ROUTE_GRADES.indexOf(grade);
  const lo = Math.max(0, Math.min(index - 4, FRENCH_ROUTE_GRADES.length - 9));
  const quickGrades = FRENCH_ROUTE_GRADES.slice(lo, lo + 9);

  function log(result: RouteResult, asProject = false) {
    const clientId = crypto.randomUUID();
    const input = {
      sessionId, clientId, grade, style, result, falls: isClean(result) ? 0 : falls,
      routeName: name, wallAngle: "UNKNOWN" as const, routeProjectId: project?.id ?? null,
      nativeGrade: colours.length ? colour : null,
      tries: isFirstGo(result) ? 1 : tries, notes,
      extraClientIds: asProject ? [] : Array.from({ length: count - 1 }, () => crypto.randomUUID()),
      asProject,
    };
    if (colours.length && !colour) { setNotice({ tone: "error", text: e.nativeColour + " ?" }); return; }
    setNotice(null);
    start(async () => {
      const res = await logRouteAscent(input);
      if (!res.ok) {
        setNotice({ tone: "error", text: res.error === "notFirstAscent" ? r.notFirst : t.common.unknownError });
        return;
      }
      const { rows, projectSent, project: created } = res.data!;
      const ids = new Set(rows.map((x) => x.id));
      setAscents((list) => [...[...rows].reverse(), ...list.filter((a) => !ids.has(a.id))]);
      if (colour) setEquivalents((m) => ({ ...m, [colour]: grade }));
      const last = rows[rows.length - 1];
      if (projectSent && last?.route_project_id) {
        const sent = projects.find((p) => p.id === last.route_project_id);
        setProjects((list) => list.filter((p) => p.id !== last.route_project_id));
        setProject(null);
        setNotice({ tone: "ok", text: fmt(r.projectSent, { name: sent?.route_name ?? last.route_name ?? "" }) });
      } else if (created) {
        setProjects((list) => [{ id: created.id, route_name: created.route_name, grade, goal_style: "LEAD" }, ...list]);
        setNotice({ tone: "ok", text: fmt(r.projectCreated, { name: created.route_name }) });
      } else {
        setNotice({ tone: "ok", text: rows.length > 1 ? fmt(L.loggedRoutes, { n: rows.length, grade })
          : fmt(r.logged, { grade, result: r.results[result] }) });
      }
      setFalls(0); setCount(1); setTries(1); setNotes("");
    });
  }

  function saveComment() {
    if (!editing) return;
    const { id, notes: text } = editing;
    setAscents((list) => list.map((a) => a.id === id ? { ...a, notes: text } : a));
    setEditing(null);
    start(async () => {
      const res = await updateRouteAscent({ id, notes: text });
      setNotice(res.ok ? { tone: "ok", text: L.saved } : { tone: "error", text: t.common.unknownError });
    });
  }

  function remove(id: string) {
    const before = ascents;
    setAscents((list) => list.filter((a) => a.id !== id));
    start(async () => {
      const res = await deleteRouteAscent(id);
      if (!res.ok) { setAscents(before); setNotice({ tone: "error", text: t.common.unknownError }); }
    });
  }

  function chooseProject(p: ActiveRouteProject | null) {
    setProject(p);
    if (p) {
      setName(p.route_name);
      if ((FRENCH_ROUTE_GRADES as readonly string[]).includes(p.grade)) setGrade(p.grade as Grade);
      setStyle(p.goal_style);
    } else setName("");
  }

  function trackAsProject(a: RouteAscentRow) {
    if (!a.route_name) return;
    start(async () => {
      const res = await createRouteProject({ gymId, routeName: a.route_name, grade: a.grade, goalStyle: "LEAD", notes: "" });
      if (!res.ok || !res.data) { setNotice({ tone: "error", text: t.common.unknownError }); return; }
      const projectId = res.data.id;
      // The server attached earlier goes of this named route; mirror that locally.
      const key = routeKey(a.route_name!);
      setAscents((list) => list.map((x) => x.route_name && routeKey(x.route_name) === key ? { ...x, route_project_id: projectId } : x));
      const alreadySent = ascents.some((x) => x.route_name && routeKey(x.route_name) === key && completesProject(x.result, x.style, "LEAD"));
      if (!alreadySent) setProjects((list) => list.some((p) => p.id === projectId) ? list
        : [{ id: projectId, route_name: a.route_name!, grade: a.grade, goal_style: "LEAD" }, ...list]);
      setNotice({ tone: "ok", text: fmt(r.projectCreated, { name: a.route_name! }) });
    });
  }

  function finish() {
    if (!window.confirm(r.endConfirm)) return;
    start(async () => {
      const res = await endSession(sessionId);
      if (!res.ok) { setNotice({ tone: "error", text: t.common.unknownError }); return; }
      router.refresh();
    });
  }

  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));

  return <div className="space-y-5 pb-6">
    {mode === "live" ? <header className="flex items-start justify-between gap-3">
      <div>
        <p className="leblond-eyebrow text-accent">● {r.routeSession}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">{gymName}</h1>
      </div>
      <p className="text-right"><span className="block text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{t.session.elapsed}</span>
        <span className="text-2xl font-black tabular-nums" role="timer">{formatClock(elapsed)}</span></p>
    </header> : <h2 className="text-lg font-black">{gymName} · {r.routeSession}</h2>}

    <section aria-labelledby="route-log" className="leblond-premium-surface space-y-5 p-4 sm:p-6">
      <h2 id="route-log" className="sr-only">{r.logHint}</h2>
      <p className="text-sm text-ink-2">{r.logHint}</p>
      {projects.length ? <fieldset>
        <legend className="text-sm font-bold">{r.projectsHere}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {projects.map((p) => <button key={p.id} type="button" aria-pressed={project?.id === p.id}
            onClick={() => chooseProject(project?.id === p.id ? null : p)}
            className={cn("min-h-11 rounded-full border px-4 text-sm font-bold",
              project?.id === p.id ? "border-accent bg-accent text-accent-ink" : "border-accent/30 bg-accent-soft text-accent")}>
            ★ {p.route_name} · {p.grade}
          </button>)}
        </div>
      </fieldset> : null}
      {colours.length ? <fieldset>
        <legend className="text-sm font-bold">{e.nativeColour}</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {colours.map((g) => <button key={g.id} type="button" aria-pressed={colour === g.id} onClick={() => chooseColour(g.id)}
            style={g.swatch ? { backgroundColor: g.swatch, color: g.swatchText } : undefined}
            className={cn("min-h-12 rounded-xl border px-1 text-xs font-extrabold uppercase",
              colour === g.id ? "ring-4 ring-accent ring-offset-2" : "border-line")}>
            {(t.grades.colors as Record<string, string>)[g.id] ?? g.id}
          </button>)}
        </div>
      </fieldset> : null}
      <fieldset>
        <legend className="text-sm font-bold">{colours.length ? e.frenchEquivalent : r.grade}</legend>
        {colours.length ? <p className="mt-1 text-xs text-ink-3">{e.frenchHint}</p> : null}
        <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-9">
          {quickGrades.map((g) => <button key={g} type="button" aria-pressed={grade === g} onClick={() => setGrade(g)}
            className={cn("min-h-12 rounded-xl border text-base font-extrabold tabular-nums",
              grade === g ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface")}>{g}</button>)}
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-ink-2">{r.moreGrades}
          <select value={grade} onChange={(e) => setGrade(e.target.value as Grade)}
            className="min-h-10 rounded-lg border border-line bg-surface px-2 font-bold text-ink">
            {FRENCH_ROUTE_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold">{r.style}</legend>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
          {ROUTE_STYLES.map((s) => <button key={s} type="button" aria-pressed={style === s} onClick={() => setStyle(s)}
            className={cn("min-h-12 rounded-xl text-sm font-bold", style === s ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
            {r.styles[s]}</button>)}
        </div>
      </fieldset>
      <label className="block text-sm font-bold">{r.routeName}
        <input value={name} maxLength={120} disabled={!!project} onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-normal" />
        <span className="mt-1 block text-xs font-normal text-ink-3">{r.routeNameHint}</span>
      </label>
      <Stepper label={L.howManyRoutes} value={count} min={1} max={30} onChange={setCount} />
      <Stepper label={L.tries} hint={L.triesRouteHint} value={tries} min={1} max={100} onChange={setTries} />
      <label className="block text-sm font-bold">{L.comment}
        <textarea value={notes} maxLength={500} rows={2} placeholder={L.commentPlaceholder} onChange={(ev) => setNotes(ev.target.value)}
          className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-normal" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold" id="falls-label">{r.falls}</span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="falls-label">
          <button type="button" aria-label={r.removeFall} onClick={() => setFalls((f) => Math.max(0, f - 1))}
            className="h-12 w-12 rounded-full border border-line bg-surface text-xl font-bold">−</button>
          <span className="w-8 text-center text-xl font-black tabular-nums" aria-live="polite">{falls}</span>
          <button type="button" aria-label={r.addFall} onClick={() => setFalls((f) => Math.min(50, f + 1))}
            className="h-12 w-12 rounded-full border border-line bg-surface text-xl font-bold">+</button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {ROUTE_RESULTS.map((res) => <button key={res} type="button" disabled={pending || (isFirstGo(res) && tries > 1)} onClick={() => log(res)}
          style={toneButtonStyle(routeTone(res))}
          className="min-h-16 rounded-2xl border px-3 py-2 text-left disabled:opacity-40 sm:text-center">
          <strong className="block text-base"><span aria-hidden>{routeSymbol(res)} </span>{r.results[res]}</strong>
          <span className="block text-xs opacity-80">{isFirstGo(res) && tries > 1 ? L.flashOnlyOne : r.resultHints[res]}</span>
        </button>)}
        <button type="button" disabled={pending || count > 1} onClick={() => log(falls > 0 ? "TOP_WITH_REST" : "ATTEMPT", true)}
          style={toneButtonStyle("project")}
          className="min-h-16 rounded-2xl border px-3 py-2 text-left disabled:opacity-40 sm:text-center">
          <strong className="block text-base"><span aria-hidden>★ </span>{L.project}</strong>
          <span className="block text-xs opacity-80">{fmt(L.routeProjectName, { grade })}</span>
        </button>
      </div>
      {notice ? <p role={notice.tone === "error" ? "alert" : "status"}
        className={cn("text-sm font-semibold", notice.tone === "error" ? "text-danger" : "text-ink-2")}>{notice.text}</p> : null}
    </section>

    <section aria-labelledby="route-list" className="space-y-2">
      <h2 id="route-list" className="text-sm font-extrabold">{r.thisSession} · {ascents.length}</h2>
      {ascents.length === 0 ? <p className="text-sm text-ink-3">{r.noneYet}</p> :
        <ul className="space-y-2">
          {ascents.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <span className="min-w-0">
              {a.native_grade && a.native_grade_system ? <GradeChip t={t} system={a.native_grade_system} grade={a.native_grade} size="sm" className="mr-2" /> : null}
              <strong className="text-lg tabular-nums">{a.grade}</strong>
              <ResultBadge tone={routeTone(a.result)} label={r.results[a.result]} className="ml-2" />
              {a.route_project_id ? <ResultBadge tone="project" label={L.project} className="ml-1" /> : null}
              <span className="block truncate text-xs text-ink-2">{r.styles[a.style]}{a.tries > 1 ? ` · ${fmt(L.triesShort, { n: a.tries })}` : ""}{a.falls ? ` · ${a.falls} ${r.falls.toLowerCase()}` : ""}{a.route_name ? ` · ${a.route_name}` : ""}</span>
              {a.notes ? <span className="mt-1 block text-sm italic text-ink-2">“{a.notes}”</span> : null}
              {editing?.id === a.id ? <span className="mt-2 flex gap-2">
                <input value={editing.notes} maxLength={500} aria-label={L.comment} autoFocus
                  onChange={(ev) => setEditing({ id: a.id, notes: ev.target.value })}
                  className="min-h-10 flex-1 rounded-lg border border-line bg-surface px-2 text-sm" />
                <button type="button" onClick={saveComment} className="min-h-10 rounded-lg bg-accent px-3 text-xs font-bold text-accent-ink">{L.save}</button>
              </span> : <button type="button" onClick={() => setEditing({ id: a.id, notes: a.notes })}
                className="mt-1 mr-3 text-xs font-bold text-accent underline underline-offset-2">{a.notes ? L.editComment : L.addComment}</button>}
              {a.route_name && !a.route_project_id ? <button type="button" disabled={pending} onClick={() => trackAsProject(a)}
                className="mt-1 text-xs font-bold text-accent underline underline-offset-2">{r.followAsProject}</button> : null}
            </span>
            <button type="button" onClick={() => remove(a.id)} className="min-h-10 rounded-lg px-3 text-xs font-bold text-danger">{r.remove}</button>
          </li>)}
        </ul>}
    </section>

    {mode === "live" ? <button type="button" disabled={pending} onClick={finish}
      className="min-h-14 w-full rounded-2xl bg-ink text-base font-black text-surface disabled:opacity-60">{r.end}</button> : null}
  </div>;
}

const isFirstGo = (r: RouteResult) => r === "ONSIGHT" || r === "FLASH";
const routeSymbol = (r: RouteResult) => (isFirstGo(r) ? "⚡" : r === "REDPOINT" || r === "TOP_WITH_REST" ? "✓" : "·");

/** − value + control with large touch targets. */
export function Stepper({ label, hint, value, min, max, onChange }: {
  label: string; hint?: string; value: number; min: number; max: number; onChange: (n: number) => void;
}) {
  const id = "stepper-" + label.replace(/\W+/g, "-").toLowerCase();
  return <div className="flex items-center justify-between gap-3">
    <span><span className="block text-sm font-bold" id={id}>{label}</span>{hint ? <span className="block text-xs text-ink-3">{hint}</span> : null}</span>
    <div className="flex items-center gap-2" role="group" aria-labelledby={id}>
      <button type="button" aria-label={label + " −"} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}
        className="h-12 w-12 rounded-full border border-line bg-surface text-xl font-bold disabled:opacity-40">−</button>
      <span className="w-8 text-center text-xl font-black tabular-nums" aria-live="polite">{value}</span>
      <button type="button" aria-label={label + " +"} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}
        className="h-12 w-12 rounded-full border border-line bg-surface text-xl font-bold disabled:opacity-40">+</button>
    </div>
  </div>;
}
