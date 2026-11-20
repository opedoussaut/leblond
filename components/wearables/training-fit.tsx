"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { unlinkTrainingActivity } from "@/lib/actions/fit-import";
import { fitAttachDictionary } from "@/lib/i18n/fit-attach";
import { fitImportDictionary } from "@/lib/i18n/fit-import";

/** Takes the FIT file off a training séance after a confirmation; the file stays imported (Réglages › Connexions). */
export function RemoveTrainingFitButton({ activityId }: { activityId: string }) {
  const { locale } = useI18n();
  const d = fitAttachDictionary(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="mt-2 space-y-2">
      <Button variant="ghost" disabled={pending} onClick={() => {
        if (!window.confirm(fitImportDictionary(locale).removeConfirm)) return;
        start(async () => {
          const r = await unlinkTrainingActivity(activityId);
          setFailed(!r.ok);
          router.refresh();
        });
      }}>{d.remove}</Button>
      {failed ? <Notice tone="error">{d.unknown}</Notice> : null}
    </div>
  );
}
