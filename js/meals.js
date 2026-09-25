// 식단: 주간 식단표와 오늘의 식단. 규칙은 Notion '식단'.
// 집에서 먹는 끼니는 일과표의 식사 칸에서 가져온다 (알바 중 끼니는 식대라 빼고).
import { dayPlan, ymd } from "./schedule.js";

// 메인 요리. 새 요리는 여기에 한 줄 더하면 돌림에 들어간다.
export const DISHES = [
  { id: "jja", name: "냉동 대패 짜글이", short: "짜글이", makesTwo: true },
  { id: "rice", name: "계란 볶음밥", short: "계란 볶음밥" },
  { id: "ramen", name: "라면", short: "라면" },
  { id: "chicken", name: "닭가슴살 + 햇반", short: "닭가슴살 + 햇반" },
];
// 짜글이는 두 끼 분량을 만들어 다음 끼니에 남은 것을 먹는다
export const LEFTOVER = { id: "jja-left", name: "짜글이 (남은 것)", short: "짜글이 (남은 것)" };

const ALL = [...DISHES, LEFTOVER];
export const dishById = (id) => ALL.find((d) => d.id === id);
export const pickable = () => ALL; // 칸을 눌렀을 때 고를 수 있는 것

// 그 날 집에서 먹는 끼니 칸
export function homeMeals(date, settings) {
  const day = ymd(date);
  return dayPlan(date, settings).blocks
    .filter((x) => x.kind === "meal")
    .map((x) => ({ key: `${day} ${x.name}`, day, label: x.name, start: x.start }));
}

// 알바 중 식대로 먹는 끼니 (오픈반은 점심, 마감반은 저녁)
export function workMeal(date, settings) {
  const plan = dayPlan(date, settings);
  if (!plan.working) return null;
  return plan.shift === "open" ? "점심" : "저녁";
}

// 월요일부터 7일
export function weekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

export function mondayOf(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
}

// 끼니마다 요리를 정한다.
// - 직접 고른 칸(overrides)은 그대로 쓴다
// - 짜글이를 만든 다음 끼니는 남은 짜글이
// - 나머지는 짜글이 → 볶음밥 → 라면 → 닭가슴살 순서로 돈다 (직접 고른 칸은 순서를 쓰지 않는다)
export function planMeals(slots, overrides = {}) {
  let turn = 0;
  let cookedJja = false;
  return slots.map((slot) => {
    let id;
    let auto = false;
    if (overrides[slot.key]) id = overrides[slot.key];
    else if (cookedJja) { id = LEFTOVER.id; auto = true; }
    else { id = DISHES[turn++ % DISHES.length].id; auto = true; }
    cookedJja = DISHES.find((d) => d.id === id)?.makesTwo ?? false;
    return { ...slot, dish: dishById(id) ?? DISHES[0], auto };
  });
}

// 이번 주 식단표: 날짜마다 집 끼니(요리 포함)와 알바 식대 끼니
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
