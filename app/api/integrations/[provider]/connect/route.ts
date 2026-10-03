import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createPkcePair, randomState } from "@/lib/integrations/wearables/oauth";
import { getProvider, providerStatus } from "@/lib/integrations/wearables/registry";
import { canStartAuthorization } from "@/lib/integrations/wearables/status";
import { WEARABLE_PROVIDERS, type WearableProviderId } from "@/lib/integrations/wearables/types";
import { hasEncryptionKey } from "@/lib/security/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const OAUTH_COOKIE = "lb_oauth";

/** Starts the official OAuth flow: random state (+ PKCE verifier) kept in an httpOnly cookie. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/integrations/[provider]/connect">) {
  const { provider: raw } = await ctx.params;
  const provider = raw.toUpperCase() as WearableProviderId;
  const back = (err: string) =>
    NextResponse.redirect(new URL(`/settings/connections?error=${err}&provider=${provider}`, request.url));
  if (!(WEARABLE_PROVIDERS as readonly string[]).includes(provider)) return back("unknown_provider");

  const viewer = await getViewer();
  if (!viewer?.active) return NextResponse.redirect(new URL("/login", request.url));

  const { data: conn } = await viewer.supabase.from("wearable_connections").select("status").eq("provider", provider).maybeSingle();
  const status = providerStatus(provider, conn, hasEncryptionKey() && createAdminClient() !== null);
  if (!canStartAuthorization(status)) return back("not_available");

  const adapter = getProvider(provider);
  const state = randomState();
  const pkce = adapter.usesPkce ? createPkcePair() : null;
  const response = NextResponse.redirect(adapter.getAuthorizationUrl({ state, codeChallenge: pkce?.challenge ?? null }));
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ provider, state, verifier: pkce?.verifier ?? null, uid: viewer.userId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations",
    maxAge: 600,
  });
  return response;
}
