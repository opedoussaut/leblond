import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/viewer";
import { loadSessionView } from "@/lib/data/session";
import { getI18n } from "@/lib/i18n/server";
import { SessionSummaryView } from "./summary";
import { RouteSessionSummary } from "./route-summary";
import { SessionLogger, loadRouteAscents } from "./session-logger";

export default async function SessionPage({ params }: PageProps<"/session/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const view = await loadSessionView(viewer.supabase, id);
  if (!view) notFound();

  if (!view.session.ended_at) return <SessionLogger viewer={viewer} view={view} mode="live" />;

  if (view.session.discipline === "ROUTE") {
    const { locale } = await getI18n(viewer.profile.preferred_language);
    const ascents = await loadRouteAscents(viewer, view.session.id);
    return <RouteSessionSummary locale={locale} session={view.session} gymName={view.gym.name} ascents={ascents} />;
  }
  return <SessionSummaryView viewer={viewer} view={view} />;
}
