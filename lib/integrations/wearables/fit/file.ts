import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import type { Json } from "@/lib/supabase/database.types";
import { fitImportDictionary } from "@/lib/i18n/fit-import";
import { utcToZoned } from "@/lib/time";
import { pickVenue, resolveDiscipline, trainingMethodId, type DetectionSource, type VenueOption, type VenuePick } from "./classify";
import { activityNameOf, importedWhat, pickVenueHref, readImportedAs, type FileChoice, type ImportedAs } from "./import-flow";

/**
 * Files an imported watch activity in the journal (one-step FIT import):
 * creates the climbing séance (venue found from the watch's position or the
 * climber's habits) or the training séance, with the watch's date, start time
 * and duration, and links the activity to it. RLS applies throughout.
 */
export type FileOutcome =
  | { ok: true; href: string }
  | { ok: false; error: "not_found" | "already" | "future" | "not_empty" | "unknown"; href?: string }
  | { ok: false; error: "needs_venue"; href: string };

const ACTIVITY_COLUMNS = "id, started_at, duration_seconds, session_id, training_session_id, raw_metadata, activity_type" as const;
const GYM_COLUMNS = "id, latitude, longitude, brand, external_provider, has_bouldering, has_routes" as const;

type GymRow = { id: string; latitude: number | null; longitude: number | null; brand: string; external_provider: string | null;
  has_bouldering: boolean; has_routes: boolean };
const isOutdoor = (g: { brand: string; external_provider: string | null }) => g.brand === "OUTDOOR" || g.external_provider !== null;
const toVenue = (g: GymRow): VenueOption => ({
  id: g.id, latitude: g.latitude, longitude: g.longitude, outdoor: isOutdoor(g), hasBouldering: g.has_bouldering, hasRoutes: g.has_routes,
});

/** The watch may run a few minutes fast; anything later is a clock problem, not a séance. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

export async function fileActivity(
  viewer: Viewer,
  activityId: string,
  choice: FileChoice,
  opts: { by: DetectionSource | "climber"; start?: { lat: number; lon: number } | null },
): Promise<FileOutcome> {
  const supabase = viewer.supabase;
  const { data: activity } = await supabase.from("wearable_activities").select(ACTIVITY_COLUMNS).eq("id", activityId).maybeSingle();
  if (!activity) return { ok: false, error: "not_found" };
  if (activity.session_id) return { ok: false, error: "already", href: `/session/${activity.session_id}` };
  if (activity.training_session_id) return { ok: false, error: "already", href: `/train/sessions/${activity.training_session_id}` };
  const startedAt = new Date(activity.started_at);
  if (startedAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS) return { ok: false, error: "future" };
  const endedAt = new Date(startedAt.getTime() + activity.duration_seconds * 1000);
  const minutes = Math.round(activity.duration_seconds / 60);
  const meta = (activity.raw_metadata && typeof activity.raw_metadata === "object" ? activity.raw_metadata : {}) as Record<string, Json>;
  const mark = (importedAs: ImportedAs) =>
    supabase.from("wearable_activities").update({ raw_metadata: { ...meta, importedAs: { ...importedAs } } as Json }).eq("id", activityId);

  if (choice.kind === "CLIMB") {
    const venue = await findVenue(viewer, choice, opts.start ?? null);
    if (!venue) return { ok: false, error: "needs_venue", href: pickVenueHref(activityId) };
    const { data: session, error } = await supabase.from("sessions").insert({
      gym_id: venue.gymId, user_id: viewer.userId, source: "IMPORT", discipline: venue.discipline,
      started_at: startedAt.toISOString(), ended_at: endedAt.toISOString(), duration_minutes: Math.min(1440, minutes),
    }).select("id").single();
    if (error || !session) return { ok: false, error: "unknown" };
    // The watch wins: linking gives the séance the activity's exact times.
    const { error: linkError } = await supabase.rpc("link_wearable_activity", { p_activity_id: activityId, p_session_id: session.id });
    if (linkError) {
      await supabase.from("sessions").delete().eq("id", session.id);
      return { ok: false, error: "unknown" };
    }
    await mark({ what: importedWhat({ kind: "CLIMB", discipline: venue.discipline, setting: choice.setting }), by: opts.by, via: venue.via });
    return { ok: true, href: `/session/${session.id}` };
  }

  const name = activityNameOf(activity.raw_metadata);
  const d = fitImportDictionary(viewer.profile.preferred_language === "en" ? "en" : "fr");
  const local = utcToZoned(startedAt);
  const { data: training, error } = await supabase.from("training_sessions").insert({
    user_id: viewer.userId,
    title: (name ?? d.defaultTitle[choice.training]).slice(0, 120),
    method_id: trainingMethodId(choice.training, name),
    status: "COMPLETED",
    scheduled_date: local.date, scheduled_time: local.time,
    planned_minutes: minutes >= 5 && minutes <= 480 ? minutes : null,
    actual_minutes: Math.min(1440, minutes),
    started_at: startedAt.toISOString(), completed_at: endedAt.toISOString(),
  }).select("id").single();
  if (error || !training) return { ok: false, error: "unknown" };
  const { error: linkError } = await supabase.rpc("link_training_activity", { p_activity_id: activityId, p_training_session_id: training.id });
  if (linkError) {
    await supabase.from("training_sessions").delete().eq("id", training.id);
    return { ok: false, error: "unknown" };
  }
  await mark({ what: choice.training, by: opts.by, via: null });
  return { ok: true, href: `/train/sessions/${training.id}` };
}

/** Venue and discipline of a climbing import, or null when the climber has to pick the venue. */
async function findVenue(
  viewer: Viewer,
  choice: Extract<FileChoice, { kind: "CLIMB" }>,
  start: { lat: number; lon: number } | null,
): Promise<(VenuePick & { discipline: "BOULDER" | "ROUTE" }) | null> {
  const supabase = viewer.supabase;
  const [{ data: recent }, { data: favourites }, { data: nearby }] = await Promise.all([
    supabase.from("sessions").select("gym_id, discipline").not("ended_at", "is", null)
      .order("started_at", { ascending: false }).limit(30),
    supabase.from("favourite_gyms").select("gym_id").eq("user_id", viewer.userId),
    // Venues around where the watch started (a box a little wider than the search radius).
    start
      ? supabase.from("gyms").select(GYM_COLUMNS).eq("active", true)
        .gte("latitude", start.lat - 0.05).lte("latitude", start.lat + 0.05)
        .gte("longitude", start.lon - 0.08).lte("longitude", start.lon + 0.08)
      : Promise.resolve({ data: [] as GymRow[] }),
  ]);
  const known = [...new Set([...(recent ?? []).map((r) => r.gym_id), ...(favourites ?? []).map((f) => f.gym_id)])];
  const { data: knownGyms } = known.length
    ? await supabase.from("gyms").select(GYM_COLUMNS).in("id", known)
    : { data: [] as GymRow[] };
  const venues = new Map<string, VenueOption>();
  for (const g of [...(nearby ?? []), ...(knownGyms ?? [])] as GymRow[]) venues.set(g.id, toVenue(g));

  const discipline = resolveDiscipline(choice.discipline, choice.setting,
    (recent ?? []).map((r) => ({ discipline: r.discipline, outdoor: venues.get(r.gym_id)?.outdoor ?? false })));
  const pick = pickVenue({
    discipline, setting: choice.setting, start, venues: [...venues.values()],
    recentGymIds: (recent ?? []).map((r) => ({ gymId: r.gym_id, discipline: r.discipline })),
    favouriteIds: (favourites ?? []).map((f) => f.gym_id),
  });
  return pick ? { ...pick, discipline } : null;
}

/**
 * Corrects a one-step import while its séance is still empty: removes that
 * séance and files the activity again as the climber says (or, with
 * "PICK_VENUE", hands over to the past-séance form to choose the venue).
 */
export async function refileActivity(viewer: Viewer, activityId: string, choice: FileChoice | "PICK_VENUE"): Promise<FileOutcome> {
  const supabase = viewer.supabase;
  const { data: activity } = await supabase.from("wearable_activities").select(ACTIVITY_COLUMNS).eq("id", activityId).maybeSingle();
  if (!activity || !readImportedAs(activity.raw_metadata)) return { ok: false, error: "not_found" };
  if (activity.session_id) {
    const empty = await climbingSessionIsEmpty(viewer, activity.session_id);
    if (!empty) return { ok: false, error: "not_empty" };
    const { error } = await supabase.from("sessions").delete().eq("id", activity.session_id);
    if (error) return { ok: false, error: "unknown" };
  } else if (activity.training_session_id) {
    const empty = await trainingSessionIsEmpty(viewer, activity.training_session_id);
    if (!empty) return { ok: false, error: "not_empty" };
    const { error } = await supabase.from("training_sessions").delete().eq("id", activity.training_session_id);
    if (error) return { ok: false, error: "unknown" };
  }
  if (choice === "PICK_VENUE") {
    // From here the climber files it by hand, in the past-séance form: no longer a one-step import.
    const meta = { ...(activity.raw_metadata as Record<string, Json>) };
    delete meta.importedAs;
    await supabase.from("wearable_activities").update({ raw_metadata: meta }).eq("id", activityId);
    return { ok: true, href: pickVenueHref(activityId) };
  }
  return fileActivity(viewer, activityId, choice, { by: "climber" });
}

/** Nothing logged yet: no climb of any kind and no notes. */
export async function climbingSessionIsEmpty(viewer: Viewer, sessionId: string): Promise<boolean> {
  const supabase = viewer.supabase;
  const head = { count: "exact" as const, head: true };
  const [{ data: session }, attempts, ascents, boards] = await Promise.all([
    supabase.from("sessions").select("notes").eq("id", sessionId).maybeSingle(),
    supabase.from("attempts").select("id", head).eq("session_id", sessionId),
    supabase.from("route_ascents").select("id", head).eq("session_id", sessionId),
    supabase.from("board_ascents").select("id", head).eq("session_id", sessionId),
  ]);
  if (!session || attempts.error || ascents.error || boards.error) return false;
  return !session.notes?.trim() && !attempts.count && !ascents.count && !boards.count;
}

/** Nothing logged yet: no exercise and no notes. */
export async function trainingSessionIsEmpty(viewer: Viewer, trainingSessionId: string): Promise<boolean> {
  const supabase = viewer.supabase;
  const [{ data: session }, exercises] = await Promise.all([
    supabase.from("training_sessions").select("notes, status").eq("id", trainingSessionId).maybeSingle(),
    supabase.from("training_session_exercises").select("id", { count: "exact", head: true }).eq("session_id", trainingSessionId),
  ]);
  if (!session || exercises.error) return false;
  return session.status === "COMPLETED" && !session.notes.trim() && !exercises.count;
}
