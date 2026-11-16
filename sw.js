/* Field Tools service worker: caches the whole app so it works with no signal.
   Bump VERSION whenever any file changes so phones pick up the new copy. */
const VERSION = 'field-tools-v1.2.0';
const FILES = [
  './', 'index.html', 'styles.css', 'core.js', 'app.js', 'pwa.js', 'manifest.webmanifest',
  'fonts/barlow-condensed-latin-400-normal.woff2', 'fonts/barlow-condensed-latin-600-normal.woff2',
  'fonts/barlow-condensed-latin-700-normal.woff2', 'fonts/share-tech-mono-latin-400-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('field-tools-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first (the app is fully static), falling back to the network, and to the app shell for page loads.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => {
      if (req.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    }))
  );
});
