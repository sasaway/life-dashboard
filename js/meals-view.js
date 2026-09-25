// 식단 화면: 식단 탭(오늘·이번 주·산 재료 추천), 메인 카드, 요리 고르기 창.
import { store } from "./store.js";
import { openSheet, closeSheet } from "./sheet.js";
import { getScheduleSettings } from "./schedule-view.js";
import { ymd } from "./schedule.js";
import { planWeek, mondayOf, withOverride, pickable } from "./meals.js";
import { tipsFor } from "./meal-tips.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const shortDay = (d) => `${DAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;

let overrides = store.load("mealOverrides", {}); // { "2026-09-25 점심": "ramen" }

const week = () => planWeek(mondayOf(new Date()), getScheduleSettings(), overrides);
const todayOf = (w) => w.find((d) => d.day === ymd(new Date()));

const mealLine = (m) =>
  `<span class="t mono">${esc(m.start)}</span><span class="n"><b>${esc(m.label)}</b> · ${esc(m.dish.short)}</span>`;
const workLine = (label) => `<li class="work"><span class="t"></span><span class="n">${esc(label)} · 알바 식대</span></li>`;

// ---------- 메인 카드: 오늘 메뉴만 ----------
export function renderMealMain() {
  const t = todayOf(week());
  $("mealMain").innerHTML = t.meals.map((m) => `<li>${mealLine(m)}</li>`).join("") + (t.work ? workLine(t.work) : "");
}

// ---------- 식단 탭 ----------
function renderMealTab() {
  const w = week();
  const t = todayOf(w);
  $("mealTodayDate").textContent = shortDay(t.date);
  $("mealToday").innerHTML = t.meals.map((m) => `<li>${mealLine(m)}</li>`).join("") + (t.work ? workLine(t.work) : "");

  $("mealWeek").innerHTML = w.map((d) => `
    <li class="${d.day === t.day ? "is-today" : ""}">
      <span class="wd">${esc(shortDay(d.date))}${d.day === t.day ? '<span class="tag">오늘</span>' : ""}</span>
      <span class="slots">
        ${d.meals.map((m) => `<button class="meal-chip" data-slot="${esc(m.key)}" aria-label="${esc(shortDay(d.date))} ${esc(m.label)}: ${esc(m.dish.short)}. 바꾸기">
          <span class="lbl">${esc(m.label)}</span>${esc(m.dish.short)}${m.auto ? "" : '<span class="mark">직접</span>'}</button>`).join("")}
        ${d.work ? `<span class="meal-chip work"><span class="lbl">${esc(d.work)}</span>알바 식대</span>` : ""}
      </span>
    </li>`).join("");

  const tips = tipsFor(store.load("bought", []), new Date());
  $("mealTips").innerHTML = tips.map((x) => `
    <li><b>${esc(x.name)}</b><span class="sub num">${esc(x.day.slice(5).split("-").map(Number).join("/"))} 가져옴</span>
      <ul>${x.tips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ul></li>`).join("");
  $("mealTipsEmpty").hidden = tips.length > 0;
}

// ---------- 요리 고르기 ----------
let picking = null;

function openPicker(key) {
  const m = week().flatMap((d) => d.meals).find((x) => x.key === key);
  if (!m) return;
  picking = m;
  $("pickTitle").textContent = `${m.label} 바꾸기`;
  $("pickDate").textContent = shortDay(new Date(`${m.day}T00:00`));
  $("pickList").innerHTML = pickable().map((dish) => `
    <li><button class="pick" data-dish="${dish.id}" aria-pressed="${!m.auto && m.dish.id === dish.id}">${esc(dish.name)}</button></li>`).join("")
    + `<li><button class="pick" data-dish="" aria-pressed="${m.auto}">자동으로 (돌림 순서대로)</button></li>`;
  openSheet("mealSheet");
}

export function renderAll() {
  renderMealMain();
  renderMealTab();
}

export function startMeals() {
  renderAll();
  $("mealWeek").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-slot]");
    if (b) openPicker(b.dataset.slot);
  });
  $("pickList").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-dish]");
    if (!b || !picking) return;
    overrides = withOverride(overrides, picking.key, b.dataset.dish);
    store.save("mealOverrides", overrides);
    closeSheet();
    renderAll();
  });
  // 일과표(알바 요일·주)나 산 재료가 바뀌면 다시 그린다
  document.addEventListener("schedule-change", renderAll);
  document.addEventListener("bought-change", renderMealTab);
}
