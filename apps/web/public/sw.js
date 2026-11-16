// Service worker. Phase 5: Web Push. Phase 10: offline page and static asset caching.
const VERSION = "v3"; // v3: the Buddy logo; drops icons cached before it
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE, "/icons/192", "/manifest.webmanifest"]))
      .then(() => self.skipWaiting()),
  );
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

// Only our own GETs. Pages always come from the network (they're personal and live);
// with no connection, the offline page. Hashed build assets and icons are cached.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE).then((r) => r || Response.error())),
    );
    return;
  }

  // Content-hashed, so a cached copy is always right.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }

  // Icons: serve the cached copy, refresh it in the background.
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(request).then((hit) => {
          const fresh = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || fresh;
        }),
      ),
    );
  }
});

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
      // Sound is the device's choice; a buzz still gets noticed where sound is off (Android).
      vibrate: [120, 60, 120],
      icon: "/icons/192",
      badge: "/icons/badge",
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
