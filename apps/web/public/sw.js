// Service worker. Phase 5: Web Push. Offline shell and asset caching arrive in Phase 10.
const VERSION = "v1";

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

// Payload from /api/push: { title, body?, url, tag? }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "UOSBuddy" };
  }
  const title = data.title || "UOSBuddy";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body,
      tag: data.tag,
      renotify: !!data.tag,
      icon: "/icons/192",
      badge: "/icons/192",
      data: { url: data.url || "/notifications" },
    }),
  );
});

// Open (or focus) the app at the notification's page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
