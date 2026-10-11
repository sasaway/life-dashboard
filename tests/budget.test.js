import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES, parseWon, formatWon, addBudgetItem, setBudgetAmount, removeBudgetItem, sumBy,
  monthKey, shiftMonth, monthLabel, settlementRows, setActual, budgetStatus, settlementStats,
  toggleFixed, resolveMonth, withMonth, migrate, effective, sumEffective,
  setTotal, etcOf, addEtc, setEtcAmount, removeEtc, unknownOf,
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

test("할인·적립: 실질 예산 = 예산 − 할인·적립, 결산은 실질 예산과 비교하고 고정 항목과 함께 다음 달로", () => {
  let items = [{ id: "net", cat: "subs", name: "넷플릭스", amount: 17000, fixed: true }, { id: "food", cat: "living", name: "식비", amount: 200000 }];
  assert.equal(effective(items[0]), 17000); // 할인 칸이 없던 옛 항목은 할인 0
  items = setBudgetAmount(items, "net", "3,000", "off").items;
  assert.deepEqual(items[0], { id: "net", cat: "subs", name: "넷플릭스", amount: 17000, off: 3000, fixed: true });
  assert.match(setBudgetAmount(items, "net", "삼천", "off").error, /숫자/);
  assert.equal(effective(items[0]), 14000);
  assert.equal(effective({ amount: 1000, off: 5000 }), 0); // 할인이 더 커도 0 아래로는 안 간다
  assert.equal(sumEffective(items), 214000);
  const rows = settlementRows(items, { actual: { net: 15000 } });
  assert.deepEqual(rows.map((x) => [x.budget, x.actual]), [[14000, 15000], [200000, 0]]);
  assert.equal(settlementStats(rows).byCat.find((c) => c.key === "subs").status.label, "초과");
  assert.equal(resolveMonth({ "2026-09": items }, "2026-10")[0].off, 3000);
});

// ---------- v3.2 전체 사용금액 · 기타 소비 · 출처를 모르는 돈 (숫자는 전부 지어낸 것) ----------
const M = "2026-09";
const ITEMS = [{ id: "a", cat: "fixed", name: "가", amount: 150000 }, { id: "b", cat: "living", name: "나", amount: 100000 }];
// 전체 300,000 · 기록 220,000 (a 150,000 + b 70,000) · 기타 30,000
function sample() {
  let s = setTotal({}, M, "300,000").settlements;
  s = setActual(s, M, "a", "150000").settlements;
  s = setActual(s, M, "b", "70,000").settlements;
  s = addEtc(s, M, "택시", "12,000", "e1").settlements;
  s = addEtc(s, M, "선물", "18000", "e2").settlements;
  return s;
}
const rowsOf = (s, m = M) => settlementRows(ITEMS, s[m]);

test("v3.2 출처를 모르는 돈 = 전체 − 기록한 돈 − 기타 소비 (예: 300,000 − 220,000 − 30,000 = 50,000)", () => {
  const s = sample();
  assert.deepEqual(s[M], { actual: { a: 150000, b: 70000 }, total: 300000, etc: [{ id: "e1", name: "택시", amount: 12000 }, { id: "e2", name: "선물", amount: 18000 }] });
  assert.deepEqual(unknownOf(rowsOf(s), s[M]), { total: 300000, recorded: 220000, etc: 30000, unknown: 50000, state: "ok" });
  // 기타 소비를 찾아 적을수록 모르는 돈이 줄어든다
  const more = addEtc(s, M, "병원", "50000", "e3").settlements;
  assert.deepEqual([unknownOf(rowsOf(more), more[M]).unknown, unknownOf(rowsOf(more), more[M]).state], [0, "ok"], "딱 0 이면 다 찾은 것");
});

test("v3.2 전체를 아직 안 적었으면 모르는 돈은 계산하지 않는다 (기록 · 기타 합은 알려 준다), 빈칸으로 지우면 다시 안 적은 상태", () => {
  let s = setActual({}, M, "a", "150000").settlements;
  s = addEtc(s, M, "택시", "12000", "e1").settlements;
  assert.deepEqual(unknownOf(rowsOf(s), s[M]), { total: null, recorded: 150000, etc: 12000, unknown: null, state: "none" });
  assert.deepEqual(unknownOf(rowsOf({}), undefined), { total: null, recorded: 0, etc: 0, unknown: null, state: "none" }, "아무것도 없는 달");
  const full = sample();
  const cleared = setTotal(full, M, "  ").settlements;
  assert.equal("total" in cleared[M], false);
  assert.deepEqual([cleared[M].actual, cleared[M].etc], [full[M].actual, full[M].etc], "전체를 지워도 나머지는 그대로");
  assert.equal(unknownOf(rowsOf(cleared), cleared[M]).state, "none");
  assert.equal(setTotal({}, M, "").settlements[M], undefined, "없는 달을 지우면 아무것도 안 생긴다");
  // 0 을 적은 건 '0원 썼다' 는 뜻 — 안 적은 것과 다르다
  assert.deepEqual([setTotal({}, M, "0").settlements[M].total, unknownOf([], setTotal({}, M, "0").settlements[M]).state], [0, "ok"]);
});

test("v3.2 적은 돈이 전체보다 많으면 'over' — 얼마 많은지 알 수 있게 음수 차이를 돌려준다 (은월 선택)", () => {
  const s = setTotal(sample(), M, "245,000").settlements;
  assert.deepEqual(unknownOf(rowsOf(s), s[M]), { total: 245000, recorded: 220000, etc: 30000, unknown: -5000, state: "over" });
});

test("v3.2 기타 소비: 추가 · 금액 고치기 · 지우기 · 합산, 이름이 없거나 숫자가 아니거나 같은 이름이면 막는다", () => {
  let s = sample();
  assert.deepEqual(etcOf(s[M]).map((x) => x.name), ["택시", "선물"]);
  assert.match(addEtc(s, M, "  ", "1000").error, /이름/);
  assert.match(addEtc(s, M, "커피", "천원").error, /숫자/);
  assert.match(addEtc(s, M, " 택시 ", "1").error, /이미/);
  assert.equal(addEtc(s, M, "커피", "천원").settlements, s, "막으면 받은 값 그대로");
  assert.equal(addEtc(s, M, "  편의점   야식 ", "", "e9").settlements[M].etc.at(-1).name, "편의점 야식", "띄어쓰기 정리, 금액 빈칸은 0");
  s = setEtcAmount(s, M, "e1", "20,000").settlements;
  assert.deepEqual(etcOf(s[M]).map((x) => x.amount), [20000, 18000]);
  assert.match(setEtcAmount(s, M, "e1", "abc").error, /숫자/);
  assert.equal(unknownOf(rowsOf(s), s[M]).unknown, 300000 - 220000 - 38000);
  s = removeEtc(s, M, "e2");
  assert.deepEqual(etcOf(s[M]), [{ id: "e1", name: "택시", amount: 20000 }]);
  assert.deepEqual([s[M].total, s[M].actual], [300000, { a: 150000, b: 70000 }], "지워도 전체 · 실제는 그대로");
  assert.equal(removeEtc(s, M, "없는 것")[M].etc.length, 1);
  assert.deepEqual(removeEtc({}, M, "e1"), {}, "없는 달은 그대로");
  assert.deepEqual(etcOf(undefined), []);
  // 큰 값 상한 (parseWon 과 같다)
  assert.equal(setTotal({}, M, "99999999999999").settlements[M].total, 1_000_000_000);
  assert.equal(addEtc({}, M, "큰돈", "99999999999999", "x").settlements[M].etc[0].amount, 1_000_000_000);
  assert.match(setTotal(s, M, "-5").error, /숫자/);
});

test("v3.2 '실제로 쓴 돈' 을 고쳐도 그 달의 전체 · 기타 소비가 지워지지 않고, 받은 값은 안 바꾼다", () => {
  const s = sample();
  const before = JSON.stringify(s);
  const next = setActual(s, M, "b", "80,000").settlements;
  assert.deepEqual(next[M], { ...s[M], actual: { a: 150000, b: 80000 } });
  assert.equal(unknownOf(rowsOf(next), next[M]).unknown, 300000 - 230000 - 30000);
  setTotal(s, M, "1"); addEtc(s, M, "새것", "1"); setEtcAmount(s, M, "e1", "1"); removeEtc(s, M, "e1");
  assert.equal(JSON.stringify(s), before);
});

test("v3.2 달마다 따로 저장한다", () => {
  let s = sample();
  s = setTotal(s, "2026-08", "100,000").settlements;
  s = addEtc(s, "2026-08", "택시", "5000", "z1").settlements; // 다른 달이면 같은 이름도 된다
  assert.deepEqual(s["2026-08"], { actual: {}, total: 100000, etc: [{ id: "z1", name: "택시", amount: 5000 }] });
  assert.deepEqual(s[M], sample()[M], "다른 달은 안 건드린다");
  assert.equal(unknownOf(rowsOf(s, "2026-08"), s["2026-08"]).unknown, 95000);
});

test("v3.2 한 달 합계의 '실제' 에 기타 소비를 넣는다 (은월 선택): 예산은 그대로라 퍼센트 · 상태가 올라간다. 분류별은 예산 항목만", () => {
  const s = sample();
  const rows = rowsOf(s);
  const plain = settlementStats(rows);
  assert.deepEqual([plain.total.actual, plain.total.budget, plain.total.pct, plain.total.status.key], [220000, 250000, 88, "good"]);
  const withEtc = settlementStats(rows, unknownOf(rows, s[M]).etc);
  assert.deepEqual([withEtc.total.actual, withEtc.total.budget, withEtc.total.pct, withEtc.total.status.key], [250000, 250000, 100, "warn"]);
  assert.equal(settlementStats(rows, 40000).total.status.key, "danger", "기타 소비까지 더해 예산을 넘으면 초과");
  assert.deepEqual(withEtc.byCat, plain.byCat);
  assert.deepEqual(settlementStats(rows, 0), plain);
});

test("v3.2 옛 저장(실제로 쓴 돈만 있는 달)은 그대로 열린다: 전체는 안 적은 것, 기타 소비는 빈 목록", () => {
  const old = { [M]: { actual: { a: 150000 } } };
  assert.deepEqual(etcOf(old[M]), []);
  assert.deepEqual(unknownOf(rowsOf(old), old[M]), { total: null, recorded: 150000, etc: 0, unknown: null, state: "none" });
  assert.deepEqual(settlementRows(ITEMS, old[M]).map((x) => x.actual), [150000, 0]);
  assert.deepEqual(addEtc(old, M, "택시", "1000", "e1").settlements[M], { actual: { a: 150000 }, etc: [{ id: "e1", name: "택시", amount: 1000 }] });
  // 이미 옮긴 폰(budgets 가 있음)은 migrate 가 settlements 를 그대로 돌려준다 — 새 칸이 안 사라진다
  const s = sample();
  assert.equal(migrate({ budgets: { [M]: ITEMS }, settlements: s }, "2026-10").settlements, s);
});
