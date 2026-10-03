"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GymPicker } from "@/components/climbing/gym-picker";
import { useI18n } from "@/components/i18n-provider";
import { Notice } from "@/components/ui/card";
import { startSession } from "@/lib/actions/sessions";
import type { Tables } from "@/lib/supabase/database.types";

export function StartSession({ gyms, favouriteIds }: { gyms: Tables<"gyms">[]; favouriteIds: string[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <div className="space-y-3">
      {error ? <Notice tone="error">{t.common.unknownError}</Notice> : null}
      <GymPicker
        mode="pick"
        gyms={gyms}
        favouriteIds={favouriteIds}
        pending={pending}
        onPick={(gym) =>
          start(async () => {
            const res = await startSession(gym.id);
            if (res.ok && res.data) router.push(`/session/${res.data.sessionId}`);
            else setError(true);
          })
        }
      />
    </div>
  );
}
