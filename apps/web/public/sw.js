// Bump CACHE whenever the caching strategy changes: `activate` deletes every
// cache whose name no longer matches, which is the only way a client stuck on
// an old strategy can heal itself.
const CACHE = "movievault-shell-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

// Vite build assets are content-hashed, so their URLs change on every deploy:
// cache-first can never serve a stale one. Everything else same-origin
// (icons, manifest, the app shell) is stale-while-revalidate, so a deploy
// reaches returning visitors on their next load instead of being pinned to
// whatever was cached first.
const isImmutableAsset = (url) => url.pathname.startsWith("/assets/");

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache media/API proxy traffic: it can be large, private, or stale.
  if (url.pathname.startsWith("/api/")) return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      if (!cached) return network;
      // Serve the cached copy now; the refresh lands on the next load. The
      // catch keeps a failed background refresh from becoming an unhandled
      // rejection while offline.
      event.waitUntil(network.catch(() => {}));
      return cached;
    }),
  );
});
