"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button, buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { linkActivityToSession } from "@/lib/actions/wearables";
import { formatDate, formatDuration } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { fitAttachDictionary, type FitAttachDictionary } from "@/lib/i18n/fit-attach";
import { linkedSessionHref, planFitAttach, readFitUploadResponse, type FitUpload, type FitUploadErrorCode } from "@/lib/integrations/wearables/fit/attach";
import { compareTiming, type TimingSide } from "@/lib/integrations/wearables/timing";

export type FitUploaded = Extract<FitUpload, { kind: "ok" }>;

/** Sends one .fit file to the provider-neutral import endpoint. */
export async function uploadFitFile(file: File): Promise<FitUpload> {
  const fd = new FormData();
  fd.set("file", file);
  try {
    const res = await fetch("/api/uploads/fit", { method: "POST", body: fd });
    return readFitUploadResponse(res.ok, await res.json().catch(() => null));
  } catch {
    return { kind: "error", code: "unknown" };
  }
}

export function fitErrorText(d: FitAttachDictionary, code: FitUploadErrorCode): string {
  return code === "not_fit" ? d.notFit : code === "no_activity" ? d.noActivity : code === "too_large" ? d.tooLarge : d.unknown;
}

/** "sam. 7 nov. · 10:34 → 14:19 · 3h45", in the climber's time zone. */
export function timingLine(side: TimingSide, locale: Locale): string {
  const day = formatDate(`${side.date}T12:00:00Z`, locale, { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${side.start}${side.end ? ` → ${side.end}` : ""} · ${formatDuration(side.minutes)}`;
}

/** A button that opens the file picker and uploads the chosen .fit file at once. */
export function FitFileButton({ label, onUploaded, variant = "secondary", disabled = false }: {
  label: string;
  onUploaded: (result: FitUpload) => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const { locale } = useI18n();
  const d = fitAttachDictionary(locale);
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const off = disabled || busy;
  return (
    <>
      <label htmlFor={inputId} aria-disabled={off}
        className={buttonClass(variant, "md", off ? "pointer-events-none cursor-default opacity-60" : "cursor-pointer")}>
        {busy ? d.uploading : label}
      </label>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept=".fit,application/vnd.ant.fit,application/octet-stream"
        className="sr-only"
        disabled={off}
        data-testid="fit-file-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          const result = await uploadFitFile(file);
          setBusy(false);
          if (input.current) input.current.value = "";
          onUploaded(result);
        }}
      />
    </>
  );
}

type SessionTiming = { id: string; startedAt: string; endedAt: string | null; durationMinutes: number | null };

type Message =
  | { tone: "ok" | "warn" | "error" | "info"; text: string; otherHref?: string }
  | null;

/**
 * Attach or replace the FIT file of an existing climbing séance. A file that
 * overlaps the séance is linked straight away and the séance takes the watch's
 * times (said explicitly, with the times before); one that does not overlap
 * asks first; one already linked to another séance is never moved.
 */
export function SessionFitAttach({ session, hasActivity }: { session: SessionTiming; hasActivity: boolean }) {
  const { t, locale } = useI18n();
  const d = fitAttachDictionary(locale);
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pendingConfirm, setPendingConfirm] = useState<FitUploaded | null>(null);
  const [pending, start] = useTransition();

  function link(upload: FitUploaded) {
    // Timing as it is now, to say what changed once the watch's times apply.
    const cmp = compareTiming(upload, session);
    start(async () => {
      const r = await linkActivityToSession(upload.activityId, session.id);
      setPendingConfirm(null);
      if (!r.ok) { setMessage({ tone: "error", text: d.unknown }); return; }
      const detail = cmp.reason === "live" ? t.session.timingLive
        : cmp.reason === "noTiming" ? t.session.timingUnusable
          : cmp.reason === "future" ? t.session.timingFuture
            : cmp.differs ? fmt(d.timingReplaced, { after: timingLine(cmp.activity, locale), before: timingLine(cmp.session, locale) })
              : d.timingSame;
      setMessage({ tone: cmp.usable ? "ok" : "warn", text: `${d.attached} ${detail}` });
      router.refresh();
    });
  }

  function onUploaded(result: FitUpload) {
    setMessage(null);
    setPendingConfirm(null);
    if (result.kind === "error") { setMessage({ tone: "error", text: fitErrorText(d, result.code) }); return; }
    const plan = planFitAttach(result, session);
    if (plan === "already") setMessage({ tone: "info", text: d.alreadyHere });
    else if (plan === "elsewhere") setMessage({ tone: "warn", text: d.elsewhere, otherHref: linkedSessionHref(result) ?? undefined });
    else if (plan === "confirm") setPendingConfirm(result);
    else link(result);
  }

  const confirmCmp = pendingConfirm ? compareTiming(pendingConfirm, session) : null;
  return (
    <div className="mt-3 space-y-3" data-testid="session-fit-attach">
      <div className="flex flex-wrap items-center gap-2">
        <FitFileButton label={hasActivity ? d.replace : d.attach} onUploaded={onUploaded} disabled={pending}
          variant={hasActivity ? "secondary" : "primary"} />
      </div>
      {pendingConfirm && confirmCmp ? (
        <Notice tone="warn">
          <p className="font-semibold">{d.confirmTitle}</p>
          <p className="mt-1">
            {fmt(d.confirmBody, { watch: timingLine(confirmCmp.activity, locale), session: timingLine(confirmCmp.session, locale) })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => link(pendingConfirm)}>{d.confirmAttach}</Button>
            <Button variant="ghost" disabled={pending} onClick={() => setPendingConfirm(null)}>{d.cancel}</Button>
          </div>
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone}>
          {message.text}
          {message.otherHref ? (
            <>
              {" "}
              <Link className="underline" href={message.otherHref}>{d.openOther}</Link>
            </>
          ) : null}
        </Notice>
      ) : null}
    </div>
  );
}

/** Unlinks the séance's activity after a confirmation: the séance keeps its current times (as typed ones); the file stays imported. */
export function RemoveFitButton({ activityId, label }: { activityId: string; label: string }) {
  const { locale } = useI18n();
  const d = fitAttachDictionary(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="mt-2 space-y-2">
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(d.removeConfirm)) return;
          start(async () => {
            const r = await linkActivityToSession(activityId, null);
            setFailed(!r.ok);
            router.refresh();
          });
        }}
      >
        {label}
      </Button>
      {failed ? <Notice tone="error">{d.unknown}</Notice> : null}
    </div>
  );
}
