import { test } from "node:test";
import assert from "node:assert/strict";
import { mealReport, workoutReport, words, reviewReport, hobbyReport, hobbyChanges } from "../js/weekly-report.js";
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

const START = {
  parties: [{ id: "p1", name: "파티 1", slots: ["1503", "1103", null] }, { id: "p2", name: "파티 2", slots: [null, null, null] }],
  builds: { 1503: { lv: 1 } },
  gear: { frames: [{ id: "inv", frame: "오락시아", primary: "쿠바 소백" }, { id: "cc", frame: "벤쉬" }], others: ["볼터", "패리스"] },
};
const END = {
  parties: [{ id: "p1", name: "파티 1", slots: ["1503", "1505", null] }, { id: "p3", name: "파티 3", slots: [null, null, null] }],
  builds: { 1503: { lv: 1, weapon: 1, skill: 1 }, 1505: { lv: 1 } },
  gear: { frames: [{ id: "inv", frame: "오락시아", primary: "쿠바 소벡" }, { id: "n", frame: "나린" }], others: ["볼터", "쏜바크"] },
};
const NAMES = { 1503: "벨리나", 1103: "설지", 1505: "파수인" };

test("취미 바뀐 것: 파티 추가·삭제·넣음·뺌, 새로 한 육성 체크, 워프레임 장비", () => {
  const c = hobbyChanges(START, END, (id) => NAMES[id]);
  assert.deepEqual(c.wuwa, ["파티 1: 파수인 넣음", "파티 1: 설지 뺌", "파티 추가: 파티 3", "파티 삭제: 파티 2",
    "벨리나: 무기 돌파 · 스킬작 완료", "파수인: 레벨 돌파 완료"]);
  assert.deepEqual(c.warframe, ["오락시아 장비 고침", "워프레임 추가: 나린", "워프레임 삭제: 벤쉬", "그 외 무기 추가: 쏜바크", "그 외 무기 삭제: 패리스"]);
});

test("취미: 체크를 다 한 날, 주간은 마지막 날 값, 주 처음 모습이 없으면 바뀐 것은 null", () => {
  const hobbyLog = { days: {
    "2026-09-28": { ww: [4, 4], wwWeek: [2, 6], wf: [2, 2] },
    "2026-09-29": { ww: [2, 4], wwWeek: [5, 6], wf: [1, 2] },
  } };
  const r = hobbyReport(hobbyLog, WEEK, null, END, (id) => id);
  assert.deepEqual([r.recorded, r.wwFullDays, r.wfFullDays], [2, 1, 1]);
  assert.deepEqual(r.wwWeekly, [5, 6]);
  assert.equal(r.changes, null);
  assert.ok(hobbyReport(hobbyLog, WEEK, START, END, (id) => id).changes.wuwa.length > 0);
});
