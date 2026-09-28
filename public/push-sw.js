self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  e.waitUntil(
    Promise.all([
      self.registration.showNotification("Study#", {
        body: "新しいお知らせがあります",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: "/notifications" },
      }),
      self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : null,
    ]),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url || "/"));
});
