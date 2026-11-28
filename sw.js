// Офлайн-режим. Свои файлы: сначала сеть (новые уроки появляются сразу), но не дольше 4 секунд —
// на слабой связи отдаём из кэша. Шрифты лежат в самом сайте (fonts/), редкие слоги кэшируются при первой встрече.
const CACHE = 'korean-v24';
const SHELL = ['./', './index.html', './app/styles.css', './data/index.js', './data/pictures.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-180.png', './icon-512.png', './icon-maskable-512.png',
  './fonts/fonts.css', './fonts/ibm-plex-sans.woff2', './fonts/noto-sans-kr-core.woff2', './fonts/noto-serif-kr-core.woff2',
  ...['hangul', 'store', 'tts', 'ui', 'keyboard', 'numbers', 'data', 'practice', 'views', 'reading', 'main'].map((f) => `./app/${f}.js`)];
// уроки перечислены в data/index.js: берём их id оттуда, чтобы приложение открывалось без сети уже после первого визита
async function precache() {
  const c = await caches.open(CACHE);
  const fresh = (u) => new Request(u, { cache: 'reload' }); // мимо HTTP-кэша браузера, иначе в офлайн-кэш попадёт старая версия
  await c.addAll(SHELL.map(fresh));
  const list = await (await fetch('./data/index.js', { cache: 'no-cache' })).text();
  await c.addAll([...new Set(list.match(/lesson-\d+/g) || [])].map((id) => fresh(`./data/lessons/${id}.js`)));
}
const NET_TIMEOUT = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // только свои старые кэши: на github.io у соседних сайтов того же владельца общий origin
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('korean-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req.url, { cache: 'no-cache' }).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  });
  net.catch(() => {}); // если ответ из кэша уже отдан, ошибку сети просто игнорируем
  try {
    const first = await Promise.race([net, new Promise((r) => setTimeout(r, NET_TIMEOUT))]);
    if (first) return first;
    const hit = await cache.match(req);
    return hit || (await net);
  } catch {
    const hit = (await cache.match(req)) || (req.mode === 'navigate' ? (await cache.match('./')) || (await cache.match('./index.html')) : null);
    return hit || Response.error();
  }
}
