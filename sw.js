// Офлайн-режим: сначала сеть (чтобы новые уроки появлялись сразу), без сети — из кэша.
const CACHE = 'korean-v1';
// v2
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === location.origin;
  e.respondWith(
    (sameOrigin ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request))
      .then((res) => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
