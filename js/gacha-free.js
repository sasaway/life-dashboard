// 명조 가챠 계산기 · 무과금으로 받을 것 (핫픽스 v3.1.1, Notion 핫픽스 '무과금으로 받는 내용이 너무 적음'). 계산만 — 화면은 gacha-view.js.
// 숫자는 공식 발표가 아니라 3.7 기준 커뮤니티 가이드 여러 곳이 같이 적은 값이다 (Cowork 조사 2026-10-09). 버전마다 달라서 전부 화면에서 고칠 수 있다.
// 어림이 큰 줄(탐사 · 임무, 이벤트)은 범위의 가운데 값 (은월 선택). 해역과 역경의 탑은 나눔이 출처마다 달라 합계 한 줄.
import { parseDate } from "./schedule.js";
import { firstsUntil } from "./gacha-shop.js";

export const VERSION_DAYS = 42; // 한 버전 (픽업 일정에 다음 버전이 없을 때 어림으로 쓴다)
const MAX_AMOUNT = 999_999;

// kind: 무엇으로 받나 (astrite 별소 · char 캐릭뽑 · weap 무기뽑), cycle: week 주마다 · version 버전마다 · month 달마다 · once 한 번(date 에)
export const FREE_ITEMS = [
  { id: "weekly", name: "주간 활약도", kind: "astrite", amount: 160, cycle: "week" },
  { id: "tower", name: "해역 · 역경의 탑", kind: "astrite", amount: 2400, cycle: "version" },
  { id: "matrix", name: "종말 매트릭스", kind: "astrite", amount: 400, cycle: "version" },
  { id: "explore", name: "탐사 · 임무", kind: "astrite", amount: 4000, cycle: "version", rough: true },
  { id: "event", name: "기간 한정 이벤트", kind: "astrite", amount: 3450, cycle: "version", rough: true },
  { id: "mail", name: "점검 · 코드 보상", kind: "astrite", amount: 900, cycle: "version" },
  { id: "login-char", name: "7일 접속", kind: "char", amount: 5, cycle: "version" },
  { id: "login-weap", name: "7일 접속", kind: "weap", amount: 5, cycle: "version" },
  { id: "shop-char", name: "상점 교환", kind: "char", amount: 7, cycle: "month" },
  { id: "shop-weap", name: "상점 교환", kind: "weap", amount: 7, cycle: "month" },
  { id: "gift37", name: "3.7 선물", kind: "char", amount: 10, cycle: "once", date: "2026-10-22" },
];
export const KIND_LABEL = { astrite: "별소", char: "캐릭뽑", weap: "무기뽑" };
export const CYCLE_LABEL = { week: "주마다", version: "버전마다", month: "달마다", once: "한 번" };

export const defaultFreeItems = () => Object.fromEntries(FREE_ITEMS.map((x) => [x.id, { amount: x.amount, on: true }]));
const amountOf = (v) => (Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), MAX_AMOUNT) : 0);

// 저장된 줄에 빠진 것이 있으면 기본값으로 (옛 저장에는 items 가 통째로 없다). 모르는 줄은 버린다
export function normalizeFreeItems(saved) {
  const base = defaultFreeItems();
  if (!saved || typeof saved !== "object") return base;
  for (const id of Object.keys(base)) {
    const s = saved[id];
    if (s && typeof s === "object") base[id] = { amount: "amount" in s ? amountOf(Number(s.amount)) : base[id].amount, on: s.on !== false };
  }
  return base;
}

// 픽업 날까지 몇 번 받나. ctx = { days: 남은 날, planDate, starts: 픽업 날 전에 새로 시작하는 버전 수 (픽업 일정에서, 모르면 null) }
// 은월 선택: 지금 버전 · 이번 주 · 이번 달 몫도 다 받는다고 친다 (이미 받은 줄은 화면에서 끈다).
// 날짜가 없거나 오늘 · 지난 날이면 0 — 앞으로 받을 것은 세지 않는다 (일일 의뢰와 같다)
export function timesOf(item, ctx) {
  const { days, planDate } = ctx;
  if (!(days > 0)) return 0;
  if (item.cycle === "week") return 1 + Math.floor(days / 7);
  if (item.cycle === "version") return 1 + (ctx.starts ?? Math.floor(days / VERSION_DAYS));
  if (item.cycle === "month") return 1 + firstsUntil(planDate, days);
  // 한 번: 그 날이 오늘부터 픽업 날 사이일 때만 (지났으면 이미 받아서 가진 것에 들어 있다)
  const end = parseDate(planDate);
  const today = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days);
  const at = parseDate(item.date);
  return today <= at && at <= end ? 1 : 0;
}

// 줄마다 { ...item, amount, on, times, got } 와 합계 { astrite, char, weap } (꺼 둔 줄은 got 0)
export function freeIncome(items, ctx) {
  const total = { astrite: 0, char: 0, weap: 0 };
  const lines = FREE_ITEMS.map((item) => {
    const { amount, on } = items?.[item.id] ?? { amount: item.amount, on: true };
    const times = timesOf(item, ctx);
    const got = on ? amount * times : 0;
    total[item.kind] += got;
    return { ...item, amount, on, times, got };
  });
  return { lines, total };
}

// 한 버전(42일)을 다 받으면: 일일 의뢰 42일 + 주 6번 + 버전 줄 1번 + 달 줄 1번 + 한 번 줄 (켠 줄만)
export function versionTotal(items, daily) {
  const total = { astrite: daily * VERSION_DAYS, char: 0, weap: 0 };
  for (const item of FREE_ITEMS) {
    const { amount, on } = items?.[item.id] ?? { amount: item.amount, on: true };
    if (on) total[item.kind] += amount * (item.cycle === "week" ? VERSION_DAYS / 7 : 1);
  }
  return total;
}
