// 예산과 지난달 결산. 규칙은 Notion '돈'.
// 예산은 한 번 정하면 매달 그대로 쓴다. 결산은 그 달에 처음 적을 때의 예산을 함께 남긴다.
import { newId } from "./shopping.js";

export const CATEGORIES = [
  { key: "fixed", label: "고정지출" },
  { key: "living", label: "생활비" },
  { key: "subs", label: "구독료" },
  { key: "extra", label: "부가지출" },
];

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
  return { items: [...items, { id, cat, name: clean, amount }], error: "" };
}

export function setBudgetAmount(items, id, amountText) {
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { items, error: "금액은 숫자만 적어 줘." };
  return { items: items.map((x) => (x.id === id ? { ...x, amount } : x)), error: "" };
}

export const removeBudgetItem = (items, id) => items.filter((x) => x.id !== id);

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

// ---------- 결산 ----------
// 그 달 결산 줄: 저장된 예산(없으면 지금 예산) + 실제로 쓴 돈
export function settlementRows(budgetItems, settlement) {
  const base = settlement?.snapshot ?? budgetItems;
  const actual = settlement?.actual ?? {};
  return base.map((x) => ({ ...x, budget: x.amount, actual: actual[x.id] ?? 0 }));
}

export function setActual(settlements, month, budgetItems, id, amountText) {
  const amount = parseWon(amountText);
  if (Number.isNaN(amount)) return { settlements, error: "금액은 숫자만 적어 줘." };
  const cur = settlements[month] ?? { snapshot: budgetItems.map((x) => ({ ...x })), actual: {} };
  return {
    settlements: { ...settlements, [month]: { ...cur, actual: { ...cur.actual, [id]: amount } } },
    error: "",
  };
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
