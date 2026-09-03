const CACHE_NAME = 'planmaker-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/config.html',
  '/manifest.json',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/export_excel.js',
  '/data/map.json',
  '/data/manpower.json',
  '/src/brain/bundle.js',
  '/src/brain/index.js',
  '/src/brain/core.js',
  '/src/brain/utils.js',
  '/src/brain/blockAllocator.js',
  '/src/brain/loadBalancer.js',
  '/src/brain/cqiSelector.js',
  '/src/brain/unassignedFitter.js',
  '/src/brain/formatter.js',
  '/src/brain/validator.js',
  '/src/brain/manpowerAssigner.js',
  '/src/brain/history.js',
  '/src/brain/heatmap.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Stale-While-Revalidate for app shell & static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fails, return cached response if available
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
