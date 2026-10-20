"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GymPicker } from "@/components/climbing/gym-picker";
import { AreaPicker, type AreaItem } from "@/components/climbing/outdoor";
import { useI18n } from "@/components/i18n-provider";
import { Notice } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { startSession } from "@/lib/actions/sessions";
import { routeDictionary } from "@/lib/i18n/routes";
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
  const { t, locale } = useI18n();
  const r = routeDictionary(locale);
  const [choice, setChoice] = useState<Tables<"gyms"> | null>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const [tab, setTab] = useState(initialTab);

  const begin = (gymId: string, discipline: "BOULDER" | "ROUTE" = "BOULDER") =>
    start(async () => {
      const res = await startSession(gymId, discipline);
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
        <>
          <GymPicker mode="pick" gyms={gyms} favouriteIds={favouriteIds} pending={pending}
            onPick={(gym) => {
              // A venue offering both disciplines asks which one is being logged today.
              if (gym.has_bouldering && gym.has_routes) setChoice(gym);
              else begin(gym.id, gym.has_routes ? "ROUTE" : "BOULDER");
            }} />
          {choice ? (
            <section aria-labelledby="discipline-choice" className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
              <h2 id="discipline-choice" className="font-extrabold">{choice.name} · {r.chooseDiscipline}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([["BOULDER", r.boulder, r.boulderHint], ["ROUTE", r.route, r.routeHint]] as const).map(([d, label, hint]) => (
                  <button key={d} type="button" disabled={pending} onClick={() => begin(choice.id, d)}
                    className="min-h-20 rounded-2xl border border-line bg-surface p-4 text-left hover:border-accent disabled:opacity-60">
                    <strong className="block text-lg">{label}</strong>
                    <span className="mt-1 block text-sm text-ink-2">{hint}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <AreaPicker areas={areas} favouriteGymIds={favouriteIds} pending={pending} onPick={(a) => begin(a.gym_id)} />
      )}
    </div>
  );
}
