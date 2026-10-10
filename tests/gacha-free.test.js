import { test } from "node:test";
import assert from "node:assert/strict";
import { FREE_ITEMS, VERSION_DAYS, defaultFreeItems, normalizeFreeItems, timesOf, freeIncome, versionTotal } from "../js/gacha-free.js";
import { normalizeGacha, defaultGacha, income, pullsOf, expectation, verdict } from "../js/gacha.js";

const item = (id) => FREE_ITEMS.find((x) => x.id === id);
const ctx = (planDate, days, starts = null) => ({ planDate, days, starts });

test("핫픽스 v3.1.1 무과금 줄 기본값: 주간 160 · 해역·탑 2,400 · 매트릭스 400 · 탐사·임무 4,000 · 이벤트 3,450 · 점검·코드 900 · 뽑권", () => {
  assert.deepEqual(FREE_ITEMS.map((x) => [x.id, x.kind, x.amount, x.cycle]), [
    ["weekly", "astrite", 160, "week"], ["tower", "astrite", 2400, "version"], ["matrix", "astrite", 400, "version"],
    ["explore", "astrite", 4000, "version"], ["event", "astrite", 3450, "version"], ["mail", "astrite", 900, "version"],
    ["login-char", "char", 5, "version"], ["login-weap", "weap", 5, "version"],
    ["shop-char", "char", 7, "month"], ["shop-weap", "weap", 7, "month"], ["gift37", "char", 10, "once"],
  ]);
  assert.equal(item("gift37").date, "2026-10-22");
  assert.deepEqual(FREE_ITEMS.filter((x) => x.rough).map((x) => x.id), ["explore", "event"], "어림이 큰 줄은 가운데 값 (은월 선택)");
  assert.equal(new Set(FREE_ITEMS.map((x) => x.id)).size, FREE_ITEMS.length);
});

test("한 버전을 다 받으면 약 125연 (조사한 범위 110~120연 근처)", () => {
  const t = versionTotal(defaultFreeItems(), 60);
  assert.deepEqual(t, { astrite: 60 * 42 + 160 * 6 + 2400 + 400 + 4000 + 3450 + 900, char: 22, weap: 12 });
  assert.equal(pullsOf(t), 125);
  const off = { ...defaultFreeItems(), event: { amount: 3450, on: false } };
  assert.equal(versionTotal(off, 60).astrite, t.astrite - 3450, "꺼 둔 줄은 뺀다");
});

test("주기별 세기: 주마다 = 이번 주 + 남은 주, 버전마다 = 지금 버전 + 새로 시작하는 버전, 달마다 = 이번 달 + 오는 1일 수", () => {
  assert.deepEqual([1, 6, 7, 12, 14, 32].map((d) => timesOf(item("weekly"), ctx("2026-11-11", d))), [1, 1, 2, 2, 3, 5]);
  // 버전: 픽업 일정이 알려 주면 그 수, 모르면 42일마다 하나
  assert.equal(timesOf(item("tower"), ctx("2026-10-22", 12, 0)), 1, "지금 버전 몫은 다 받는다고 친다 (은월 선택)");
  assert.equal(timesOf(item("tower"), ctx("2026-11-20", 41, 1)), 2);
  assert.deepEqual([12, 41, 42, 83, 84].map((d) => timesOf(item("tower"), ctx("2027-01-01", d))), [1, 1, 2, 2, 3]);
  // 달: 10/10 → 10/22 는 이번 달 것만, 11/11 까지면 11/1 하나 더
  assert.equal(timesOf(item("shop-char"), ctx("2026-10-22", 12)), 1);
  assert.equal(timesOf(item("shop-char"), ctx("2026-11-11", 32)), 2);
  assert.equal(timesOf(item("shop-char"), ctx("2026-11-01", 22)), 2, "픽업 날이 1일이면 그 달 것도");
});

test("한 번만 받는 줄(3.7 선물 10/22): 그 날이 오늘 ~ 픽업 날 사이일 때만 센다 — 지나면 저절로 0", () => {
  const gift = item("gift37");
  assert.equal(timesOf(gift, ctx("2026-10-22", 12)), 1, "픽업 날 당일에 들어와도 센다");
  assert.equal(timesOf(gift, ctx("2026-10-21", 11)), 0, "픽업이 그 전이면 못 받는다");
  assert.equal(timesOf(gift, ctx("2026-11-11", 20)), 1, "오늘(10/22) 들어오는 날");
  assert.equal(timesOf(gift, ctx("2026-11-11", 19)), 0, "지난 뒤(10/23)에는 이미 가진 것에 들어 있다");
});

test("날짜가 없거나 오늘 · 지난 날이면 모든 줄이 0", () => {
  for (const days of [null, 0, -3]) {
    const r = freeIncome(defaultFreeItems(), ctx(days === null ? "" : "2026-10-22", days));
    assert.deepEqual(r.total, { astrite: 0, char: 0, weap: 0 });
    assert.ok(r.lines.every((l) => l.times === 0 && l.got === 0));
  }
});

test("전 / 후 예시 (2026-10-10, 가진 것 0, 기본값): 10/22 픽업 4연 → 110연, 11/11 픽업 12연 → 134연", () => {
  const at = (date, days) => income(normalizeGacha({ plan: { date } }), days, { starts: 0 });
  const a = at("2026-10-22", 12);
  assert.deepEqual(a.free, { astrite: 720 + 320 + 11150, char: 5 + 7 + 10, weap: 5 + 7 });
  assert.equal(pullsOf(a.freeOnly), 110);
  const b = at("2026-11-11", 32);
  assert.deepEqual(b.free, { astrite: 1920 + 800 + 11150, char: 5 + 14 + 10, weap: 5 + 14 });
  assert.equal(pullsOf(b.freeOnly), 134);
  // 보강 전 값: 일일 의뢰만
  const g = normalizeGacha({ plan: { date: "2026-10-22" } });
  const none = { ...g, free: { ...g.free, items: normalizeFreeItems(Object.fromEntries(FREE_ITEMS.map((x) => [x.id, { on: false }]))) } };
  assert.equal(pullsOf(income(none, 12).freeOnly), 4);
});

test("숫자를 고치거나 끄면 바로 반영되고, 줄마다 몇 번 · 얼마인지 알려 준다", () => {
  const items = { ...defaultFreeItems(), explore: { amount: 4600, on: true }, event: { amount: 3450, on: false }, "shop-weap": { amount: 0, on: true } };
  const r = freeIncome(items, ctx("2026-10-22", 12, 0));
  assert.equal(r.total.astrite, 320 + 2400 + 400 + 4600 + 900);
  assert.equal(r.total.weap, 5);
  const line = (id) => r.lines.find((l) => l.id === id);
  assert.deepEqual([line("weekly").times, line("weekly").got], [2, 320]);
  assert.deepEqual([line("event").on, line("event").times, line("event").got], [false, 1, 0]);
  assert.equal(line("explore").got, 4600);
  // 픽업 판정에도: 명함 한 장 (평균 56연) — 일일 의뢰만이면 부족, 줄을 켜면 된다
  const side = expectation(defaultGacha().plan).win;
  const g = normalizeGacha({ plan: { date: "2026-10-22" } });
  assert.equal(verdict(side, income(g, 12, { starts: 0 }).freeOnly).key, "sure");
  const off = { ...g, free: { ...g.free, items: normalizeFreeItems(Object.fromEntries(FREE_ITEMS.map((x) => [x.id, { on: false }]))) } };
  assert.equal(verdict(side, income(off, 12).freeOnly).key, "short");
});

test("옛 저장 호환: items 가 없으면 기본 줄, 적어 둔 '그 밖에' 숫자는 그대로. 빠진 줄 · 빈 값 · 큰 값 · 깨진 값", () => {
  const old = normalizeGacha({ free: { daily: 80, astrite: 5000, char: 3 } });
  assert.deepEqual([old.free.daily, old.free.astrite, old.free.char], [80, 5000, 3]);
  assert.deepEqual(old.free.items, defaultFreeItems());
  assert.deepEqual(normalizeGacha(JSON.parse(JSON.stringify(old))), old, "다시 열어도 그대로");
  const some = normalizeFreeItems({ weekly: { amount: 200, on: false }, tower: { amount: 0 }, explore: { amount: 99999999 }, event: { amount: -5 }, mail: { amount: "abc" }, 없는줄: { amount: 1 }, matrix: null });
  assert.deepEqual(some.weekly, { amount: 200, on: false });
  assert.deepEqual(some.tower, { amount: 0, on: true }, "0 으로 적은 건 0 그대로");
  assert.equal(some.explore.amount, 999999, "상한");
  assert.equal(some.event.amount, 0);
  assert.equal(some.mail.amount, 0);
  assert.equal("없는줄" in some, false);
  assert.deepEqual(some.matrix, { amount: 400, on: true });
  assert.deepEqual(normalizeFreeItems({ weekly: { on: false } }).weekly, { amount: 160, on: false }, "켬/끔만 저장돼 있으면 숫자는 기본값");
  for (const bad of [null, undefined, "x", 3]) assert.deepEqual(normalizeFreeItems(bad), defaultFreeItems());
  assert.equal(VERSION_DAYS, 42);
});
