import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PULL_COST, HARD_PITY, AVG_PER_FIVE, defaultGacha, normalizeGacha, count, astriteOf, pullsOf, daysUntil, dLabel, income,
  passCharDay, passCharIn,
} from "../js/gacha.js";

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
  assert.equal(old.paid.passAstrite, 680);
  assert.equal(old.plan.date, "2026-10-14");
});

test("재화 합계: 무과금만 / 과금 포함", () => {
  const g = normalizeGacha({
    have: { astrite: 16000, char: 3, weap: 1 },
    free: { daily: 60, astrite: 1000, char: 2 },
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
  assert.equal(income(g, 45).monthlyDays, 30);
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
