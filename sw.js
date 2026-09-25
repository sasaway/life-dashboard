// 서비스 워커: 앱 파일 사본을 폰에 두어 인터넷이 없어도 열리게 한다.
// 인터넷이 되면 늘 새 파일을 먼저 받고, 안 될 때만 사본을 쓴다.
// 파일을 고치면 VERSION 을 올린다 (js/version.js 도 같이). 그래야 폰이 새 버전을 알아챈다.
const VERSION = "v13";
const CACHE = `life-dashboard-${VERSION}`;
const NETWORK_WAIT_MS = 4000; // 인터넷이 느리면 이만큼 기다리고 사본을 쓴다

const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "design/tokens.css",
  "styles/fonts.css",
  "styles/components.css",
  "js/app.js",
  "js/version.js",
  "js/time.js",
  "js/store.js",
  "js/schedule.js",
  "js/schedule-view.js",
  "js/sheet.js",
  "js/review.js",
  "js/review-view.js",
  "js/shopping.js",
  "js/shopping-view.js",
  "js/budget.js",
  "js/budget-view.js",
  "js/meals.js",
  "js/meal-tips.js",
  "js/meals-view.js",
  "js/recipes.js",
  "js/timer.js",
  "js/recipe-view.js",
  "js/workout.js",
  "js/workout-view.js",
  "fonts/Pretendard-Regular.subset.woff2",
  "fonts/Pretendard-Medium.subset.woff2",
  "fonts/Pretendard-SemiBold.subset.woff2",
  "fonts/Pretendard-Bold.subset.woff2",
  "fonts/IBMPlexMono-Medium.woff2",
  "fonts/IBMPlexMono-SemiBold.woff2",
  "images/exercise/walk.jpg",
  "images/exercise/roll.jpg",
  "images/exercise/legpress.jpg",
  "images/exercise/latpull.jpg",
  "images/exercise/row.jpg",
  "images/exercise/chest.jpg",
  "images/exercise/shoulder.jpg",
  "images/exercise/pecdeck.jpg",
  "images/exercise/backext.jpg",
  "images/exercise/crunch.jpg",
  "images/exercise/cardio.jpg",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  // cache: "reload" — 폰이 잠깐 들고 있던 옛 파일 말고 서버의 새 파일을 받는다
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 새 파일을 먼저 받는다. 인터넷이 없거나 느리면 사본을 보여 준다.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // no-cache: 서버에 '바뀌었어?' 를 꼭 물어본다 (안 바뀌었으면 짧은 대답만 온다)
      const network = fetch(req, { cache: "no-cache" }).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      });
      network.catch(() => {}); // 사본을 보여 준 뒤 실패해도 조용히 넘어간다
      const slow = new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT_MS));
      let res;
      try {
        res = await Promise.race([network, slow]);
        if (res?.ok) return res;
      } catch {
        // 인터넷 없음 → 아래에서 사본
      }
      // 인터넷이 없거나, 느리거나, 서버가 오류를 돌려주면 사본
      const cached = await cache.match(req, { ignoreSearch: true });
      return cached || res || network;
    }),
  );
});
