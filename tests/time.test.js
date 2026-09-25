import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting, dateLabel } from "../js/time.js";

test("인사말은 시간대 경계에서 바뀐다", () => {
  assert.equal(greeting(0), "편안한 밤");
  assert.equal(greeting(4), "편안한 밤");
  assert.equal(greeting(5), "좋은 아침");
  assert.equal(greeting(11), "좋은 아침");
  assert.equal(greeting(12), "좋은 오후");
  assert.equal(greeting(17), "좋은 오후");
  assert.equal(greeting(18), "좋은 저녁");
  assert.equal(greeting(23), "좋은 저녁");
});

test("날짜 글자는 요일, 월, 일 순서다", () => {
  assert.equal(dateLabel(new Date(2026, 8, 25)), "금요일, 9월 25일");
  assert.equal(dateLabel(new Date(2026, 8, 27)), "일요일, 9월 27일");
});
