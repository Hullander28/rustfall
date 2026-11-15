// Rustfall service worker - "always live":
// every same-origin request goes to the network first (revalidated, so unchanged files are a cheap 304),
// the cache is only an offline fallback. A new deploy is therefore picked up on the very next launch.
const BUILD = '20261115184937';
const CACHE = 'rustfall-' + BUILD;
const CORE = ['./', 'index.html', 'index.js', 'index.wasm', 'index.pck', 'index.audio.worklet.js', 'rf.js', 'manifest.webmanifest',
  'rf-font.ttf', 'loading-bg.jpg', 'icon-192.png', 'icon-180.png', 'icon-512.png', 'version.json'];
self.addEventListener('install', (e) => {
  // take over immediately; warm the offline cache in the background
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, {cache: 'no-cache'})).catch(() => {})))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('rustfall-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // Firebase / Google always straight to network
  const nav = req.mode === 'navigate';
  const key = nav ? 'index.html' : url.pathname.endsWith('/version.json') ? 'version.json' : req;
  const net = nav ? fetch(req.url, {cache: 'no-cache', credentials: 'same-origin'}) : fetch(req, {cache: 'no-cache'});
  e.respondWith(net.then((r) => {
    if (r.ok && r.status === 200) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(key, cp)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(key, {ignoreSearch: true}).then((hit) => hit || caches.match(req, {ignoreSearch: true}))
    .then((hit) => hit || Response.error())));
});
