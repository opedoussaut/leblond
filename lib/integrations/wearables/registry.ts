import { corosProvider } from "./coros";
import { garminProvider } from "./garmin";
import { resolveProviderStatus } from "./status";
import { STRAVA_PLANNED_ONLY, stravaProvider } from "./strava";
import { suuntoProvider } from "./suunto";
import type { ProviderAvailability, WearableProvider, WearableProviderId } from "./types";

export const PROVIDER_LABELS: Record<WearableProviderId, string> = {
  COROS: "COROS",
  SUUNTO: "Suunto",
  GARMIN: "Garmin",
  STRAVA: "Strava",
};

/** V1 wearables shown in Connections, plus Strava as "coming next". */
export const V1_PROVIDERS: WearableProviderId[] = ["COROS", "SUUNTO", "GARMIN"];

export function getProvider(id: WearableProviderId): WearableProvider {
  switch (id) {
    case "COROS":
      return corosProvider();
    case "SUUNTO":
      return suuntoProvider();
    case "GARMIN":
      return garminProvider();
    case "STRAVA":
      return stravaProvider();
  }
}

export function isPlannedOnly(id: WearableProviderId): boolean {
  return id === "STRAVA" && STRAVA_PLANNED_ONLY;
}

/**
 * Status for the UI. `platformReady` covers server prerequisites for storing
 * tokens safely (encryption key + service role); without them no provider can
 * be connected, so they are reported as requiring setup/approval.
 */
export function providerStatus(
  id: WearableProviderId,
  connection: { status: "CONNECTED" | "DISCONNECTED" | "ERROR" } | null,
  platformReady: boolean,
): ProviderAvailability {
  const p = getProvider(id);
  return resolveProviderStatus({
    plannedOnly: isPlannedOnly(id),
    configured: platformReady && p.isConfigured(),
    environment: p.environment(),
    connection,
  });
}
