import { Card, SectionTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import { fitImportDictionary } from "@/lib/i18n/fit-import";
import type { Tables } from "@/lib/supabase/database.types";
import { RemoveTrainingFitButton } from "./training-fit";

const PROVIDER_LABEL: Record<string, string> = { COROS: "COROS", SUUNTO: "Suunto", GARMIN: "Garmin", STRAVA: "Strava" };

/** The watch activity filed as this training séance: only the fields the file actually had. */
export function TrainingWatchCard({ activity, t, locale }: {
  activity: Pick<Tables<"wearable_activities">, "id" | "provider" | "device_name" | "duration_seconds" | "avg_heart_rate"
    | "max_heart_rate" | "calories" | "training_load">;
  t: Dictionary;
  locale: Locale;
}) {
  const rows: Array<[string, string]> = [];
  if (activity.device_name) rows.push([t.session.device, activity.device_name]);
  rows.push([t.session.elapsed, formatDuration(activity.duration_seconds / 60)]);
  if (activity.avg_heart_rate != null) rows.push([t.session.avgHr, `${activity.avg_heart_rate} bpm`]);
  if (activity.max_heart_rate != null) rows.push([t.session.maxHr, `${activity.max_heart_rate} bpm`]);
  if (activity.calories != null) rows.push([t.session.calories, `${activity.calories} kcal`]);
  if (activity.training_load != null) rows.push([t.session.trainingLoad, String(activity.training_load)]);
  return (
    <Card data-testid="training-watch">
      <SectionTitle>{fitImportDictionary(locale).watchTitle}</SectionTitle>
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
      <p className="mt-2 text-xs text-ink-3">{t.connections.medicalNote}</p>
      <RemoveTrainingFitButton activityId={activity.id} />
    </Card>
  );
}
