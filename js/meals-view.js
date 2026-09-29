// 식단 화면: 식단 탭(오늘·이번 주·산 재료 추천), 메인 카드, 요리 고르기 창.
import { store } from "./store.js";
import { openSheet, closeSheet } from "./sheet.js";
import { getScheduleSettings } from "./schedule-view.js";
import { ymd, mondayOf } from "./schedule.js";
import { DAYS } from "./time.js";
import { planWeek, withOverride, pickable, syncMealLog, recordDay } from "./meals.js";
import { ideasFor } from "./meal-tips.js";
import { openRecipeForDish } from "./recipe-view.js";
import { $, esc } from "./dom.js";

const shortDay = (d) => `${DAYS[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;

let overrides = store.load("mealOverrides", {}); // { "2026-09-25 점심": "ramen" }
let mealLog = store.load("mealLog", {});          // 날마다 먹은 끼니 한 벌 (v2.2, 주간 보고서용)

// 오늘 기록을 새로 맞추고, 지난 며칠 중 빈 날을 채운다 (바뀐 게 있을 때만 저장)
function syncLog() {
  const next = syncMealLog(mealLog, new Date(), getScheduleSettings(), overrides);
  if (JSON.stringify(next) === JSON.stringify(mealLog)) return;
  mealLog = next;
  store.save("mealLog", mealLog);
}

const week = () => planWeek(mondayOf(new Date()), getScheduleSettings(), overrides);
const todayOf = (w) => w.find((d) => d.day === ymd(new Date()));

// 오늘 메뉴 한 줄 (누르면 레시피, '안 먹음 · 외식' 은 레시피 없이 글만). t = 왼쪽 칸(시각 또는 '알바 중')
const mealRow = (dish, t, label, note = "") => dish.none
  ? `<li>${t}<span class="n"><b>${esc(label)}</b> · ${esc(dish.short)}</span></li>`
  : `<li><button class="meal-link" data-recipe-dish="${esc(dish.id)}" aria-label="${esc(label)} ${esc(dish.short)} 레시피 보기">${t}<span class="n"><b>${esc(label)}</b> · ${esc(dish.short)}${note ? `<span class="meal-note">${esc(note)}</span>` : ""}</span><span class="go">레시피</span></button></li>`;
// 알바 중 끼니는 먹는 차례대로: 오픈반 점심은 집 저녁보다 먼저, 마감반 저녁은 집 점심 다음
const inOrder = (home, work, first) => (work ? (first ? [work, ...home] : [...home, work]) : home);

// ---------- 메인 카드: 오늘 메뉴만 ----------
export function renderMealMain() {
  const t = todayOf(week());
  const home = t.meals.map((m) => mealRow(m.dish, `<span class="t mono">${esc(m.start)}</span>`, m.label));
  const work = t.work && mealRow(t.work.dish, `<span class="t">알바 중</span>`, t.work.label, t.work.note);
  $("mealMain").innerHTML = inOrder(home, work, t.work?.first).join("");
}

// ---------- 식단 탭 ----------
// 알바 중 끼니는 늘 같아서 고르는 칸이 아니라 작은 한 줄
const workNote = (w) =>
  `<span class="work-note">${esc(w.label)} · 알바 중 · ${esc(w.dish.short)}${w.note ? ` (${esc(w.note)})` : ""}</span>`;
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
        ${inOrder(d.meals.map((m) => `<button class="meal-chip" data-slot="${esc(m.key)}" aria-label="${esc(shortDay(d.date))} ${esc(m.label)}: ${esc(m.dish.short)}. 바꾸기">
          <span class="lbl">${esc(m.label)}</span><span class="dish">${esc(m.dish.short)}</span>${m.auto ? "" : '<span class="mark">직접</span>'}</button>`),
          d.work && workNote(d.work), d.work?.first).join("")}
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
  $("pickRecipe").hidden = Boolean(m.dish.none); // '안 먹음 · 외식' 은 레시피가 없다
  $("pickList").innerHTML = pickable().map((dish) => `
    <li><button class="pick" data-dish="${dish.id}" aria-pressed="${!m.auto && m.dish.id === dish.id}">${esc(dish.name)}</button></li>`).join("")
    + `<li><button class="pick" data-dish="" aria-pressed="${m.auto}">자동으로 (돌림 순서대로)</button></li>`;
  openSheet("mealSheet");
}

export function renderAll() {
  syncLog(); // 1분마다 불린다 — 자정이 지나면 어제 기록이 그대로 남고 오늘 기록이 새로 생긴다
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
    // 지난 날을 고치면 그 날 먹은 기록도 고친다 (오늘은 renderAll 이 맞춘다)
    mealLog = recordDay(mealLog, new Date(`${picking.day}T00:00`), new Date(), getScheduleSettings(), overrides);
    store.save("mealLog", mealLog);
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
