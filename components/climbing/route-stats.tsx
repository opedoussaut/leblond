import Link from "next/link";
import { routeAscentsInLastDays, routeWorkingGrade, summarizeRoutes, type RouteAscentFact } from "@/lib/analytics/routes";
import { formatRatio } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { routeDictionary } from "@/lib/i18n/routes";

/** Observed route statistics (French sport grades), always separate from bouldering. */
export function RouteStats({ locale, ascents, now, days = 30, title }: {
  locale: Locale; ascents: RouteAscentFact[]; now: Date; days?: number | null; title?: string;
}) {
  const r = routeDictionary(locale);
  const fr = locale === "fr";
  const recent = days ? routeAscentsInLastDays(ascents, days, now) : ascents;
  const s = summarizeRoutes(recent);
  const working = routeWorkingGrade(ascents, now);
  const max = Math.max(1, ...s.pyramid.map((p) => p.clean));
  return <section aria-labelledby="route-stats-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="route-stats-heading" className="text-xl font-extrabold">{title ?? r.sectionTitle}</h2>
      <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-2">
        {fr ? "Observé · carnet de voie" : "Observed · route log"}
      </span>
    </div>
    {s.ascents === 0 ? <p className="text-sm text-ink-2">{r.noRoutes}{" "}
      <Link href="/session/new" className="font-bold text-accent underline">{fr ? "Commencer une séance" : "Start a session"}</Link></p>
      : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [fr ? "Voies" : "Routes", String(s.ascents), `${s.lead} ${r.styles.LEAD.toLowerCase()} · ${s.toprope + s.autobelay} ${fr ? "autres" : "other"}`],
          [fr ? "Enchaînées" : "Clean", String(s.clean), `${s.onsights} ${r.onsights} · ${s.flashes} flash`],
          [r.cleanRate, formatRatio(s.cleanRate), undefined],
          [r.highestLead, s.highestLeadClean ?? "—", s.highestOnsight ? `${r.highestOnsight} ${s.highestOnsight}` : undefined],
        ].map(([label, value, hint]) => <div key={label} className="rounded-2xl bg-surface-2 p-4">
          <p className="text-xs font-semibold text-ink-3">{label}</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-[11px] text-ink-3">{hint}</p> : null}
        </div>)}
      </div>}
    {s.pyramid.length ? <div>
      <h3 className="text-sm font-bold">{r.pyramid}</h3>
      <ul className="mt-2 space-y-1.5" aria-label={r.pyramid}>
        {s.pyramid.map((p) => <li key={p.grade} className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2 text-sm">
          <span className="font-bold tabular-nums">{p.grade}</span>
          <span className="h-3 rounded-full bg-accent-soft"><span className="block h-3 rounded-full bg-accent" style={{ width: `${(p.clean / max) * 100}%` }} /></span>
          <span className="text-right tabular-nums text-ink-2">{p.clean}</span>
        </li>)}
      </ul>
    </div> : null}
    <p className="text-sm text-ink-2"><strong>{r.workingGrade} :</strong> {working.grade ?? r.insufficient} <span className="text-ink-3">(n = {working.sampleSize})</span></p>
    <p className="text-xs text-ink-3">{r.workingRule} {r.topropeNote} {r.separateScales}</p>
  </section>;
}
