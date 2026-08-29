/**
 * Service Worker - Baly PWA
 * Network-first for app code, cache-first for static assets.
 * This prevents an installed PWA from running stale JavaScript for days.
 */

const CACHE_NAME = 'baly-v9.0.1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/styles/main.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

const APP_FILES = [
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

const isAppCode = (url) =>
  url.pathname.endsWith('.js') ||
  url.pathname.endsWith('.mjs') ||
  url.pathname.endsWith('.css') ||
  url.pathname.endsWith('.html');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([...STATIC_ASSETS, ...APP_FILES]))
      .then(() => self.skipWaiting())
  );
});

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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // Always prefer the newest application code when online.
  if (isAppCode(url) || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        }))
    );
    return;
  }

  // Static images/icons: cache-first for fast loading.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
