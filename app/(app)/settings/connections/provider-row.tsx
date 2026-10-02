"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button, buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { disconnectProvider, syncProvider } from "@/lib/actions/wearables";
import { formatDateTime } from "@/lib/format";
import { canStartAuthorization } from "@/lib/integrations/wearables/status";
import type { ProviderAvailability, WearableProviderId } from "@/lib/integrations/wearables/types";
import { fmt } from "@/lib/i18n";

const TONE: Record<ProviderAvailability, string> = {
  CONNECTED: "text-ok",
  AVAILABLE: "text-ink",
  DEVELOPMENT_TESTING: "text-warn",
  DISCONNECTED: "text-ink-2",
  ERROR: "text-danger",
  REQUIRES_PROVIDER_APPROVAL: "text-ink-3",
  NOT_YET_AVAILABLE: "text-ink-3",
};

export function ProviderRow({
  provider,
  label,
  status,
  lastSyncAt,
}: {
  provider: WearableProviderId;
  label: string;
  status: ProviderAvailability;
  lastSyncAt: string | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const help = (t.connections.statusHelp as Record<string, string>)[status];

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className={cn("text-sm font-semibold", TONE[status])}>{t.connections.status[status]}</span>
      </div>
      {help ? <p className="mt-1 text-xs text-ink-3">{fmt(help, { provider: label })}</p> : null}
      {lastSyncAt ? (
        <p className="mt-1 text-xs text-ink-3">{fmt(t.connections.lastSync, { date: formatDateTime(lastSyncAt, locale) })}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {canStartAuthorization(status) ? (
          // Full navigation: the OAuth flow leaves the app and comes back to the callback route.
          <a href={`/api/integrations/${provider.toLowerCase()}/connect`} className={buttonClass("primary", "md")}>
            {t.connections.connect}
          </a>
        ) : null}
        {status === "CONNECTED" ? (
          <>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await syncProvider(provider);
                  setMessage(
                    res.ok
                      ? fmt(t.connections.syncResult, { inserted: res.data?.inserted ?? 0, duplicates: res.data?.duplicates ?? 0 })
                      : res.error === "SYNC_REQUIRES_PROVIDER_WEBHOOKS"
                        ? fmt(t.connections.syncViaWebhooks, { provider: label })
                        : t.common.unknownError,
                  );
                  router.refresh();
                })
              }
            >
              {t.connections.sync}
            </Button>
            {confirm ? (
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await disconnectProvider(provider);
                    setConfirm(false);
                    setMessage(fmt(t.connections.disconnected, { provider: label }));
                    router.refresh();
                  })
                }
              >
                {fmt(t.connections.disconnectConfirm, { provider: label })}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                {t.connections.disconnect}
              </Button>
            )}
          </>
        ) : null}
      </div>
      {message ? (
        <p role="status" className="mt-2 text-sm text-ink-2">
          {message}
        </p>
      ) : null}
    </li>
  );
}
