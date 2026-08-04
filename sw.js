/**
 * Service Worker - بلي PWA
 * Cache-first strategy for full offline support
 */

const CACHE_NAME = 'baly-v6.0.0';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/styles/main.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './src/db/database.js',
  './src/utils/formatter.js',
  './src/utils/calculator.js',
  './src/modules/settings.js',
  './src/modules/trips.js',
  './src/modules/expenses.js',
  './src/modules/transfers.js',
  './src/modules/reports.js',
  './src/modules/wallet.js',
  './src/modules/fuelWallet.js',
  './src/modules/bonuses.js',
  './src/modules/balyBalance.js',
  './src/app.js',
];

// Install: cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first with network fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Ignore cross-origin requests (e.g. Firebase)
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseClone));
            return response;
          })
          .catch(() => {
            // Return offline page for navigation
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
