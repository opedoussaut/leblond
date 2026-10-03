import { apiEnvironment, envOf } from "../config";
import { buildAuthorizationUrl, requestToken } from "../oauth";
import { ProviderCapabilityError, type TokenSet, type WearableProvider } from "../types";

/**
 * Garmin Connect Developer Program — OAuth 2.0 with PKCE.
 * Endpoints from Garmin's "OAuth2 PKCE Specification" (developer portal).
 * Access requires Garmin's approval; Health API commercial use may need a licence.
 *
 * Activity/Health data is delivered by Garmin through PUSH/PING notifications to
 * an endpoint registered in the Garmin developer portal. That webhook is part of
 * the provider-approval work (Milestone "SYNC"); until then FIT import is used.
 */
export const GARMIN_ENDPOINTS = {
  authorize: "https://connect.garmin.com/oauth2Confirm",
  token: "https://diauth.garmin.com/di-oauth2-service/oauth/token",
  userId: "https://apis.garmin.com/wellness-api/rest/user/id",
  deregister: "https://apis.garmin.com/wellness-api/rest/user/registration",
} as const;

export function garminProvider(fetchImpl: typeof fetch = fetch): WearableProvider {
  const clientId = envOf("GARMIN_CLIENT_ID");
  const clientSecret = envOf("GARMIN_CLIENT_SECRET");
  const redirectUri = envOf("GARMIN_REDIRECT_URI");
  return {
    providerId: "GARMIN",
    usesPkce: true,
    isConfigured: () => Boolean(clientId && clientSecret && redirectUri),
    environment: () => apiEnvironment("GARMIN"),
    getAuthorizationUrl: ({ state, codeChallenge }) =>
      buildAuthorizationUrl(GARMIN_ENDPOINTS.authorize, {
        response_type: "code",
        client_id: clientId,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        redirect_uri: redirectUri,
        state,
      }),
    async exchangeAuthorizationCode({ code, codeVerifier }) {
      if (!clientId || !clientSecret || !codeVerifier) throw new ProviderCapabilityError("NOT_CONFIGURED");
      const tokens = await requestToken(
        GARMIN_ENDPOINTS.token,
        {
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: codeVerifier,
          ...(redirectUri ? { redirect_uri: redirectUri } : {}),
        },
        {},
        fetchImpl,
      );
      const res = await fetchImpl(GARMIN_ENDPOINTS.userId, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      const userId = res.ok ? ((await res.json()) as { userId?: string }).userId ?? null : null;
      return { ...tokens, providerUserId: userId };
    },
    async refreshTokens(refreshToken: string): Promise<TokenSet> {
      if (!clientId || !clientSecret) throw new ProviderCapabilityError("NOT_CONFIGURED");
      return requestToken(
        GARMIN_ENDPOINTS.token,
        { grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken },
        {},
        fetchImpl,
      );
    },
    async disconnect(tokens) {
      // Deregistration revokes LEBLOND's access on Garmin's side.
      await fetchImpl(GARMIN_ENDPOINTS.deregister, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }).catch(() => undefined);
    },
    async syncActivities() {
      throw new ProviderCapabilityError("SYNC_REQUIRES_PROVIDER_WEBHOOKS");
    },
  };
}
