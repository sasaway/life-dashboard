import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES, parseWon, formatWon, addBudgetItem, setBudgetAmount, removeBudgetItem, sumBy,
  monthKey, shiftMonth, monthLabel, settlementRows, setActual, budgetStatus, settlementStats,
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
  assert.deepEqual(items, [{ id: "a", cat: "fixed", name: "월세", amount: 400000 }]);
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
  { id: "rent", cat: "fixed", name: "월세", amount: 400000 },
  { id: "food", cat: "living", name: "식비", amount: 200000 },
  { id: "net", cat: "subs", name: "넷플릭스", amount: 10000 },
];

test("결산을 처음 적을 때 그 달 예산을 함께 남긴다 — 나중에 예산을 바꿔도 그 달은 그대로", () => {
  let { settlements } = setActual({}, "2026-08", BUDGET, "food", "150,000");
  const changed = setBudgetAmount(BUDGET, "food", "300000").items;
  ({ settlements } = setActual(settlements, "2026-08", changed, "rent", "400000"));
  const rows = settlementRows(changed, settlements["2026-08"]);
  assert.deepEqual(rows.map((x) => [x.name, x.budget, x.actual]),
    [["월세", 400000, 400000], ["식비", 200000, 150000], ["넷플릭스", 10000, 0]]);
});

test("아직 안 적은 달은 지금 예산으로 보여 주고, 쓴 돈은 0", () => {
  const rows = settlementRows(BUDGET, undefined);
  assert.deepEqual(rows.map((x) => [x.budget, x.actual]), [[400000, 0], [200000, 0], [10000, 0]]);
});

test("잘못된 금액은 결산에 들어가지 않는다", () => {
  const r = setActual({}, "2026-08", BUDGET, "food", "많이");
  assert.match(r.error, /숫자/);
  assert.deepEqual(r.settlements, {});
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
  const rows = settlementRows(BUDGET, { snapshot: BUDGET, actual: { rent: 400000, food: 230000, net: 5000 } });
  const s = settlementStats(rows);
  assert.deepEqual([s.total.budget, s.total.actual, s.total.pct], [610000, 635000, 104]);
  assert.equal(s.total.status.key, "danger");
  const by = Object.fromEntries(s.byCat.map((c) => [c.label, [c.pct, c.status.key]]));
  assert.deepEqual(by, {
    고정지출: [100, "warn"], 생활비: [115, "danger"], 구독료: [50, "good"], 부가지출: [0, "none"],
  });
});
