// FirePCR Service Worker v9 — Vite SPA
// Caches index.html + all JS/CSS assets for true offline

const CACHE_NAME = 'firepcr-v9';

// Install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache index.html
      try { await cache.add('/'); } catch (e) { console.error('[SW] Failed to cache /', e); }
      // Cache static assets
      try { await cache.addAll(['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']); } catch {}
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches, claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => {
      // Take control of all open tabs immediately
      return self.clients.claim();
    })
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Skip Supabase auth token requests
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/auth/v1/token')) return;

  // ── JS/CSS/Font assets: CacheFirst (immutable, hashed filenames) ──
  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.woff2')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // ── Navigation: serve index.html (SPA routing) ──
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/', clone));
        }
        return response;
      }).catch(() => {
        return caches.match('/').then(cached => {
          if (cached) return cached;
          return new Response(
            '<html><body style="background:#030712;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,system-ui,sans-serif"><div style="text-align:center"><p style="font-size:3rem">📶</p><h1>Offline</h1><p style="color:#888">Please connect to the internet and reload.</p><button onclick="location.reload()" style="margin-top:1rem;padding:.75rem 2rem;background:#0066ff;color:#fff;border:none;border-radius:12px;font-size:1rem;cursor:pointer">Reload</button></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
    return;
  }

  // ── Supabase API: NetworkFirst with cache fallback ──
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503, headers: { 'Content-Type': 'application/json' }
          });
        });
      })
    );
    return;
  }

  // ── Everything else: NetworkFirst ──
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => {
        if (cached) return cached;
        return new Response('', { status: 503 });
      });
    })
  );
});
