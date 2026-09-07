const CACHE = 'tallerpc-v1';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './db.js', './pdf-export.js', './cloud.js', './cloud-config.js',
  './brand-pattern-v221.css', './brand-pattern-v221.js', './svg-sanitize-v221.js', './manifest.webmanifest', './tech-mark.svg', './circuit-pattern-dark.svg', './circuit-pattern-light.svg', './circuit-pattern-print.svg',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Nunca almacenar respuestas de Supabase ni de ningún servicio externo.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request)
      .then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put('./index.html', response.clone()));
        return response;
      })
      .catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => {
    const network = fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});
