/**
 * Provider-neutral wearable contracts. Every source (official API, FIT file)
 * is normalised into NormalizedWorkout before it touches the database.
 */

export const WEARABLE_PROVIDERS = ["COROS", "SUUNTO", "GARMIN", "STRAVA"] as const;
export type WearableProviderId = (typeof WEARABLE_PROVIDERS)[number];
export type ActivitySource = WearableProviderId | "FIT_IMPORT";

/** What the UI is allowed to say about a provider (brief §19). */
export type ProviderAvailability =
  | "AVAILABLE"
  | "REQUIRES_PROVIDER_APPROVAL"
  | "DEVELOPMENT_TESTING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR"
  | "NOT_YET_AVAILABLE";

export interface HeartRateSample {
  /** Seconds from activity start. */
  t: number;
  bpm: number;
}

export interface NormalizedWorkout {
  provider: ActivitySource;
  externalActivityId: string;
  activityType: string;
  startedAt: Date;
  durationSeconds: number;
  calories: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  heartRateSamples: HeartRateSample[] | null;
  trainingLoad: number | null;
  recoveryMetrics: Record<string, number> | null;
  deviceName: string | null;
  deviceManufacturer: string | null;
  rawFileReference: string | null;
  /** Provenance: which source fields were present (never fabricated). */
  rawMetadata: Record<string, unknown>;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[] | null;
  providerUserId: string | null;
}

/** A capability the provider does not offer in this deployment (e.g. push-only APIs). */
export class ProviderCapabilityError extends Error {
  constructor(
    readonly code: "SYNC_REQUIRES_PROVIDER_WEBHOOKS" | "NOT_CONFIGURED" | "NOT_IMPLEMENTED",
    message?: string,
  ) {
    super(message ?? code);
  }
}

/**
 * Wearable provider adapter (brief §27). Authorization uses OAuth 2.0 with
 * `state` and, where supported, PKCE. Tokens are handled by the server only.
 */
export interface WearableProvider {
  providerId: WearableProviderId;
  /** True when credentials AND endpoints required by the official API are configured. */
  isConfigured(): boolean;
  environment(): "production" | "development";
  usesPkce: boolean;
  getAuthorizationUrl(params: { state: string; codeChallenge: string | null }): string;
  exchangeAuthorizationCode(params: { code: string; codeVerifier: string | null }): Promise<TokenSet>;
  refreshTokens?(refreshToken: string): Promise<TokenSet>;
  /** Revoke on the provider side when the API supports it. */
  disconnect(tokens: TokenSet): Promise<void>;
  syncActivities(tokens: TokenSet, since?: Date): Promise<NormalizedWorkout[]>;
}
