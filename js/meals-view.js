// 식단 화면: 식단 탭(오늘·이번 주·산 재료 추천), 메인 카드, 요리 고르기 창.
import { store } from "./store.js";
import { openSheet, closeSheet } from "./sheet.js";
import { getScheduleSettings } from "./schedule-view.js";
import { ymd, mondayOf } from "./schedule.js";
import { DAYS } from "./time.js";
import { planWeek, withOverride, pickable } from "./meals.js";
import { ideasFor } from "./meal-tips.js";
import { openRecipeForDish } from "./recipe-view.js";
import { $, esc } from "./dom.js";

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
  $("mealMain").innerHTML = t.meals.map((m) =>
    `<li><button class="meal-link" data-recipe-dish="${esc(m.dish.id)}" aria-label="${esc(m.label)} ${esc(m.dish.short)} 레시피 보기">${mealLine(m)}<span class="go">레시피</span></button></li>`).join("")
    + (t.work ? workLine(t.work) : "");
}

// ---------- 식단 탭 ----------
// 이번 주 식단표가 이 탭의 주인공이다. 오늘 줄은 일정표의 '진행 중' 칸처럼 강조하고, 지난 날은 흐리게.
function renderMealTab() {
  const w = week();
  const today = ymd(new Date());
  const [first, last] = [w[0].date, w[6].date];
  $("mealWeekRange").textContent = `${first.getMonth() + 1}/${first.getDate()} – ${last.getMonth() + 1}/${last.getDate()}`;

  $("mealWeek").innerHTML = w.map((d) => {
    const cls = d.day === today ? "cur" : d.day < today ? "past" : "";
    return `<li class="${cls}"${d.day === today ? ' aria-current="date"' : ""}>
      <span class="wd"><b>${DAYS[d.date.getDay()]}</b><span class="num">${d.date.getMonth() + 1}/${d.date.getDate()}</span></span>
      <span class="slots">
        ${d.day === today ? '<span class="pill">오늘</span>' : ""}
        ${d.meals.map((m) => `<button class="meal-chip" data-slot="${esc(m.key)}" aria-label="${esc(shortDay(d.date))} ${esc(m.label)}: ${esc(m.dish.short)}. 바꾸기">
          <span class="lbl">${esc(m.label)}</span><span class="dish">${esc(m.dish.short)}</span>${m.auto ? "" : '<span class="mark">직접</span>'}</button>`).join("")}
        ${d.work ? `<span class="work-note">${esc(d.work)}은 알바 식대</span>` : ""}
      </span>
    </li>`;
  }).join("");

  const ideas = ideasFor(store.load("bought", []), new Date());
  $("mealTips").innerHTML = ideas.map((x) => `
    <li><div class="row-h"><b>${esc(x.name)}</b><span class="sub">${esc(x.from.join(", "))}</span></div>
      <span class="why">${esc(x.why)}</span>
      <ol>${x.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol></li>`).join("");
  $("mealTipsEmpty").hidden = ideas.length > 0;
}

// ---------- 요리 고르기 ----------
let picking = null;

function openPicker(key) {
  const m = week().flatMap((d) => d.meals).find((x) => x.key === key);
  if (!m) return;
  picking = m;
  $("pickTitle").textContent = `${m.label} 바꾸기`;
  $("pickDate").textContent = shortDay(new Date(`${m.day}T00:00`));
  $("pickRecipe").dataset.dish = m.dish.id;
  $("pickList").innerHTML = pickable().map((dish) => `
    <li><button class="pick" data-dish="${dish.id}" aria-pressed="${!m.auto && m.dish.id === dish.id}">${esc(dish.name)}</button></li>`).join("")
    + `<li><button class="pick" data-dish="" aria-pressed="${m.auto}">자동으로 (돌림 순서대로)</button></li>`;
  openSheet("mealSheet");
}

export function renderAll() {
  renderMealMain();
  renderMealTab();
}

// 식단 탭 위 전환: [이번 주 식단 · 레시피] (돈 탭과 같은 모양)
function showMealPage(page) {
  document.querySelectorAll("#mealPick button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.page === page)));
  $("meal-page-week").hidden = page !== "week";
  $("meal-page-recipes").hidden = page !== "recipes";
}

export function startMeals() {
  renderAll();
  $("mealPick").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]");
    if (b) showMealPage(b.dataset.page);
  });
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
  // 오늘 메뉴를 누르거나, 고르기 창에서 '레시피 보기' 를 누르면 레시피
  $("mealMain").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-recipe-dish]");
    if (b) openRecipeForDish(b.dataset.recipeDish);
  });
  $("pickRecipe").addEventListener("click", () => openRecipeForDish($("pickRecipe").dataset.dish));
  // 일과표(알바 요일·주)나 산 재료가 바뀌면 다시 그린다
  document.addEventListener("schedule-change", renderAll);
  document.addEventListener("bought-change", renderMealTab);
}
