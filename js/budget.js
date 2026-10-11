// 예산과 지난달 결산. 규칙은 Notion '돈' (09:41 · 2026-09-27 12:03 수정본).
// 예산은 달마다 따로 있다. '고정' 을 켠 항목만 다음 달 예산으로 넘어간다.
// 항목마다 할인·적립(원)을 적으면 실질 예산 = 예산 − 할인·적립, 결산은 실질 예산과 비교한다.
import { newId } from "./shopping.js";
import { pad } from "./schedule.js";

export const CATEGORIES = [
  { key: "fixed", label: "고정지출" },
  { key: "living", label: "생활비" },
  { key: "subs", label: "구독료" },
  { key: "extra", label: "부가지출" },
];

// 새 항목의 '고정' 기본값: 매달 반복되는 분류만 켠다
export const DEFAULT_FIXED = { fixed: true, subs: true, living: false, extra: false };

const MAX_WON = 1_000_000_000;

// "12,000원" → 12000. 숫자가 아니면 NaN, 비었으면 0.
export function parseWon(text) {
  const digits = String(text).replace(/[,\s원]/g, "");
  if (!digits) return 0;
  if (!/^\d+$/.test(digits)) return NaN;
  return Math.min(Number(digits), MAX_WON);
}

export const formatWon = (n) => `${n.toLocaleString("ko-KR")}원`;

// ---------- 예산 항목 ----------
export function addBudgetItem(items, cat, name, amountText, id = newId()) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { items, error: "항목 이름을 적어 줘." };
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { items, error: "금액은 숫자만 적어 줘." };
  if (items.some((x) => x.cat === cat && x.name === clean)) return { items, error: `'${clean}' 은(는) 이미 있어.` };
  return { items: [...items, { id, cat, name: clean, amount, fixed: DEFAULT_FIXED[cat] }], error: "" };
}

// field: "amount" (예산) 또는 "off" (할인·적립)
export function setBudgetAmount(items, id, amountText, field = "amount") {
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { items, error: "금액은 숫자만 적어 줘." };
  return { items: items.map((x) => (x.id === id ? { ...x, [field]: amount } : x)), error: "" };
}

// 실질 예산. 할인·적립이 예산보다 크면 0 (off 가 없는 옛 항목은 할인 0)
export const effective = (x) => Math.max(0, x.amount - (x.off || 0));
export const sumEffective = (items) => items.reduce((s, x) => s + effective(x), 0);

export const removeBudgetItem = (items, id) => items.filter((x) => x.id !== id);

export const toggleFixed = (items, id) => items.map((x) => (x.id === id ? { ...x, fixed: !x.fixed } : x));

export const sumBy = (rows, field) => rows.reduce((s, x) => s + (x[field] || 0), 0);

// ---------- 달 ----------
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export function shiftMonth(key, n) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}
export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${y}년 ${m}월`;
}

// ---------- 달마다 예산 ----------
// 그 달 예산이 아직 없으면: 가장 가까운 이전 달의 고정 항목을 가져온다.
// 이전 달이 하나도 없으면(앱을 처음 쓴 달보다 앞) 가장 가까운 다음 달의 고정 항목으로 채운다.
export function resolveMonth(budgets, month) {
  if (budgets[month]) return budgets[month];
  const months = Object.keys(budgets).sort();
  const before = months.filter((m) => m < month).pop();
  const after = months.find((m) => m > month);
  const from = before ?? after;
  return from ? budgets[from].filter((x) => x.fixed).map((x) => ({ ...x })) : [];
}

export const withMonth = (budgets, month, items) => ({ ...budgets, [month]: items });

// ---------- 결산 ----------
export function settlementRows(items, settlement) {
  const actual = settlement?.actual ?? {};
  return items.map((x) => ({ ...x, budget: effective(x), actual: actual[x.id] ?? 0 }));
}

export function setActual(settlements, month, id, amountText) {
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { settlements, error: "금액은 숫자만 적어 줘." };
  const actual = { ...(settlements[month]?.actual ?? {}), [id]: amount };
  return { settlements: { ...settlements, [month]: { ...settlements[month], actual } }, error: "" }; // 그 달의 전체 금액 · 기타 소비는 그대로 (v3.2)
}

// ---------- 전체 사용금액 · 기타 소비 · 출처를 모르는 돈 (v3.2, Notion '돈 › 지난달 결산') ----------
// settlements[달] = { actual, total, etc: [{ id, name, amount }] } — total 이 없으면 아직 안 적은 것, etc 가 없으면 빈 목록 (옛 저장 그대로 열린다)
const NOT_NUMBER = "금액은 숫자만 적어 줘.";
const withSettle = (settlements, month, patch) => ({ ...settlements, [month]: { actual: {}, ...settlements[month], ...patch } });

// 그 달에 실제로 나간 돈 전체. 빈칸이면 지운다 (안 적은 상태로)
export function setTotal(settlements, month, amountText) {
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { settlements, error: NOT_NUMBER };
  if (String(amountText).trim()) return { settlements: withSettle(settlements, month, { total: amount }), error: "" };
  const { total: _, ...rest } = settlements[month] ?? {};
  return { settlements: settlements[month] ? { ...settlements, [month]: rest } : settlements, error: "" };
}

export const etcOf = (settlement) => settlement?.etc ?? [];

// 기타 소비: 예산에 없던 돈을 찾아서 이름 + 금액으로 적는다
export function addEtc(settlements, month, name, amountText, id = newId()) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { settlements, error: "항목 이름을 적어 줘." };
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { settlements, error: NOT_NUMBER };
  const etc = etcOf(settlements[month]);
  if (etc.some((x) => x.name === clean)) return { settlements, error: `'${clean}' 은(는) 이미 있어.` };
  return { settlements: withSettle(settlements, month, { etc: [...etc, { id, name: clean, amount }] }), error: "" };
}

export function setEtcAmount(settlements, month, id, amountText) {
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { settlements, error: NOT_NUMBER };
  const etc = etcOf(settlements[month]).map((x) => (x.id === id ? { ...x, amount } : x));
  return { settlements: withSettle(settlements, month, { etc }), error: "" };
}

export const removeEtc = (settlements, month, id) =>
  (settlements[month] ? withSettle(settlements, month, { etc: etcOf(settlements[month]).filter((x) => x.id !== id) }) : settlements);

// 출처를 모르는 돈 = 전체 − 기록한 돈(항목마다 적은 '실제로 쓴 돈') − 기타 소비.
// state: "none" 전체를 아직 안 적음 · "ok" · "over" 적은 돈이 전체보다 많음 (unknown 이 음수 — 화면이 차이를 알려 준다)
export function unknownOf(rows, settlement) {
  const recorded = sumBy(rows, "actual");
  const etc = sumBy(etcOf(settlement), "amount");
  const total = settlement?.total;
  if (total == null) return { total: null, recorded, etc, unknown: null, state: "none" };
  const unknown = total - recorded - etc;
  return { total, recorded, etc, unknown, state: unknown < 0 ? "over" : "ok" };
}

// ---------- 옛 저장 형식(v6) 옮기기 ----------
// v6: budget = 매달 같은 항목 하나, settlements[m].snapshot = 그 달 예산
// → budgets[달] 로 나눈다. 전에 적은 항목은 '매달 그대로' 였으니 고정으로 둔다.
export function migrate({ budget, settlements = {}, budgets }, thisMonth) {
  if (budgets) return { budgets, settlements };
  const out = {};
  const clean = {};
  for (const [m, st] of Object.entries(settlements)) {
    if (st.snapshot) out[m] = st.snapshot.map((x) => ({ ...x, fixed: true }));
    clean[m] = { actual: st.actual ?? {} };
  }
  if (budget?.length && !out[thisMonth]) out[thisMonth] = budget.map((x) => ({ ...x, fixed: true }));
  return { budgets: out, settlements: clean };
}

// ---------- 통계 ----------
// 상태는 색과 글자를 같이 쓴다 (DESIGN.md 8번)
export function budgetStatus(budget, actual) {
  if (!budget && !actual) return { key: "none", label: "" };
  if (!budget || actual > budget) return { key: "danger", label: "초과" };
  if (actual / budget >= 0.9) return { key: "warn", label: "거의 다 씀" };
  return { key: "good", label: "예산 안" };
}

function summary(rows, more = 0) {
  const budget = sumBy(rows, "budget");
  const actual = sumBy(rows, "actual") + more;
  const pct = budget ? Math.round((actual / budget) * 100) : actual ? 100 : 0;
  return { budget, actual, pct, status: budgetStatus(budget, actual) };
}

// etc = 기타 소비 합: 한 달 합계의 '실제' 에 더한다 (v3.2, 은월 선택 — 예산은 그대로). 분류별은 예산 항목만
export function settlementStats(rows, etc = 0) {
  return {
    total: summary(rows, etc),
    byCat: CATEGORIES.map((c) => ({ ...c, ...summary(rows.filter((x) => x.cat === c.key)) })),
  };
}
