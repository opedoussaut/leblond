"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { createRouteProject } from "@/lib/actions/route-projects";
import { ROUTE_STYLES, type RouteStyle } from "@/lib/climbing/routes";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { routeDictionary } from "@/lib/i18n/routes";

const field = "mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink";

/** Create a route project at a venue that offers routes. */
export function RouteProjectForm({ gyms }: { gyms: Array<{ id: string; name: string }> }) {
  const { t, locale } = useI18n();
  const r = routeDictionary(locale);
  const router = useRouter();
  const [gymId, setGymId] = useState(gyms[0]?.id ?? "");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("6c");
  const [goal, setGoal] = useState<RouteStyle>("LEAD");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!gyms.length) return <p className="text-sm text-ink-2">{r.noRouteGyms}</p>;
  return <form aria-label={r.newProject} className="space-y-3" onSubmit={(e) => {
    e.preventDefault(); setError("");
    start(async () => {
      const res = await createRouteProject({ gymId, routeName: name, grade, goalStyle: goal, notes });
      if (!res.ok || !res.data) { setError(t.common.unknownError); return; }
      router.push("/projects/routes/" + res.data.id);
    });
  }}>
    <label className="block text-sm font-semibold">{r.gym}
      <select className={field} value={gymId} onChange={(e) => setGymId(e.target.value)}>
        {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
    </label>
    <label className="block text-sm font-semibold">{r.routeName.replace(/ \(.*\)$/, "")}
      <input className={field} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
    </label>
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
      <textarea className={field} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </label>
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <button type="submit" disabled={pending || !name.trim()}
      className="min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-accent-ink disabled:opacity-50">{r.create}</button>
  </form>;
}
