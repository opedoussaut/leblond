"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { refileFitImport } from "@/lib/actions/fit-import";
import { fitImportDictionary } from "@/lib/i18n/fit-import";
import type { FileAs, ImportedWhat } from "@/lib/integrations/wearables/fit/import-flow";

/** "Not right?": the other kinds the import could have been, and another venue for a climbing séance. */
export function FitRefile({ activityId, current }: { activityId: string; current: ImportedWhat }) {
  const { locale } = useI18n();
  const d = fitImportDictionary(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const climbing = current.startsWith("BOULDER") || current.startsWith("ROUTE");
  const options: Array<[FileAs | "PICK_VENUE", string]> = [
    ...(current.startsWith("BOULDER") ? [] : [["BOULDER", d.asBoulder] as [FileAs, string]]),
    ...(current.startsWith("ROUTE") ? [] : [["ROUTE", d.asRoute] as [FileAs, string]]),
    ...(climbing ? [["TRAINING", d.asTraining] as [FileAs, string]] : []),
    ...(climbing ? [["PICK_VENUE", d.otherVenue] as ["PICK_VENUE", string]] : []),
  ];
  return (
    <div className="mt-3 space-y-2" data-testid="fit-refile">
      <p className="text-sm">{d.notRight}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(([as, label]) => (
          <Button key={as} variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => {
            setFailed(false);
            const r = await refileFitImport({ activityId, as });
            if (!r.ok || !r.data) { setFailed(true); return; }
            router.push(r.data.href);
          })}>{label}</Button>
        ))}
      </div>
      {failed ? <Notice tone="error">{d.refileFailed}</Notice> : null}
    </div>
  );
}
