const CACHE_NAME = "np-sports-pwa-v0.1.2";
const CACHE_PREFIX = "np-sports-pwa-";

const APP_SHELL = [
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
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Never cache API responses, including authenticated admin data.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/")
  ) return;

  const isAppAsset =
    request.mode === "navigate" ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "manifest";

  if (!isAppAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === "basic") {
        try { await cache.put(request, response.clone()); } catch (_) {}
      }
      return response;
    } catch (_) {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) return cachedResponse;
      if (request.mode === "navigate") {
        const offlinePage = await cache.match("./index.html");
        if (offlinePage) return offlinePage;
      }
      return new Response("This resource is unavailable offline.", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
