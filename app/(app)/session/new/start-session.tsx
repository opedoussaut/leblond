"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GymPicker } from "@/components/climbing/gym-picker";
import { AreaPicker, type AreaItem } from "@/components/climbing/outdoor";
import { useI18n } from "@/components/i18n-provider";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { startSession } from "@/lib/actions/sessions";
import type { Tables } from "@/lib/supabase/database.types";

export function StartSession({
  gyms,
  favouriteIds,
  areas,
  initialTab,
}: {
  gyms: Tables<"gyms">[];
  favouriteIds: string[];
  areas: AreaItem[];
  initialTab: "gym" | "bleau";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const [tab, setTab] = useState(initialTab);

  const begin = (gymId: string) =>
    start(async () => {
      const res = await startSession(gymId);
      if (res.ok && res.data) router.push(`/session/${res.data.sessionId}`);
      else setError(true);
    });

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={t.session.whereToday} className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
        {(
          [
            ["gym", t.outdoor.tabGym],
            ["bleau", t.outdoor.tabBleau],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "min-h-11 rounded-xl text-sm font-bold",
              tab === key ? "bg-surface text-ink shadow-sm" : "text-ink-2",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <Notice tone="error">{t.common.unknownError}</Notice> : null}
      {tab === "gym" ? (
        <GymPicker mode="pick" gyms={gyms} favouriteIds={favouriteIds} pending={pending} onPick={(gym) => begin(gym.id)} />
      ) : (
        <AreaPicker areas={areas} favouriteGymIds={favouriteIds} pending={pending} onPick={(a) => begin(a.gym_id)} />
      )}
    </div>
  );
}
