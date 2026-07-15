const CACHE = "arena-v3";
const ASSETS = [
  "./","./index.html","./manifest.json",
  "./styles/base.css","./styles/gateway.css","./styles/components.css",
  "./styles/sports.css","./styles/awards.css","./styles/history.css",
  "./styles/profiles.css","./styles/theme.css",
  "./scripts/storage.js","./scripts/state.js","./scripts/utils.js",
  "./scripts/commentary.js","./scripts/ui.js","./scripts/cricket.js",
  "./scripts/football.js","./scripts/badminton.js","./scripts/pickleball.js",
  "./scripts/chess.js","./scripts/history.js","./scripts/gallery.js",
  "./scripts/profiles.js","./scripts/awards.js","./scripts/room.js",
  "./scripts/gateway.js","./scripts/onboarding.js","./scripts/main.js",
  "./assets/images/cricket.jpg","./assets/images/football.jpg",
  "./assets/images/badminton.jpg","./assets/images/pickleball.jpg",
  "./assets/images/chess.jpg"
];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(ASSETS.map(u=>c.add(u).catch(()=>{})))));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{
  const isHTML = e.request.destination==="document";
  if(isHTML){e.respondWith(fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));return res;}).catch(()=>caches.match(e.request)));}
  else{e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));}
});