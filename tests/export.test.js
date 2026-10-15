import { test } from "node:test";
import assert from "node:assert/strict";
import { makeExport, exportFileName, exportSummary, KEYS } from "../js/export.js";
import { QUESTIONS, WEEK_QUESTIONS } from "../js/review.js";

function fakeStorage(entries = {}) {
  const m = new Map(Object.entries(entries));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
  };
}
const AT = new Date(2026, 9, 15, 21, 0);

test("내보내기: 회고 · 일정표 · 운동만 담고 다른 칸은 안 담는다", () => {
  const sched = { workdays: [true, true, true, true, true, true, false], dayShifts: { 1: "open" } };
  const s = fakeStorage({
    "ld:reviews": JSON.stringify({ "2026-10-14": { answers: ["a", "b", "c", "d"] }, "2026-10-02": { answers: ["1", "", "", ""] } }),
    "ld:weekReviews": JSON.stringify({ "2026-10-05": { answers: ["w", "", "", ""] } }),
    "ld:schedule": JSON.stringify(sched),
    "ld:workoutLog": JSON.stringify({ "2026-10-13": { legpress: 3 } }),
    "ld:cardioMin": JSON.stringify({ "2026-10-13": 22 }),
    "ld:budget": JSON.stringify({ 비밀: 1 }),
    "ld:calUrl": JSON.stringify("https://example.com/secret"),
    "ld:memo": JSON.stringify({ text: "메모" }),
  });
  const e = makeExport({ storage: s, appVersion: "v3.5 · 10월 15일", at: AT });
  assert.equal(e.kind, "life-dashboard-export");
  assert.deepEqual(Object.keys(e.reviews.daily), ["2026-10-02", "2026-10-14"]); // 날짜 순서
  assert.deepEqual(e.reviews.daily["2026-10-14"].answers, ["a", "b", "c", "d"]);
  assert.deepEqual(e.reviews.weekly["2026-10-05"].answers[0], "w");
  assert.deepEqual(e.reviews.questions, QUESTIONS);
  assert.deepEqual(e.reviews.weekQuestions, WEEK_QUESTIONS);
  assert.deepEqual(e.schedule, sched);
  assert.deepEqual(e.workout, { log: { "2026-10-13": { legpress: 3 } }, cardioMin: { "2026-10-13": 22 } });
  assert.deepEqual(e.counts, { reviews: 2, weekReviews: 1, workoutDays: 1, cardioDays: 1 });
  const text = JSON.stringify(e);
  for (const no of ["비밀", "secret", "메모"]) assert.ok(!text.includes(no), `${no} 가 들어가면 안 된다`);
  assert.deepEqual(KEYS, ["reviews", "weekReviews", "schedule", "workoutLog", "cardioMin"]);
});

test("내보내기: 빈 폰 · 깨진 칸이어도 파일은 만든다", () => {
  const e = makeExport({ storage: fakeStorage({ "ld:reviews": "{깨짐" }), appVersion: "v3.5", at: AT });
  assert.deepEqual(e.reviews.daily, {});
  assert.equal(e.schedule, null);
  assert.deepEqual(e.workout, { log: {}, cardioMin: {} });
  assert.equal(exportSummary(e), "회고 0일 · 주간회고 0주 · 운동 0일");
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(e)));
});

test("내보내기 파일 이름", () => {
  const e = makeExport({ storage: fakeStorage(), appVersion: "v3.5 · 10월 15일", at: AT });
  assert.equal(exportFileName(e), "life-dashboard-export-v3.5-20261015.json");
});
