"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { applyActivityTiming, linkActivityToSession } from "@/lib/actions/wearables";
import { formatDate, formatDuration } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { compareTiming, type TimingComparison } from "@/lib/integrations/wearables/timing";

type SessionTiming = { startedAt: string; endedAt: string | null; durationMinutes: number | null };
type ActivityTimingInput = { startedAt: string; durationSeconds: number };

function useErrorText() {
  const { t } = useI18n();
  return (code: string) =>
    code === "liveSession" ? t.session.timingLive
      : code === "noTiming" ? t.session.timingUnusable
        : code === "invalidDate" ? t.session.timingFuture : t.common.unknownError;
}

/** "sam. 7 nov. · 10:34 → 14:19 · 3h45": the watch's times, in the climber's time zone (Europe/Paris). */
function useWatchLine() {
  const { locale } = useI18n();
  return (cmp: TimingComparison) => {
    const s = cmp.activity;
    return `${formatDate(`${s.date}T12:00:00Z`, locale, { weekday: "short", day: "numeric", month: "short" })} · ${s.start}${s.end ? ` → ${s.end}` : ""} · ${formatDuration(s.minutes)}`;
  };
}

function reasonText(cmp: TimingComparison, t: ReturnType<typeof useI18n>["t"]): string | null {
  if (cmp.reason === "live") return t.session.timingLive;
  if (cmp.reason === "noTiming") return t.session.timingUnusable;
  if (cmp.reason === "future") return t.session.timingFuture;
  return null;
}

/** Pick an imported activity and link it: the session takes the watch's times (the watch wins). */
export function LinkActivity({ options, sessionId, session }: {
  options: Array<{ id: string; label: string } & ActivityTimingInput>;
  sessionId: string;
  session: SessionTiming;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const watchLine = useWatchLine();
  const router = useRouter();
  const [value, setValue] = useState(options[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const chosen = options.find((o) => o.id === value);
  const cmp = chosen ? compareTiming(chosen, session) : null;
  const note = cmp ? (reasonText(cmp, t) ?? (cmp.differs ? fmt(t.session.timingWillApply, { when: watchLine(cmp) }) : null)) : null;

  function link() {
    setError("");
    start(async () => {
      const r = await linkActivityToSession(value, sessionId);
      if (!r.ok) setError(errorText(r.error));
      router.refresh();
    });
  }

  return (
    <div className="mt-2 space-y-3">
      <label htmlFor="link-activity" className="block text-sm font-semibold">
        {t.session.linkActivity}
        <Select id="link-activity" className="mt-1" value={value} onChange={(e) => setValue(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>
      {note ? <p className="text-sm text-ink-2">{note}</p> : null}
      <Button disabled={pending || !value} onClick={link}>{t.connections.linkTo}</Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

/**
 * For a linked activity: the session's times are the watch's. Only when they
 * were corrected by hand afterwards is there a way back to the watch's.
 */
export function ActivityTiming({ sessionId, activity, session, timingSource }: {
  sessionId: string;
  activity: ActivityTimingInput;
  session: SessionTiming;
  timingSource: "MANUAL" | "ACTIVITY";
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const cmp = compareTiming(activity, session);
  if (timingSource === "ACTIVITY" || !cmp.differs) {
    return <p className="mt-3 text-sm font-semibold text-ink-2">⌚ {t.session.timingFromWatch}</p>;
  }
  const note = reasonText(cmp, t);
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-semibold text-ink-2">✎ {t.session.timingManual}</p>
      {note ? <p className="text-sm text-ink-2">{note}</p> : null}
      {cmp.usable ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setError("");
            start(async () => {
              const r = await applyActivityTiming(sessionId);
              if (!r.ok) setError(errorText(r.error));
              router.refresh();
            });
          }}
        >
          {t.session.timingApply}
        </Button>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

export function UnlinkActivity({ activityId }: { activityId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      className="mt-2"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await linkActivityToSession(activityId, null);
          router.refresh();
        })
      }
    >
      {t.session.unlink}
    </Button>
  );
}
