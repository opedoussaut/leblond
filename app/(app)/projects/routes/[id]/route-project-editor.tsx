"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";
import { deleteRouteProject, updateRouteProject } from "@/lib/actions/route-projects";
import { ROUTE_STYLES, type RouteProjectStatus, type RouteStyle } from "@/lib/climbing/routes";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { routeDictionary } from "@/lib/i18n/routes";

const field = "mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink";

export function RouteProjectEditor({ project }: {
  project: { id: string; grade: string; goalStyle: RouteStyle; status: RouteProjectStatus; notes: string };
}) {
  const { t, locale } = useI18n();
  const r = routeDictionary(locale);
  const router = useRouter();
  const [grade, setGrade] = useState(project.grade);
  const [goal, setGoal] = useState(project.goalStyle);
  const [notes, setNotes] = useState(project.notes);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save(status: RouteProjectStatus) {
    setMessage(null);
    start(async () => {
      const res = await updateRouteProject({ id: project.id, grade, goalStyle: goal, status, notes });
      setMessage(res.ok ? { ok: true, text: r.saved } : { ok: false, text: t.common.unknownError });
      if (res.ok) router.refresh();
    });
  }

  return <Card className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm font-semibold">{r.grade}
        <select className={field} value={grade} onChange={(e) => setGrade(e.target.value)}>
          {FRENCH_ROUTE_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">{r.goalStyle}
        <select className={field} value={goal} onChange={(e) => setGoal(e.target.value as RouteStyle)}>
          {ROUTE_STYLES.map((s) => <option key={s} value={s}>{r.styles[s]}</option>)}
        </select>
      </label>
    </div>
    <label className="block text-sm font-semibold">{r.notes}
      <textarea className={field} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </label>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => save(project.status)}
        className="min-h-12 rounded-full bg-accent px-5 text-sm font-extrabold text-accent-ink disabled:opacity-60">{r.save}</button>
      {project.status !== "SENT" ? <button type="button" disabled={pending} onClick={() => save("SENT")}
        className="min-h-12 rounded-full border border-line bg-surface px-5 text-sm font-bold">{r.markSent}</button> : null}
      {project.status === "ACTIVE" ? <button type="button" disabled={pending} onClick={() => save("ABANDONED")}
        className="min-h-12 rounded-full border border-line bg-surface px-5 text-sm font-bold">{r.abandon}</button>
        : <button type="button" disabled={pending} onClick={() => save("ACTIVE")}
          className="min-h-12 rounded-full border border-line bg-surface px-5 text-sm font-bold">{r.reactivate}</button>}
    </div>
    {message ? <p role={message.ok ? "status" : "alert"} className={"text-sm font-semibold " + (message.ok ? "text-ink-2" : "text-danger")}>{message.text}</p> : null}
    <button type="button" disabled={pending} onClick={() => {
      if (!window.confirm(r.deleteConfirm)) return;
      start(async () => { const res = await deleteRouteProject(project.id); if (res.ok) router.push("/projects"); });
    }} className="text-sm font-bold text-danger underline underline-offset-4">{r.deleteProject}</button>
  </Card>;
}
