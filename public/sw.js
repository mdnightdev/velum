const CACHE_NAME = 'velum-cache-v6';
const MAX_CACHE_ENTRIES = 25;

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/icon.svg',
  '/icon.jpg',
  '/manifest.json'
];

// Backend routes and dynamic media that MUST NEVER be cached
const UNCACHED_PREFIXES = [
  '/metrics',
  '/health',
  '/status',
  '/api',
  '/v2',
  '/socket.io',
  '/ws',
  '/system',
  '/debug',
  '/photos',
  '/uploads'
];

// LRU Cache Eviction: Keeps Cache Storage bounded
async function limitCacheSize(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      // Delete oldest cached items
      const deleteCount = keys.length - maxItems;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (err) {
    // Ignore cache trim errors
  }
}

// Install Event - Pre-cache minimal static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Purge all older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network-first for dynamic, bounded stale-while-revalidate for core static files only
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass non-GET, WebSockets, or media uploads
  if (event.request.method !== 'GET' || url.protocol.startsWith('ws')) {
    return;
  }

  // 2. Bypass all backend API, websocket, telemetry, and uploaded photos
  if (UNCACHED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return;
  }

  // 3. Network-first strategy for navigation/index.html to ensure fresh app code
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              limitCacheSize(CACHE_NAME, MAX_CACHE_ENTRIES);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 4. Stale-while-revalidate strictly for static JS/CSS/Fonts (with LRU eviction cap)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
              limitCacheSize(CACHE_NAME, MAX_CACHE_ENTRIES);
            });
          }
        }).catch(() => {});

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Cache only same-origin static assets
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic') &&
          (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.woff2'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
            limitCacheSize(CACHE_NAME, MAX_CACHE_ENTRIES);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Velum', body: 'New message received', icon: '/icon.svg', data: { url: '/' } };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: '/icon.svg',
    data: data.data || { url: '/' },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
