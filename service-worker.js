
const CACHE = "np-sports-pwa-v0.1.1";

const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/styles.css",
  "./assets/js/config.js",
  "./assets/js/app.js",
  "./assets/icons/np.svg",
  "./assets/icons/np-icon-180.png",
  "./assets/icons/np-icon-192.png",
  "./assets/icons/np-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key =>
          key.startsWith("np-sports-pwa-") &&
          key !== CACHE
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    try {
      const response = await fetch(request);

      if (response && response.ok && response.type === "basic") {
        try {
          await cache.put(request, response.clone());
        } catch (_) {}
      }

      return response;

    } catch (error) {
      const cached = await cache.match(request);

      if (cached) return cached;

      if (request.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }

      throw error;
    }
  })());
});
