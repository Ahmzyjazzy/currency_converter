//service worker
var staticCacheName = 'currency-static-v1',
    materialIcon = 'currency-icon',
    currencies = 'currency-list';

var allCaches = [
  staticCacheName,
  materialIcon,
  currencies
];

var staticFilesToCache = [
  '/',
  '/index.html',
  '/src/css/app.css',
  '/src/js/jquery.min.js',
  '/src/js/app.js',
  '/src/js/localforage-1.4.0.js',
  '/src/js/handlebars.min.js',
  '/src/materialize/css/materialize.min.css',
  '/src/materialize/js/materialize.js',
  '/src/select2/css/select2.min.css',
  '/src/select2/js/select2.full.min.js',
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
  var requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== location.origin) {    
    // check google fonts request
    if(requestUrl.origin == 'https://fonts.gstatic.com' || requestUrl.pathname.startsWith('/icon')) 
      event.respondWith(serveFiles(event.request, materialIcon));
    // check currency list request
    if(requestUrl.pathname.endsWith('currencies')) {
      event.respondWith(serveFiles(event.request, currencies));
    }
    return; 
  }

  event.respondWith(
    caches.match(event.request).then(function(response) {
      if (response) return response;
      return fetch(event.request).then(function(response) {
        return response
      });
    })
  );
});

function serveFiles(request, cacheName) {
  var storageUrl = (request.url.endsWith('currencies?'))? request.url.slice(8).split('/')[3] : request.url;
  /*check cache first then network*/
  return caches.open(cacheName).then(function(cache) {
    return cache.match(storageUrl).then(function(response) {
      console.log('[ServiceWorker] Response', response.url);
      if (response) return response;

      return fetch(request).then(function(networkResponse) {
        cache.put(storageUrl, networkResponse.clone());
        return networkResponse;
      });
    });
  });
}

self.addEventListener('message', function(event) {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

//