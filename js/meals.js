// 식단: 주간 식단표와 오늘의 식단. 규칙은 Notion '식단' · '일정 › 알바' + 은월이 정한 끼니별 메뉴 (핫픽스 v3.0.5, 2026-10-09).
// 집에서 먹는 끼니는 일과표의 아침 칸 · 식사 칸에서 가져온다. 알바 중 끼니는 늘 닭가슴살 + 햇반.
import { dayPlan, ymd, weekDates, mondayOf, parseDate } from "./schedule.js";
import { proteinOf, PROTEIN_GOAL } from "./recipes.js";

export const BREAKFAST = "아침";
export const MEALS = [BREAKFAST, "점심", "저녁"];
const MAIN = ["점심", "저녁"];

// 기본 메뉴 목록. 새 메뉴는 여기에 한 줄 더하면 된다 — 규칙 코드는 이름이 아니라 아래 칸만 본다.
// 은월이 설정 › 식단 메뉴에서 고친 것(허용 끼니 · 자동 배정 빼기 · 직접 추가)은 아래 '메뉴 설정' 이 여기에 얹는다 (핫픽스 v3.0.6)
// allowed:  자동 배정에 쓰는 끼니 (칸을 눌러 직접 고르는 건 다 된다)
// eggs:     계란이 들어가는 요리 — 오픈반 알바 날 아침에는 3개로 (점심을 못 먹을 수 있어서)
// makesTwo: 한 번 만들어 두 끼 — 다음 점심 · 저녁에 남은 것을 먹는다
// afterOpen: 오픈반 퇴근 후 저녁에 먼저 놓는다
// weekMax:  한 주에 자동으로 놓는 횟수 (연달아 놓지도 않는다)
// work:     알바 중에 먹는 요리 — 집 끼니에는 자동으로 놓지 않는다
export const BASE_DISHES = [
  { id: "rice-soy", name: "간장 계란 볶음밥", short: "간장 계란 볶음밥", allowed: MEALS, eggs: true },
  { id: "rice-kimchi", name: "김치 계란 볶음밥", short: "김치 계란 볶음밥", allowed: MEALS, eggs: true },
  { id: "bread", name: "통밀빵 세트", short: "통밀빵 세트", allowed: [BREAKFAST], eggs: true },
  { id: "jja", name: "김치 대패 짜글이", short: "짜글이", allowed: MAIN, makesTwo: true, afterOpen: true },
  { id: "ramen", name: "라면 (안성탕면)", short: "안성탕면", allowed: MAIN, weekMax: 2 }, // 자동 배정의 라면은 안성탕면
  { id: "chicken", name: "닭가슴살 + 햇반", short: "닭가슴살 + 햇반", allowed: [], work: true },
];
export const WORK_DISH = BASE_DISHES.find((d) => d.work);
// 라면의 다른 한 가지 — 칸을 눌러 직접 고를 때만 (v2.2). 라면 횟수 · 연속 계산에는 라면으로 센다
export const CHAPA = { id: "chapa", name: "라면 (짜파게티)", short: "짜파게티", allowed: [], countsAs: "ramen" };
// 짜글이는 두 끼 분량을 만들어 다음 끼니에 남은 것을 먹는다
export const LEFTOVER = { id: "jja-left", name: "짜글이 (남은 것)", short: "짜글이 (남은 것)", allowed: [] };
// 계획과 다르게 집에서 안 먹은 끼니 (v2.2)
export const SKIP = { id: "skip", name: "안 먹음 · 외식", short: "안 먹음 · 외식", allowed: [], none: true };
// v3.0.4 까지의 '계란 볶음밥'. 지난 먹은 기록(mealLog)이 그대로 읽히게 남긴다 (고르는 창에는 없다).
// 레시피가 굴소스 · 간장 양념이라 직접 고른 칸(mealOverrides)은 간장 계란 볶음밥으로 옮긴다
export const OLD_RICE = { id: "rice", name: "계란 볶음밥", short: "계란 볶음밥", allowed: [] };

// ---------- 메뉴 설정 (핫픽스 v3.0.6) ----------
// 저장 칸 mealMenu 에는 기본값에서 바뀐 것만 둔다 — 안 건드린 메뉴는 나중에 코드의 기본값이 바뀌면 따라온다.
// { allowed: { bread: ["아침", "점심"] },        기본 메뉴 중 허용 끼니를 고친 것
//   off: ["ramen"],                              자동 배정에서 뺀 메뉴 (칸을 눌러 직접 고르는 건 된다)
//   custom: [{ id: "x-…", name, allowed }],      직접 추가한 메뉴 (이름만 — 레시피 · 단백질 없음)
//   removed: [{ id, name }] }                    지운 메뉴의 이름 (지난 기록 · 직접 고른 칸이 계속 읽히게)
const ordered = (list) => MEALS.filter((m) => list.includes(m));
const sameMeals = (a, b) => a.length === b.length && a.every((m) => b.includes(m));
// 기본값 + 저장값 = 지금 메뉴 목록. 뺀 메뉴에는 off 가 붙는다
export function menuWith(saved = {}) {
  const off = (id) => ((saved.off ?? []).includes(id) ? { off: true } : {});
  return [
    ...BASE_DISHES.map((d) => ({ ...d, allowed: d.work ? [] : ordered(saved.allowed?.[d.id] ?? d.allowed), ...off(d.id) })),
    ...(saved.custom ?? []).map((c) => ({ id: c.id, name: c.name, short: c.name, allowed: ordered(c.allowed ?? []), custom: true, ...off(c.id) })),
  ];
}
// 지금 메뉴. 앱은 열 때와 설정에서 고칠 때 setMealMenu 로 바꾼다 (meal-menu-view.js)
export let DISHES = menuWith();
let gone = [];
export function setMealMenu(saved = {}) {
  DISHES = menuWith(saved);
  gone = (saved.removed ?? []).map((r) => ({ id: r.id, name: r.name, short: r.name, allowed: [], custom: true }));
}

export const dishById = (id) => [...DISHES, CHAPA, LEFTOVER, SKIP, OLD_RICE, ...gone].find((d) => d.id === id);
// 그 끼니에 자동으로 놓는 메뉴 (목록 순서대로, 뺀 메뉴는 없다)
export const autoDishes = (meal, dishes = DISHES) => dishes.filter((d) => !d.off && d.allowed.includes(meal));

// 설정에서 고치기. 전부 저장값 → 새 저장값 (화면과 떨어져 있어 테스트가 쓴다).
// 끼니마다 자동 배정 메뉴가 하나는 있어야 한다 — 어기는 변경은 받은 값을 그대로 돌려준다 (화면이 그걸 보고 안내한다)
const menuOk = (saved) => MEALS.every((m) => autoDishes(m, menuWith(saved)).length > 0);
function tidy(saved) {
  const allowed = Object.fromEntries(Object.entries(saved.allowed ?? {}).filter(([id, list]) => {
    const base = BASE_DISHES.find((d) => d.id === id);
    return base && !base.work && !sameMeals(ordered(list), base.allowed);
  }));
  const out = {};
  if (Object.keys(allowed).length) out.allowed = allowed;
  for (const k of ["off", "custom", "removed"]) if (saved[k]?.length) out[k] = saved[k];
  return out;
}
const changed = (saved, next) => (menuOk(next) ? tidy(next) : saved);

export function toggleAllowed(saved, id, meal) {
  const dish = menuWith(saved).find((d) => d.id === id);
  if (!dish || dish.work || !MEALS.includes(meal)) return saved;
  const allowed = dish.allowed.includes(meal) ? dish.allowed.filter((m) => m !== meal) : ordered([...dish.allowed, meal]);
  return changed(saved, dish.custom
    ? { ...saved, custom: saved.custom.map((c) => (c.id === id ? { ...c, allowed } : c)) }
    : { ...saved, allowed: { ...saved.allowed, [id]: allowed } });
}
export function toggleAuto(saved, id) {
  const dish = menuWith(saved).find((d) => d.id === id);
  if (!dish || dish.work) return saved;
  const off = saved.off ?? [];
  return changed(saved, { ...saved, off: dish.off ? off.filter((x) => x !== id) : [...off, id] });
}
// 이름만 있는 메뉴. 처음에는 점심 · 저녁에 놓는다 (추가한 뒤 칩으로 고친다). id 는 부르는 쪽이 준다 (x-<시각>)
export function addCustom(saved, name, id) {
  const text = String(name ?? "").trim();
  if (!text || !id) return saved;
  const taken = new Set([...menuWith(saved), CHAPA, LEFTOVER, SKIP, OLD_RICE, ...(saved.removed ?? [])].map((d) => d.id));
  let unique = id;
  for (let n = 2; taken.has(unique); n++) unique = `${id}-${n}`;
  return tidy({ ...saved, custom: [...(saved.custom ?? []), { id: unique, name: text, allowed: MAIN }] });
}
export function renameCustom(saved, id, name) {
  const text = String(name ?? "").trim();
  if (!text || !(saved.custom ?? []).some((c) => c.id === id && c.name !== text)) return saved;
  return { ...saved, custom: saved.custom.map((c) => (c.id === id ? { ...c, name: text } : c)) };
}
export function removeCustom(saved, id) {
  const dish = (saved.custom ?? []).find((c) => c.id === id);
  if (!dish) return saved;
  return changed(saved, {
    ...saved,
    custom: saved.custom.filter((c) => c.id !== id),
    off: (saved.off ?? []).filter((x) => x !== id),
    removed: [...(saved.removed ?? []), { id, name: dish.name }],
  });
}
// 기본값으로: 허용 끼니 · 자동 배정만 처음대로. 직접 추가한 메뉴(와 지운 메뉴 이름)는 그대로 둔다
export function resetMenu(saved) {
  return tidy({ ...saved, allowed: {}, off: [] });
}
// 칸을 눌렀을 때 고를 수 있는 것: 그 끼니의 자동 배정 메뉴가 먼저, 나머지는 '다른 메뉴'
export function pickable(meal) {
  const auto = autoDishes(meal);
  return { auto, other: [...DISHES.filter((d) => !auto.includes(d)), CHAPA, LEFTOVER, SKIP] };
}

export const upgradeOverrides = (overrides) => (Object.values(overrides).includes(OLD_RICE.id)
  ? Object.fromEntries(Object.entries(overrides).map(([k, id]) => [k, id === OLD_RICE.id ? "rice-soy" : id]))
  : overrides);

// 그 날 집에서 먹는 끼니 칸: 일과표의 아침 칸(월~토)과 식사 칸, 시각 순서대로.
// meal 은 어느 끼니인지 — 이름을 고친 식사 칸은 15시 전이면 점심, 뒤면 저녁으로 본다. open 은 오픈반으로 알바하는 날
export function homeMeals(date, settings) {
  const day = ymd(date);
  const plan = dayPlan(date, settings);
  const open = plan.working && plan.shift === "open";
  return plan.blocks
    .filter((x) => x.kind === "meal" || x.kind === "breakfast")
    .map((x) => ({
      key: `${day} ${x.name}`, day, label: x.name, start: x.start, open,
      meal: x.kind === "breakfast" ? BREAKFAST : MAIN.includes(x.name) ? x.name : x.start < "15:00" ? MAIN[0] : MAIN[1],
    }));
}

// 알바 중에 먹는 끼니: 오픈반은 점심, 중간반·마감반은 저녁 (시각은 정해 둔 게 없다 — 핫픽스 v3.0.3 에서 Notion 따라 시각 글을 뺌)
export function workMeal(date, settings) {
  const plan = dayPlan(date, settings);
  if (!plan.working) return null;
  return plan.shift === "open"
    ? { label: "점심", dish: WORK_DISH, first: true }
    : { label: "저녁", dish: WORK_DISH, first: false };
}
// 먹는 차례: 알바 중 점심(first)은 아침 다음 · 집 저녁보다 먼저, 알바 중 저녁은 맨 뒤
export function eatOrder(home, work, first, isBreakfast = (m) => m.meal === BREAKFAST) {
  if (!work) return home;
  if (!first) return [...home, work];
  const n = home.findIndex((m) => !isBreakfast(m));
  const k = n < 0 ? home.length : n;
  return [...home.slice(0, k), work, ...home.slice(k)];
}

// 한 주(월~일)의 끼니마다 요리를 정한다. 같은 칸 · 같은 고른 값이면 늘 같은 결과 (앱을 연 시각과 상관없다).
// 위가 이긴다: ① 직접 고른 칸(overrides) ② 허용 끼니 ③ 짜글이 이어 먹기 ④ 오픈반 저녁 짜글이 ⑤ 라면 횟수 · 연속 ⑥ 차례대로 채우기
// - 아침: 요일로 정한다 (월 = 아침 메뉴 첫 번째부터 차례로) — 다른 칸을 바꿔도 안 흔들린다
// - 점심 · 저녁: 짜글이를 만든 다음 칸은 남은 짜글이 (아침은 건너뛴다. 같은 날 두 끼여도 남은 짜글이는 된다)
//   그 밖에는 그 날 이미 놓인 메뉴 · 횟수가 찬 메뉴 · 방금 먹은 횟수 제한 메뉴를 빼고 차례대로.
//   짜글이는 남은 것을 다 먹은 바로 다음 칸과 그 주의 마지막 칸(이어 먹을 칸이 없다)에는 새로 놓지 않는다
// - 차례는 횟수 제한이 있는 메뉴(라면)부터 — 주에 한 번은 꼭 나오게
const fillOrder = () => [...DISHES.filter((d) => d.weekMax), ...DISHES.filter((d) => !d.weekMax)]
  .filter((d) => !d.off && MAIN.some((m) => d.allowed.includes(m)));
const countKey = (id) => dishById(id)?.countsAs ?? id;
export function planMeals(slots, overrides = {}) {
  const FILL = fillOrder(); // 돌 때마다 지금 메뉴에서 (설정에서 고치면 바로 반영)
  const lastMain = slots.findLastIndex((s) => s.meal !== BREAKFAST);
  const used = {};   // 날짜 → 그 날 이미 놓인 메뉴
  const count = {};  // 이번 주 점심 · 저녁에 놓인 횟수
  let turn = 0;
  let left = false;  // 남은 짜글이가 기다리는 중
  let prev = null;   // 바로 앞 점심 · 저녁
  return slots.map((slot, i) => {
    const am = slot.meal === BREAKFAST;
    const auto = !overrides[slot.key];
    let id;
    if (!auto) id = overrides[slot.key];
    else if (am) {
      const list = autoDishes(BREAKFAST);
      id = (list[((parseDate(slot.day).getDay() + 6) % 7) % list.length] ?? SKIP).id; // 목록이 비면 (설정이 막지만) 죽지 않게
    } else if (left) id = LEFTOVER.id;
    else {
      const ok = (d) => d.allowed.includes(slot.meal) && !used[slot.day]?.has(d.id)
        && !(d.weekMax && ((count[d.id] ?? 0) >= d.weekMax || prev === d.id))
        && !(d.makesTwo && (prev === LEFTOVER.id || i === lastMain));
      let pick = slot.open && slot.meal === MAIN[1] ? FILL.find((d) => d.afterOpen && ok(d)) : undefined;
      for (let k = 0; !pick && k < FILL.length; k++) {
        const d = FILL[(turn + k) % FILL.length];
        if (ok(d)) { pick = d; turn = (turn + k + 1) % FILL.length; }
      }
      // 다 걸리면 (하루에 집 끼니가 아주 많을 때) 같은 날 겹치는 것만 눈감는다
      id = (pick ?? FILL.find((d) => d.allowed.includes(slot.meal) && !d.weekMax && !d.makesTwo)
        ?? FILL.find((d) => d.allowed.includes(slot.meal)) ?? FILL[0] ?? SKIP).id;
    }
    const dish = dishById(id) ?? DISHES[0] ?? SKIP;
    (used[slot.day] ??= new Set()).add(dish.id);
    if (!am) {
      left = Boolean(dish.makesTwo);
      prev = countKey(dish.id);
      count[prev] = (count[prev] ?? 0) + 1;
    } else if (dish.makesTwo) left = true; // 아침에 직접 짜글이를 고른 날
    const eggs = am && slot.open && dish.eggs ? { eggs: 3 } : {};
    return { ...slot, dish, auto, ...eggs };
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
// { "2026-09-28": [{ label: "아침", dish: "rice-soy", eggs: 3 }, { label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "jja" }] }
// 아침 · eggs(오픈반 날 계란 3개)는 핫픽스 v3.0.5 부터. 그 전에 적힌 날은 그대로 둔다
export const MEAL_LOG_DAYS = 60;

// 그 날 먹는 끼니를 먹는 차례대로 (집 끼니 + 알바 중 끼니)
export function dayMeals(date, settings, overrides = {}) {
  const d = planWeek(mondayOf(date), settings, overrides).find((x) => x.day === ymd(date));
  const am = new Set(d.meals.filter((m) => m.meal === BREAKFAST).map((m) => m.label));
  const home = d.meals.map((m) => ({ label: m.label, dish: m.dish.id, ...(m.eggs ? { eggs: m.eggs } : {}) }));
  const work = d.work && { label: d.work.label, dish: d.work.dish.id, work: true };
  return eatOrder(home, work, d.work?.first, (m) => am.has(m.label));
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

// 기록 한 끼의 단백질(g). 계란 3개로 먹은 끼니는 계란 한 개만큼(약 6g) 더한다. '안 먹음 · 외식' 은 null
export const EGG_PROTEIN = 6;
export function mealProtein(m) {
  const g = proteinOf(m.dish);
  return g == null ? null : g + (m.eggs === 3 ? EGG_PROTEIN : 0);
}

// 며칠 치 기록의 단백질 (주간 보고서용): 먹은 끼니 수 · 한 끼 목표를 넘긴 끼니 수 · 합계(g). '안 먹음 · 외식' 은 세지 않는다
export function proteinSummary(log, days) {
  const eaten = days.flatMap((day) => log[day] ?? []).map(mealProtein).filter((g) => g != null);
  return { meals: eaten.length, hit: eaten.filter((g) => g >= PROTEIN_GOAL).length, grams: eaten.reduce((a, g) => a + g, 0) };
}
