import { greeting, dateLabel } from "./time.js";
import { askToKeepData } from "./store.js";
import { startSchedule, renderToday, openScheduleSettings } from "./schedule-view.js";
import { startReview, renderReviewCard } from "./review-view.js";
import { openSheet, startSheets } from "./sheet.js";
import { startShopping } from "./shopping-view.js";
import { startBudget } from "./budget-view.js";
import { startMeals, renderAll as renderMeals } from "./meals-view.js";
import { startRecipes } from "./recipe-view.js";

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");

// ---------- 머리말: 날짜 · 인사 · 시계 ----------
function renderClock() {
  const d = new Date();
  $("today").textContent = dateLabel(d);
  $("greet").textContent = greeting(d.getHours());
  $("clock").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  renderToday();
  renderReviewCard(); // 06:00 에 오늘 회고로 넘어간다
  renderMeals();      // 자정에 오늘 식단으로 넘어간다
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
  window.scrollTo(0, 0);
}

function startTabs() {
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => showScreen(t.dataset.screen));
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
startClock();
startTabs();
startSettings();
registerServiceWorker();
askToKeepData();
