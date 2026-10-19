import { GradeChip } from "@/components/climbing/grade-chip";
import { BoolderAttribution } from "@/components/climbing/outdoor";
import { Card, Notice, PageHeader, SectionTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { latestOutdoorImport } from "@/lib/data/outdoor";
import { formatDateTime } from "@/lib/format";
import { ARKOSE_GRADES, CLIMBING_DISTRICT_GRADES } from "@/lib/grading";
import { PROVIDER_LABELS, V1_PROVIDERS, providerStatus } from "@/lib/integrations/wearables/registry";
import type { WearableProviderId } from "@/lib/integrations/wearables/types";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { hasEncryptionKey } from "@/lib/security/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActivityList } from "./activity-list";
import { FitImport } from "./fit-import";
import { ProviderRow } from "./provider-row";

export const metadata = { title: "Connexions" };

export default async function ConnectionsPage({ searchParams }: PageProps<"/settings/connections">) {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const sp = await searchParams;
  const platformReady = hasEncryptionKey() && createAdminClient() !== null;

  const [{ data: connections }, { data: activities }, { data: sessions }, boolderImport] = await Promise.all([
    viewer.supabase.from("wearable_connections").select("provider, status, last_sync_at, last_error"),
    viewer.supabase
      .from("wearable_activities")
      .select("id, provider, started_at, duration_seconds, avg_heart_rate, max_heart_rate, calories, device_name, session_id")
      .order("started_at", { ascending: false })
      .limit(20),
    viewer.supabase
      .from("sessions")
      .select("id, started_at, ended_at, gyms(name)")
      .order("started_at", { ascending: false })
      .limit(40),
    latestOutdoorImport(viewer.supabase),
  ]);
  const conn = (p: WearableProviderId) => connections?.find((c) => c.provider === p) ?? null;
  const flashProvider = typeof sp.provider === "string" ? sp.provider : "";
  const providerName = PROVIDER_LABELS[flashProvider as WearableProviderId] ?? flashProvider;

  return (
    <div className="space-y-5">
      <PageHeader title={t.connections.title} subtitle={t.connections.intro} />
      {sp.connected ? <Notice tone="ok">{fmt(t.connections.oauthConnected, { provider: providerName })}</Notice> : null}
      {typeof sp.error === "string" ? (
        <Notice tone="error">{fmt(t.connections.oauthError, { provider: providerName, reason: sp.error })}</Notice>
      ) : null}

      <Card>
        <SectionTitle>{t.connections.climbing}</SectionTitle>
        <ul className="mt-2 divide-y divide-line">
          {(
            [
              ["ARKOSE", "ARKOSE_COLOR", ARKOSE_GRADES],
              ["CLIMBING_DISTRICT", "CLIMBING_DISTRICT_COLOR", CLIMBING_DISTRICT_GRADES],
            ] as const
          ).map(([brand, system, grades]) => (
            <li key={brand} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{t.brands[brand]}</span>
                <span className="text-sm font-semibold text-ok">{t.connections.nativeGrading}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {grades.map((g) => (
                  <GradeChip key={g.id} t={t} system={system} grade={g.id} size="sm" />
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-3">{t.connections.liveSyncUnavailable}</p>
            </li>
          ))}
          <li className="py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{t.outdoor.sourceTitle}</span>
              <span className={boolderImport ? "text-sm font-semibold text-ok" : "text-sm text-ink-3"}>
                {boolderImport ? t.outdoor.imported : t.outdoor.neverImported}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-3">{t.outdoor.sourceHelp}</p>
            {boolderImport ? (
              <p className="mt-1 text-xs text-ink-2">
                {fmt(t.outdoor.lastImport, {
                  date: formatDateTime(boolderImport.imported_at, locale),
                  areas: boolderImport.areas,
                  problems: boolderImport.problems,
                })}
                {boolderImport.source_version
                  ? ` · ${fmt(t.outdoor.sourceVersion, { version: boolderImport.source_version.slice(0, 7) })}`
                  : ""}
              </p>
            ) : null}
            <BoolderAttribution className="mt-1" />
          </li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>{t.connections.wearables}</SectionTitle>
        <ul className="mt-2 divide-y divide-line">
          {V1_PROVIDERS.map((p) => {
            const c = conn(p);
            return (
              <ProviderRow
                key={p}
                provider={p}
                label={PROVIDER_LABELS[p]}
                status={providerStatus(p, c, platformReady)}
                lastSyncAt={c?.last_sync_at ?? null}
              />
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-3">{t.connections.medicalNote}</p>
      </Card>

      <Card>
        <SectionTitle>{t.connections.import}</SectionTitle>
        <FitImport />
      </Card>

      <Card>
        <SectionTitle>{t.connections.activities}</SectionTitle>
        <ActivityList
          activities={activities ?? []}
          sessions={(sessions ?? []).map((s) => ({
            id: s.id,
            startedAt: s.started_at,
            endedAt: s.ended_at,
            gymName: s.gyms?.name ?? "",
          }))}
          locale={locale}
        />
      </Card>

      <Card>
        <SectionTitle>{t.connections.comingNext}</SectionTitle>
        <ul className="mt-2">
          <ProviderRow provider="STRAVA" label="Strava" status={providerStatus("STRAVA", conn("STRAVA"), platformReady)} lastSyncAt={null} />
        </ul>
      </Card>
    </div>
  );
}
