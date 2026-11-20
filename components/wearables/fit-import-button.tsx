"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button, buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { IconWatch } from "@/components/ui/icons";
import { fitErrorText, timingLine } from "@/components/wearables/fit-attach";
import { fileFitImport } from "@/lib/actions/fit-import";
import { fmt } from "@/lib/i18n";
import { fitAttachDictionary } from "@/lib/i18n/fit-attach";
import { fitImportDictionary } from "@/lib/i18n/fit-import";
import { readFitImportResponse, type FileAs, type FitImportResult } from "@/lib/integrations/wearables/fit/import-flow";
import { compareTiming } from "@/lib/integrations/wearables/timing";

async function importFitFile(file: File): Promise<FitImportResult> {
  const fd = new FormData();
  fd.set("file", file);
  try {
    const res = await fetch("/api/uploads/fit/import", { method: "POST", body: fd });
    return readFitImportResponse(res.ok, await res.json().catch(() => null));
  } catch {
    return { kind: "error", code: "unknown" };
  }
}

/**
 * "Importer un fichier FIT": one tap, one file, and the séance is in the
 * journal — climbing or training, recognised from the file. Only when the file
 * cannot tell does it ask which, with two (three) buttons.
 */
export function FitImportButton({ size = "lg", className }: { size?: "md" | "lg" | "xl"; className?: string }) {
  const { locale } = useI18n();
  const d = fitImportDictionary(locale);
  const A = fitAttachDictionary(locale);
  const router = useRouter();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<Extract<FitImportResult, { kind: "ask" }> | null>(null);
  const [message, setMessage] = useState<{ text: string; href?: string } | null>(null);
  const off = busy || pending;

  function go(href: string) {
    // Navigation keeps the button busy until the séance page replaces this one.
    start(() => router.push(href));
  }

  function onResult(r: FitImportResult) {
    if (r.kind === "created" || r.kind === "needs_venue") go(r.href);
    else if (r.kind === "existing") setMessage({ text: d.existing, href: r.href });
    else if (r.kind === "ask") setAsk(r);
    else setMessage({ text: r.code === "future" ? d.future : r.code === "unknown" ? d.failed : fitErrorText(A, r.code) });
  }

  function choose(as: FileAs) {
    if (!ask) return;
    start(async () => {
      const r = await fileFitImport({ activityId: ask.activityId, as });
      if (!r.ok || !r.data) { setMessage({ text: d.failed }); return; }
      setAsk(null);
      router.push(r.data.href);
    });
  }

  const when = ask ? timingLine(compareTiming(ask, { startedAt: ask.startedAt, endedAt: ask.startedAt, durationMinutes: null }).activity, locale) : "";
  return (
    <div className={cn("space-y-3", className)} data-testid="fit-import">
      <label htmlFor={inputId} aria-disabled={off}
        className={buttonClass("secondary", size, cn("w-full", off ? "pointer-events-none cursor-default opacity-60" : "cursor-pointer"))}>
        <IconWatch /> {busy || pending ? d.uploading : d.button}
      </label>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept=".fit,application/vnd.ant.fit,application/octet-stream"
        className="sr-only"
        disabled={off}
        data-testid="fit-import-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setMessage(null);
          setAsk(null);
          setBusy(true);
          const result = await importFitFile(file);
          setBusy(false);
          if (input.current) input.current.value = "";
          onResult(result);
        }}
      />
      {ask ? (
        <Notice tone="info">
          <p className="font-semibold">{d.askTitle}</p>
          <p className="mt-1">{fmt(d.askBody, { when })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => choose("BOULDER")}>{d.asBoulder}</Button>
            <Button disabled={pending} onClick={() => choose("ROUTE")}>{d.asRoute}</Button>
            <Button disabled={pending} onClick={() => choose("TRAINING")}>{d.asTraining}</Button>
            <Button variant="ghost" disabled={pending} onClick={() => setAsk(null)}>{d.cancel}</Button>
          </div>
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.href ? "info" : "error"}>
          {message.text}
          {message.href ? <> <Link className="underline" href={message.href}>{d.open}</Link></> : null}
        </Notice>
      ) : null}
    </div>
  );
}
