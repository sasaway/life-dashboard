import { test } from "node:test";
import assert from "node:assert/strict";
import { isMorning, todayState, markSeen, setFolded, seenCount, briefLines, LINKS } from "../js/briefing.js";
import { DEFAULT_SETTINGS, dayPlan } from "../js/schedule.js";
import { planFor } from "../js/workout.js";

const at = (d, h, m = 0) => new Date(2026, 8, d, h, m); // 2026-09-21 월 ~ 27 일

test("아침(05~12시)에만 보인다", () => {
  assert.deepEqual([4, 5, 9, 11, 12, 23].map((h) => isMorning(at(26, h))), [false, true, true, true, false, false]);
  assert.equal(isMorning(at(26, 11, 59)), true);
});

test("봤는지 표시와 접힘은 오늘만 기억하고, 다음 날 처음으로 돌아간다", () => {
  let s = todayState(null, at(26, 7));
  assert.deepEqual(s, { day: "2026-09-26", seen: {}, folded: false });
  s = setFolded(markSeen(s, "mail"), true);
  assert.equal(seenCount(s), 1);
  assert.equal(todayState(s, at(26, 11)).folded, true);
  assert.deepEqual(todayState(s, at(27, 6)), { day: "2026-09-27", seen: {}, folded: false });
  assert.equal(seenCount(markSeen(markSeen(s, "mail"), "cal")), LINKS.length);
});

test("메일·캘린더는 앱 주소와, 앱이 없을 때 열 웹 주소가 있다", () => {
  for (const l of LINKS) {
    assert.match(l.app, /^google\w+:\/\/$/);
    assert.match(l.web, /^https:\/\/\w+\.google\.com\/$/);
  }
});

const meals = { meals: [{ label: "저녁", dish: { short: "짜글이" } }], work: "점심" };
const zero = { done: 0, total: 4 };

test("일하는 날: 알바 시간·식단·운동·취미 네 줄", () => {
  const d = at(21, 7); // 월요일, 기준 주
  const plan = dayPlan(d, { ...DEFAULT_SETTINGS, anchorMonday: "2026-09-21", anchorShift: "open" });
  const lines = briefLines({ plan, meals, gym: planFor(d), ww: zero, wf: { done: 1, total: 2 } });
  assert.deepEqual(lines.map((l) => l.label), ["알바", "식단", "운동", "취미"]);
  assert.deepEqual(lines[0], { label: "알바", time: "08:30–15:30", text: "오픈반" });
  assert.equal(lines[1].text, "저녁 짜글이 · 점심은 알바 식대");
  assert.equal(lines[2].time, "15:30–17:30");
  assert.equal(lines[3].time, "19:00–21:00");
  assert.equal(lines[3].text, "명조 0/4 · 워프레임 1/2");
});

test("일요일: 운동은 쉬는 날, 끼니가 없으면 그렇다고 쓴다", () => {
  const d = at(27, 7);
  const plan = dayPlan(d, { ...DEFAULT_SETTINGS, anchorMonday: "2026-09-21", anchorShift: "open" });
  const lines = briefLines({ plan, meals: { meals: [], work: null }, gym: planFor(d), ww: zero, wf: zero });
  assert.equal(lines[2].text, "쉬는 날");
  assert.equal(lines[2].time, "");
  assert.equal(lines[1].text, "정해진 끼니 없음");
  if (!plan.working) assert.deepEqual(lines[0], { label: "알바", time: "", text: "쉬는 날" });
});
