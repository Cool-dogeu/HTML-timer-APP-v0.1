const CACHE_NAME = 'agility-timer-v1.1.0';
const urlsToCache = [
  '/',
  '/timer.html',
  '/assets/js/app.js',
  '/assets/css/styles.css',
  '/assets/images/logo.png',
  '/manifest.json',
  // CDN resources for offline access
  'https://unpkg.com/vue@3.4.15/dist/vue.global.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache.map(url => new Request(url, {
          cache: 'reload'
        })));
      })
      .then(() => {
        console.log('Service Worker: All files cached');
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching files', error);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }

        // Fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response for caching
            const responseToCache = response.clone();

            // Add successful requests to cache (for dynamic caching)
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Only cache same-origin requests and specific CDN resources
                if (event.request.url.startsWith(self.location.origin) || 
                    event.request.url.includes('unpkg.com') ||
                    event.request.url.includes('googleapis.com')) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          })
          .catch((error) => {
            console.log('Service Worker: Fetch failed, serving offline fallback:', error);
            
            // For navigation requests, return the cached main page
            if (event.request.mode === 'navigate') {
              return caches.match('./timer.html');
            }
            
            // For other requests, you might want to return a generic offline response
            return new Response('Offline - content not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Handle background sync for when connection is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    // You can add logic here to sync data when connection is restored
  }
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received');
  // You can add push notification logic here if needed
});

// Handle message from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({version: CACHE_NAME});
  }
});

// Periodic background sync (for Chrome)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'timer-sync') {
    console.log('Service Worker: Periodic sync triggered');
    // Add periodic sync logic if needed
  }
});