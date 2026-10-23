// FinManager Service Worker
//
// Strategy (deliberately conservative - stale assets caused blank pages before):
//   - API requests (/api/*)  -> network only, never cached
//   - Navigation requests    -> network only; on failure fall back to a fresh
//                               network fetch of /index.html (NOT a cached copy,
//                               which is what served stale bundles before)
//   - Hashed build assets    -> stale-while-revalidate (immutable by hash)
//   - Everything else        -> network only
//
// The SW file itself is served with no-store by nginx, and CACHE_NAME is
// bumped on every release so old caches are purged on activate.

const CACHE_NAME = 'finmanager-v22';
const OFFLINE_FALLBACK = '/index.html';

const PRECACHE_URLS = ['/manifest.json'];

// --- Install: precache minimal shell, then take over immediately ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

// --- Activate: delete every cache that is not the current one ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- Helper: never let a fetch rejection escape (this caused "TypeError: Failed to fetch") ---
function networkOnly(request) {
  return fetch(request).catch(
    () =>
      new Response(JSON.stringify({ error: 'offline', message: 'Koneksi jaringan terputus' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // API calls: always go to the network, never cached
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Navigation (SPA routes): network first, and on failure re-fetch index.html
  // from the network. We intentionally do NOT serve a cached index.html, because
  // a cached copy pins the app to an old bundle hash forever.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        fetch(OFFLINE_FALLBACK, { cache: 'no-store' }).catch(
          () =>
            new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head>' +
                '<body style="font-family:sans-serif;text-align:center;padding:3rem">' +
                '<h1>Offline</h1><p>Tidak ada koneksi ke server. Coba muat ulang nanti.</p>' +
                '</body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
        )
      )
    );
    return;
  }

  // Hashed build assets (index-<hash>.js / .css): immutable, use stale-while-revalidate
  if (/\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|svg|jpg|jpeg|webp)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Everything else: network only
  event.respondWith(networkOnly(request));
});

// --- Background sync (placeholder for offline transaction queue) ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  // Offline transaction queue is not implemented yet.
}

// --- Push notifications ---
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title || 'FinManager', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
