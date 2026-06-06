// Arena PWA — Service Worker
const CACHE = "arena-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles/base.css",
  "./styles/gateway.css",
  "./styles/components.css",
  "./styles/sports.css",
  "./styles/awards.css",
  "./styles/history.css",
  "./styles/profiles.css",
  "./styles/theme.css",
  "./scripts/storage.js",
  "./scripts/state.js",
  "./scripts/utils.js",
  "./scripts/commentary.js",
  "./scripts/ui.js",
  "./scripts/cricket.js",
  "./scripts/football.js",
  "./scripts/badminton.js",
  "./scripts/pickleball.js",
  "./scripts/chess.js",
  "./scripts/history.js",
  "./scripts/gallery.js",
  "./scripts/profiles.js",
  "./scripts/awards.js",
  "./scripts/room.js",
  "./scripts/gateway.js",
  "./scripts/main.js",
  "./assets/images/cricket.jpg",
  "./assets/images/football.jpg",
  "./assets/images/badminton.jpg",
  "./assets/images/pickleball.jpg",
  "./assets/images/chess.jpg",
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css",
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap"
];

// Install — cache all assets
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => {
      // Cache what we can — don't fail if CDN is unavailable
      return Promise.allSettled(ASSETS.map(url => c.add(url).catch(() => {})));
    })
  );
});

// Activate — clear old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache-first for our assets, network-first for everything else
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const isOurAsset = ASSETS.some(a => e.request.url.includes(a.replace("./", "")));

  if (isOurAsset || url.hostname === location.hostname) {
    // Cache-first strategy for app assets
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => caches.match("./index.html"));
      })
    );
  } else {
    // Network-first for external resources (fonts, CDN icons)
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});
