"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { applyActivityTiming, linkActivityToSession } from "@/lib/actions/wearables";
import { formatDate, formatDuration } from "@/lib/format";
import { compareTiming, type TimingComparison, type TimingSide } from "@/lib/integrations/wearables/timing";

type SessionTiming = { startedAt: string; endedAt: string | null; durationMinutes: number | null };
type ActivityTimingInput = { startedAt: string; durationSeconds: number };

function useErrorText() {
  const { t } = useI18n();
  return (code: string) =>
    code === "liveSession" ? t.session.timingLive
      : code === "noTiming" ? t.session.timingUnusable
        : code === "invalidDate" ? t.session.timingFuture : t.common.unknownError;
}

/** Watch vs session, side by side, in the climber's time zone (Europe/Paris). */
function TimingTable({ cmp }: { cmp: TimingComparison }) {
  const { t, locale } = useI18n();
  const line = (s: TimingSide) =>
    `${formatDate(`${s.date}T12:00:00Z`, locale, { weekday: "short", day: "numeric", month: "short" })} · ${s.start}${s.end ? ` → ${s.end}` : ""} · ${formatDuration(s.minutes)}`;
  return (
    <dl aria-label={t.session.timingTitle} className="divide-y divide-line rounded-xl border border-line bg-surface-2 px-3 text-sm">
      {([[t.session.timingWatch, cmp.activity], [t.session.timingSession, cmp.session]] as const).map(([label, side]) => (
        <div key={label} className="flex flex-wrap justify-between gap-x-3 py-2">
          <dt className="font-semibold text-ink-2">{label}</dt>
          <dd className="font-semibold tabular-nums">{line(side)}</dd>
        </div>
      ))}
    </dl>
  );
}

function reasonText(cmp: TimingComparison, t: ReturnType<typeof useI18n>["t"]): string | null {
  if (cmp.reason === "live") return t.session.timingLive;
  if (cmp.reason === "noTiming") return t.session.timingUnusable;
  if (cmp.reason === "future") return t.session.timingFuture;
  return cmp.differs ? null : t.session.timingSame;
}

/** Pick an imported activity, compare its times with the session's, then link — with or without its times. */
export function LinkActivity({ options, sessionId, session }: {
  options: Array<{ id: string; label: string } & ActivityTimingInput>;
  sessionId: string;
  session: SessionTiming;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [value, setValue] = useState(options[0]?.id ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const chosen = options.find((o) => o.id === value);
  const cmp = chosen ? compareTiming(chosen, session) : null;
  const note = cmp ? reasonText(cmp, t) : null;

  function link(useActivityTiming: boolean) {
    setError("");
    start(async () => {
      const r = await linkActivityToSession(value, sessionId, { useActivityTiming });
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
      {cmp ? <TimingTable cmp={cmp} /> : null}
      {note ? <p className="text-sm text-ink-2">{note}</p> : null}
      {cmp?.differs && cmp.usable ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button disabled={pending || !value} onClick={() => link(true)}>{t.session.timingUseWatch}</Button>
          <Button variant="secondary" disabled={pending || !value} onClick={() => link(false)}>{t.session.timingKeep}</Button>
        </div>
      ) : (
        <Button disabled={pending || !value} onClick={() => link(false)}>{t.connections.linkTo}</Button>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

/** For a linked activity: where the session's times come from, and the option to take the watch's. */
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
  if (timingSource === "ACTIVITY") {
    return <p className="mt-3 text-sm font-semibold text-ink-2">⌚ {t.session.timingFromWatch}</p>;
  }
  const cmp = compareTiming(activity, session);
  const note = reasonText(cmp, t);
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-semibold text-ink-2">✎ {t.session.timingManual}</p>
      {cmp.differs ? <TimingTable cmp={cmp} /> : null}
      {note && cmp.differs ? <p className="text-sm text-ink-2">{note}</p> : null}
      {cmp.differs && cmp.usable ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t.session.timingConfirm)) return;
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
