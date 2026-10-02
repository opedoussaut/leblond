import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";

/** Routes reachable without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = ["/", "/login", "/auth/callback", "/auth/confirm", "/offline"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated visitors away from private routes. Fine-grained checks
 * (whitelist still active, onboarding done) happen server-side in the app
 * layout, close to the data.
 */
export async function proxy(request: NextRequest) {
  const env = publicSupabaseEnv();
  let response = NextResponse.next({ request });

  if (!env) {
    // Not configured yet: only public pages make sense.
    if (!isPublic(request.nextUrl.pathname) && !request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth (not just the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (!user && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/home", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    // Skip static assets, icons and the manifest.
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icons/|brand/|manifest.webmanifest|sw.js|robots.txt).*)",
  ],
};
