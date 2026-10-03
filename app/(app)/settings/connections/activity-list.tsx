"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { deleteActivity, linkActivityToSession } from "@/lib/actions/wearables";
import { formatDateTime, formatDuration } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { overlapsSession } from "@/lib/integrations/wearables/overlap";

type Activity = {
  id: string;
  provider: string;
  started_at: string;
  duration_seconds: number;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  calories: number | null;
  device_name: string | null;
  session_id: string | null;
};
type SessionOpt = { id: string; startedAt: string; endedAt: string | null; gymName: string };

export function ActivityList({ activities, sessions, locale }: { activities: Activity[]; sessions: SessionOpt[]; locale: Locale }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, string>>({});
  if (activities.length === 0) return <p className="mt-2 text-sm text-ink-2">{t.connections.noActivities}</p>;

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <ul className="mt-2 divide-y divide-line">
      {activities.map((a) => {
        const linked = sessions.find((s) => s.id === a.session_id);
        const candidates = sessions.filter((s) =>
          overlapsSession(
            { startedAt: new Date(a.started_at), durationSeconds: a.duration_seconds },
            { startedAt: new Date(s.startedAt), endedAt: s.endedAt ? new Date(s.endedAt) : null },
          ),
        );
        const options = candidates.length ? candidates : sessions;
        const selected = choice[a.id] ?? options[0]?.id ?? "";
        return (
          <li key={a.id} className="space-y-2 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{formatDateTime(a.started_at, locale)}</span>
              <span className="text-xs text-ink-3">{a.device_name ?? a.provider}</span>
            </div>
            <p className="text-sm tabular-nums text-ink-2">
              {formatDuration(a.duration_seconds / 60)}
              {a.avg_heart_rate != null ? ` · ${t.session.avgHr} ${a.avg_heart_rate}` : ""}
              {a.max_heart_rate != null ? ` · ${t.session.maxHr} ${a.max_heart_rate}` : ""}
              {a.calories != null ? ` · ${a.calories} kcal` : ""}
            </p>
            {linked ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/session/${linked.id}`} className="text-accent underline-offset-2 hover:underline">
                  {fmt(t.connections.linkedTo, { date: formatDateTime(linked.startedAt, locale) })}
                </Link>
                <Button variant="ghost" disabled={pending} onClick={() => run(() => linkActivityToSession(a.id, null))}>
                  {t.session.unlink}
                </Button>
              </div>
            ) : options.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`link-${a.id}`}>
                  {t.connections.linkTo}
                </label>
                <Select
                  id={`link-${a.id}`}
                  value={selected}
                  onChange={(e) => setChoice((c) => ({ ...c, [a.id]: e.target.value }))}
                  className="max-w-xs"
                >
                  {options.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatDateTime(s.startedAt, locale)} · {s.gymName}
                      {candidates.includes(s) ? " ✓" : ""}
                    </option>
                  ))}
                </Select>
                <Button disabled={pending || !selected} onClick={() => run(() => linkActivityToSession(a.id, selected))}>
                  {t.connections.linkTo}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-ink-3">{t.connections.notLinked}</p>
            )}
            <Button variant="ghost" disabled={pending} onClick={() => run(() => deleteActivity(a.id))}>
              {t.connections.deleteActivity}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
