/**
 * MCGI Attendance Management System - Service Worker (Offline PWA Engine)
 * Enables 100% offline functionality on mobile devices & desktop browsers.
 * Caches core shell assets, external CDNs, and facilitates local-first sync.
 */

const CACHE_NAME = 'mcgi-attendance-v2.5.6';

// Essential core shell assets required for the app to open and run offline
const PRECACHE_ASSETS = [
  './',
  './login.html',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './logo-16.png',
  './logo-20.png',
  './logo-24.png',
  './logo-32.png',
  './logo-40.png',
  './logo-48.png',
  './logo-192.png',
  './logo.png',
  './logo-gcos.jpg',
  './logo-tk.jpg',
  './css/custom.css',
  './js/html5-qrcode.min.js',
  './js/carousel_data.js',
  './js/carousel_background.js',
  './js/neat-gradient.js',
  './js/supabase_client.js',
  './js/attendance_logger.js',
  './js/app.js',
  './js/charts.js'
];

// Critical external CDN dependencies
const EXTERNAL_CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap'
];

// ─────────────────────────────────────────────────────────────────────────────
// Install Event: Pre-cache local assets & critical CDN libraries
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching core application assets...');
      
      // 1. Cache local assets (with individual error tolerance)
      await Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Could not precache local asset:', url, err);
          })
        )
      );

      // 2. Cache external CDNs (with CORS/opaque tolerance)
      await Promise.allSettled(
        EXTERNAL_CDN_ASSETS.map((url) =>
          fetch(url, { mode: 'cors' })
            .then((res) => {
              if (res.ok || res.type === 'opaque') {
                return cache.put(url, res);
              }
            })
            .catch((err) => {
              console.warn('[SW] Could not precache CDN asset:', url, err);
            })
        )
      );

      console.log('[SW] Core precaching completed.');
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Activate Event: Cleanup stale caches & take immediate control of clients
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Fetch Event: Cache-First for static assets, Network-First for HTML/Nav
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests (e.g. POST, PUT)
  if (req.method !== 'GET') {
    return;
  }

  // Do not intercept Supabase API requests (supabase client handles offline queue in localStorage)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Strategy A: Page Navigation (HTML documents)
  // Try network first with a quick 1.5s timeout. If offline or timeout, serve cached page.
  if (req.mode === 'navigate' || req.destination === 'document' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetchWithTimeout(req, 1500)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            return networkRes;
          }
          return caches.match(req).then((cached) => cached || caches.match('./login.html') || caches.match('./index.html'));
        })
        .catch(() => {
          // Device is completely offline: return cached page
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            if (url.pathname.includes('index.html')) {
              return caches.match('./index.html') || caches.match('index.html');
            }
            return caches.match('./login.html') || caches.match('login.html');
          });
        })
    );
    return;
  }

  // Strategy B: Static Assets & External CDNs
  // Cache-first: return cached copy if available, otherwise fetch and cache
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) {
        // Fetch in background to keep cache fresh if online
        if (navigator.onLine) {
          fetch(req).then((freshRes) => {
            if (freshRes && (freshRes.ok || freshRes.type === 'opaque')) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, freshRes));
            }
          }).catch(() => {});
        }
        return cachedRes;
      }

      // Not in cache: fetch from network and store in cache
      return fetch(req)
        .then((networkRes) => {
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => {
          // If offline and request is an image, fallback gracefully
          if (req.destination === 'image') {
            return caches.match('./logo.png');
          }
          return new Response('', { status: 408, statusText: 'Offline and asset not cached.' });
        });
    })
  );
});

/**
 * Helper: Fetch with timeout
 */
function fetchWithTimeout(request, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('Network fetch timed out'));
    }, timeoutMs);

    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        if (!timedOut) resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        if (!timedOut) reject(err);
      });
  });
}
