self.addEventListener('install', (event) => {
    console.log('Service worker installing...');
    // Perform install steps
});

self.addEventListener('fetch', (event) => {
    console.log('Service worker fetching...', event.request.url);
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});