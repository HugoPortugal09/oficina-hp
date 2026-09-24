// Oficina HP - Service Worker v1.0.0
const CACHE_NAME = 'oficina-hp-cache-v1';
const OFFLINE_URL = '/';

const PRECACHE_ASSETS = [
  '/',
  '/mobile',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/grau_logo.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

// 1. Install event: Pre-cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Non-critical precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate event: Clean up previous caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch event: Stale-While-Revalidate with Navigation Fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and API calls (PocketBase, external APIs)
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') || url.port === '8090' || url.protocol.startsWith('chrome-extension:')) {
    return;
  }

  // A. Navigation (HTML pages)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(OFFLINE_URL) || await cache.match('/index.html');
        return cached || new Response('Offline - Oficina HP', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      })
    );
    return;
  }

  // B. Static Assets (CSS, JS, Fonts, Images)
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$/) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        }).catch(() => null);

        return cached || (await fetchPromise);
      })
    );
    return;
  }

  // C. Fallback default
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req);
    })
  );
});

// Listen for skip waiting message from app client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
