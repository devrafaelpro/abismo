// Funciona offline: rede primeiro, cache como reserva.
const CACHE = 'abismo-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/main.js', 'js/ui.js', 'js/render.js', 'js/dive.js', 'js/world.js', 'js/data.js', 'js/state.js', 'js/audio.js', 'js/fmt.js',
  'fonts/barlow-400.woff2', 'fonts/barlow-600.woff2', 'fonts/barlow-700.woff2', 'fonts/cond-500.woff2', 'fonts/cond-700.woff2', 'fonts/cond-800.woff2',
  'icons/icon-192.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(x => x || caches.match('./'))));
});
