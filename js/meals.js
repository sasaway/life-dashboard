// 식단: 주간 식단표와 오늘의 식단. 규칙은 Notion '식단' · '일정 › 알바' (2026-09-28 15:39 수정본).
// 집에서 먹는 끼니는 일과표의 식사 칸에서 가져온다. 알바 중 끼니는 늘 닭가슴살 + 햇반.
import { dayPlan, ymd, weekDates, mondayOf } from "./schedule.js";
import { proteinOf, PROTEIN_GOAL } from "./recipes.js";

// 메인 요리. 새 요리는 여기에 한 줄 더하면 돌림에 들어간다.
// work: 알바 중에 먹는 요리 — 집 끼니 자동 돌림에서는 뺀다 (칸을 눌러 직접 고르는 건 된다)
export const DISHES = [
  { id: "jja", name: "김치 대패 짜글이", short: "짜글이", makesTwo: true },
  { id: "rice", name: "계란 볶음밥", short: "계란 볶음밥" },
  { id: "ramen", name: "라면 (안성탕면)", short: "안성탕면" }, // 자동 돌림의 라면은 안성탕면
  { id: "chicken", name: "닭가슴살 + 햇반", short: "닭가슴살 + 햇반", work: true },
];
export const WORK_DISH = DISHES.find((d) => d.work);
export const ROTATION = DISHES.filter((d) => !d.work);
// 라면의 다른 한 가지 — 칸을 눌러 직접 고를 때만 (v2.2, 주간 보고서 단백질을 맞게 세려고 나눔)
export const CHAPA = { id: "chapa", name: "라면 (짜파게티)", short: "짜파게티" };
// 짜글이는 두 끼 분량을 만들어 다음 끼니에 남은 것을 먹는다
export const LEFTOVER = { id: "jja-left", name: "짜글이 (남은 것)", short: "짜글이 (남은 것)" };
// 계획과 다르게 집에서 안 먹은 끼니 (v2.2)
export const SKIP = { id: "skip", name: "안 먹음 · 외식", short: "안 먹음 · 외식", none: true };

const ALL = [DISHES[0], DISHES[1], DISHES[2], CHAPA, DISHES[3], LEFTOVER, SKIP];
export const dishById = (id) => ALL.find((d) => d.id === id);
export const pickable = () => ALL; // 칸을 눌렀을 때 고를 수 있는 것

// 그 날 집에서 먹는 끼니 칸
export function homeMeals(date, settings) {
  const day = ymd(date);
  return dayPlan(date, settings).blocks
    .filter((x) => x.kind === "meal")
    .map((x) => ({ key: `${day} ${x.name}`, day, label: x.name, start: x.start }));
}

// 알바 중에 먹는 끼니: 오픈반은 점심, 중간반·마감반은 저녁 (시각은 정해 둔 게 없다 — 핫픽스 v3.0.3 에서 Notion 따라 시각 글을 뺌)
export function workMeal(date, settings) {
  const plan = dayPlan(date, settings);
  if (!plan.working) return null;
  return plan.shift === "open"
    ? { label: "점심", dish: WORK_DISH, first: true }
    : { label: "저녁", dish: WORK_DISH, first: false };
}

// 끼니마다 요리를 정한다.
// - 직접 고른 칸(overrides)은 그대로 쓴다
// - 짜글이를 만든 다음 끼니는 남은 짜글이
// - 나머지는 짜글이 → 볶음밥 → 라면 순서로 돈다 (닭가슴살은 알바 끼니라 빠짐, 직접 고른 칸은 순서를 쓰지 않는다)
export function planMeals(slots, overrides = {}) {
  let turn = 0;
  let cookedJja = false;
  return slots.map((slot) => {
    let id;
    let auto = false;
    if (overrides[slot.key]) id = overrides[slot.key];
    else if (cookedJja) { id = LEFTOVER.id; auto = true; }
    else { id = ROTATION[turn++ % ROTATION.length].id; auto = true; }
    cookedJja = DISHES.find((d) => d.id === id)?.makesTwo ?? false;
    return { ...slot, dish: dishById(id) ?? DISHES[0], auto };
  });
}

// 이번 주 식단표: 날짜마다 집 끼니(요리 포함)와 알바 중 끼니
export function planWeek(monday, settings, overrides) {
  const dates = weekDates(monday);
  const planned = planMeals(dates.flatMap((d) => homeMeals(d, settings)), overrides);
  return dates.map((d) => ({
    day: ymd(d),
    date: d,
    work: workMeal(d, settings),
    meals: planned.filter((m) => m.day === ymd(d)),
  }));
}

// 고른 요리 저장. 자동으로 정해지는 것과 같으면 따로 적어 두지 않는다.
export function withOverride(overrides, key, id) {
  const next = { ...overrides };
  if (id) next[key] = id;
  else delete next[key];
  return next;
}

// ---------- 먹은 기록 (v2.2, 주간 보고서용) ----------
// 계획대로 먹었다고 치고, 날마다 그 날 끼니를 한 벌 저장해 둔다 (다르게 먹었으면 칸을 눌러 바꾸거나 '안 먹음 · 외식').
// 식단은 설정(일과표·돌림)으로 다시 계산되니, 지난 날은 저장해 둔 것을 그대로 둬야 나중에 설정이 바뀌어도 기록이 안 흔들린다.
// { "2026-09-28": [{ label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "jja" }] }
export const MEAL_LOG_DAYS = 60;

// 그 날 먹는 끼니를 먹는 차례대로 (집 끼니 + 알바 중 끼니)
export function dayMeals(date, settings, overrides = {}) {
  const d = planWeek(mondayOf(date), settings, overrides).find((x) => x.day === ymd(date));
  const home = d.meals.map((m) => ({ label: m.label, dish: m.dish.id }));
  if (!d.work) return home;
  const work = { label: d.work.label, dish: d.work.dish.id, work: true };
  return d.work.first ? [work, ...home] : [...home, work];
}

// 앱을 열 때 · 식단을 바꿀 때: 오늘은 늘 새로 적고, 지난 6일은 비어 있을 때만 채운다. 60일 넘은 건 정리.
export function syncMealLog(log, today, settings, overrides = {}) {
  const from = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - MEAL_LOG_DAYS));
  const next = Object.fromEntries(Object.entries(log).filter(([day]) => day >= from));
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    if (i === 0 || !next[ymd(d)]) next[ymd(d)] = dayMeals(d, settings, overrides);
  }
  return next;
}

// 지난 날 칸을 직접 바꾸면 (먹은 걸 고쳐 적는 것) 그 날 기록도 새로. 앞으로의 날은 아직 기록하지 않는다.
export function recordDay(log, date, today, settings, overrides = {}) {
  if (ymd(date) > ymd(today)) return log;
  return { ...log, [ymd(date)]: dayMeals(date, settings, overrides) };
}

// 며칠 치 기록의 단백질 (주간 보고서용): 먹은 끼니 수 · 한 끼 목표를 넘긴 끼니 수 · 합계(g). '안 먹음 · 외식' 은 세지 않는다
export function proteinSummary(log, days) {
  const eaten = days.flatMap((day) => log[day] ?? []).map((m) => proteinOf(m.dish)).filter((g) => g != null);
  return { meals: eaten.length, hit: eaten.filter((g) => g >= PROTEIN_GOAL).length, grams: eaten.reduce((a, g) => a + g, 0) };
}
