import { apiEnvironment, envOf } from "../config";
import { buildAuthorizationUrl, requestToken } from "../oauth";
import { ProviderCapabilityError, type WearableProvider } from "../types";

/**
 * COROS.
 *
 * Two official routes exist (support.coros.com):
 *  - a self-service developer path (incl. COROS MCP) meant for a developer's
 *    own account and tooling — useful for prototyping, not for a multi-user app;
 *  - the Partner API (OAuth 2.0, webhook push, FIT downloads) for platforms that
 *    meet COROS's partner requirements.
 *
 * Partner endpoints are delivered with COROS's partner documentation after
 * approval, so they are configuration (COROS_AUTHORIZE_URL / COROS_TOKEN_URL),
 * never guessed. Without them the provider is "Requires provider approval".
 * Activity delivery is webhook-based and arrives with the "SYNC" milestone.
 */
export function corosProvider(fetchImpl: typeof fetch = fetch): WearableProvider {
  const clientId = envOf("COROS_CLIENT_ID");
  const clientSecret = envOf("COROS_CLIENT_SECRET");
  const redirectUri = envOf("COROS_REDIRECT_URI");
  const authorizeUrl = envOf("COROS_AUTHORIZE_URL");
  const tokenUrl = envOf("COROS_TOKEN_URL");
  return {
    providerId: "COROS",
    usesPkce: false,
    isConfigured: () => Boolean(clientId && clientSecret && redirectUri && authorizeUrl && tokenUrl),
    environment: () => apiEnvironment("COROS"),
    getAuthorizationUrl: ({ state }) => {
      if (!authorizeUrl) throw new ProviderCapabilityError("NOT_CONFIGURED");
      return buildAuthorizationUrl(authorizeUrl, {
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
      });
    },
    async exchangeAuthorizationCode({ code }) {
      if (!tokenUrl || !clientId || !clientSecret || !redirectUri) throw new ProviderCapabilityError("NOT_CONFIGURED");
      return requestToken(
        tokenUrl,
        { grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri },
        {},
        fetchImpl,
      );
    },
    async disconnect() {
      // Revocation is defined in COROS partner documentation; tokens are deleted locally.
    },
    async syncActivities() {
      throw new ProviderCapabilityError("SYNC_REQUIRES_PROVIDER_WEBHOOKS");
    },
  };
}
