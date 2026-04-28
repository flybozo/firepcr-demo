// FirePCR Service Worker v11 — Vite SPA
// Caches index.html + all JS/CSS assets for true offline

const CACHE_NAME = 'firepcr-v16';

// Install: cache the app shell + all JS/CSS asset chunks
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Cache index.html
      try { await cache.add('/'); } catch (e) { console.error('[SW] Failed to cache /', e); }
      // Cache static assets
      try { await cache.addAll(['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']); } catch {}
      // Pre-cache all hashed JS/CSS chunks so the app works offline after cache clear
      try {
        const res = await fetch('/asset-manifest.json');
        if (res.ok) {
          const { assets } = await res.json();
          await Promise.allSettled(assets.map(url => cache.add(url)));
          console.log(`[SW] Pre-cached ${assets.length} asset chunks`);
        }
      } catch (e) {
        console.warn('[SW] Could not pre-cache asset chunks:', e);
      }
      self.skipWaiting();
    })()
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

// Listen for skip-waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'FirePCR', body: 'You have a new notification', url: '/' };
  let debugInfo = 'no event.data';
  try {
    if (event.data) {
      const raw = event.data.text();
      debugInfo = 'raw: ' + raw.substring(0, 100);
      data = { ...data, ...JSON.parse(raw) };
    }
  } catch (e) {
    debugInfo = 'parse error: ' + String(e);
    data.body = debugInfo;
  }

  // Don't show notification if the app is already visible in the foreground
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: false }).then((clients) => {
      const appInForeground = clients.some((c) => c.visibilityState === 'visible');
      // If app is open and the notification is a chat message, skip it
      if (appInForeground && data.url === '/chat') return;
      const origin = self.location.origin;
      // iOS Safari only reliably renders: title, body, icon, data
      // vibrate/renotify/requireInteraction/badge cause body to be silently dropped on iOS
      const isIOS = /iP(hone|ad|od)/.test(self.navigator?.userAgent || '');
      const opts = {
        body: data.body || '',
        icon: origin + '/icons/icon-512.png',
        data: { url: data.url || '/' },
      };
      if (!isIOS) {
        Object.assign(opts, {
          badge: origin + '/icons/icon-192.png',
          vibrate: [200, 100, 200],
          tag: data.tag || 'firepcr-' + Date.now(),
          renotify: true,
          silent: false,
        });
      }
      return self.registration.showNotification(data.title || 'FirePCR', opts);
    })
  );
});

// Notification click — open the app to the specified URL.
// Internal paths (e.g. /chat) focus the running PWA and route in-app.
// External http(s) URLs open in a new window/tab so the user can reach the linked site.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || '/';

  // Classify the URL once. Reject any non-http(s) scheme to avoid javascript:/data: tricks.
  let isExternal = false;
  let targetUrl = '/';
  try {
    if (/^https?:\/\//i.test(rawUrl)) {
      const u = new URL(rawUrl);
      isExternal = u.origin !== self.location.origin;
      targetUrl = u.href;
    } else if (rawUrl.startsWith('/')) {
      targetUrl = new URL(rawUrl, self.location.origin).href;
    } else {
      targetUrl = self.location.origin + '/';
    }
  } catch (_) {
    targetUrl = self.location.origin + '/';
  }

  event.waitUntil((async () => {
    if (isExternal) {
      // External link: open in a new browser window/tab. Don't try to navigate the PWA there
      // — standalone PWAs can't navigate to a different origin, and iOS will silently fail.
      try {
        await self.clients.openWindow(targetUrl);
      } catch (e) {
        console.error('[SW] openWindow failed for external URL', targetUrl, e);
      }
      return;
    }

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Broadcast NAVIGATE to ALL existing clients first (handles iOS suspended PWA)
    clients.forEach(client => {
      client.postMessage({ type: 'NAVIGATE', url: targetUrl });
    });
    const appClient = clients.find(client => client.url.startsWith(self.location.origin));
    if (appClient) {
      return appClient.focus().then(focused => {
        if ('navigate' in focused) {
          try { return focused.navigate(targetUrl); } catch (_) {}
        }
        return focused;
      });
    }
    return self.clients.openWindow(targetUrl);
  })());
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
