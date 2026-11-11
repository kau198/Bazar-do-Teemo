const CACHE_PREFIX = "bazar-" + self.registration.scope + "-";
const CACHE = CACHE_PREFIX + "v11";
const ASSETS = [
  "/assets/icons/logo-teemo-transparent.png",
  "/",
  "/catalogo",
  "/contato",
  "/css/style.css",
  "/js/main.js",
  "/manifest.webmanifest",
  "/assets/icons/icon.svg",
  "/assets/icons/logo-teemo.png",
  "/assets/images/products/teemo-collectible-plush.png",
  "/assets/images/products/tibbers-plush.png",
  "/assets/images/products/panda-teemo.png",
  "/assets/images/products/teemo-figure.png",
  "/assets/images/products/jinx-anime-inspired-tee-unisex.png",
  "/assets/images/products/winter-wonder-soraka-mousepad.png",
  "/assets/images/products/arcane-jinx-ekko-tee.png",
  "/assets/images/products/teemo-plush.png",
  "/assets/images/products/worlds-2026-poro-plush.png",
  "/assets/images/products/high-noon-thresh-mousepad.png",
  "/assets/images/products/apex-kda-ahri-figure.png",
  "/assets/images/products/bbc-arcane-jinx-tee.png",
  "/assets/images/products/lcs-2024-tibbers-plush.png",
  "/assets/images/products/kalista-posters.png",
  "/assets/images/products/jhin-art-print.png",
  "/assets/images/products/kayn-posters.png",
  "/assets/images/products/spirit-blossom-ahri-xl-mousepad.png",
  "/assets/images/products/gromp-plush.png",
  "/assets/images/products/baron-nashor-plush.png",
  "/assets/images/products/kda-firestarter-crossbody-bag.png",
  "/assets/images/products/battle-academia-keychains-6-pack.png",
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
    new URL(e.request.url).pathname.startsWith("/api/") ||
    new URL(e.request.url).pathname.startsWith("/admin") ||
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
