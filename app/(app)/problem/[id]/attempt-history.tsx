"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { correctAttempt, deleteLatestAttempt } from "@/lib/actions/sessions";
import { ATTEMPT_RESULTS, type AttemptResult } from "@/lib/climbing/types";
import { formatDateTime } from "@/lib/format";
import type { Tables } from "@/lib/supabase/database.types";

export function AttemptHistory({ attempts }: { attempts: Tables<"attempts">[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (attempts.length === 0) return <p className="mt-2 text-sm text-ink-2">{t.common.noData}</p>;
  const latestId = attempts.at(-1)?.id;

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error === "flashOnlyFirst" ? t.session.flashOnlyFirst : t.common.unknownError);
      setEditing(null);
      router.refresh();
    });

  return (
    <div className="mt-2">
      <ol className="divide-y divide-line">
        {attempts.map((a) => (
          <li key={a.id} className="py-2">
            <div className="flex items-center gap-3">
              <span className="w-8 text-sm tabular-nums text-ink-3">#{a.attempt_number}</span>
              <span className="font-bold uppercase tracking-wide">{t.results[a.result]}</span>
              <span className="text-xs text-ink-3">{formatDateTime(a.created_at, locale)}</span>
              <button
                type="button"
                className="ml-auto min-h-10 px-2 text-sm text-accent"
                onClick={() => setEditing(editing === a.id ? null : a.id)}
              >
                {t.session.tapToChange}
              </button>
            </div>
            {editing === a.id ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {ATTEMPT_RESULTS.filter((r) => r !== a.result && (r !== "FLASH" || a.attempt_number === 1)).map(
                  (r: AttemptResult) => (
                    <Button
                      key={r}
                      variant="secondary"
                      disabled={pending}
                      onClick={() => act(() => correctAttempt({ attemptId: a.id, result: r }))}
                    >
                      → {t.results[r]}
                    </Button>
                  ),
                )}
                {a.id === latestId ? (
                  <Button variant="danger" disabled={pending} onClick={() => act(() => deleteLatestAttempt(a.id))}>
                    {t.problem.deleteAttempt}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
