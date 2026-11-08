const CACHE_PREFIX = "bazar-" + self.registration.scope + "-";
const CACHE = CACHE_PREFIX + "v10";
const ASSETS = [
  "./public/logo-teemo-transparent.png",
  "./",
  "./catalogo.html",
  "./contato.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./public/icon.svg",
  "./public/logo-teemo.png",
  "./public/products/teemo-collectible-plush.png",
  "./public/products/tibbers-plush.png",
  "./public/products/panda-teemo.png",
  "./public/products/teemo-figure.png",
  "./public/products/jinx-anime-inspired-tee-unisex.png",
  "./public/products/winter-wonder-soraka-mousepad.png",
  "./public/products/arcane-jinx-ekko-tee.png",
  "./public/products/teemo-plush.png",
  "./data/products.json",
  "./services/catalog.js",
  "./public/products/worlds-2026-poro-plush.png",
  "./public/products/high-noon-thresh-mousepad.png",
  "./public/products/apex-kda-ahri-figure.png",
  "./public/products/bbc-arcane-jinx-tee.png",
  "./public/products/lcs-2024-tibbers-plush.png",
  "./public/products/kalista-posters.png",
  "./public/products/jhin-art-print.png",
  "./public/products/kayn-posters.png",
  "./public/products/spirit-blossom-ahri-xl-mousepad.png",
  "./public/products/gromp-plush.png",
  "./public/products/baron-nashor-plush.png",
  "./public/products/kda-firestarter-crossbody-bag.png",
  "./public/products/battle-academia-keychains-6-pack.png",
];
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE)
              .map((k) => caches.delete(k)),
          ),
        ),
    ]),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    !e.request.url.startsWith(self.registration.scope)
  )
    return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches
        .match(e.request)
        .then(
          (r) =>
            r || new Response("Conteúdo indisponível offline", { status: 503 }),
        ),
    ),
  );
});
