const CACHE_NAME = 'firepcr-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.add('/');
      await cache.addAll(['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/auth/v1/token')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // For navigation: ALWAYS serve index.html (SPA routing)
      if (event.request.mode === 'navigate') {
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put('/', response.clone());
          return response;
        } catch {
          const cached = await cache.match('/');
          if (cached) return cached;
          return new Response('Offline', { status: 503 });
        }
      }

      // For everything else: NetworkFirst
      try {
        const response = await fetch(event.request);
        if (response.ok && response.status === 200 && !response.redirected) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        return new Response(JSON.stringify({ error: 'offline' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        });
      }
    })()
  );
});
