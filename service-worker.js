//service worker
var staticCacheName = 'currency-static-v1';

var allCaches = [
  staticCacheName
];

var staticFilesToCache = [
  '/',
  '/index.html',
  '/src/css/app.css',
  '/src/js/jquery.min.js',
  '/src/js/app.js',
  '/src/js/localforage-1.4.0.js',
  '/src/materialize/css/materialize.min.css',
  '/src/materialize/js/materialize.js',
  '/favicon.ico',
];

self.addEventListener('install', function(e) {
  console.log('[ServiceWorker] Install');
  e.waitUntil(
    caches.open(staticCacheName).then(function(cache) {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(staticFilesToCache);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          console.log('[ServiceWorker] Removing old cache', cacheName);
          return cacheName.startsWith('currency-') &&
                 !allCaches.includes(cacheName);
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});


self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      if (response) return response;
      return fetch(event.request).then(function(response) {
        // console.log('[ServiceWorker] Response', response);
        return response
      });
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

//ahmed

