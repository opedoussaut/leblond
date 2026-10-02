import { Card, SectionTitle } from "@/components/ui/card";
import { formatDateTime, formatDuration } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { Tables } from "@/lib/supabase/database.types";
import { LinkActivity, UnlinkActivity } from "./link-activity";

type Candidate = { id: string; startedAt: string; durationSeconds: number; device: string | null };

/** Wearable metrics for a session — only fields that actually exist are shown. */
export async function SessionWearable({
  sessionId,
  activity,
  candidates,
}: {
  sessionId: string;
  activity: Tables<"wearable_activities"> | null;
  candidates: Candidate[];
}) {
  const { t, locale } = await getI18n();
  if (!activity) {
    return (
      <Card>
        <SectionTitle>{t.session.wearable}</SectionTitle>
        {candidates.length ? (
          <LinkActivity
            sessionId={sessionId}
            options={candidates.map((c) => ({
              id: c.id,
              label: `${formatDateTime(c.startedAt, locale)} · ${formatDuration(c.durationSeconds / 60)}${c.device ? ` · ${c.device}` : ""}`,
            }))}
          />
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            {t.session.noMatchingActivity}{" "}
            <a href="/settings/connections" className="text-accent underline-offset-2 hover:underline">
              {t.connections.fitTitle} →
            </a>
          </p>
        )}
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
      <dl className="mt-2 divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-2 text-sm">
            <dt className="text-ink-2">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-3">{t.connections.medicalNote}</p>
      <UnlinkActivity activityId={activity.id} />
    </Card>
  );
}
