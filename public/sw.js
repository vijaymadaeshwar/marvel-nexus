/* Marvel Nexus — service worker
   Cache-first for the app shell so the timeline loads instantly (and offline),
   network-first for data so the freshest titles still flow through.
   Stale-while-revalidate for TMDB poster images. */
const CACHE_NAME = "marvel-nexus-v48";
const IMG_CACHE = "marvel-nexus-img-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/timeline-utils.js",
  "./js/app.js",
  "./js/nexus.js",
  "./js/enhance.js",
  "./js/nexus-villains.js",
  "./js/nexus-postcredits.js",
  "./js/nexus-egghunt.js",
  "./js/nexus-sharecard.js",
  "./js/nexus-nostalgia.js",
  "./js/nexus-stanlee.js",
  "./js/nexus-surprise.js",
  "./js/nexus-progress.js",
  "./js/nexus-quiz.js",
  "./js/nexus-watchparty.js",
  "./js/nexus-mobile.js",
  "./js/nexus-analytics.js",
  "./js/nexus-secretwars.js",
  "./js/nexus-advanced-stats.js",
  "./data/movies.json",
  "./data/cast.json",
  "./data/movies.inline.js",
  "./data/cast.inline.js",
  "./data/stones.inline.js",
  "./assets/background.jpg",
  "./assets/x-men.jpg",
  "./assets/doomsday.jpg",
  "./assets/favicon-48.png",
  "./assets/apple-touch-icon.png",
  "./assets/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== IMG_CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === location.origin;

  // Never cache YouTube
  if (url.hostname.includes("youtube") || url.hostname.includes("ytimg")) return;

  // TMDB poster images: stale-while-revalidate (show cached instantly, update in background)
  if (url.hostname.includes("image.tmdb.org")) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetched = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || fetched;
        })
      )
    );
    return;
  }

  // SimpleIcons CDN images: cache-first
  if (url.hostname.includes("cdn.simpleicons.org")) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Data requests: network-first, fall back to cache when offline.
  if (sameOrigin && (url.pathname.endsWith(".json") || url.pathname.endsWith(".inline.js"))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell and assets: cache-first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (sameOrigin && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
