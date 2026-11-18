const RELEASE = '3.1.0';
const CACHE = 'fluentlab-static-' + RELEASE;
const versioned = name => './' + name + '?v=' + RELEASE;
const SHELL = './index.html';
const assets = [
  'styles.css', 'studio.css', 'data.js', 'question-bank.js', 'mission-transfer.js',
  'missions-data.js', 'adaptive.js', 'cloud-config.js', 'cloud.js', 'app.js',
  'favicon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'
];
const scope = self.registration.scope;
const assetUrls = new Set(assets.map(name => new URL(versioned(name), scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    new Request(new URL(SHELL, scope), {cache: 'reload'}),
    ...assetUrls
  ])));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('fluentlab-static-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(new URL(SHELL, scope)) || Response.error();
    }));
  } else if (assetUrls.has(request.url)) {
    event.respondWith(caches.open(CACHE).then(async cache => await cache.match(request) || fetch(request)));
  }
});
