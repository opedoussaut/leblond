import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { getProvider } from "@/lib/integrations/wearables/registry";
import { markConnection, saveConnection } from "@/lib/integrations/wearables/store";
import { WEARABLE_PROVIDERS, type WearableProviderId } from "@/lib/integrations/wearables/types";
import { createAdminClient } from "@/lib/supabase/admin";

const OAUTH_COOKIE = "lb_oauth";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * OAuth callback. The connection is stored as CONNECTED only after the
 * provider returned a valid token for the exact state we issued.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/integrations/[provider]/callback">) {
  const { provider: raw } = await ctx.params;
  const provider = raw.toUpperCase() as WearableProviderId;
  const done = (query: string) => {
    const res = NextResponse.redirect(new URL(`/settings/connections?${query}&provider=${provider}`, request.url));
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/integrations" });
    return res;
  };
  if (!(WEARABLE_PROVIDERS as readonly string[]).includes(provider)) return done("error=unknown_provider");

  const viewer = await getViewer();
  if (!viewer?.active) return NextResponse.redirect(new URL("/login", request.url));

  let stored: { provider?: string; state?: string; verifier?: string | null; uid?: string } = {};
  try {
    stored = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {
    stored = {};
  }
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");

  if (providerError) return done("error=denied");
  if (!code || !stored.state || stored.provider !== provider || stored.uid !== viewer.userId || !safeEqual(stored.state, state)) {
    return done("error=invalid_state");
  }

  const admin = createAdminClient();
  if (!admin) return done("error=not_available");
  try {
    const tokens = await getProvider(provider).exchangeAuthorizationCode({ code, codeVerifier: stored.verifier ?? null });
    await saveConnection(admin, viewer.userId, provider, tokens);
    return done("connected=1");
  } catch {
    await markConnection(admin, viewer.userId, provider, "ERROR", "authorization_failed");
    return done("error=exchange_failed");
  }
}
