// 예산과 지난달 결산. 규칙은 Notion '돈' (09:41 수정본).
// 예산은 달마다 따로 있다. '고정' 을 켠 항목만 다음 달 예산으로 넘어간다.
import { newId } from "./shopping.js";

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

export function setBudgetAmount(items, id, amountText) {
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { items, error: "금액은 숫자만 적어 줘." };
  return { items: items.map((x) => (x.id === id ? { ...x, amount } : x)), error: "" };
}

export const removeBudgetItem = (items, id) => items.filter((x) => x.id !== id);

export const toggleFixed = (items, id) => items.map((x) => (x.id === id ? { ...x, fixed: !x.fixed } : x));

export const sumBy = (rows, field) => rows.reduce((s, x) => s + (x[field] || 0), 0);

// ---------- 달 ----------
const pad = (n) => String(n).padStart(2, "0");
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
  return items.map((x) => ({ ...x, budget: x.amount, actual: actual[x.id] ?? 0 }));
}

export function setActual(settlements, month, id, amountText) {
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { settlements, error: "금액은 숫자만 적어 줘." };
  const actual = { ...(settlements[month]?.actual ?? {}), [id]: amount };
  return { settlements: { ...settlements, [month]: { actual } }, error: "" };
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

function summary(rows) {
  const budget = sumBy(rows, "budget");
  const actual = sumBy(rows, "actual");
  const pct = budget ? Math.round((actual / budget) * 100) : actual ? 100 : 0;
  return { budget, actual, pct, status: budgetStatus(budget, actual) };
}

export function settlementStats(rows) {
  return {
    total: summary(rows),
    byCat: CATEGORIES.map((c) => ({ ...c, ...summary(rows.filter((x) => x.cat === c.key)) })),
  };
}
