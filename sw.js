const CACHE_NAME = 'nexus-mini-portal-v11.4-iconic-ui';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon.svg',
  './rigs/icon.anim.js',
  './sprites/badge-roster.svg',
  './sprites/badge-rules.svg',
  './sprites/badge-screenshots.svg',
  './sprites/badge-pwa.svg',
  './sprites/badge-fullscreen.svg',
  './sprites/badge-launch.svg',
  './shared/nexus-sdk.js',
  './tank/index.html',
  './star/index.html',
  './miner/index.html',
  './pudding/index.html',
  './genesis/index.html',
  './assets/tank-battle/icon.svg',
  './assets/tank-battle/preview.png',
  './assets/tank-battle/style.css',
  './assets/tank-battle/sprites/player-tank-p1.svg',
  './assets/tank-battle/sprites/player-tank-p2.svg',
  './assets/tank-battle/sprites/enemy-scout.svg',
  './assets/tank-battle/sprites/enemy-raider.svg',
  './assets/tank-battle/sprites/enemy-shooter.svg',
  './assets/tank-battle/sprites/enemy-mammoth.svg',
  './assets/tank-battle/sprites/enemy-boss-train.svg',
  './assets/tank-battle/sprites/base-eagle.svg',
  './assets/tank-battle/sprites/tile-brick.svg',
  './assets/tank-battle/sprites/tile-steel.svg',
  './assets/tank-battle/sprites/tile-bush.svg',
  './assets/tank-battle/sprites/pickup-crate.svg',
  './assets/tank-battle/rigs/icon.anim.js',
  './assets/tank-battle/rigs/player-tank-p1.anim.js',
  './assets/tank-battle/rigs/player-tank-p2.anim.js',
  './assets/tank-battle/rigs/enemy-scout.anim.js',
  './assets/tank-battle/rigs/enemy-raider.anim.js',
  './assets/tank-battle/rigs/enemy-shooter.anim.js',
  './assets/tank-battle/rigs/enemy-mammoth.anim.js',
  './assets/tank-battle/rigs/enemy-boss-train.anim.js',
  './assets/tank-battle/rigs/base-eagle.anim.js',
  './assets/tank-battle/rigs/tile-brick.anim.js',
  './assets/tank-battle/rigs/tile-steel.anim.js',
  './assets/tank-battle/rigs/tile-bush.anim.js',
  './assets/tank-battle/rigs/pickup-crate.anim.js',
  './assets/star-defender/icon.svg',
  './assets/star-defender/preview.png',
  './assets/star-defender/concept.jpg',
  './assets/star-defender/schematics.jpg',
  './assets/gold-miner/icon.svg',
  './assets/gold-miner/preview.png',
  './assets/pudding-defense/icon.svg',
  './assets/pudding-defense/preview.png',
  './assets/pudding-defense/combat.png',
  './assets/pudding-defense/levels.png',
  './assets/micro-genesis/icon.svg',
  './assets/micro-genesis/preview.png',
  './assets/micro-genesis/ui-lab-preview.png',
  './assets/micro-genesis/ui-arena-preview.png',
  './assets/micro-genesis/ui-bestiary-preview.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(async () => {
        const exact = await caches.match(event.request);
        if (exact) return exact;
        const ignoreQuery = await caches.match(event.request, { ignoreSearch: true });
        if (ignoreQuery) return ignoreQuery;
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return Response.error();
      })
  );
});
