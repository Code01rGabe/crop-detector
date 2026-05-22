const CACHE_NAME = 'crop-detector-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './db.js',
    './app.js',
    './model/model.json',
    './model/weights.bin',
    './model/metadata.json',
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs',
    'https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.3/dist/teachablemachine-image.min.js'
];

// 1. Install Event - Cache all structural files and the model matrix
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching offline assets and AI model files...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Activate Event - Clean up older caches if updates happen
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// 3. Fetch Event - Intercept requests and serve from cache if offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached asset if found, otherwise try fetching from network
            return cachedResponse || fetch(event.request).catch(() => {
                // Optional: Fallback UI handling when both fail
            });
        })
    );
});