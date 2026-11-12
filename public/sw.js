/*
 * LEBLOND service worker.
 * - Makes the app installable and shows an offline page for navigations.
 * - Keeps the app's static files (/_next/static: versioned, public) so pages
 *   already opened still work without signal.
 * - Live boulder session pages: the app keeps a copy of the session being
 *   logged (lib/offline/service-worker.ts, cache "leblond-pages-v1"); without
 *   signal that copy is served, so logging goes on. Only those pages, only
 *   while the session is live; deleted when it ends and when signing out.
 * - Never caches API responses or any other authenticated page.
 */
const SHELL = "leblond-shell-v2";
const STATIC = "leblond-static-v1";
const PAGES = "leblond-pages-v1";
const OFFLINE_URL = "/offline";
const SHELL_FILES = [OFFLINE_URL, "/icons/icon-192.png", "/brand/leblond-mark-96.png"];
const LIVE_PAGE = /^\/session\/[0-9a-f-]{36}$/;
const NETWORK_WAIT_MS = 6000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll(SHELL_FILES);
      // The offline page's own scripts and styles, so it renders without signal.
      try {
        const html = await (await fetch(OFFLINE_URL, { cache: "no-store" })).text();
        const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)<>]+/g) || [])];
        const files = await caches.open(STATIC);
        await Promise.all(assets.map((a) => files.add(a).catch(() => undefined)));
      } catch {
        /* the offline page still shows, unstyled */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, STATIC, PAGES]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Versioned static files: from the cache when there, else from the network (and kept). */
async function staticFile(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone()).catch(() => undefined);
  return res;
}

/** A live session page: the network first; the kept copy when there is no signal (or it is too slow). */
async function livePage(request, path) {
  const pages = await caches.open(PAGES);
  const kept = await pages.match(path);
  try {
    const res = await withTimeout(fetch(request), kept ? NETWORK_WAIT_MS : 30000);
    // Refresh the copy only for a page the app asked to keep, never a redirect (e.g. to sign in).
    if (kept && res.ok && !res.redirected) pages.put(path, res.clone()).catch(() => undefined);
    return res;
  } catch {
    return kept || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticFile(request));
    return;
  }
  if (request.mode !== "navigate") return;
  if (LIVE_PAGE.test(url.pathname)) {
    event.respondWith(livePage(request, url.pathname));
    return;
  }
  event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
});
