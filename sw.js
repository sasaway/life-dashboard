// 서비스 워커: 앱 파일 사본을 폰에 두어 인터넷이 없어도 열리게 한다.
// 앱 파일은 '한 버전 사본' 에서만 꺼낸다 → 새 화면과 옛 코드가 섞이지 않는다.
// 새 버전은 파일을 전부 새로 받아 온 뒤에만 자리를 잡고, 그때 화면이 한 번 새로 그려진다 (app.js).
// 파일을 고치면 VERSION 을 올린다 (js/version.js 도 같이). 그래야 폰이 새 버전을 알아챈다.
const VERSION = "v1.4";
const CACHE = `life-dashboard-${VERSION}`;
const ICONS = "encore-icons"; // 명조 캐릭터 얼굴 (버전이 바뀌어도 남긴다)
// 옛 워프레임 게임 자료 사본(wf-data, 모딩용)은 v1.4 에서 모딩을 없애면서 아래 정리 때 같이 지운다

const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "design/tokens.css",
  "styles/fonts.css",
  "styles/components.css",
  "js/app.js",
  "js/dom.js",
  "js/icons.js",
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
  "js/wuwa.js",
  "js/wuwa-view.js",
  "js/warframe.js",
  "js/warframe-view.js",
  "js/library.js",
  "js/photos.js",
  "js/library-view.js",
  "js/briefing.js",
  "js/briefing-view.js",
  "js/calendar.js",
  "js/calendar-view.js",
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
  e.waitUntil((async () => {
    // 올리는 중간(파일 일부만 새것)에 받으면 섞이니, 버전 표시가 맞는지 먼저 본다. 안 맞으면 다음에 다시.
    const v = await fetch(new Request("js/version.js", { cache: "reload" })).then((r) => r.text());
    if (!v.includes(`"${VERSION} `)) throw new Error(`version.js 가 아직 ${VERSION} 가 아니다`);
    // cache: "reload" — 폰이 잠깐 들고 있던 옛 파일 말고 서버의 새 파일을 받는다
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![CACHE, ICONS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 앱 파일: 이 버전 사본에서 꺼낸다 (없으면 받아서 넣어 둔다). 인터넷이 없어도 열린다.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // 명조 캐릭터 얼굴: 한 번 받으면 사본을 쓴다 (인터넷 없이도 보이게)
  if (req.method === "GET" && url.hostname === "api.encore.moe" && url.pathname.includes("/resource/")) {
    e.respondWith(caches.open(ICONS).then(async (cache) =>
      (await cache.match(req)) || fetch(req).then((res) => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; })));
    return;
  }
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        // 인터넷이 없고 사본도 없으면: 화면 요청이면 첫 화면이라도
        return (req.mode === "navigate" && (await cache.match("./"))) || Response.error();
      }
    }),
  );
});
