// Service worker for the Myithri app (installable on phones and PCs, and the Play Store app).
// The data itself always comes live from the server (Google), never from here. This only keeps
// the app's own files so it opens without a connection and shows the lists saved on the device,
// instead of the browser's "no internet" page.
const CACHE = "myithri-v2";
const BASE = "";
const SHELL = `${BASE}/admin/`;
const MAX_FILES = 150;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([SHELL, `${BASE}/admin-icons/icon-192.png`, `${BASE}/myithri-small.webp`]))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Myithri</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#EEF2F7;color:#0B1F44;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}
button{margin-top:16px;border:0;border-radius:12px;background:#0B1F44;color:#fff;font:600 15px system-ui;padding:12px 20px}</style></head>
<body><div><p style="font-size:20px;font-weight:700;margin:0">You're offline</p><p style="color:#5B6B85">Myithri needs the internet to open the first time. Check your connection and try again.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_FILES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only the app's own files; Google (the data) and everything else go straight to the network.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (req.mode === "navigate") {
    // Pages: the newest from the network, the saved copy when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname.startsWith(SHELL)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(SHELL, copy));
          }
          return res;
        })
        .catch(async () => (url.pathname.startsWith(SHELL) && (await caches.match(SHELL))) || new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
    );
    return;
  }

  // Built files carry a fingerprint in their name and never change: keep them once fetched.
  if (/\/_next\/static\/|\/admin-icons\/|\/demo\/|\.(webp|png|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy).then(() => trim(c)));
            }
            return res;
          }),
      ),
    );
  }
});
