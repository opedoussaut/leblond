import { createHash, randomBytes } from "node:crypto";
import type { TokenSet } from "./types";

/** OAuth 2.0 helpers shared by provider adapters (RFC 6749 / RFC 7636 PKCE). */

export function randomState(): string {
  return randomBytes(24).toString("base64url");
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizationUrl(base: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

export class OAuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  scope?: string;
  user?: string;
  athlete?: { id?: number | string };
}

/** POST an x-www-form-urlencoded token request and normalise the response. */
export async function requestToken(
  tokenUrl: string,
  body: Record<string, string>,
  opts: { basicAuth?: { clientId: string; clientSecret: string }; headers?: Record<string, string> } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<TokenSet> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    ...opts.headers,
  };
  if (opts.basicAuth) {
    headers.Authorization = `Basic ${Buffer.from(`${opts.basicAuth.clientId}:${opts.basicAuth.clientSecret}`).toString("base64")}`;
  }
  const res = await fetchImpl(tokenUrl, { method: "POST", headers, body: new URLSearchParams(body) });
  if (!res.ok) throw new OAuthError(res.status, `token_endpoint_${res.status}`);
  const json = (await res.json()) as RawTokenResponse;
  if (!json.access_token) throw new OAuthError(502, "token_missing");
  const expiresAt = json.expires_at
    ? new Date(json.expires_at * 1000)
    : json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000)
      : null;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt,
    scopes: json.scope ? json.scope.split(/[ ,]+/).filter(Boolean) : null,
    providerUserId: json.user ?? (json.athlete?.id != null ? String(json.athlete.id) : null),
  };
}
