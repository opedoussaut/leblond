import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, getDictionary, isLocale, LOCALE_COOKIE, type Locale } from "./index";

/**
 * Resolve the locale for a request: explicit preference (profile, passed in) →
 * cookie → Accept-Language → French (beta default).
 */
export async function resolveLocale(preferred?: string | null): Promise<Locale> {
  if (isLocale(preferred)) return preferred;
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  if (isLocale(first)) return first;
  return DEFAULT_LOCALE;
}

export async function getI18n(preferred?: string | null) {
  const locale = await resolveLocale(preferred);
  return { locale, t: getDictionary(locale) };
}
