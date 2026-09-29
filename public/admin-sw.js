// Minimal service worker so the admin app can be installed on phones and PCs.
// It does not cache anything: the app always shows live data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
