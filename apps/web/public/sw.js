// Minimal service worker (Phase 0). Offline shell, asset caching and push arrive in Phases 5 and 10.
const VERSION = "v0";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Pass-through fetch handler: keeps installability checks happy without caching anything yet.
self.addEventListener("fetch", () => {});
