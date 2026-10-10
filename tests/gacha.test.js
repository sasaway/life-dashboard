import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PULL_COST, HARD_PITY, AVG_PER_FIVE, defaultGacha, normalizeGacha, count, astriteOf, pullsOf, daysUntil, dLabel, income,
} from "../js/gacha.js";
import { passCharDate, passCharCounts } from "../js/gacha-shop.js";
import { FREE_ITEMS } from "../js/gacha-free.js";

// 무과금 줄(v3.1.1)을 다 끈 것 — 그 전부터 있던 계산(일일 의뢰 · 그 밖에 · 과금)만 볼 때
const itemsOff = Object.fromEntries(FREE_ITEMS.map((x) => [x.id, { on: false }]));

// 옛 모양으로 저장된 패스도 옮긴 뒤 같은 답이 나오는지 (계산은 gacha-shop.js)
const passCharDay = (g) => passCharDate(g.paid.items.pass);
const passCharIn = (g) => passCharCounts(g.paid.items.pass, g.plan.date);

test("가챠 규칙 값: 1연 160 별소, 천장 80연, 평균 약 56연", () => {
  assert.equal(PULL_COST, 160);
  assert.equal(HARD_PITY, 80);
  assert.equal(AVG_PER_FIVE, 56);
});

test("연차 ↔ 별소: n연 = 별소 ÷ 160 (버림) + 뽑권", () => {
  assert.equal(astriteOf(10), 1600);
  assert.equal(astriteOf(-3), 0);
  assert.equal(pullsOf({ astrite: 16000, char: 0, weap: 0 }), 100);
  assert.equal(pullsOf({ astrite: 159, char: 0, weap: 0 }), 0, "160 이 안 되면 1연이 안 된다");
  assert.equal(pullsOf({ astrite: 16159, char: 3, weap: 2 }), 105);
});

test("빈칸은 0, 음수·글자는 받지 않는다", () => {
  assert.equal(count(""), 0);
  assert.equal(count("   "), 0);
  assert.equal(count(undefined), 0);
  assert.equal(count("-160"), 0);
  assert.equal(count("abc"), 0);
  assert.equal(count("12a"), 0);
  assert.equal(count("1.5"), 0);
  assert.equal(count("16,000"), 16000);
  assert.equal(count("0042"), 42);
  assert.equal(count("99999999999"), 9_999_999, "너무 큰 수는 막는다");
});

test("D-n: 폰 날짜(한국 시간) 기준으로 센다. 자정을 넘으면 하루 줄어든다", () => {
  const late = new Date(2026, 8, 30, 23, 59);
  const afterMidnight = new Date(2026, 9, 1, 0, 0);
  assert.equal(daysUntil("2026-10-14", late), 14);
  assert.equal(daysUntil("2026-10-14", afterMidnight), 13);
  assert.equal(daysUntil("2026-10-01", late), 1);
  assert.equal(daysUntil("2026-10-01", afterMidnight), 0);
  assert.equal(daysUntil("2026-09-29", late), -1);
  assert.equal(daysUntil("", late), null);
  assert.equal(daysUntil(undefined, late), null);
  assert.equal(daysUntil("2027-01-02", new Date(2026, 11, 31, 12)), 2, "해를 넘어도");
  assert.equal(dLabel(14), "D-14");
  assert.equal(dLabel(0), "D-day");
  assert.equal(dLabel(-1), "지났어");
});

test("저장 칸이 비었거나 옛 모양이어도 기본값으로 채워 연다", () => {
  assert.deepEqual(normalizeGacha(null), defaultGacha());
  const old = normalizeGacha({ have: { astrite: 500 }, plan: { date: "2026-10-14" } });
  assert.deepEqual(old.have, { astrite: 500, char: 0, weap: 0 });
  assert.equal(old.free.daily, 60);
  assert.equal(old.paid.items.pass.astrite, 680);
  assert.equal(old.plan.date, "2026-10-14");
});

test("재화 합계: 무과금만 / 과금 포함", () => {
  const g = normalizeGacha({
    have: { astrite: 16000, char: 3, weap: 1 },
    free: { daily: 60, astrite: 1000, char: 2, items: itemsOff },
    paid: { monthly: true, pass: true, passDate: "2026-09-20", topup: 500 },
    plan: { date: "2026-10-14" },
  });
  const r = income(g, 14);
  assert.deepEqual(r.free, { astrite: 60 * 14 + 1000, char: 2, weap: 0 });
  assert.deepEqual(r.freeOnly, { astrite: 16000 + 840 + 1000, char: 5, weap: 1 });
  assert.equal(pullsOf(r.freeOnly), 111 + 5 + 1); // 17840 ÷ 160 = 111.5 → 111
  assert.deepEqual(r.paid, { astrite: 90 * 14 + 680 + 500, char: 2, weap: 0 });
  assert.deepEqual(r.withPaid, { astrite: 17840 + 2440, char: 7, weap: 1 });
});

test("월정액은 최대 30일까지만, 끄면 0", () => {
  const g = normalizeGacha({ paid: { monthly: true } });
  assert.equal(income(g, 45).paid.astrite, 90 * 30);
  assert.equal(income(g, 10).paid.astrite, 90 * 10);
  assert.equal(income(normalizeGacha({}), 45).paid.astrite, 0);
});

test("날짜가 없거나 지났으면 앞으로 받을 것은 0 (지금 가진 것 + 직접 적은 것만)", () => {
  const g = normalizeGacha({ have: { astrite: 320 }, free: { astrite: 160 }, paid: { monthly: true } });
  for (const days of [null, -3, 0]) {
    const r = income(g, days);
    assert.equal(r.free.astrite, 160);
    assert.equal(r.paid.astrite, 0);
    assert.equal(pullsOf(r.withPaid), 3);
  }
});

test("유료 패스 캐릭뽑은 산 뒤 3주: 픽업 날(당일 포함)까지 받으면 넣고, 아니면 뺀다. 별소는 바로", () => {
  const at = (passDate, date) => normalizeGacha({ paid: { pass: true, passDate }, plan: { date } });
  assert.equal(passCharDay(at("2026-09-30", "")), "2026-10-21");
  assert.equal(passCharDay(at("2026-10-20", "")), "2026-11-10", "달을 넘어도");
  assert.equal(passCharIn(at("2026-09-30", "2026-10-21")), true, "딱 3주 되는 날 픽업이면 받는다");
  assert.equal(passCharIn(at("2026-09-30", "2026-10-20")), false, "하루 모자라면 안 받는다");
  assert.equal(passCharIn(at("", "2026-12-01")), false, "산 날을 모르면 안 넣는다");
  assert.equal(passCharIn(at("2026-09-30", "")), false, "픽업 날짜가 없으면 안 넣는다");
  assert.equal(passCharIn(normalizeGacha({ paid: { pass: false, passDate: "2026-09-01" }, plan: { date: "2026-12-01" } })), false, "끄면 안 넣는다");
  const early = income(at("2026-09-30", "2026-10-14"), 14).paid;
  assert.deepEqual([early.astrite, early.char], [680, 0], "10/14 픽업: 별소 680 만");
  const late = income(at("2026-09-30", "2026-10-28"), 28).paid;
  assert.deepEqual([late.astrite, late.char], [680, 2], "10/28 픽업: 캐릭뽑 2 도");
});

// ---------- v2.5 픽업 ----------
import { copiesNeeded, fiveStars, pullsFor, expectation, astriteNeeded, verdict, chainLabel, MAX_STACK } from "../js/gacha.js";

test("체인 → 데려올 장수: 없으면 체인 + 1, 가진 체인이 있으면 그만큼 빼고, 넘으면 0", () => {
  assert.equal(copiesNeeded(0, -1), 1, "명함 = 1장");
  assert.equal(copiesNeeded(2, -1), 3);
  assert.equal(copiesNeeded(6, -1), 7);
  assert.equal(copiesNeeded(2, 0), 2, "명함을 가졌으면 2체인까지 2장");
  assert.equal(copiesNeeded(6, 4), 2);
  assert.equal(copiesNeeded(1, 3), 0, "이미 넘었다");
  assert.deepEqual([-1, 0, 1, 6].map(chainLabel), ["없음", "명함", "1체인", "6체인"]);
});

test("픽뚫 안 당함 = 5성 n번, 당함 = 2n번, 확정이면 첫 장은 두 경우 모두 1번", () => {
  assert.deepEqual(fiveStars(1, false), { win: 1, lose: 2 });
  assert.deepEqual(fiveStars(3, false), { win: 3, lose: 6 });
  assert.deepEqual(fiveStars(1, true), { win: 1, lose: 1 });
  assert.deepEqual(fiveStars(3, true), { win: 3, lose: 5 });
  assert.deepEqual(fiveStars(0, true), { win: 0, lose: 0 });
});

test("스택은 첫 5성에만: 평균 max(56 − 스택, 1), 최악 80 − 스택", () => {
  assert.deepEqual(pullsFor(1, 0), { avg: 56, worst: 80 });
  assert.deepEqual(pullsFor(1, 70), { avg: 1, worst: 10 });
  assert.deepEqual(pullsFor(2, 70), { avg: 57, worst: 90 });
  assert.deepEqual(pullsFor(3, 30), { avg: 26 + 112, worst: 50 + 160 });
  assert.deepEqual(pullsFor(1, 79), { avg: 1, worst: 1 }, "79연째면 다음 한 번이 천장");
  assert.deepEqual(pullsFor(1, 200), { avg: 1, worst: 1 }, "79 넘게 적어도 79로 친다");
  assert.deepEqual(pullsFor(0, 30), { avg: 0, worst: 0 });
  assert.equal(MAX_STACK, 79);
});

test("전무: 무기 픽업은 늘 픽업 무기라 한 번, 최악 80 − 무기 스택", () => {
  const plan = { chain: 0, owned: -1, weapon: true, stack: 0, guaranteed: false, wStack: 45 };
  const e = expectation(plan);
  assert.deepEqual(e.win.weapon, { avg: 11, worst: 35 });
  assert.deepEqual(e.lose.weapon, { avg: 11, worst: 35 }, "무기는 픽뚫이 없어 두 경우가 같다");
  assert.equal(e.win.worst, 80 + 35);
  assert.equal(e.lose.worst, 160 + 35);
  assert.equal(expectation({ ...plan, weapon: false }).win.weapon.worst, 0);
});

test("예: 스택 70 · 확정 끔 · 명함 1장 → 안 당함 평균 1연·최악 10연, 당함 평균 57연·최악 90연", () => {
  const e = expectation({ chain: 0, owned: -1, weapon: false, stack: 70, guaranteed: false, wStack: 0 });
  assert.equal(e.copies, 1);
  assert.deepEqual([e.win.fives, e.win.avg, e.win.worst], [1, 1, 10]);
  assert.deepEqual([e.lose.fives, e.lose.avg, e.lose.worst], [2, 57, 90]);
  const funds = { astrite: 16000, char: 0, weap: 0 };
  assert.equal(astriteNeeded(e.lose, "worst", funds), 14400);
  assert.equal(verdict(e.win, funds).text, "최악이어도 확정");
  assert.equal(verdict(e.lose, funds).text, "최악이어도 확정");
});

test("필요 별소: 캐릭뽑은 캐릭 쪽에만, 무기뽑은 무기 쪽에만 쓰고 0 밑으로 안 간다", () => {
  const side = { char: { avg: 100, worst: 150 }, weapon: { avg: 20, worst: 40 } };
  assert.equal(astriteNeeded(side, "avg", { astrite: 0, char: 30, weap: 50 }), 70 * 160, "남는 무기뽑을 캐릭에 쓰지 않는다");
  assert.equal(astriteNeeded(side, "worst", { astrite: 0, char: 200, weap: 0 }), 40 * 160);
});

test("판정: 최악이어도 확정 / 평균이면 가능 / n연 부족 (평균까지)", () => {
  const e = expectation({ chain: 2, owned: -1, weapon: false, stack: 70, guaranteed: false, wStack: 0 });
  assert.deepEqual([e.win.avg, e.win.worst, e.lose.avg, e.lose.worst], [113, 170, 281, 410]);
  const funds = { astrite: 16000, char: 0, weap: 0 }; // 100연
  assert.deepEqual(verdict(e.win, funds), { key: "short", short: 13, text: "13연 부족" });
  assert.equal(verdict(e.lose, funds).text, "181연 부족");
  assert.equal(verdict(e.win, { astrite: 16000, char: 13, weap: 0 }).text, "평균이면 가능");
  assert.equal(verdict(e.win, { astrite: 170 * 160, char: 0, weap: 0 }).text, "최악이어도 확정");
  assert.equal(verdict(e.win, { astrite: 16001, char: 0, weap: 0 }).short, 13, "모자란 별소는 연으로 올림");
});
