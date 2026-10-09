import { test } from "node:test";
import assert from "node:assert/strict";
import { mealReport, workoutReport, words, reviewReport } from "../js/weekly-report.js";
import { weekDays } from "../js/review.js";

const WEEK = weekDays("2026-09-28"); // 월 9/28 ~ 일 10/4

test("식단: 많이 먹은 순서 (남은 짜글이는 짜글이로), 단백질, 안 먹음은 따로", () => {
  const log = {
    "2026-09-28": [{ label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "jja" }],
    "2026-09-29": [{ label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "jja-left" }],
    "2026-09-30": [{ label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "skip" }],
  };
  const r = mealReport(log, WEEK);
  assert.deepEqual(r.top.map((x) => `${x.name} ${x.n}`), ["닭가슴살 + 햇반 3", "짜글이 2"]);
  assert.equal(r.skip, 1);
  assert.equal(r.recorded, 3);
  assert.deepEqual(r.protein, { meals: 5, hit: 5, grams: 29 * 3 + 25 * 2 });
});

test("운동: 운동한 날 / 운동하는 날(일요일 빼고), 운동한 날 하루 평균 세트, 기본 세트 달성률", () => {
  const log = {
    "2026-09-28": { walk: 1, roll: 1, legpress: 3, latpull: 3, row: 3, backext: 3, cardio: 1 }, // 월 A 다 함 (15)
    "2026-09-29": { walk: 1, chest: 5 },                                                       // 화 B 조금 (6)
  };
  const r = workoutReport(log, WEEK);
  assert.equal(r.planned, 6);
  assert.equal(r.worked, 2);
  assert.equal(r.avgSets, Math.round((15 + 6) / 2));
  // 기본 세트: 하루 15세트 × 6일 = 90 중 월 15 + 화(걷기 1 + 체스트 3 까지만) 4 = 19
  assert.equal(r.pct, Math.round((19 / 90) * 100));
  assert.equal(workoutReport({}, ["2026-10-04"]).planned, 0); // 일요일만이면 운동하는 날 없음
});

test("낱말 모으기: 조사를 떼고, 짧거나 뜻이 적은 낱말은 뺀다", () => {
  assert.deepEqual([...words("운동을 다 했다. 오늘은 일찍 잠. 모딩도 했음")], ["운동", "일찍", "모딩"]);
  assert.deepEqual([...words("PT에서 스쿼트")], ["PT", "스쿼트"]);
});

test("회고: 질문별로 한 주 답을 모으고, 두 날 넘게 나온 낱말을 자주 나온 것으로", () => {
  const reviews = {
    "2026-09-28": { answers: ["운동 다 함", "늦잠", "", "장보기"] },
    "2026-09-29": { answers: ["운동을 했다 운동", "늦잠 잤다", "모딩 순서", ""] },
    "2026-09-30": { answers: ["일찍 잠", "", "", ""] },
    "2026-10-05": { answers: ["다음 주라 빠짐", "", "", ""] },
  };
  const r = reviewReport(reviews, WEEK);
  assert.equal(r.written, 3);
  assert.deepEqual(r.byQuestion[0].answers.map((a) => a.day), ["2026-09-28", "2026-09-29", "2026-09-30"]);
  assert.deepEqual(r.byQuestion[0].frequent, [{ word: "운동", n: 2 }]); // 같은 날 두 번은 한 번으로
  assert.deepEqual(r.byQuestion[1].frequent, [{ word: "늦잠", n: 2 }]);
  assert.deepEqual(r.byQuestion[2].frequent, []);
  assert.equal(r.byQuestion[2].answers.length, 1);
});

test("핫픽스 v3.0.3: 보고서 계산은 식단 · 운동 · 회고 세 가지뿐이다 (취미 카드 계산은 지움, 취미 기록은 hobby-log 에 그대로)", async () => {
  const report = await import("../js/weekly-report.js");
  assert.deepEqual(Object.keys(report).sort(), ["mealReport", "reviewReport", "words", "workoutReport"]);
});
