import Link from "next/link";
import { GradeChip } from "@/components/climbing/grade-chip";
import { ResultBadge, routeTone } from "@/components/climbing/result-badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { summarizeRoutes, type RouteAscentFact } from "@/lib/analytics/routes";
import type { RouteAscentRow } from "@/lib/actions/routes";
import type { Tables } from "@/lib/supabase/database.types";
import { formatDateTime, formatDuration, formatRatio } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/i18n";
import { sessionEditDictionary } from "@/lib/i18n/session-edit";
import { routeDictionary } from "@/lib/i18n/routes";
import { SessionDetailsForm } from "./details-form";

/** Summary of a finished ROUTE session (French sport grades only). */
export function RouteSessionSummary({ locale, session, gymName, ascents }: {
  locale: Locale; session: Tables<"sessions">; gymName: string; ascents: RouteAscentRow[];
}) {
  const r = routeDictionary(locale);
  const facts: RouteAscentFact[] = ascents.map((a) => ({
    id: a.id, sessionId: a.session_id, grade: a.grade, style: a.style, result: a.result, falls: a.falls, createdAt: new Date(a.created_at),
  }));
  const s = summarizeRoutes(facts);
  return <div className="space-y-5">
    <header className="flex items-start justify-between gap-3">
      <div>
        <p className="leblond-eyebrow text-accent">{r.summaryTitle}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">{session.title || gymName}</h1>
        {session.title ? <p className="text-sm font-semibold text-ink-2">{gymName}</p> : null}
        <p className="mt-1 text-sm text-ink-2">{formatDateTime(session.started_at, locale)} · {formatDuration(session.duration_minutes)}</p>
      </div>
      <Link href={`/session/${session.id}/edit`}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-sm font-bold text-accent">
        ✎ {sessionEditDictionary(locale).edit}
      </Link>
    </header>
    <Card>
      <div className="grid grid-cols-4 gap-3">
        <Stat value={s.ascents} label={r.climbed} />
        <Stat value={s.topped} label={r.topped} />
        <Stat value={s.clean} label={r.clean} />
        <Stat value={s.onsights} label={r.onsights} />
      </div>
      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-ink-2">{r.highestLead}</dt><dd className="font-black tabular-nums">{s.highestLeadClean ?? "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-2">{r.highestClean}</dt>
          <dd className="font-black tabular-nums">{s.highestClean ? `${s.highestClean.grade} · ${r.styles[s.highestClean.style]}` : "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-2">{r.highestOnsight}</dt><dd className="font-black tabular-nums">{s.highestOnsight ?? "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-2">{r.cleanRate}</dt><dd className="font-black tabular-nums">{formatRatio(s.cleanRate)}</dd></div>
      </dl>
    </Card>
    <section aria-labelledby="route-summary-list" className="space-y-2">
      <SectionTitle><span id="route-summary-list">{r.thisSession}</span></SectionTitle>
      {ascents.length === 0 ? <p className="text-sm text-ink-3">{r.noneYet}</p> :
        <ul className="space-y-2">
          {[...ascents].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((a) =>
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
              <span>{a.native_grade && a.native_grade_system ? <GradeChip t={getDictionary(locale)} system={a.native_grade_system} grade={a.native_grade} size="sm" className="mr-2" /> : null}
                <strong className="text-base tabular-nums">{a.grade}</strong> <ResultBadge tone={routeTone(a.result)} label={r.results[a.result]} className="ml-1" />
                {a.route_project_id ? <ResultBadge tone="project" label="★" className="ml-1" /> : null}
                {a.notes ? <span className="mt-1 block text-xs italic text-ink-2">“{a.notes}”</span> : null}</span>
              <span className="text-xs text-ink-2">{r.styles[a.style]}{a.tries > 1 ? ` · ×${a.tries}` : ""}{a.falls ? ` · ${a.falls}` : ""}{a.route_name ? ` · ${a.route_name}` : ""}</span>
            </li>)}
        </ul>}
      <p className="text-xs text-ink-3">{r.separateScales}</p>
    </section>
    <SessionDetailsForm sessionId={session.id} initial={{
      notes: session.notes ?? "", perceivedEnergyBefore: session.perceived_energy_before,
      perceivedEnergyAfter: session.perceived_energy_after, fatigue: session.fatigue, motivation: session.motivation,
    }} />
  </div>;
}
