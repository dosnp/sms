const CACHE="np-sports-pwa-v0.1.0";
const FILES=["./","./index.html","./manifest.webmanifest","./assets/css/styles.css","./assets/js/config.js","./assets/js/app.js","./assets/icons/np.svg","./assets/icons/np-icon-180.png","./assets/icons/np-icon-192.png","./assets/icons/np-icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET"||new URL(e.request.url).origin!==self.location.origin||new URL(e.request.url).pathname.includes("/api/"))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))))});
