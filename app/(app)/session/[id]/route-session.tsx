"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import { endSession } from "@/lib/actions/sessions";
import { deleteRouteAscent, logRouteAscent, type RouteAscentRow } from "@/lib/actions/routes";
import { ROUTE_RESULTS, ROUTE_STYLES, isClean, type RouteResult, type RouteStyle } from "@/lib/climbing/routes";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { fmt } from "@/lib/i18n";
import { routeDictionary } from "@/lib/i18n/routes";
import { formatClock } from "@/lib/training/sessions";

type Grade = (typeof FRENCH_ROUTE_GRADES)[number];

/** Live logger for a ROUTE session: grade + style, then one tap on the result. */
export function RouteSession({ sessionId, gymName, startedAt, initialAscents, defaultGrade }: {
  sessionId: string; gymName: string; startedAt: string; initialAscents: RouteAscentRow[]; defaultGrade: Grade;
}) {
  const { t, locale } = useI18n();
  const r = routeDictionary(locale);
  const router = useRouter();
  const [ascents, setAscents] = useState(initialAscents);
  const [grade, setGrade] = useState<Grade>(defaultGrade);
  const [style, setStyle] = useState<RouteStyle>("LEAD");
  const [name, setName] = useState("");
  const [falls, setFalls] = useState(0);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);

  const index = FRENCH_ROUTE_GRADES.indexOf(grade);
  const lo = Math.max(0, Math.min(index - 4, FRENCH_ROUTE_GRADES.length - 9));
  const quickGrades = FRENCH_ROUTE_GRADES.slice(lo, lo + 9);

  function log(result: RouteResult) {
    const clientId = crypto.randomUUID();
    const input = {
      sessionId, clientId, grade, style, result, falls: isClean(result) ? 0 : falls,
      routeName: name, wallAngle: "UNKNOWN" as const,
    };
    setNotice(null);
    start(async () => {
      const res = await logRouteAscent(input);
      if (!res.ok) {
        setNotice({ tone: "error", text: res.error === "notFirstAscent" ? r.notFirst : t.common.unknownError });
        return;
      }
      setAscents((list) => [res.data!, ...list.filter((a) => a.id !== res.data!.id)]);
      setNotice({ tone: "ok", text: fmt(r.logged, { grade, result: r.results[result] }) });
      setFalls(0);
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
    <header className="flex items-start justify-between gap-3">
      <div>
        <p className="leblond-eyebrow text-accent">● {r.routeSession}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">{gymName}</h1>
      </div>
      <p className="text-right"><span className="block text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{t.session.elapsed}</span>
        <span className="text-2xl font-black tabular-nums" role="timer">{formatClock(elapsed)}</span></p>
    </header>

    <section aria-labelledby="route-log" className="leblond-premium-surface space-y-5 p-4 sm:p-6">
      <h2 id="route-log" className="sr-only">{r.logHint}</h2>
      <p className="text-sm text-ink-2">{r.logHint}</p>
      <fieldset>
        <legend className="text-sm font-bold">{r.grade}</legend>
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
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-normal" />
        <span className="mt-1 block text-xs font-normal text-ink-3">{r.routeNameHint}</span>
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
      <div className="grid gap-2 sm:grid-cols-5">
        {ROUTE_RESULTS.map((res) => <button key={res} type="button" disabled={pending} onClick={() => log(res)}
          className={cn("min-h-16 rounded-2xl px-3 py-2 text-left disabled:opacity-60 sm:text-center",
            isClean(res) ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink")}>
          <strong className="block text-base">{r.results[res]}</strong>
          <span className={cn("block text-xs", isClean(res) ? "text-accent-ink/80" : "text-ink-3")}>{r.resultHints[res]}</span>
        </button>)}
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
              <strong className="text-lg tabular-nums">{a.grade}</strong>
              <span className="ml-2 text-sm font-semibold">{r.results[a.result]}</span>
              <span className="block truncate text-xs text-ink-2">{r.styles[a.style]}{a.falls ? ` · ${a.falls} ${r.falls.toLowerCase()}` : ""}{a.route_name ? ` · ${a.route_name}` : ""}</span>
            </span>
            <button type="button" onClick={() => remove(a.id)} className="min-h-10 rounded-lg px-3 text-xs font-bold text-danger">{r.remove}</button>
          </li>)}
        </ul>}
    </section>

    <button type="button" disabled={pending} onClick={finish}
      className="min-h-14 w-full rounded-2xl bg-ink text-base font-black text-surface disabled:opacity-60">{r.end}</button>
  </div>;
}
