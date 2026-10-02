import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/card";
import { countActivity } from "@/lib/analytics";
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
    .select("id, started_at, ended_at, duration_minutes, gyms(name, brand)")
    .order("started_at", { ascending: false })
    .limit(50);
  const ids = (sessions ?? []).map((s) => s.id);
  const { data: attempts } = ids.length
    ? await viewer.supabase.from("attempts").select("*").in("session_id", ids)
    : { data: [] };
  const facts = (attempts ?? []).map(toAttemptFact);
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

      <section className="space-y-3">
        <SectionTitle>{t.session.history}</SectionTitle>
        {sessions && sessions.filter((s) => s.ended_at).length > 0 ? (
          <ul className="space-y-2">
            {sessions
              .filter((s) => s.ended_at)
              .map((s) => {
                const c = countActivity(facts.filter((a) => a.sessionId === s.id));
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
                        {formatDuration(s.duration_minutes)} · {c.problems} {t.session.problems} · {c.tops}{" "}
                        {t.session.tops} · {c.flashes} {t.session.flashes} · {c.attempts} {t.session.attempts}
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
