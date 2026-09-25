// 서비스 워커: 앱 파일 사본을 폰에 두어 인터넷이 없어도 열리게 한다.
// 파일을 고치면 VERSION 을 올린다. 그래야 폰이 새 사본을 받는다.
const VERSION = "v4";
const CACHE = `life-dashboard-${VERSION}`;

const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "design/tokens.css",
  "styles/fonts.css",
  "styles/components.css",
  "js/app.js",
  "js/time.js",
  "js/store.js",
  "js/schedule.js",
  "js/schedule-view.js",
  "js/sheet.js",
  "js/review.js",
  "js/review-view.js",
  "js/shopping.js",
  "js/shopping-view.js",
  "fonts/Pretendard-Regular.subset.woff2",
  "fonts/Pretendard-Medium.subset.woff2",
  "fonts/Pretendard-SemiBold.subset.woff2",
  "fonts/Pretendard-Bold.subset.woff2",
  "fonts/IBMPlexMono-Medium.woff2",
  "fonts/IBMPlexMono-SemiBold.woff2",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 사본을 먼저 보여 주고(빠름), 뒤에서 새 파일을 받아 사본을 바꿔 둔다
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
