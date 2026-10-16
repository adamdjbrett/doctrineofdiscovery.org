const offlineCache = 'dod-offline-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(offlineCache).then(cache => cache.add('/offline.html')));
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== self.location.origin ||
      /^\/(?:admin|oai|\.netlify)(?:\/|$)/.test(url.pathname) || /\.(?!html?$)[^/]+$/.test(url.pathname)) return;
  // Keep online pages fresh; only the small offline notice is cached.
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html', {cacheName:offlineCache})));
});
