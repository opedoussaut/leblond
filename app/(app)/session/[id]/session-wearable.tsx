import { Card, SectionTitle } from "@/components/ui/card";
import { formatDateTime, formatDuration } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { Tables } from "@/lib/supabase/database.types";
import { RemoveFitButton, SessionFitAttach } from "@/components/wearables/fit-attach";
import { fitAttachDictionary } from "@/lib/i18n/fit-attach";
import { ActivityTiming, LinkActivity } from "./link-activity";

type Candidate = { id: string; startedAt: string; durationSeconds: number; device: string | null };

const PROVIDER_LABEL: Record<string, string> = { COROS: "COROS", SUUNTO: "Suunto", GARMIN: "Garmin", STRAVA: "Strava" };

/**
 * Wearable metrics for a session — only fields that actually exist are shown —
 * and the FIT file control: attach, replace or remove the watch file.
 */
export async function SessionWearable({
  session,
  activity,
  candidates,
}: {
  session: Pick<Tables<"sessions">, "id" | "started_at" | "ended_at" | "duration_minutes" | "timing_source">;
  activity: Tables<"wearable_activities"> | null;
  candidates: Candidate[];
}) {
  const sessionId = session.id;
  const timing = { startedAt: session.started_at, endedAt: session.ended_at, durationMinutes: session.duration_minutes };
  const { t, locale } = await getI18n();
  const d = fitAttachDictionary(locale);
  const fitSession = { id: sessionId, ...timing };
  // The attach control stays at the same place whether or not a file is linked,
  // so its message ("times replaced… before…") survives the refresh after linking.
  const attach = <SessionFitAttach key="fit-attach" session={fitSession} hasActivity={!!activity} />;
  if (!activity) {
    return (
      <Card>
        <SectionTitle>{t.session.wearable}</SectionTitle>
        <div key="body">
          {candidates.length ? (
            <LinkActivity
              sessionId={sessionId}
              session={timing}
              options={candidates.map((c) => ({
                id: c.id,
                startedAt: c.startedAt,
                durationSeconds: c.durationSeconds,
                label: `${formatDateTime(c.startedAt, locale)} · ${formatDuration(c.durationSeconds / 60)}${c.device ? ` · ${c.device}` : ""}`,
              }))}
            />
          ) : (
            <p className="mt-2 text-sm text-ink-2">{t.session.noMatchingActivity} {d.pastHint}</p>
          )}
        </div>
        {attach}
      </Card>
    );
  }
  const rows: Array<[string, string]> = [];
  if (activity.device_name) rows.push([t.session.device, activity.device_name]);
  rows.push([t.session.elapsed, formatDuration(activity.duration_seconds / 60)]);
  if (activity.avg_heart_rate != null) rows.push([t.session.avgHr, `${activity.avg_heart_rate} bpm`]);
  if (activity.max_heart_rate != null) rows.push([t.session.maxHr, `${activity.max_heart_rate} bpm`]);
  if (activity.calories != null) rows.push([t.session.calories, `${activity.calories} kcal`]);
  if (activity.training_load != null) rows.push([t.session.trainingLoad, String(activity.training_load)]);
  return (
    <Card>
      <SectionTitle>{t.session.wearable}</SectionTitle>
      <div key="body">
        <p className="mt-1 text-xs font-semibold text-ink-3">
          {activity.provider === "FIT_IMPORT" ? t.session.importedFit : PROVIDER_LABEL[activity.provider] ?? activity.provider}
        </p>
        <dl className="mt-2 divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 text-sm">
              <dt className="text-ink-2">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <ActivityTiming
          sessionId={sessionId}
          activity={{ startedAt: activity.started_at, durationSeconds: activity.duration_seconds }}
          session={timing}
          timingSource={session.timing_source}
        />
        <p className="mt-2 text-xs text-ink-3">{t.connections.medicalNote}</p>
      </div>
      {attach}
      <RemoveFitButton key="remove" activityId={activity.id}
        label={activity.provider === "FIT_IMPORT" ? d.remove : t.session.unlink} />
    </Card>
  );
}
