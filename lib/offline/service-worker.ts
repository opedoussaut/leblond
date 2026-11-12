/**
 * The pages kept on the phone for use without signal (only the live session
 * being logged). Same cache name as public/sw.js, which serves them when the
 * network is down. Done from the page itself, so it works before the service
 * worker controls it.
 */
export const OFFLINE_PAGES_CACHE = "leblond-pages-v1";
/** The app's versioned static files (public), as in public/sw.js. */
const STATIC_CACHE = "leblond-static-v1";

/** The scripts and styles a page needs, so its kept copy also runs without signal. */
async function keepStaticFiles(html: string) {
  const caches = cacheApi();
  if (!caches) return;
  const fromHtml = html.match(/\/_next\/static\/[^"'\s)<>\\]+/g) ?? [];
  const loaded = performance.getEntriesByType("resource")
    .map((e) => new URL(e.name, location.href))
    .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
    .map((u) => u.pathname + u.search);
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all([...new Set([...fromHtml, ...loaded])].map(async (path) => {
    if (await cache.match(path)) return;
    await cache.add(path).catch(() => undefined);
  }));
}

function cacheApi(): CacheStorage | null {
  return typeof window !== "undefined" && "caches" in window ? window.caches : null;
}

/** Keeps a fresh copy of the page (with its private data) on this phone. */
export function keepPageForOffline(path: string) {
  const caches = cacheApi();
  if (!caches || process.env.NODE_ENV !== "production") return;
  void (async () => {
    try {
      const res = await fetch(path, { credentials: "same-origin", cache: "no-store" });
      // A redirect (e.g. to sign in) is never kept.
      if (!res.ok || res.redirected) return;
      const cache = await caches.open(OFFLINE_PAGES_CACHE);
      await cache.put(path, res.clone());
      await keepStaticFiles(await res.text());
    } catch {
      /* no signal: the copy kept earlier stays */
    }
  })();
}

export function forgetOfflinePage(path: string) {
  const caches = cacheApi();
  if (!caches) return;
  void caches.open(OFFLINE_PAGES_CACHE).then((c) => c.delete(path)).catch(() => undefined);
}

/** After signing out: no private page stays on the phone. */
export function forgetOfflinePages() {
  const caches = cacheApi();
  if (!caches) return;
  void caches.delete(OFFLINE_PAGES_CACHE).catch(() => undefined);
}
