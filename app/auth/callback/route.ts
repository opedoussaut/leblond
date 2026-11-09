import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isNotInvitedError } from "@/lib/auth/closed-beta";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validation/common";

/**
 * Magic-link and Google landing. Supports both the PKCE `code` flow and the
 * `token_hash` flow (custom email templates). A Google account the closed
 * beta refused arrives with an error description instead of a code.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  if (isNotInvitedError({ message: url.searchParams.get("error_description") })) {
    return NextResponse.redirect(new URL("/login?error=invite", request.url));
  }
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  const target = new URL(ok ? next : "/login?error=link", request.url);
  return NextResponse.redirect(target);
}
