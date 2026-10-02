import { afterEach, describe, expect, it, vi } from "vitest";
import { corosProvider } from "@/lib/integrations/wearables/coros";
import { GARMIN_ENDPOINTS, garminProvider } from "@/lib/integrations/wearables/garmin";
import { createPkcePair } from "@/lib/integrations/wearables/oauth";
import { mapSuuntoWorkout, suuntoProvider } from "@/lib/integrations/wearables/suunto";
import { ProviderCapabilityError } from "@/lib/integrations/wearables/types";

afterEach(() => vi.unstubAllEnvs());

describe("Garmin adapter (OAuth 2.0 PKCE)", () => {
  it("is not configured without credentials", () => {
    expect(garminProvider().isConfigured()).toBe(false);
  });

  it("builds the official authorization URL with PKCE and state", () => {
    vi.stubEnv("GARMIN_CLIENT_ID", "cid");
    vi.stubEnv("GARMIN_CLIENT_SECRET", "secret");
    vi.stubEnv("GARMIN_REDIRECT_URI", "https://app.example/api/integrations/garmin/callback");
    const { challenge } = createPkcePair();
    const url = new URL(garminProvider().getAuthorizationUrl({ state: "st", codeChallenge: challenge }));
    expect(`${url.origin}${url.pathname}`).toBe(GARMIN_ENDPOINTS.authorize);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "cid",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "st",
    });
  });

  it("exchanges the code with the verifier and reads the Garmin user id", async () => {
    vi.stubEnv("GARMIN_CLIENT_ID", "cid");
    vi.stubEnv("GARMIN_CLIENT_SECRET", "secret");
    vi.stubEnv("GARMIN_REDIRECT_URI", "https://app.example/cb");
    const calls: Array<{ url: string; body?: string }> = [];
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? String(init.body) : undefined });
      if (String(url) === GARMIN_ENDPOINTS.token) {
        return Response.json({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "ACTIVITY_EXPORT" });
      }
      return Response.json({ userId: "garmin-user-1" });
    }) as unknown as typeof fetch;
    const tokens = await garminProvider(fakeFetch).exchangeAuthorizationCode({ code: "c0de", codeVerifier: "ver" });
    expect(tokens).toMatchObject({ accessToken: "at", refreshToken: "rt", providerUserId: "garmin-user-1" });
    const body = new URLSearchParams(calls[0].body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBe("ver");
  });

  it("does not pretend to sync: activity delivery requires Garmin webhooks", async () => {
    await expect(garminProvider().syncActivities({} as never)).rejects.toBeInstanceOf(ProviderCapabilityError);
  });
});

describe("COROS adapter", () => {
  it("requires partner endpoints from configuration — none are guessed", () => {
    vi.stubEnv("COROS_CLIENT_ID", "cid");
    vi.stubEnv("COROS_CLIENT_SECRET", "secret");
    vi.stubEnv("COROS_REDIRECT_URI", "https://app.example/cb");
    expect(corosProvider().isConfigured()).toBe(false);
    vi.stubEnv("COROS_AUTHORIZE_URL", "https://partner.example/authorize");
    vi.stubEnv("COROS_TOKEN_URL", "https://partner.example/token");
    expect(corosProvider().isConfigured()).toBe(true);
  });
});

describe("Suunto adapter", () => {
  it("needs the subscription key in addition to OAuth credentials", () => {
    vi.stubEnv("SUUNTO_CLIENT_ID", "cid");
    vi.stubEnv("SUUNTO_CLIENT_SECRET", "secret");
    vi.stubEnv("SUUNTO_REDIRECT_URI", "https://app.example/cb");
    expect(suuntoProvider().isConfigured()).toBe(false);
    vi.stubEnv("SUUNTO_SUBSCRIPTION_KEY", "key");
    expect(suuntoProvider().isConfigured()).toBe(true);
  });

  it("maps a workout keeping only present fields", () => {
    const w = mapSuuntoWorkout({ workoutKey: "abc", startTime: 1_790_000_000_000, totalTime: 5400.4, hrdata: { workoutAvgHR: 121 } });
    expect(w).toMatchObject({ provider: "SUUNTO", externalActivityId: "abc", durationSeconds: 5400, avgHeartRate: 121, maxHeartRate: null, calories: null });
    expect(mapSuuntoWorkout({ startTime: 1 })).toBeNull();
  });
});
