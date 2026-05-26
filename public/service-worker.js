const CACHE_NAME = 'gains-ai-v7';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = ['/offline.html', '/manifest.json'];
const WORKOUT_NOTIF_TAG = 'active-workout';

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

// --- ONGOING WORKOUT NOTIFICATION ---
// The page posts messages to update / clear a sticky notification that shows
// the current workout status in the Android notification drawer.

self.addEventListener('message', (event) => {
    const data = event.data || {};

    if (data.type === 'WORKOUT_NOTIFICATION_UPDATE') {
        const { title, body, isActive } = data.payload || {};
        const showPromise = self.registration.showNotification(title || 'Workout in progress', {
            body: body || '',
            tag: WORKOUT_NOTIF_TAG,
            renotify: false,
            requireInteraction: true,
            silent: true,
            icon: '/logo192.png',
            badge: '/logo192.png',
            data: { url: '/' },
            // actions: [
            //     { action: 'toggle', title: isActive ? 'Pause' : 'Resume' },
            //     { action: 'open', title: 'Open' },
            // ],
        });
        if (event.waitUntil) event.waitUntil(showPromise);
        return;
    }

    if (data.type === 'WORKOUT_NOTIFICATION_CLEAR') {
        const clearPromise = self.registration
            .getNotifications({ tag: WORKOUT_NOTIF_TAG })
            .then((notifs) => notifs.forEach((n) => n.close()));
        if (event.waitUntil) event.waitUntil(clearPromise);
    }
});

self.addEventListener('notificationclick', (event) => {
    if (event.notification.tag !== WORKOUT_NOTIF_TAG) return;
    event.notification.close();
    const action = event.action;

    event.waitUntil((async () => {
        const allClients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        });

        if (action === 'toggle') {
            // Tell any open page to flip the workout timer.
            allClients.forEach((c) =>
                c.postMessage({ type: 'WORKOUT_TOGGLE_TIMER' })
            );
            return;
        }

        // Default click or 'open' action: focus an existing tab, or open a new one.
        if (allClients.length > 0) {
            const client = allClients[0];
            try { await client.focus(); } catch (_) { /* ignore */ }
            client.postMessage({ type: 'WORKOUT_NOTIFICATION_OPEN' });
            return;
        }
        await self.clients.openWindow('/');
    })());
});