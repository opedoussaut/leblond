import { envOf } from "../config";
import { buildAuthorizationUrl, requestToken } from "../oauth";
import { ProviderCapabilityError, type WearableProvider } from "../types";

/**
 * Strava — planned for the milestone after V1 (brief §24). The adapter
 * contract and endpoints are in place (developers.strava.com), but the
 * provider is reported as "Not yet available" and no connect flow is offered.
 * When enabled, activities must go through the same de-duplication as other
 * sources so a Garmin/COROS/Suunto workout mirrored to Strava is not counted twice.
 */
export const STRAVA_ENDPOINTS = {
  authorize: "https://www.strava.com/oauth/authorize",
  token: "https://www.strava.com/oauth/token",
  deauthorize: "https://www.strava.com/oauth/deauthorize",
} as const;

export const STRAVA_PLANNED_ONLY = true;

export function stravaProvider(fetchImpl: typeof fetch = fetch): WearableProvider {
  const clientId = envOf("STRAVA_CLIENT_ID");
  const clientSecret = envOf("STRAVA_CLIENT_SECRET");
  const redirectUri = envOf("STRAVA_REDIRECT_URI");
  return {
    providerId: "STRAVA",
    usesPkce: false,
    isConfigured: () => Boolean(clientId && clientSecret && redirectUri),
    environment: () => "production",
    getAuthorizationUrl: ({ state }) =>
      buildAuthorizationUrl(STRAVA_ENDPOINTS.authorize, {
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        approval_prompt: "auto",
        scope: "activity:read",
        state,
      }),
    async exchangeAuthorizationCode({ code }) {
      if (!clientId || !clientSecret) throw new ProviderCapabilityError("NOT_CONFIGURED");
      return requestToken(
        STRAVA_ENDPOINTS.token,
        { grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code },
        {},
        fetchImpl,
      );
    },
    async disconnect(tokens) {
      await fetchImpl(STRAVA_ENDPOINTS.deauthorize, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }).catch(() => undefined);
    },
    async syncActivities() {
      throw new ProviderCapabilityError("NOT_IMPLEMENTED", "Strava sync is planned for the next milestone");
    },
  };
}
