const CACHE_NAME = 'focus-app-v2-production';
const DATA_CACHE_NAME = 'focus-data-cache-v1';

// Files we strictly want to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install: Cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Try to cache core files, but don't fail if some missing
        return cache.addAll(PRECACHE_URLS).catch(err => {
          console.warn('Precache warning:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
          console.log('Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// Fetch: Network First strategy for HTML (to get updates), Cache First for assets
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (like Google Fonts or external APIs if needed)
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.includes('cdn-icons-png')) {
    return;
  }

  // Handle HTML requests: Network first, fall back to cache (ensure latest version)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Handle Assets (JS, CSS, Images): Stale-While-Revalidate
  // Serve from cache immediately, but update in background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
      return cachedResponse || fetchPromise;
    })
  );
});