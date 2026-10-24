import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/card";
import { countActivity, summarizeRoutes } from "@/lib/analytics";
import { routeDictionary } from "@/lib/i18n/routes";
import { sessionEditDictionary } from "@/lib/i18n/session-edit";
import { requireViewer } from "@/lib/auth/viewer";
import { toAttemptFact } from "@/lib/data/climbing";
import { formatDateTime, formatDuration } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Séances" };

export default async function SessionsPage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const { data: sessions } = await viewer.supabase
    .from("sessions")
    .select("id, started_at, ended_at, duration_minutes, discipline, gyms(name, brand)")
    .order("started_at", { ascending: false })
    .limit(50);
  const ids = (sessions ?? []).map((s) => s.id);
  const { data: attempts } = ids.length
    ? await viewer.supabase.from("attempts").select("*").in("session_id", ids)
    : { data: [] };
  const facts = (attempts ?? []).map(toAttemptFact);
  const { data: routeRows } = ids.length
    ? await viewer.supabase.from("route_ascents").select("id, session_id, grade, style, result, falls, created_at").in("session_id", ids)
    : { data: [] };
  const routeFacts = (routeRows ?? []).map((a) => ({ id: a.id, sessionId: a.session_id, grade: a.grade, style: a.style,
    result: a.result, falls: a.falls, createdAt: new Date(a.created_at) }));
  const r = routeDictionary(locale);
  const live = (sessions ?? []).find((s) => !s.ended_at);

  return (
    <div className="space-y-6">
      <PageHeader title={t.session.title} />
      {live ? (
        <Card className="border-accent">
          <p className="text-xs font-bold uppercase tracking-wider text-ok">● {t.session.active}</p>
          <p className="mt-1 font-semibold">{live.gyms?.name}</p>
          <LinkButton href={`/session/${live.id}`} size="lg" className="mt-3 w-full">
            {t.session.resume}
          </LinkButton>
        </Card>
      ) : (
        <LinkButton href="/session/new" size="xl" className="w-full">
          + {t.session.start}
        </LinkButton>
      )}
      <LinkButton href="/session/new?where=past" variant="secondary" size="lg" className="w-full">
        ↺ {sessionEditDictionary(locale).pastTitle}
      </LinkButton>

      <section className="space-y-3">
        <SectionTitle>{t.session.history}</SectionTitle>
        {sessions && sessions.filter((s) => s.ended_at).length > 0 ? (
          <ul className="space-y-2">
            {sessions
              .filter((s) => s.ended_at)
              .map((s) => {
                const c = countActivity(facts.filter((a) => a.sessionId === s.id));
                const rs = s.discipline === "ROUTE" ? summarizeRoutes(routeFacts.filter((a) => a.sessionId === s.id)) : null;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/session/${s.id}`}
                      className="block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{s.gyms?.name}</span>
                        <span className="shrink-0 text-xs text-ink-3">{formatDateTime(s.started_at, locale)}</span>
                      </div>
                      <p className="mt-1 text-sm tabular-nums text-ink-2">
                        {rs ? <>
                          {r.route} · {formatDuration(s.duration_minutes)} · {rs.ascents} {r.climbed} · {rs.clean} {r.clean}
                          {rs.highestClean ? ` · max ${rs.highestClean.grade}` : ""}
                        </> : <>
                          {formatDuration(s.duration_minutes)} · {c.problems} {t.session.problems} · {c.tops}{" "}
                          {t.session.tops} · {c.flashes} {t.session.flashes} · {c.attempts} {t.session.attempts}
                        </>}
                      </p>
                    </Link>
                  </li>
                );
              })}
          </ul>
        ) : (
          <EmptyState body={t.session.noSessions} />
        )}
      </section>
    </div>
  );
}
