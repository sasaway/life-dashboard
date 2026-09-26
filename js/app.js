import { greeting, dateLabel } from "./time.js";
import { pad } from "./schedule.js";
import { askToKeepData } from "./store.js";
import { startSchedule, renderToday, openScheduleSettings } from "./schedule-view.js";
import { startReview, renderReviewCard } from "./review-view.js";
import { openSheet, startSheets } from "./sheet.js";
import { startShopping } from "./shopping-view.js";
import { startBudget } from "./budget-view.js";
import { startMeals, renderAll as renderMeals } from "./meals-view.js";
import { startRecipes } from "./recipe-view.js";
import { startWorkout, renderWorkout } from "./workout-view.js";
import { startWuwa, renderWuwa } from "./wuwa-view.js";
import { startWarframe, renderWarframe } from "./warframe-view.js";
import { startWfTools } from "./wf-tools-view.js";
import { startLibrary } from "./library-view.js";
import { $ } from "./dom.js";


// ---------- 머리말: 날짜 · 인사 · 시계 ----------
function renderClock() {
  const d = new Date();
  $("today").textContent = dateLabel(d);
  $("greet").textContent = greeting(d.getHours());
  $("clock").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  renderToday();
  renderReviewCard(); // 06:00 에 오늘 회고로 넘어간다
  renderMeals();      // 자정에 오늘 식단으로 넘어간다
  renderWorkout();    // 자정에 오늘 운동으로 넘어간다
  renderWuwa();       // 새벽 5시에 명조 체크가 비워진다
  renderWarframe();   // 새벽 1시에 워프레임 체크가 비워지고, 출격 남은 시간을 맞춘다
}

// 다음 분이 시작될 때 맞춰 다시 그린다
function startClock() {
  renderClock();
  const msToNextMinute = 60000 - (Date.now() % 60000);
  setTimeout(() => {
    renderClock();
    setInterval(renderClock, 60000);
  }, msToNextMinute);
  // 폰에서 앱을 다시 열었을 때 바로 맞춘다
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderClock();
  });
}

// ---------- 하단 탭 ----------
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.hidden = s.id !== `screen-${name}`;
  });
  document.querySelectorAll(".tab").forEach((t) => {
    if (t.dataset.screen === name) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
  if (name === "hobby") showHobby("hub"); // 취미 탭을 누르면 늘 게임 카드 두 장부터
  window.scrollTo(0, 0);
}

// 취미: 게임 카드(허브) → 명조 쪽 / 워프레임 쪽
function showHobby(page) {
  document.querySelectorAll(".hobby-page").forEach((p) => {
    p.hidden = p.id !== `hobby-${page}`;
  });
  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent("hobby-open", { detail: page }));
}

function startTabs() {
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => showScreen(t.dataset.screen));
  });
  // 메인 카드에서 바로 가기: 운동 카드 → 운동 탭, 취미 카드 제목 줄 → 그 게임 화면
  $("screen-main").addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]")?.dataset.go;
    if (go === "gym") showScreen("gym");
    else if (go === "ww" || go === "wf") {
      showScreen("hobby");
      showHobby(go);
    }
  });
  $("screen-hobby").addEventListener("click", (e) => {
    const b = e.target.closest("[data-hobby]");
    if (b) showHobby(b.dataset.hobby);
  });
}

// ---------- 설정 창 ----------
function startSettings() {
  $("appVersion").textContent = `앱 버전 ${self.APP_VERSION}`;
  $("openSettings").addEventListener("click", () => {
    openScheduleSettings();
    openSheet("settings");
  });
}

// ---------- 오프라인 준비 ----------
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const hadWorker = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register("sw.js").then((reg) => {
    // 앱으로 돌아올 때마다 새 버전이 올라왔는지 확인한다
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) reg.update().catch(() => {});
    });
  }).catch(() => {
    // https 가 아닌 곳(같은 와이파이 확인 등)에서는 등록이 안 된다. 앱은 그대로 돈다.
  });
  // 새 버전이 자리 잡으면 화면을 한 번 새로 그린다 (처음 설치 때는 제외)
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadWorker && !reloaded) {
      reloaded = true;
      location.reload();
    }
  });
}

startSheets();
startSchedule();
startReview();
startShopping();
startBudget();
startMeals();
startRecipes();
startWorkout();
startWuwa();
startWarframe();
startWfTools();
startLibrary();
startClock();
startTabs();
startSettings();
registerServiceWorker();
askToKeepData();
