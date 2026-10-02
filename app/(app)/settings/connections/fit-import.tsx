"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button, buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { linkActivityToSession } from "@/lib/actions/wearables";

type Result =
  | { kind: "inserted"; activityId: string; suggestedSessionId: string | null }
  | { kind: "duplicate" }
  | { kind: "error"; message: string };

/** FIT upload (works for any watch that exports .fit files). */
export function FitImport() {
  const { t } = useI18n();
  const router = useRouter();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [linked, setLinked] = useState(false);
  const [pending, start] = useTransition();

  async function upload() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setLinked(false);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/uploads/fit", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        error?: string;
        activityId?: string;
        suggestedSessionId?: string | null;
      };
      if (res.ok && body.status === "inserted" && body.activityId) {
        setResult({ kind: "inserted", activityId: body.activityId, suggestedSessionId: body.suggestedSessionId ?? null });
      } else if (res.ok && body.status === "duplicate") {
        setResult({ kind: "duplicate" });
      } else {
        setResult({
          kind: "error",
          message:
            body.error === "no_activity"
              ? t.connections.fitNoSession
              : body.error === "too_large"
                ? t.connections.fitHelp
                : t.connections.fitInvalid,
        });
      }
      router.refresh();
    } catch {
      setResult({ kind: "error", message: t.common.unknownError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-3">
      <p className="text-sm text-ink-2">{t.connections.fitHelp}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className={buttonClass("secondary", "md", "cursor-pointer")}>
          {file ? file.name : t.connections.fitChoose}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".fit,application/vnd.ant.fit,application/octet-stream"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button onClick={upload} disabled={!file || busy}>
          {busy ? t.connections.fitImporting : t.connections.fitImport}
        </Button>
      </div>
      {result?.kind === "inserted" ? (
        <Notice tone="ok">
          <p>{t.connections.fitImported}</p>
          {result.suggestedSessionId && !linked ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span>{t.connections.suggested} :</span>
              <Link className="underline" href={`/session/${result.suggestedSessionId}`}>
                {t.session.title}
              </Link>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await linkActivityToSession(result.activityId, result.suggestedSessionId);
                    setLinked(r.ok);
                    router.refresh();
                  })
                }
              >
                {t.connections.linkTo}
              </Button>
            </div>
          ) : null}
          {linked ? <p className="mt-1">✓ {t.session.linkedActivity}</p> : null}
        </Notice>
      ) : null}
      {result?.kind === "duplicate" ? <Notice tone="warn">{t.connections.fitDuplicate}</Notice> : null}
      {result?.kind === "error" ? <Notice tone="error">{result.message}</Notice> : null}
    </div>
  );
}
