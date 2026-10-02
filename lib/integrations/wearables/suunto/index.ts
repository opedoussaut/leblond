import { apiEnvironment, envOf } from "../config";
import { buildAuthorizationUrl, requestToken } from "../oauth";
import { ProviderCapabilityError, type NormalizedWorkout, type WearableProvider } from "../types";

/**
 * Suunto Cloud API (apizone.suunto.com) — OAuth 2.0 authorization code flow,
 * every API call carries the Ocp-Apim-Subscription-Key header.
 * Suunto grants API access to organisations building public services, not to
 * personal projects: until credentials are issued the provider stays
 * "Requires provider approval" and FIT import is the fallback.
 *
 * The workout field mapping follows Suunto's published workout model and must
 * be validated against live data once access is granted (see docs/wearables.md).
 */
export const SUUNTO_ENDPOINTS = {
  authorize: "https://cloudapi-oauth.suunto.com/oauth/authorize",
  token: "https://cloudapi-oauth.suunto.com/oauth/token",
  workouts: "https://cloudapi.suunto.com/v2/workouts",
} as const;

interface SuuntoWorkout {
  workoutKey?: string;
  workoutId?: number | string;
  activityId?: number;
  startTime?: number;
  totalTime?: number;
  energyConsumption?: number;
  hrdata?: { workoutAvgHR?: number; workoutMaxHR?: number; avg?: number; max?: number };
}

export function mapSuuntoWorkout(w: SuuntoWorkout): NormalizedWorkout | null {
  const id = w.workoutKey ?? (w.workoutId != null ? String(w.workoutId) : null);
  if (!id || typeof w.startTime !== "number" || typeof w.totalTime !== "number") return null;
  const avg = w.hrdata?.workoutAvgHR ?? w.hrdata?.avg ?? null;
  const max = w.hrdata?.workoutMaxHR ?? w.hrdata?.max ?? null;
  return {
    provider: "SUUNTO",
    externalActivityId: id,
    activityType: w.activityId != null ? `suunto:${w.activityId}` : "unknown",
    startedAt: new Date(w.startTime),
    durationSeconds: Math.round(w.totalTime),
    calories: typeof w.energyConsumption === "number" ? Math.round(w.energyConsumption) : null,
    avgHeartRate: typeof avg === "number" ? Math.round(avg) : null,
    maxHeartRate: typeof max === "number" ? Math.round(max) : null,
    heartRateSamples: null,
    trainingLoad: null,
    recoveryMetrics: null,
    deviceName: null,
    deviceManufacturer: "Suunto",
    rawFileReference: null,
    rawMetadata: { source: "suunto-cloud-api" },
  };
}

export function suuntoProvider(fetchImpl: typeof fetch = fetch): WearableProvider {
  const clientId = envOf("SUUNTO_CLIENT_ID");
  const clientSecret = envOf("SUUNTO_CLIENT_SECRET");
  const subscriptionKey = envOf("SUUNTO_SUBSCRIPTION_KEY");
  const redirectUri = envOf("SUUNTO_REDIRECT_URI");
  const basicAuth = clientId && clientSecret ? { clientId, clientSecret } : undefined;
  return {
    providerId: "SUUNTO",
    usesPkce: false,
    isConfigured: () => Boolean(clientId && clientSecret && subscriptionKey && redirectUri),
    environment: () => apiEnvironment("SUUNTO"),
    getAuthorizationUrl: ({ state }) =>
      buildAuthorizationUrl(SUUNTO_ENDPOINTS.authorize, {
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
      }),
    async exchangeAuthorizationCode({ code }) {
      if (!basicAuth || !redirectUri) throw new ProviderCapabilityError("NOT_CONFIGURED");
      return requestToken(
        SUUNTO_ENDPOINTS.token,
        { grant_type: "authorization_code", code, redirect_uri: redirectUri },
        { basicAuth },
        fetchImpl,
      );
    },
    async refreshTokens(refreshToken) {
      if (!basicAuth) throw new ProviderCapabilityError("NOT_CONFIGURED");
      return requestToken(SUUNTO_ENDPOINTS.token, { grant_type: "refresh_token", refresh_token: refreshToken }, { basicAuth }, fetchImpl);
    },
    async disconnect() {
      // Suunto's public guide documents no revocation endpoint; LEBLOND deletes
      // its stored tokens, and the user can also revoke access from their Suunto account.
    },
    async syncActivities(tokens, since) {
      if (!subscriptionKey) throw new ProviderCapabilityError("NOT_CONFIGURED");
      const url = new URL(SUUNTO_ENDPOINTS.workouts);
      if (since) url.searchParams.set("since", String(since.getTime()));
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "Ocp-Apim-Subscription-Key": subscriptionKey },
      });
      if (!res.ok) throw new Error(`suunto_workouts_${res.status}`);
      const body = (await res.json()) as { payload?: SuuntoWorkout[] };
      return (body.payload ?? []).map(mapSuuntoWorkout).filter((w): w is NormalizedWorkout => w !== null);
    },
  };
}
