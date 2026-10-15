import { test } from "node:test";
import assert from "node:assert/strict";
import { makeExport, exportFileName, exportSummary, KEYS, routineOf, exercisesOf, daysOf } from "../js/export.js";
import { EXERCISES, ROUTINES } from "../js/workout.js";
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
  assert.deepEqual(e.workout.log, { "2026-10-13": { legpress: 3 } });
  assert.deepEqual(e.workout.cardioMin, { "2026-10-13": 22 });
  assert.deepEqual(e.counts, { reviews: 2, weekReviews: 1, workoutDays: 1, cardioDays: 1, images: 0 });
  const text = JSON.stringify(e);
  for (const no of ["비밀", "secret", "메모"]) assert.ok(!text.includes(no), `${no} 가 들어가면 안 된다`);
  assert.deepEqual(KEYS, ["reviews", "weekReviews", "schedule", "workoutLog", "cardioMin"]);
});

test("내보내기: 빈 폰 · 깨진 칸이어도 파일은 만든다", () => {
  const e = makeExport({ storage: fakeStorage({ "ld:reviews": "{깨짐" }), appVersion: "v3.5", at: AT });
  assert.deepEqual(e.reviews.daily, {});
  assert.equal(e.schedule, null);
  assert.deepEqual(e.workout.log, {});
  assert.deepEqual(e.workout.days, []);
  assert.equal(exportSummary(e), "회고 0일 · 주간회고 0주 · 운동 0일");
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(e)));
});

test("내보내기 파일 이름", () => {
  const e = makeExport({ storage: fakeStorage(), appVersion: "v3.5 · 10월 15일", at: AT });
  assert.equal(exportFileName(e), "life-dashboard-export-v3.5-20261015.json");
});

test("내보내기 운동: 요일별 루틴 (일요일 쉼, 월 A · 화 B 번갈아) · 루틴마다 준비 → 근력 → 마무리", () => {
  const r = routineOf();
  assert.deepEqual(r.week.map((w) => `${w.day}${w.routine ?? "-"}`), ["일-", "월A", "화B", "수A", "목B", "금A", "토B"]);
  for (const key of ["A", "B"]) {
    assert.equal(r.routines[key].label, ROUTINES[key].label);
    assert.deepEqual(r.routines[key].groups.map((g) => g.title), ["준비", "근력", "마무리"]);
    assert.deepEqual(r.routines[key].groups[1].exercises, ROUTINES[key].main);
  }
  assert.match(r.video, /youtube/);
});

test("내보내기 운동: 운동마다 설명 · 팁 · 사진 (사진은 받은 것만 글자로, 못 받으면 빈칸)", () => {
  const ex = exercisesOf({ legpress: { type: "image/jpeg", data: "AAAA" } });
  assert.deepEqual(Object.keys(ex), Object.keys(EXERCISES));
  assert.equal(ex.legpress.name, "시티드 레그프레스");
  assert.deepEqual(ex.legpress.tips, EXERCISES.legpress.tips);
  assert.equal(ex.legpress.amount, EXERCISES.legpress.amount);
  assert.deepEqual(ex.legpress.image, { file: "images/exercise/legpress.jpg", type: "image/jpeg", data: "AAAA" });
  assert.deepEqual(ex.chest.image, { file: "images/exercise/chest.jpg", type: null, data: null });
  const e = makeExport({ storage: fakeStorage(), appVersion: "v3.5", images: { legpress: { type: "image/jpeg", data: "AAAA" } }, at: AT });
  assert.equal(e.counts.images, 1);
  assert.equal(e.workout.exercises.legpress.image.data, "AAAA");
});

test("내보내기 운동: 날마다 그 날 루틴 · 운동마다 한 세트 / 기본 세트 · 유산소 분", () => {
  // 2026-10-13 은 화요일(B), 10-12 는 월요일(A) — 유산소만 적은 날도 나온다
  const days = daysOf({ "2026-10-13": { chest: 2, cardio: 1 } }, { "2026-10-13": 22, "2026-10-12": 15 });
  assert.deepEqual(days.map((d) => [d.date, d.weekday, d.routine]), [["2026-10-12", "월", "A"], ["2026-10-13", "화", "B"]]);
  const tue = days[1];
  assert.equal(tue.label, ROUTINES.B.label);
  assert.deepEqual(tue.exercises.find((x) => x.id === "chest"), { id: "chest", name: "체스트 프레스", done: 2, sets: 3 });
  assert.equal(tue.exercises.find((x) => x.id === "shoulder").done, 0);
  assert.equal(tue.cardioMin, 22);
  assert.equal(days[0].exercises.find((x) => x.id === "legpress").done, 0);
});
