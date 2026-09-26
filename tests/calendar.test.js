import { test } from "node:test";
import assert from "node:assert/strict";
import { isHelperUrl, readReply, shiftCount } from "../js/calendar.js";
import { DEFAULT_SETTINGS, calShift, dayPlan } from "../js/schedule.js";
import { planWeek } from "../js/meals.js";

const at = (m, d) => new Date(2026, m - 1, d, 7);
// 예시 주: 월~수 오픈반, 목~일 마감반 (주 중간에 반이 바뀜 — 지어낸 날짜)
const reply = {
  ok: true, from: "2026-11-07", to: "2026-12-19",
  shifts: { "2026-11-16": "open", "2026-11-17": "open", "2026-11-18": "open", "2026-11-19": "close", "2026-11-20": "close", "2026-11-21": "close", "2026-11-22": "close" },
};

test("심부름꾼 주소는 script.google.com/macros/s/…/exec 만 받는다", () => {
  assert.equal(isHelperUrl("https://script.google.com/macros/s/AKfycbx_ab-12/exec"), true);
  assert.equal(isHelperUrl("  https://script.google.com/macros/u/1/s/AKfy/exec "), true);
  assert.equal(isHelperUrl("https://script.google.com/macros/s/AKfy/dev"), false);
  assert.equal(isHelperUrl("http://script.google.com/macros/s/AKfy/exec"), false);
  assert.equal(isHelperUrl("https://evil.example/macros/s/AKfy/exec"), false);
});

test("답 확인: 알바 날·마지막 날을 남기고, 이상한 값은 버린다", () => {
  const { cal } = readReply({ ...reply, shifts: { ...reply.shifts, "2026-11-27": "night", "어제": "open" } }, 123);
  assert.equal(shiftCount(cal), 7);
  assert.deepEqual([cal.from, cal.until, cal.at], ["2026-11-07", "2026-11-22", 123]);
  assert.match(readReply({ ok: false, error: "no-calendar" }).error, /개인 일정/);
  assert.ok(readReply(null).error);
  assert.ok(readReply({ ok: true, from: "x", shifts: {} }).error);
  assert.equal(readReply({ ok: true, from: "2026-11-07", shifts: {} }).cal.until, null);
});

test("그 날의 반: 캘린더에 있으면 그대로, 받은 기간 안에 없으면 쉬는 날, 밖이면 모름", () => {
  const { cal } = readReply(reply);
  assert.equal(calShift(at(11, 18), cal), "open");
  assert.equal(calShift(at(11, 19), cal), "close");
  assert.equal(calShift(at(11, 15), cal), "off"); // 첫 출근 전날
  assert.equal(calShift(at(11, 23), cal), null);  // 아직 안 적은 날 → 격주 규칙
  assert.equal(calShift(at(11, 19), undefined), null);
  assert.equal(calShift(at(11, 19), { from: "2026-11-07", until: null, shifts: {} }), null);
});

test("주 중간에 반이 바뀌어도 하루하루 일과표·식단이 따라간다", () => {
  const { cal } = readReply(reply);
  const set = { ...DEFAULT_SETTINGS, cal };
  const wed = dayPlan(at(11, 18), set), thu = dayPlan(at(11, 19), set);
  assert.deepEqual([wed.shift, wed.working, wed.fromCal], ["open", true, true]);
  assert.deepEqual([thu.shift, thu.working, thu.fromCal], ["close", true, true]);
  assert.equal(thu.blocks.find((b) => b.kind === "work").start, "15:00");
  const sun = dayPlan(at(11, 15), set);
  assert.equal(sun.working, false);
  assert.equal(sun.blocks.some((b) => b.kind === "work"), false);
  // 캘린더 밖은 예전 그대로
  assert.deepEqual(dayPlan(at(11, 24), set), { ...dayPlan(at(11, 24), DEFAULT_SETTINGS), fromCal: false });

  const week = planWeek(new Date(2026, 10, 16), set, {});
  assert.deepEqual(week.map((d) => d.work), ["점심", "점심", "점심", "저녁", "저녁", "저녁", "저녁"]);
  assert.deepEqual(week.map((d) => d.meals.map((m) => m.label).join()), ["저녁", "저녁", "저녁", "점심", "점심", "점심", "점심"]);
});
