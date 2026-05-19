const CACHE_NAME = 'gains-ai-v5';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = ['/offline.html', '/manifest.json'];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Navigation requests: try network first; on failure, always show offline page.
    // (We don't fall back to a cached index.html because its JS/CSS chunks may
    //  not be cached, which would result in a blank white screen.)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    // Other requests: network first, fall back to cache if available.
    event.respondWith(
        fetch(request).catch(() => caches.match(request))
    );
});