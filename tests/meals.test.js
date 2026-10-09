import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISHES, LEFTOVER, WORK_DISH, CHAPA, SKIP, OLD_RICE, homeMeals, workMeal, planMeals, planWeek, withOverride,
  pickable, dishById, dayMeals, syncMealLog, recordDay, MEAL_LOG_DAYS, proteinSummary, autoDishes, upgradeOverrides, mealProtein, eatOrder,
  BASE_DISHES, menuWith, setMealMenu, toggleAllowed, toggleAuto, addCustom, renameCustom, removeCustom, resetMenu,
} from "../js/meals.js";
import { mondayOf, dayPlan } from "../js/schedule.js";
import { IDEAS, ideasFor, MAX_IDEAS } from "../js/meal-tips.js";
import { DEFAULT_SETTINGS } from "../js/schedule.js";

// 저녁 칸 n 개 (하루에 하나씩, 알바 없는 날) — 점심 · 저녁 차례 규칙만 볼 때
const slots = (n) => Array.from({ length: n }, (_, i) => ({ key: `s${i}`, day: `2026-10-${12 + i}`, label: "저녁", meal: "저녁", open: false }));
const names = (plan) => plan.map((m) => m.dish.id);

test("메뉴 목록 (핫픽스 v3.0.5, 은월이 정함): 여섯 가지와 자동 배정에 쓰는 끼니", () => {
  assert.deepEqual(DISHES.map((d) => [d.name, d.allowed.join("·")]), [
    ["간장 계란 볶음밥", "아침·점심·저녁"], ["김치 계란 볶음밥", "아침·점심·저녁"], ["통밀빵 세트", "아침"],
    ["김치 대패 짜글이", "점심·저녁"], ["라면 (안성탕면)", "점심·저녁"], ["닭가슴살 + 햇반", ""],
  ]);
  assert.deepEqual(autoDishes("아침").map((d) => d.short), ["간장 계란 볶음밥", "김치 계란 볶음밥", "통밀빵 세트"]);
  assert.deepEqual(autoDishes("저녁").map((d) => d.short), ["간장 계란 볶음밥", "김치 계란 볶음밥", "짜글이", "안성탕면"]);
  assert.deepEqual(autoDishes("점심"), autoDishes("저녁"));
});

test("고르기 창: 그 끼니의 자동 배정 메뉴가 먼저, 나머지는 '다른 메뉴' (직접 고르는 건 다 된다) · 맨 아래 '안 먹음 · 외식'", () => {
  assert.deepEqual(pickable("아침").auto.map((d) => d.short), ["간장 계란 볶음밥", "김치 계란 볶음밥", "통밀빵 세트"]);
  assert.deepEqual(pickable("아침").other.map((d) => d.short), ["짜글이", "안성탕면", "닭가슴살 + 햇반", "짜파게티", "짜글이 (남은 것)", "안 먹음 · 외식"]);
  assert.deepEqual(pickable("저녁").auto.map((d) => d.short), ["간장 계란 볶음밥", "김치 계란 볶음밥", "짜글이", "안성탕면"]);
  assert.deepEqual(pickable("저녁").other.map((d) => d.short), ["통밀빵 세트", "닭가슴살 + 햇반", "짜파게티", "짜글이 (남은 것)", "안 먹음 · 외식"]);
  assert.ok(![...pickable("저녁").auto, ...pickable("저녁").other].includes(OLD_RICE), "옛 '계란 볶음밥' 은 고르는 창에 없다");
  assert.equal(dishById("chapa"), CHAPA);
  assert.equal(dishById("skip"), SKIP);
});

test("짜파게티·안 먹음을 직접 고른 칸은 그대로 · 짜파게티도 라면 횟수로 센다", () => {
  const plan = planMeals(slots(4), { s1: "chapa", s2: "skip" });
  // s0 라면 → s1 직접 짜파게티 (라면 2번째) → s2 직접 안 먹음 → s3 은 라면이 주 2번 찼으니 다음 차례
  assert.deepEqual(names(plan), ["ramen", "chapa", "skip", "rice-soy"]);
  assert.deepEqual(plan.map((m) => m.auto), [true, false, false, true]);
});

test("점심 · 저녁 차례: 라면 → 간장 볶음밥 → 김치 볶음밥 → 짜글이 → 남은 짜글이 (닭가슴살 · 통밀빵은 안 나온다)", () => {
  assert.deepEqual(names(planMeals(slots(7))),
    ["ramen", "rice-soy", "rice-kimchi", "jja", "jja-left", "ramen", "rice-soy"]);
  const many = names(planMeals(slots(30)));
  assert.ok(!many.includes("chicken") && !many.includes("bread"));
});

test("알바 중 끼니는 늘 닭가슴살 + 햇반", () => {
  assert.equal(WORK_DISH.id, "chicken");
  assert.equal(workMeal(new Date(2026, 8, 29), DEFAULT_SETTINGS).dish, WORK_DISH);
  assert.equal(workMeal(new Date(2026, 8, 25), DEFAULT_SETTINGS).dish, WORK_DISH);
});

test("집 끼니에 닭가슴살을 직접 고르면 그대로 둔다 (자동 배정에서만 뺀다)", () => {
  const plan = planMeals(slots(2), { s0: "chicken" });
  assert.deepEqual(names(plan), ["chicken", "ramen"]);
  assert.equal(plan[0].auto, false);
});

test("직접 고른 칸은 그대로 쓰고 차례를 쓰지 않는다 (직접 고른 칸이 자동 배정보다 먼저)", () => {
  const plan = planMeals(slots(4), { s1: "jja" });
  // s0 라면 → s1 직접 짜글이 → s2 남은 짜글이 → s3 은 차례의 다음(간장 볶음밥)
  assert.deepEqual(names(plan), ["ramen", "jja", "jja-left", "rice-soy"]);
  assert.deepEqual(plan.map((m) => m.auto), [true, false, true, true]);
});

test("직접 짜글이를 고르면 다음 끼니가 남은 짜글이가 된다", () => {
  assert.deepEqual(names(planMeals(slots(3), { s0: "chicken", s1: "jja" })), ["chicken", "jja", "jja-left"]);
});

test("남은 짜글이를 다 먹은 바로 다음 칸과 그 주의 마지막 칸에는 짜글이를 새로 놓지 않는다", () => {
  assert.equal(LEFTOVER.id, "jja-left");
  assert.deepEqual(names(planMeals(slots(3), { s0: "jja-left" })), ["jja-left", "ramen", "rice-soy"]);
  // 차례가 짜글이여도 마지막 칸이면 건너뛴다 (남은 걸 이어 먹을 칸이 없다) — 4칸: 라면 · 간장 · 김치 · (짜글이 대신) 라면
  assert.deepEqual(names(planMeals(slots(4))), ["ramen", "rice-soy", "rice-kimchi", "ramen"]);
  for (let n = 1; n <= 12; n++) assert.notEqual(names(planMeals(slots(n))).at(-1), "jja", `${n}칸`);
});

test("고른 걸 되돌리면 자동으로 돌아간다", () => {
  const o = withOverride({}, "s1", "ramen");
  assert.deepEqual(o, { s1: "ramen" });
  assert.deepEqual(withOverride(o, "s1", ""), {});
});

// 2026-09-21 주 = 마감반 (점심만 집), 다음 주 = 오픈반 (저녁만 집)
test("집 끼니는 일과표 식사 칸에서: 마감반 주는 점심, 오픈반 주는 저녁", () => {
  assert.deepEqual(homeMeals(new Date(2026, 8, 25), DEFAULT_SETTINGS).map((m) => [m.key, m.start]),
    [["2026-09-25 아침", "06:30"], ["2026-09-25 점심", "12:00"]]); // 아침은 핫픽스 v3.0.5 부터. 점심은 10:00 운동 1시간 30분 + 샤워 30분 뒤
  assert.deepEqual(homeMeals(new Date(2026, 8, 29), DEFAULT_SETTINGS).map((m) => m.label), ["아침", "저녁"]);
  // 마감반은 알바 중 저녁 · 집 점심 다음, 오픈반은 알바 중 점심 · 집 저녁보다 먼저 (시각 글은 핫픽스 v3.0.3 에서 뺌)
  assert.deepEqual(workMeal(new Date(2026, 8, 25), DEFAULT_SETTINGS),
    { label: "저녁", dish: WORK_DISH, first: false });
  assert.deepEqual(workMeal(new Date(2026, 8, 29), DEFAULT_SETTINGS),
    { label: "점심", dish: WORK_DISH, first: true });
});

test("쉬는 날은 두 끼 다 집에서, 알바 식대는 없다", () => {
  const off = { ...DEFAULT_SETTINGS, workdays: [true, true, true, true, true, true, false] };
  const sat = new Date(2026, 8, 26);
  assert.deepEqual(homeMeals(sat, off).map((m) => m.label), ["아침", "점심", "저녁"]);
  assert.equal(workMeal(sat, off), null);
});

test("주간 식단표: 월요일부터 7일, 아침은 요일 순서 · 점심 · 저녁은 주 전체로 이어서 돈다 (마감반 주)", () => {
  const week = planWeek(mondayOf(new Date(2026, 8, 25)), DEFAULT_SETTINGS, {});
  assert.equal(week[0].day, "2026-09-21");
  assert.equal(week[6].day, "2026-09-27");
  const of = (meal) => week.map((d) => d.meals.filter((m) => (m.meal === "아침") === (meal === "아침")).map((m) => m.dish.short).join());
  assert.deepEqual(of("아침"), ["간장 계란 볶음밥", "김치 계란 볶음밥", "통밀빵 세트", "간장 계란 볶음밥", "김치 계란 볶음밥", "통밀빵 세트", ""]);
  assert.deepEqual(of("점심"), ["안성탕면", "간장 계란 볶음밥", "김치 계란 볶음밥", "짜글이", "짜글이 (남은 것)", "안성탕면", "간장 계란 볶음밥"]);
  assert.ok(week.every((d) => d.work.label === "저녁"));
});

// ---------- 먹은 기록 (v2.2) ----------
// 2026-09-28 주 = 오픈반 (알바 중 점심 → 집 저녁)
test("그 날 먹은 끼니는 먹는 차례대로: 오픈반은 아침 → 알바 중 점심 → 집 저녁, 마감반은 아침 → 점심 → 알바 중 저녁", () => {
  assert.deepEqual(dayMeals(new Date(2026, 8, 28), DEFAULT_SETTINGS),
    [{ label: "아침", dish: "rice-soy", eggs: 3 }, { label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "jja" }]);
  assert.deepEqual(dayMeals(new Date(2026, 8, 25), DEFAULT_SETTINGS), // 마감반 주 금요일
    [{ label: "아침", dish: "rice-kimchi" }, { label: "점심", dish: "jja-left" }, { label: "저녁", dish: "chicken", work: true }]);
  const off = { ...DEFAULT_SETTINGS, workdays: [true, true, true, true, true, true, false] };
  assert.deepEqual(dayMeals(new Date(2026, 9, 3), off).map((m) => m.label), ["아침", "점심", "저녁"]);
  // 차례 함수: 알바 중 점심은 아침 다음, 알바 중 저녁은 맨 뒤
  const [am, pm, w] = [{ meal: "아침" }, { meal: "저녁" }, { work: true }];
  assert.deepEqual(eatOrder([am, pm], w, true), [am, w, pm]);
  assert.deepEqual(eatOrder([am, pm], w, false), [am, pm, w]);
  assert.deepEqual(eatOrder([am, pm], null, true), [am, pm]);
});

test("기록 맞추기: 오늘과 지난 6일을 채우고, 한 번 적은 지난 날은 설정이 바뀌어도 그대로", () => {
  const today = new Date(2026, 8, 30);
  const log = syncMealLog({}, today, DEFAULT_SETTINGS);
  assert.deepEqual(Object.keys(log), ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"]);
  // 나중에 알바 요일을 바꿔도(쉬는 날로) 지난 날 기록은 안 바뀌고, 오늘만 새로
  const off = { ...DEFAULT_SETTINGS, workdays: [false, false, false, false, false, false, false] };
  const again = syncMealLog(log, today, off);
  assert.deepEqual(again["2026-09-29"], log["2026-09-29"]);
  assert.deepEqual(again["2026-09-30"].map((m) => m.label), ["아침", "점심", "저녁"]);
  assert.ok(again["2026-09-30"].every((m) => !m.work));
});

test("기록은 60일까지만 남긴다", () => {
  assert.equal(MEAL_LOG_DAYS, 60);
  const log = syncMealLog({ "2026-07-01": [], "2026-08-01": [] }, new Date(2026, 8, 30), DEFAULT_SETTINGS);
  assert.ok(!("2026-07-01" in log));
  assert.ok("2026-08-01" in log);
});

test("지난 날 칸을 '안 먹음'으로 고치면 그 날 기록도 고친다, 내일 칸은 아직 기록하지 않는다", () => {
  const today = new Date(2026, 8, 30);
  const log = syncMealLog({}, today, DEFAULT_SETTINGS);
  const o = { "2026-09-29 저녁": "skip" };
  const fixed = recordDay(log, new Date(2026, 8, 29), today, DEFAULT_SETTINGS, o);
  assert.deepEqual(fixed["2026-09-29"].find((m) => m.label === "저녁"), { label: "저녁", dish: "skip" });
  assert.equal(recordDay(log, new Date(2026, 9, 1), today, DEFAULT_SETTINGS, o), log);
});

test("단백질 요약: 한 끼 22g 넘긴 끼니 수와 합계, '안 먹음 · 외식' 은 세지 않는다", () => {
  const log = {
    "2026-09-28": [{ label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "rice" }],
    "2026-09-29": [{ label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "skip" }],
  };
  assert.deepEqual(proteinSummary(log, ["2026-09-28", "2026-09-29", "2026-09-30"]), { meals: 3, hit: 2, grams: 29 + 18 + 29 });
});

// ---------- 산 재료로 새 요리 추천 ----------
const today = new Date(2026, 8, 25);
const ideaNames = (r) => r.map((x) => x.name);

test("추천은 메인 요리 4가지가 아닌 새 요리이고, 요리마다 이유와 방법이 있다", () => {
  const mains = DISHES.map((d) => d.name);
  for (const idea of IDEAS) {
    assert.ok(!mains.includes(idea.name), idea.name);
    assert.ok(idea.why && idea.steps.length >= 2, idea.name);
  }
});

test("최근 2주(오늘 포함 14일, 9/12~9/25) 안에 가져온 재료만 본다", () => {
  assert.equal(ideasFor([{ name: "두부", day: "2026-09-11" }], today).length, 0);
  assert.deepEqual(ideaNames(ideasFor([{ name: "두부", day: "2026-09-12" }], today)), ["두부조림", "두부 계란국"]);
  assert.equal(ideasFor([{ name: "휴지", day: "2026-09-24" }], today).length, 0);
});

test("같은 요리는 한 번만, 어떤 재료 때문인지와 최근 날짜를 붙인다", () => {
  const r = ideasFor([
    { name: "계란 30구", day: "2026-09-20" },
    { name: "달걀", day: "2026-09-24" },
  ], today);
  const jjim = r.find((x) => x.name === "전자레인지 계란찜");
  assert.deepEqual(jjim.from, ["계란 30구", "달걀"]);
  assert.equal(jjim.day, "2026-09-24");
  assert.equal(r.filter((x) => x.name === "전자레인지 계란찜").length, 1);
});

test("최근에 가져온 재료의 요리가 먼저 나온다", () => {
  const r = ideasFor([
    { name: "감자", day: "2026-09-20" },
    { name: "김치", day: "2026-09-25" },
  ], today);
  assert.deepEqual(ideaNames(r), ["김치찌개", "감자채볶음"]);
});

test("한 글자 낱말은 이름이 똑같을 때만: '햄' 은 '햄버거 번' 에 안 걸리게 두 글자 이상만 포함 검사", () => {
  assert.deepEqual(ideaNames(ideasFor([{ name: "양파", day: "2026-09-25" }], today)), ["양파 계란덮밥"]);
  assert.ok(ideaNames(ideasFor([{ name: "햄", day: "2026-09-25" }], today)).includes("스팸마요 덮밥"));
  assert.equal(ideasFor([{ name: "햄버거 번", day: "2026-09-25" }], today).length, 0);
});

test("추천은 2개까지만, 가장 최근에 가져온 재료 것부터", () => {
  assert.equal(MAX_IDEAS, 2);
  const r = ideasFor([
    { name: "계란", day: "2026-09-20" },
    { name: "두부", day: "2026-09-23" },
    { name: "김치", day: "2026-09-25" },
  ], today);
  assert.equal(r.length, 2);
  assert.deepEqual(ideaNames(r), ["김치찌개", "두부조림"]);
});

test("중간반 날 (v2.8.1): 집 끼니는 10:00 점심, 알바 중 끼니는 저녁 닭가슴살 + 햇반 (먹는 차례는 점심 다음)", () => {
  const s = { ...DEFAULT_SETTINGS, dayShifts: ["mid", "mid", "mid", "mid", "mid", "mid", "mid"] };
  const wed = new Date(2026, 9, 7);
  assert.deepEqual(homeMeals(wed, s).map((m) => [m.label, m.start]), [["아침", "06:30"], ["점심", "10:00"]]);
  assert.deepEqual([workMeal(wed, s).label, workMeal(wed, s).dish.id, workMeal(wed, s).first], ["저녁", "chicken", false]);
  assert.deepEqual(dayMeals(wed, s).map((m) => [m.label, Boolean(m.work)]), [["아침", false], ["점심", false], ["저녁", true]]);
});

// ---------- 핫픽스 v3.0.5: 끼니별 메뉴 ----------
const MON = new Date(2026, 9, 12);
const ds = (...v) => ({ ...DEFAULT_SETTINGS, dayShifts: v }); // 일 · 월 · 화 · 수 · 목 · 금 · 토
const OPEN_WEEK = ds("off", "open", "open", "open", "open", "open", "open");
const CLOSE_WEEK = ds("close", "close", "close", "close", "close", "close", "close");
const MIXED_WEEK = ds("off", "open", "open", "mid", "close", "close", "off");
const OFF_WEEK = ds("off", "off", "off", "off", "off", "off", "off");
const ids = (week, am) => week.map((d) => d.meals.filter((m) => (m.meal === "아침") === am).map((m) => m.dish.id).join("+"));

test("v3.0.5 아침: 월~토 간장 → 김치 → 통밀빵 순서 (월요일 = 간장부터), 일요일은 아침이 없다", () => {
  for (const s of [OPEN_WEEK, CLOSE_WEEK, MIXED_WEEK, OFF_WEEK]) {
    assert.deepEqual(ids(planWeek(MON, s, {}), true), ["rice-soy", "rice-kimchi", "bread", "rice-soy", "rice-kimchi", "bread", ""]);
  }
  // 다른 칸을 직접 바꾸거나 아침 하나를 바꿔도 나머지 아침은 안 흔들린다
  const o = { "2026-10-12 저녁": "ramen", "2026-10-13 아침": "bread" };
  assert.deepEqual(ids(planWeek(MON, OPEN_WEEK, o), true), ["rice-soy", "bread", "bread", "rice-soy", "rice-kimchi", "bread", ""]);
  assert.equal(planWeek(MON, OPEN_WEEK, o)[1].meals[0].auto, false);
});

test("v3.0.5 계란: 오픈반으로 알바하는 날 아침만 3개, 그 밖(다른 반 · 쉬는 날 · 점심 · 저녁)은 표시 없음", () => {
  const eggs = (s) => planWeek(MON, s, {}).map((d) => d.meals.map((m) => m.eggs ?? 2).join(""));
  assert.deepEqual(eggs(MIXED_WEEK), ["32", "32", "22", "22", "22", "222", "22"]);
  assert.ok(planWeek(MON, CLOSE_WEEK, {}).every((d) => d.meals.every((m) => !("eggs" in m))));
  // 계란 요리가 아닌 걸 직접 고른 아침에는 붙지 않는다
  assert.ok(!("eggs" in planWeek(MON, OPEN_WEEK, { "2026-10-12 아침": "skip" })[0].meals[0]));
  // 먹은 기록 · 단백질: 계란 3개 끼니는 약 6g 더
  assert.deepEqual(dayMeals(MON, OPEN_WEEK)[0], { label: "아침", dish: "rice-soy", eggs: 3 });
  assert.deepEqual([mealProtein({ dish: "bread" }), mealProtein({ dish: "bread", eggs: 3 }), mealProtein({ dish: "skip", eggs: 3 })], [26, 32, null]);
  assert.deepEqual(proteinSummary({ d: [{ label: "아침", dish: "rice-kimchi", eggs: 3 }, { label: "아침", dish: "rice-kimchi" }] }, ["d"]), { meals: 2, hit: 1, grams: 26 + 20 });
});

test("v3.0.5 오픈반 주: 퇴근 후 저녁은 짜글이 먼저 → 다음 저녁에 남은 것 (아침은 건너뛴다) → 하루 다른 메뉴 → 다시", () => {
  const week = planWeek(MON, OPEN_WEEK, {});
  assert.deepEqual(ids(week, false), ["jja", "jja-left", "ramen", "jja", "jja-left", "rice-soy", "rice-kimchi+ramen"]);
  // 월요일 저녁에 만들면 화요일 아침은 그대로 볶음밥, 화요일 저녁이 남은 짜글이
  assert.deepEqual(week[1].meals.map((m) => `${m.label} ${m.dish.id}`), ["아침 rice-kimchi", "저녁 jja-left"]);
});

test("v3.0.5 쉬는 날 점심에 만든 짜글이는 같은 날 저녁에 남은 것 (남은 짜글이는 '같은 날 한 번' 의 예외)", () => {
  const week = planWeek(MON, OFF_WEEK, {});
  assert.deepEqual(ids(week, false), ["ramen+rice-kimchi", "jja+jja-left", "ramen+rice-soy", "rice-kimchi+jja", "jja-left+rice-soy", "rice-kimchi+jja", "jja-left+rice-soy"]);
  // 직접 골라도: 쉬는 날 점심을 짜글이로 바꾸면 그 날 저녁이 남은 짜글이
  assert.deepEqual(planWeek(MON, OFF_WEEK, { "2026-10-12 점심": "jja" })[0].meals.map((m) => m.dish.id), ["rice-soy", "jja", "jja-left"]);
});

test("v3.0.5 규칙이 여러 주 · 여러 반에서 다 지켜진다 (허용 끼니 · 이어 먹기 · 라면 주 1~2회 · 연속 없음 · 같은 날 한 번 · 마지막 칸)", () => {
  const settings = [OPEN_WEEK, CLOSE_WEEK, MIXED_WEEK, OFF_WEEK, ds("close", "open", "open", "open", "open", "open", "open"),
    ds("off", "mid", "mid", "mid", "mid", "mid", "off"), ds("open", "close", "off", "open", "mid", "off", "close"), DEFAULT_SETTINGS];
  const mondays = [new Date(2026, 9, 5), MON, new Date(2026, 9, 19), new Date(2026, 11, 28)];
  for (const [si, s] of settings.entries()) for (const monday of mondays) {
    const week = planWeek(monday, s, {});
    const tag = `설정 ${si} · ${week[0].day}`;
    assert.deepEqual(planWeek(monday, s, {}), week, `${tag}: 몇 번을 계산해도 같다`);
    const all = week.flatMap((d) => d.meals);
    const main = all.filter((m) => m.meal !== "아침");
    for (const m of all) {
      assert.ok(m.auto);
      assert.notEqual(m.dish.id, "chicken", `${tag}: 닭가슴살은 집 끼니에 자동으로 안 놓는다`);
      if (m.meal === "아침") assert.ok(m.dish.allowed.includes("아침"), `${tag}: 아침에 ${m.dish.short}`);
      else assert.ok(m.dish.id === "jja-left" || m.dish.allowed.includes(m.meal), `${tag}: ${m.meal} 에 ${m.dish.short}`);
      if (m.dish.id === "bread") assert.equal(m.meal, "아침", `${tag}: 통밀빵은 아침만`);
    }
    assert.ok(!week[6].meals.some((m) => m.meal === "아침"), `${tag}: 일요일 아침 없음`);
    for (const d of week) assert.equal(new Set(d.meals.map((m) => m.dish.id)).size, d.meals.length, `${tag} ${d.day}: 같은 날 같은 메뉴`);
    const seq = main.map((m) => m.dish.id);
    seq.forEach((id, i) => {
      if (id === "jja") assert.equal(seq[i + 1], "jja-left", `${tag}: 짜글이 다음 점심 · 저녁은 남은 것`);
      if (id === "jja-left") assert.equal(seq[i - 1], "jja", `${tag}: 남은 짜글이 앞은 짜글이`);
      if (id === "ramen") assert.notEqual(seq[i + 1], "ramen", `${tag}: 라면 연속`);
    });
    const ramen = seq.filter((id) => id === "ramen").length;
    assert.ok(ramen >= 1 && ramen <= 2, `${tag}: 라면 ${ramen}번`);
    // 오픈반 알바 날 저녁: 짜글이를 놓을 수 있으면 짜글이
    main.forEach((m, i) => {
      if (m.open && m.meal === "저녁" && seq[i - 1] !== "jja" && seq[i - 1] !== "jja-left" && i !== main.length - 1) assert.equal(m.dish.id, "jja", `${tag} ${m.day}`);
    });
  }
});

test("v3.0.5 옛 '계란 볶음밥'(rice): 먹은 기록은 그대로 읽히고, 직접 고른 칸만 간장 계란 볶음밥으로 옮긴다", () => {
  assert.deepEqual([dishById("rice").name, dishById("rice").short], ["계란 볶음밥", "계란 볶음밥"]);
  const log = { "2026-10-01": [{ label: "저녁", dish: "rice" }] };
  assert.deepEqual(proteinSummary(log, ["2026-10-01"]), { meals: 1, hit: 0, grams: 18 });
  // 기록 맞추기는 이미 적힌 지난 날을 바꾸지 않는다
  assert.deepEqual(syncMealLog(log, new Date(2026, 9, 3), DEFAULT_SETTINGS)["2026-10-01"], log["2026-10-01"]);
  const o = { "2026-10-05 저녁": "rice", "2026-10-06 저녁": "chapa" };
  assert.deepEqual(upgradeOverrides(o), { "2026-10-05 저녁": "rice-soy", "2026-10-06 저녁": "chapa" });
  assert.deepEqual(o["2026-10-05 저녁"], "rice", "원본은 건드리지 않는다");
  const done = upgradeOverrides(o);
  assert.equal(upgradeOverrides(done), done, "옮길 게 없으면 그대로 (몇 번 돌려도 같다)");
});

test("v3.0.5 이름을 고친 식사 칸도 끼니를 안다: 15시 전이면 점심, 뒤면 저녁 메뉴", () => {
  const mine = [{ start: "07:00", kind: "meal", name: "브런치", note: "" }, { start: "20:00", kind: "meal", name: "야식", note: "" }, { start: "23:00", kind: "sleep", name: "취침", note: "" }];
  const s = { ...OFF_WEEK, templates: { ...DEFAULT_SETTINGS.templates, open: mine } };
  assert.deepEqual(homeMeals(MON, s).map((m) => [m.label, m.meal]), [["브런치", "점심"], ["야식", "저녁"]]);
  assert.ok(planWeek(MON, s, {}).flatMap((d) => d.meals).every((m) => m.dish.id !== "bread"));
});

// ---------- 핫픽스 v3.0.6: 설정 › 식단 메뉴 ----------
// 메뉴를 바꿔 보는 테스트는 끝에 기본값으로 되돌린다 (다른 테스트가 같은 모듈을 쓴다)
function withMenu(saved, fn) {
  setMealMenu(saved);
  try { return fn(); } finally { setMealMenu({}); }
}
const mainIds = (s, o = {}) => planWeek(MON, s, o).flatMap((d) => d.meals).filter((m) => m.meal !== "아침").map((m) => m.dish.id);

test("v3.0.6 저장은 기본값에서 바뀐 것만: 안 건드리면 {}, 되돌리면 다시 {} · 기본 목록은 그대로", () => {
  assert.deepEqual(menuWith({}), BASE_DISHES);
  assert.deepEqual(DISHES, BASE_DISHES);
  const a = toggleAllowed({}, "bread", "점심");
  assert.deepEqual(a, { allowed: { bread: ["아침", "점심"] } });
  assert.deepEqual(toggleAllowed(a, "bread", "점심"), {}, "다시 끄면 기본값과 같아져 저장에서 빠진다");
  const b = toggleAuto({}, "ramen");
  assert.deepEqual(b, { off: ["ramen"] });
  assert.deepEqual(toggleAuto(b, "ramen"), {});
  assert.equal(menuWith(b).find((d) => d.id === "ramen").off, true);
  assert.deepEqual(menuWith(b).find((d) => d.id === "ramen").allowed, ["점심", "저녁"], "칩은 그대로 남는다");
  // 닭가슴살(알바 중만)은 칩도 스위치도 없다
  const none = {};
  assert.equal(toggleAllowed(none, "chicken", "저녁"), none);
  assert.equal(toggleAuto(none, "chicken"), none);
  assert.equal(toggleAllowed(none, "없는 메뉴", "저녁"), none);
});

test("v3.0.6 허용 끼니를 바꾸면 돌림에 반영된다: 통밀빵에 점심을 켜면 점심 후보, 저녁에는 안 나온다", () => {
  const saved = toggleAllowed({}, "bread", "점심");
  withMenu(saved, () => {
    assert.deepEqual(autoDishes("점심").map((d) => d.id), ["rice-soy", "rice-kimchi", "bread", "jja", "ramen"]);
    assert.deepEqual(pickable("저녁").auto.map((d) => d.id), ["rice-soy", "rice-kimchi", "jja", "ramen"]);
    const week = planWeek(MON, OFF_WEEK, {}).flatMap((d) => d.meals);
    assert.ok(week.some((m) => m.meal === "점심" && m.dish.id === "bread"), "점심에 통밀빵이 나온다");
    assert.ok(!week.some((m) => m.meal === "저녁" && m.dish.id === "bread"), "저녁에는 안 나온다");
    assert.deepEqual(planWeek(MON, OFF_WEEK, {}), planWeek(MON, OFF_WEEK, {}), "같은 설정이면 늘 같은 결과");
  });
  assert.ok(!mainIds(OFF_WEEK).includes("bread"), "기본값으로 돌아오면 다시 아침만");
});

test("v3.0.6 자동 배정에서 뺀 메뉴는 돌림에 안 나오고, 고르는 창 '다른 메뉴' 에는 있어서 직접 고를 수 있다", () => {
  assert.ok(mainIds(OPEN_WEEK).includes("ramen"));
  withMenu(toggleAuto({}, "ramen"), () => {
    for (const s of [OPEN_WEEK, CLOSE_WEEK, MIXED_WEEK, OFF_WEEK]) assert.ok(!mainIds(s).includes("ramen"));
    assert.ok(!pickable("저녁").auto.some((d) => d.id === "ramen"));
    assert.ok(pickable("저녁").other.some((d) => d.id === "ramen"));
    assert.equal(planWeek(MON, OPEN_WEEK, { "2026-10-14 저녁": "ramen" })[2].meals.at(-1).dish.id, "ramen", "직접 고르면 된다");
  });
  // 짜글이를 빼면 오픈반 저녁 우선 · 남은 짜글이도 없다
  withMenu(toggleAuto({}, "jja"), () => assert.ok(!mainIds(OPEN_WEEK).some((id) => id === "jja" || id === "jja-left")));
});

test("v3.0.6 끼니마다 자동 배정 메뉴가 하나는 있어야 한다: 마지막 하나를 끄는 칩 · 스위치 · 삭제는 받은 값을 그대로 돌려준다", () => {
  // 아침: 간장 · 김치 · 통밀빵 → 둘을 빼면 통밀빵 하나
  let s = toggleAuto(toggleAuto({}, "rice-soy"), "rice-kimchi");
  // 볶음밥 둘이 빠지면 점심 · 저녁은 짜글이 · 라면이 남는다
  assert.deepEqual(s.off, ["rice-soy", "rice-kimchi"]);
  assert.equal(toggleAuto(s, "bread"), s, "아침의 마지막 메뉴는 못 뺀다");
  assert.equal(toggleAllowed(s, "bread", "아침"), s, "아침 칩도 못 끈다");
  s = toggleAuto(s, "jja");
  assert.equal(toggleAuto(s, "ramen"), s, "점심 · 저녁의 마지막 메뉴는 못 뺀다");
  assert.equal(toggleAllowed(s, "ramen", "저녁"), s);
  // 직접 추가한 메뉴가 그 끼니의 마지막이면 지우기도 막힌다
  let c = toggleAllowed(addCustom(s, "샐러드", "x-1"), "x-1", "점심"); // 샐러드는 저녁만
  c = toggleAllowed(c, "ramen", "저녁");                              // 라면은 점심만 → 저녁은 샐러드뿐
  assert.deepEqual(menuWith(c).filter((d) => !d.off && d.allowed.includes("저녁")).map((d) => d.id), ["x-1"]);
  assert.equal(removeCustom(c, "x-1"), c);
  assert.equal(toggleAuto(c, "x-1"), c);
  // 이런 설정에서도 식단 계산은 죽지 않는다
  withMenu(c, () => assert.equal(planWeek(MON, OFF_WEEK, {}).flatMap((d) => d.meals).length, 6 * 3 + 2));
});

test("v3.0.6 메뉴가 통째로 비어도 (설정이 막지만) 식단 계산은 죽지 않는다", () => {
  withMenu({ off: BASE_DISHES.map((d) => d.id) }, () => {
    const all = planWeek(MON, OFF_WEEK, {}).flatMap((d) => d.meals);
    assert.equal(all.length, 20);
    assert.ok(all.every((m) => m.dish.id === "skip"));
  });
});

test("v3.0.6 이름만 있는 메뉴: 점심 · 저녁 돌림에 들어오고, 레시피 · 단백질은 없다 · 이름 고치기", () => {
  let s = addCustom({}, "  샐러드  ", "x-100");
  assert.deepEqual(s, { custom: [{ id: "x-100", name: "샐러드", allowed: ["점심", "저녁"] }] });
  assert.equal(addCustom(s, "   ", "x-200"), s, "이름이 비면 안 더한다");
  assert.deepEqual(addCustom(s, "샌드위치", "x-100").custom.map((c) => c.id), ["x-100", "x-100-2"], "id 가 겹치면 번호를 붙인다");
  withMenu(s, () => {
    const d = dishById("x-100");
    assert.deepEqual([d.name, d.short, d.custom, d.allowed.join("·")], ["샐러드", "샐러드", true, "점심·저녁"]);
    assert.ok(mainIds(OFF_WEEK).includes("x-100"), "돌림에 들어온다");
    assert.ok(!planWeek(MON, OFF_WEEK, {}).flatMap((x) => x.meals).some((m) => m.meal === "아침" && m.dish.id === "x-100"));
    assert.equal(mealProtein({ dish: "x-100" }), null);
    assert.deepEqual(proteinSummary({ d: [{ label: "점심", dish: "x-100" }, { label: "저녁", dish: "jja" }] }, ["d"]), { meals: 1, hit: 1, grams: 25 });
    // 아침 칩을 켜면 아침 요일 순서의 네 번째로
    withMenu(toggleAllowed(s, "x-100", "아침"), () => assert.equal(planWeek(MON, OFF_WEEK, {})[3].meals[0].dish.id, "x-100"));
  });
  const r = renameCustom(s, "x-100", "닭가슴살 샐러드");
  assert.deepEqual(r.custom, [{ id: "x-100", name: "닭가슴살 샐러드", allowed: ["점심", "저녁"] }]);
  assert.equal(renameCustom(s, "x-100", "  "), s, "빈 이름으로는 안 바뀐다");
  assert.equal(renameCustom(s, "rice-soy", "다른 이름"), s, "기본 메뉴 이름은 못 고친다");
});

test("v3.0.6 지운 메뉴: 목록 · 돌림 · 고르는 창에서 빠지고, 지난 기록과 직접 고른 칸에서는 이름으로 읽힌다 · 기본 메뉴는 못 지운다", () => {
  const s = toggleAuto(addCustom({}, "샐러드", "x-1"), "x-1");
  const gone = removeCustom(s, "x-1");
  assert.deepEqual(gone, { removed: [{ id: "x-1", name: "샐러드" }] }, "자동 배정 표시도 같이 정리된다");
  assert.equal(removeCustom(gone, "rice-soy"), gone);
  withMenu(gone, () => {
    assert.ok(!DISHES.some((d) => d.id === "x-1"));
    assert.ok(![...pickable("저녁").auto, ...pickable("저녁").other].some((d) => d.id === "x-1"));
    assert.equal(dishById("x-1").short, "샐러드");
    assert.equal(planWeek(MON, OFF_WEEK, { "2026-10-12 점심": "x-1" })[0].meals[1].dish.short, "샐러드", "직접 골라 둔 칸");
    assert.deepEqual(proteinSummary({ d: [{ label: "점심", dish: "x-1" }] }, ["d"]), { meals: 0, hit: 0, grams: 0 });
  });
  assert.equal(dishById("x-1"), undefined, "설정을 비우면 없다");
  // 같은 이름으로 다시 추가해도 id 가 겹치지 않는다
  assert.deepEqual(addCustom(gone, "샐러드", "x-1").custom.map((c) => c.id), ["x-1-2"]);
});

test("v3.0.6 기본값으로: 끼니 칩 · 자동 배정만 처음대로, 직접 추가한 메뉴와 지운 메뉴 이름은 그대로", () => {
  let s = toggleAllowed(toggleAuto({}, "ramen"), "bread", "점심");
  s = removeCustom(addCustom(addCustom(s, "샐러드", "x-1"), "토스트", "x-2"), "x-2");
  s = toggleAuto(toggleAllowed(s, "x-1", "아침"), "x-1");
  const back = resetMenu(s);
  assert.deepEqual(back, { custom: [{ id: "x-1", name: "샐러드", allowed: ["아침", "점심", "저녁"] }], removed: [{ id: "x-2", name: "토스트" }] });
  assert.deepEqual(menuWith(back).slice(0, BASE_DISHES.length), BASE_DISHES);
  assert.deepEqual(resetMenu({}), {});
});
