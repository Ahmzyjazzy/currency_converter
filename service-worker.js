//service worker file
var staticCacheName = 'currency-static-v2',
    materialIcon = 'currency-icon';

var allCaches = [
  staticCacheName,
  materialIcon
];

var staticFilesToCache = [
  '/currency_converter/',
  '/currency_converter/index.html',
  '/currency_converter/src/css/app.css',
  '/currency_converter/src/js/jquery.min.js',
  '/currency_converter/src/js/app.js',
  '/currency_converter/src/js/localforage-1.4.0.js',
  '/currency_converter/src/js/handlebars.min.js',
  '/currency_converter/src/materialize/css/materialize.min.css',
  '/currency_converter/src/materialize/js/materialize.js',
  '/currency_converter/favicon.ico',
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
    // check google fonts request and cache
    event.respondWith(serveFonts(event.request));
    return; 
  }
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

function serveFonts(request) {
  var storageUrl = request.url;
  console.log(storageUrl);

  return caches.open(materialIcon).then(function(cache) {
    return cache.match(storageUrl).then(function(response) {
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
