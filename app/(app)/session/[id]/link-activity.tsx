"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { linkActivityToSession } from "@/lib/actions/wearables";

export function LinkActivity({ options, sessionId }: { options: Array<{ id: string; label: string }>; sessionId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState(options[0]?.id ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label htmlFor="link-activity" className="text-sm font-semibold">
        {t.session.linkActivity}
      </label>
      <Select id="link-activity" value={value} onChange={(e) => setValue(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
      <Button
        disabled={pending || !value}
        onClick={() =>
          start(async () => {
            await linkActivityToSession(value, sessionId);
            router.refresh();
          })
        }
      >
        {t.connections.linkTo}
      </Button>
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
