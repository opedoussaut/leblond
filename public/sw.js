/*
 * LEBLOND service worker — deliberately minimal for V1.
 * - Makes the app installable and shows an offline page for navigations.
 * - Never caches API responses or authenticated pages (private data).
 * Offline session logging is planned for a later milestone.
 */
const CACHE = "leblond-shell-v1";
const OFFLINE_URL = "/offline";
const SHELL = [OFFLINE_URL, "/icons/icon-192.png", "/brand/leblond-mark-96.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
