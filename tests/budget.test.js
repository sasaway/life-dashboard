import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES, parseWon, formatWon, addBudgetItem, setBudgetAmount, removeBudgetItem, sumBy,
  monthKey, shiftMonth, monthLabel, settlementRows, setActual, budgetStatus, settlementStats,
  toggleFixed, resolveMonth, withMonth, migrate,
} from "../js/budget.js";

test("분류는 Notion 의 네 가지 그대로다", () => {
  assert.deepEqual(CATEGORIES.map((c) => c.label), ["고정지출", "생활비", "구독료", "부가지출"]);
});

test("금액 읽기: 쉼표·'원'·공백은 무시, 숫자가 아니면 NaN, 비면 0", () => {
  assert.equal(parseWon("12,000원"), 12000);
  assert.equal(parseWon(" 5000 "), 5000);
  assert.equal(parseWon(""), 0);
  assert.ok(Number.isNaN(parseWon("만원")));
  assert.ok(Number.isNaN(parseWon("-300")));
  assert.equal(formatWon(1234567), "1,234,567원");
});

test("예산 항목 추가: 이름이 없거나 금액이 이상하거나 같은 분류에 같은 이름이면 막는다", () => {
  let { items, error } = addBudgetItem([], "fixed", " 월세 ", "400,000", "a");
  assert.equal(error, "");
  assert.deepEqual(items, [{ id: "a", cat: "fixed", name: "월세", amount: 400000, fixed: true }]);
  assert.match(addBudgetItem(items, "fixed", " ", "1").error, /이름/);
  assert.match(addBudgetItem(items, "fixed", "관리비", "abc").error, /숫자/);
  assert.match(addBudgetItem(items, "fixed", "월세", "1").error, /이미/);
  assert.equal(addBudgetItem(items, "living", "월세", "1").error, ""); // 다른 분류면 괜찮다
});

test("예산 금액 고치기·항목 지우기", () => {
  const items = [{ id: "a", cat: "subs", name: "넷플릭스", amount: 13500 }];
  assert.equal(setBudgetAmount(items, "a", "17,000").items[0].amount, 17000);
  assert.match(setBudgetAmount(items, "a", "x").error, /숫자/);
  assert.deepEqual(removeBudgetItem(items, "a"), []);
  assert.equal(sumBy([{ amount: 1 }, { amount: 2 }], "amount"), 3);
});

test("달 계산: 해가 바뀌어도 맞다", () => {
  assert.equal(monthKey(new Date(2026, 8, 25)), "2026-09");
  assert.equal(shiftMonth("2026-09", -1), "2026-08");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2025-12", 1), "2026-01");
  assert.equal(monthLabel("2026-08"), "2026년 8월");
});

const BUDGET = [
  { id: "rent", cat: "fixed", name: "월세", amount: 400000, fixed: true },
  { id: "food", cat: "living", name: "식비", amount: 200000, fixed: true },
  { id: "net", cat: "subs", name: "넷플릭스", amount: 10000, fixed: true },
];

test("'고정' 기본값: 고정지출·구독료는 켜고, 생활비·부가지출은 끈다", () => {
  const add = (cat) => addBudgetItem([], cat, "x", "1", "a").items[0].fixed;
  assert.deepEqual(CATEGORIES.map((c) => add(c.key)), [true, false, true, false]);
  assert.equal(toggleFixed([{ id: "a", fixed: false }], "a")[0].fixed, true);
});

test("새 달 예산은 이전 달의 고정 항목만 가져온다", () => {
  const sep = [
    { id: "rent", cat: "fixed", name: "월세", amount: 400000, fixed: true },
    { id: "trip", cat: "extra", name: "여행", amount: 150000, fixed: false },
  ];
  const budgets = { "2026-09": sep };
  assert.deepEqual(resolveMonth(budgets, "2026-10").map((x) => x.name), ["월세"]);
  assert.deepEqual(resolveMonth(budgets, "2026-12").map((x) => x.name), ["월세"]); // 몇 달 건너뛰어도
  assert.equal(resolveMonth(budgets, "2026-09"), sep); // 있는 달은 그대로
  assert.deepEqual(resolveMonth({}, "2026-09"), []);
});

test("앱을 처음 쓴 달보다 앞선 달은 다음 달의 고정 항목으로 채운다", () => {
  const budgets = { "2026-09": BUDGET };
  assert.deepEqual(resolveMonth(budgets, "2026-08").map((x) => x.name), ["월세", "식비", "넷플릭스"]);
});

test("가져온 항목을 고쳐도 원래 달 예산은 안 바뀐다", () => {
  const budgets = { "2026-09": BUDGET };
  const oct = setBudgetAmount(resolveMonth(budgets, "2026-10"), "food", "300000").items;
  const next = withMonth(budgets, "2026-10", oct);
  assert.equal(next["2026-09"][1].amount, 200000);
  assert.equal(next["2026-10"][1].amount, 300000);
});

test("결산: 그 달 예산과 실제로 쓴 돈", () => {
  let { settlements } = setActual({}, "2026-08", "food", "150,000");
  ({ settlements } = setActual(settlements, "2026-08", "rent", "400000"));
  const rows = settlementRows(BUDGET, settlements["2026-08"]);
  assert.deepEqual(rows.map((x) => [x.name, x.budget, x.actual]),
    [["월세", 400000, 400000], ["식비", 200000, 150000], ["넷플릭스", 10000, 0]]);
  assert.deepEqual(settlementRows(BUDGET, undefined).map((x) => x.actual), [0, 0, 0]);
});

test("잘못된 금액은 결산에 들어가지 않는다", () => {
  const r = setActual({}, "2026-08", "food", "많이");
  assert.match(r.error, /숫자/);
  assert.deepEqual(r.settlements, {});
});

test("옛 저장 형식(v6)을 옮긴다: 적어 둔 예산은 이번 달 고정 항목, 결산 스냅숏은 그 달 예산", () => {
  const old = {
    budget: [{ id: "rent", cat: "fixed", name: "월세", amount: 450000 }],
    settlements: { "2026-08": { snapshot: [{ id: "rent", cat: "fixed", name: "월세", amount: 400000 }], actual: { rent: 400000 } } },
  };
  const { budgets, settlements } = migrate(old, "2026-09");
  assert.deepEqual(budgets["2026-09"], [{ id: "rent", cat: "fixed", name: "월세", amount: 450000, fixed: true }]);
  assert.equal(budgets["2026-08"][0].amount, 400000);
  assert.deepEqual(settlements, { "2026-08": { actual: { rent: 400000 } } });
  // 이미 옮겼으면 그대로
  const again = migrate({ budget: old.budget, settlements, budgets }, "2026-09");
  assert.equal(again.budgets, budgets);
  // 아무것도 없으면 빈 채로
  assert.deepEqual(migrate({}, "2026-09"), { budgets: {}, settlements: {} });
});

test("상태: 90% 미만 예산 안, 90~100% 거의 다 씀, 넘으면 초과", () => {
  assert.equal(budgetStatus(100, 89).key, "good");
  assert.equal(budgetStatus(100, 90).key, "warn");
  assert.equal(budgetStatus(100, 100).key, "warn");
  assert.equal(budgetStatus(100, 101).key, "danger");
  assert.equal(budgetStatus(0, 5).key, "danger"); // 예산 없이 쓴 돈
  assert.equal(budgetStatus(0, 0).key, "none");
  assert.equal(budgetStatus(100, 101).label, "초과");
});

test("통계: 전체와 분류별 사용률", () => {
  const rows = settlementRows(BUDGET, { actual: { rent: 400000, food: 230000, net: 5000 } });
  const s = settlementStats(rows);
  assert.deepEqual([s.total.budget, s.total.actual, s.total.pct], [610000, 635000, 104]);
  assert.equal(s.total.status.key, "danger");
  const by = Object.fromEntries(s.byCat.map((c) => [c.label, [c.pct, c.status.key]]));
  assert.deepEqual(by, {
    고정지출: [100, "warn"], 생활비: [115, "danger"], 구독료: [50, "good"], 부가지출: [0, "none"],
  });
});
