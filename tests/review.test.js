import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUESTIONS, reviewDay, answeredCount, statusLabel, pastDays, mondayKey,
  weekDays, shiftWeek, dayLabel, weekLabel, withAnswer,
} from "../js/review.js";

test("Notion 의 4가지 질문 그대로다", () => {
  assert.deepEqual(QUESTIONS, [
    "오늘 잘 되었던 일은?", "오늘 안 되었던 일은?", "오늘 배운 것은?", "내일 처음으로 할 일은?",
  ]);
});

test("새벽(06시 전)에 쓰면 어제 회고, 06시부터는 오늘 회고", () => {
  assert.equal(reviewDay(new Date(2026, 8, 25, 22, 40)), "2026-09-25");
  assert.equal(reviewDay(new Date(2026, 8, 26, 1, 10)), "2026-09-25");
  assert.equal(reviewDay(new Date(2026, 8, 26, 5, 59)), "2026-09-25");
  assert.equal(reviewDay(new Date(2026, 8, 26, 6, 0)), "2026-09-26");
  assert.equal(reviewDay(new Date(2026, 9, 1, 2, 0)), "2026-09-30"); // 달이 바뀌어도
});

test("상태: 안 씀 / 쓰는 중 / 다 씀 (공백만 있으면 안 쓴 것)", () => {
  assert.equal(statusLabel(undefined), "아직 안 썼어");
  assert.equal(statusLabel({ answers: ["  ", "", "", ""] }), "아직 안 썼어");
  assert.equal(statusLabel({ answers: ["좋았어", "", "", ""] }), "쓰는 중");
  assert.equal(statusLabel({ answers: ["a", "b", "c", "d"] }), "다 썼어");
  assert.equal(answeredCount({ answers: ["a", "", "c", ""] }), 2);
});

test("지난 회고는 최근 날부터, 빈 날은 빼고", () => {
  const r = {
    "2026-09-20": { answers: ["a", "", "", ""] },
    "2026-09-25": { answers: ["b", "", "", ""] },
    "2026-09-22": { answers: ["", "", "", ""] },
  };
  assert.deepEqual(pastDays(r), ["2026-09-25", "2026-09-20"]);
});

test("주는 월요일부터 일요일까지", () => {
  assert.equal(mondayKey("2026-09-25"), "2026-09-21");
  assert.equal(mondayKey("2026-09-27"), "2026-09-21"); // 일요일
  assert.equal(mondayKey("2026-09-28"), "2026-09-28");
  assert.deepEqual(weekDays("2026-09-28"), [
    "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
  ]);
  assert.equal(shiftWeek("2026-09-21", -1), "2026-09-14");
  assert.equal(shiftWeek("2026-09-21", 1), "2026-09-28");
});

test("날짜 글자", () => {
  assert.equal(dayLabel("2026-09-25"), "9월 25일 (금)");
  assert.equal(weekLabel("2026-09-21"), "9월 21일 – 27일");
  assert.equal(weekLabel("2026-09-28"), "9월 28일 – 10월 4일");
});

test("답을 쓰면 그 칸만 바뀌고, 다 지우면 그 날 기록이 사라진다", () => {
  let r = withAnswer({}, "2026-09-25", 2, "API 쓰는 법");
  assert.deepEqual(r["2026-09-25"].answers, ["", "", "API 쓰는 법", ""]);
  r = withAnswer(r, "2026-09-25", 0, "운동함");
  assert.deepEqual(r["2026-09-25"].answers, ["운동함", "", "API 쓰는 법", ""]);
  r = withAnswer(withAnswer(r, "2026-09-25", 0, ""), "2026-09-25", 2, " ");
  assert.equal("2026-09-25" in r, false);
});

test("원래 기록은 건드리지 않는다", () => {
  const before = { "2026-09-25": { answers: ["a", "", "", ""] } };
  withAnswer(before, "2026-09-25", 1, "b");
  assert.deepEqual(before["2026-09-25"].answers, ["a", "", "", ""]);
});
