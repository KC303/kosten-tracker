// Hält die App-Dateien auf dem Gerät vor, damit sie ohne Netz startet.
// Kostendaten fasst der Service Worker nie an, sie liegen im localStorage der Seite.
const CACHE = 'kosten-tracker-v2';
const DATEIEN = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'logik.js',
  'diagramme.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Sofort aus dem Vorrat antworten und im Hintergrund nachladen:
// Die App startet immer schnell, eine neue Fassung ist beim nächsten Öffnen da.
self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;

  ereignis.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const vorrat = await cache.match(anfrage, { ignoreSearch: true });
    const frisch = fetch(anfrage, { cache: 'no-cache' })
      .then((antwort) => {
        if (antwort.ok) cache.put(anfrage, antwort.clone());
        return antwort;
      })
      .catch(() => null);
    if (vorrat) {
      ereignis.waitUntil(frisch);
      return vorrat;
    }
    const antwort = await frisch;
    if (antwort) return antwort;
    if (anfrage.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
    return Response.error();
  })());
});
