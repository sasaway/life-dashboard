import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISHES, LEFTOVER, homeMeals, workMeal, planMeals, planWeek, mondayOf, withOverride,
} from "../js/meals.js";
import { tipsFor } from "../js/meal-tips.js";
import { DEFAULT_SETTINGS } from "../js/schedule.js";

const slots = (n) => Array.from({ length: n }, (_, i) => ({ key: `s${i}` }));
const names = (plan) => plan.map((m) => m.dish.id);

test("메인 요리는 Notion 의 네 가지", () => {
  assert.deepEqual(DISHES.map((d) => d.name), ["냉동 대패 짜글이", "계란 볶음밥", "라면", "닭가슴살 + 햇반"]);
});

test("자동 돌림: 짜글이 다음 끼니는 남은 짜글이, 그다음 볶음밥·라면·닭가슴살", () => {
  assert.deepEqual(names(planMeals(slots(7))),
    ["jja", "jja-left", "rice", "ramen", "chicken", "jja", "jja-left"]);
});

test("직접 고른 칸은 그대로, 돌림 순서는 건너뛰지 않는다", () => {
  const plan = planMeals(slots(4), { s1: "ramen" });
  // s0 짜글이 → s1 은 직접 라면 (남은 짜글이 대신) → s2 볶음밥 → s3 라면
  assert.deepEqual(names(plan), ["jja", "ramen", "rice", "ramen"]);
  assert.deepEqual(plan.map((m) => m.auto), [true, false, true, true]);
});

test("직접 짜글이를 고르면 다음 끼니가 남은 짜글이가 된다", () => {
  assert.deepEqual(names(planMeals(slots(3), { s0: "chicken", s1: "jja" })), ["chicken", "jja", "jja-left"]);
});

test("남은 짜글이를 직접 고른 칸은 돌림 순서를 쓰지 않는다", () => {
  assert.equal(LEFTOVER.id, "jja-left");
  // s0 을 남은 짜글이로 → s1 은 돌림 첫 번째(짜글이) → s2 는 그 남은 것
  assert.deepEqual(names(planMeals(slots(3), { s0: "jja-left" })), ["jja-left", "jja", "jja-left"]);
});

test("고른 걸 되돌리면 자동으로 돌아간다", () => {
  const o = withOverride({}, "s1", "ramen");
  assert.deepEqual(o, { s1: "ramen" });
  assert.deepEqual(withOverride(o, "s1", ""), {});
});

// 2026-09-21 주 = 마감반 (점심만 집), 다음 주 = 오픈반 (저녁만 집)
test("집 끼니는 일과표 식사 칸에서: 마감반 주는 점심, 오픈반 주는 저녁", () => {
  assert.deepEqual(homeMeals(new Date(2026, 8, 25), DEFAULT_SETTINGS).map((m) => [m.key, m.start]),
    [["2026-09-25 점심", "12:30"]]);
  assert.deepEqual(homeMeals(new Date(2026, 8, 29), DEFAULT_SETTINGS).map((m) => m.label), ["저녁"]);
  assert.equal(workMeal(new Date(2026, 8, 25), DEFAULT_SETTINGS), "저녁");
  assert.equal(workMeal(new Date(2026, 8, 29), DEFAULT_SETTINGS), "점심");
});

test("쉬는 날은 두 끼 다 집에서, 알바 식대는 없다", () => {
  const off = { ...DEFAULT_SETTINGS, workdays: [true, true, true, true, true, true, false] };
  const sat = new Date(2026, 8, 26);
  assert.deepEqual(homeMeals(sat, off).map((m) => m.label), ["점심", "저녁"]);
  assert.equal(workMeal(sat, off), null);
});

test("주간 식단표: 월요일부터 7일, 끼니가 주 전체로 이어서 돈다", () => {
  const week = planWeek(mondayOf(new Date(2026, 8, 25)), DEFAULT_SETTINGS, {});
  assert.equal(week[0].day, "2026-09-21");
  assert.equal(week[6].day, "2026-09-27");
  assert.deepEqual(week.map((d) => d.meals.map((m) => m.dish.short).join()),
    ["짜글이", "짜글이 (남은 것)", "계란 볶음밥", "라면", "닭가슴살 + 햇반", "짜글이", "짜글이 (남은 것)"]);
  assert.ok(week.every((d) => d.work === "저녁"));
});

// ---------- 산 재료 추천 ----------
const today = new Date(2026, 8, 25);

test("최근 2주(오늘 포함 14일, 9/12~9/25) 안에 가져온 재료만, 같은 재료는 가장 최근 것 하나", () => {
  const bought = [
    { name: "계란 30구", day: "2026-09-25" },
    { name: "계란 30구", day: "2026-09-20" },
    { name: "두부", day: "2026-09-11" }, // 15일째 → 빠짐
    { name: "휴지", day: "2026-09-24" },  // 추천 없음 → 빠짐
  ];
  const r = tipsFor(bought, today);
  assert.deepEqual(r.map((x) => [x.name, x.day]), [["계란 30구", "2026-09-25"]]);
  assert.ok(r[0].tips.some((t) => t.includes("라면에 계란")));
  assert.equal(tipsFor([{ name: "두부", day: "2026-09-11" }], today).length, 0);
  assert.equal(tipsFor([{ name: "두부", day: "2026-09-12" }], today).length, 1);
});

test("한 글자 낱말은 이름이 똑같을 때만: '파' 는 '양파' 에 안 걸린다", () => {
  const onion = tipsFor([{ name: "양파", day: "2026-09-25" }], today)[0].tips;
  assert.deepEqual(onion, ["짜글이에 양파 반 개"]);
  assert.ok(tipsFor([{ name: "파", day: "2026-09-25" }], today)[0].tips.includes("라면에 파 송송"));
});
