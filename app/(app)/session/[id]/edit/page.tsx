import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/viewer";
import { loadSessionView } from "@/lib/data/session";
import { getI18n } from "@/lib/i18n/server";
import { sessionEditDictionary } from "@/lib/i18n/session-edit";
import { utcToZoned } from "@/lib/time";
import { SessionLogger } from "../session-logger";
import { DeleteSessionButton, SessionMetaForm } from "./session-meta-form";
import { IconCheck } from "@/components/ui/icons";
import { Notice } from "@/components/ui/card";
import { fitAttachDictionary } from "@/lib/i18n/fit-attach";
import { SessionWearableSection } from "../session-wearable-section";
import { SessionPlaceForm } from "./session-place-form";
import { listGymsWithFavourites } from "@/lib/data/gyms";
import { listOutdoorAreas, listOutdoorSites } from "@/lib/data/outdoor";

export const metadata = { title: "Modifier la séance" };

/** Edit a finished session: where and when it happened, its watch FIT file, what was climbed, or delete it. */
export default async function EditSessionPage({ params, searchParams }: PageProps<"/session/[id]/edit">) {
  const { id } = await params;
  const fitFailed = (await searchParams).fit === "failed";
  const viewer = await requireViewer();
  const view = await loadSessionView(viewer.supabase, id);
  if (!view) notFound();
  if (!view.session.ended_at) redirect(`/session/${id}`);
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const e = sessionEditDictionary(locale);
  const start = utcToZoned(view.session.started_at);
  const minutes = view.session.duration_minutes
    ?? Math.max(1, Math.round((new Date(view.session.ended_at).getTime() - new Date(view.session.started_at).getTime()) / 60_000));
  // Place and discipline are correctable (a FIT import guesses them) while nothing is logged in the séance.
  const board = view.session.discipline === "BOARD";
  const [places, areas, sites, { count: ascents }] = board ? [null, [], [], { count: 0 }] : await Promise.all([
    listGymsWithFavourites(viewer.supabase, viewer.userId),
    listOutdoorAreas(viewer.supabase),
    listOutdoorSites(viewer.supabase),
    viewer.supabase.from("route_ascents").select("id", { count: "exact", head: true }).eq("session_id", id),
  ]);
  const { count: attempts } = board ? { count: 0 } : await viewer.supabase.from("attempts")
    .select("id", { count: "exact", head: true }).eq("session_id", id);
  const locked = (attempts ?? 1) + (ascents ?? 1) > 0;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">{e.editing}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{e.editTitle}</h1>
        <p className="text-sm text-ink-2">{view.gym.name}</p>
      </div>
      <Link href={`/session/${id}`} className="inline-flex min-h-12 items-center rounded-full bg-ink px-5 text-sm font-extrabold text-surface">
        <IconCheck /> {e.done}
      </Link>
    </header>
    {fitFailed && !view.activity ? <Notice tone="error">{fitAttachDictionary(locale).linkFailed}</Notice> : null}
    {/* Attaching a FIT file changes the times: the form picks up the new ones itself (no remount). */}
    <SessionMetaForm sessionId={id} initial={{ date: start.date, time: start.time, minutes, title: view.session.title ?? "" }}
      fromWatch={view.session.timing_source === "ACTIVITY"} today={utcToZoned(new Date()).date} />
    {places ? <SessionPlaceForm sessionId={id} locked={locked} fromWatch={!!view.activity}
      current={{ id: view.gym.id, name: view.gym.name, hasBouldering: view.gym.has_bouldering, hasRoutes: view.gym.has_routes }}
      discipline={view.session.discipline === "ROUTE" ? "ROUTE" : "BOULDER"}
      gyms={places.gyms} favouriteIds={places.favouriteIds} areas={areas} sites={sites} /> : null}
    <SessionWearableSection supabase={viewer.supabase} view={view} />
    {/* A board séance's climbs are corrected on the séance page itself. */}
    {view.session.discipline === "BOARD" ? null : <section aria-label={e.logTitle} className="space-y-3">
      <SessionLogger viewer={viewer} view={view} mode="edit" />
    </section>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <Link href={`/session/${id}`} className="inline-flex min-h-12 items-center rounded-full bg-ink px-5 text-sm font-extrabold text-surface">
        <IconCheck /> {e.done}
      </Link>
      <DeleteSessionButton sessionId={id} />
    </div>
  </div>;
}
