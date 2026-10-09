import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  EXERCISES, ROUTINES, WEEK, planFor, planIds, doneSets, tapSet, progressOf, pruneLog, searchUrl, CARDIO_MINUTES, cardioMinutes, tapCardio,
} from "../js/workout.js";
import { workoutReport } from "../js/weekly-report.js";

const day = (d) => new Date(2026, 8, d); // 2026-09-21 월 ~ 27 일

test("일요일은 쉬고, 월·수·금 A(하체·등·허리), 화·목·토 B(가슴·어깨·복근)", () => {
  assert.deepEqual([21, 22, 23, 24, 25, 26, 27].map((d) => planFor(day(d)).key),
    ["A", "B", "A", "B", "A", "B", null]);
  assert.equal(planFor(day(27)).label, "쉬는 날");
  assert.deepEqual(planFor(day(27)).groups, []);
  assert.equal(WEEK.length, 7);
});

test("영상의 근력 운동 8가지가 A·B 에 빠짐없이 한 번씩, 준비·마무리는 매일", () => {
  const all = [...ROUTINES.A.main, ...ROUTINES.B.main].sort();
  assert.deepEqual(all, ["backext", "chest", "crunch", "latpull", "legpress", "pecdeck", "row", "shoulder"]);
  for (const d of [21, 22]) {
    const p = planFor(day(d));
    assert.deepEqual(p.groups.map((g) => g.title), ["준비", "근력", "마무리"]);
    assert.deepEqual(planIds(p).slice(0, 2), ["walk", "roll"]);
    assert.equal(planIds(p).at(-1), "cardio");
  }
});

test("세트·횟수는 영상 화면 자막 그대로", () => {
  for (const id of ["legpress", "latpull", "row", "chest", "shoulder"]) {
    assert.equal(EXERCISES[id].amount, "15개 × 3~5세트");
    assert.deepEqual([EXERCISES[id].sets, EXERCISES[id].maxSets], [3, 5]);
  }
  assert.equal(EXERCISES.pecdeck.amount, "15개 × 3세트");
  assert.equal(EXERCISES.backext.amount, "10~15개 × 3세트");
  assert.equal(EXERCISES.crunch.amount, "20개 이상 × 3세트");
});

test("운동마다 설명, 사진 파일, 유튜브 검색 링크가 있다", () => {
  for (const [id, ex] of Object.entries(EXERCISES)) {
    assert.ok(ex.tips.length >= 2, id);
    assert.ok(existsSync(new URL(`../images/exercise/${ex.img}.jpg`, import.meta.url)), `${id} 사진`);
    assert.match(searchUrl(id), /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  }
  assert.ok(searchUrl("legpress").includes(encodeURIComponent("시티드 레그프레스")));
});

test("세트 칸 누르기: n번째를 누르면 n세트까지, 같은 칸을 다시 누르면 한 칸 되돌림", () => {
  const d = "2026-09-25";
  let log = tapSet({}, d, "legpress", 2);
  assert.equal(doneSets(log, d, "legpress"), 2);
  log = tapSet(log, d, "legpress", 2);
  assert.equal(doneSets(log, d, "legpress"), 1);
  log = tapSet(log, d, "legpress", 5); // 3~5세트 운동은 5세트까지
  assert.equal(doneSets(log, d, "legpress"), 5);
  log = tapSet(log, d, "pecdeck", 9); // 3세트 운동은 3이 끝
  assert.equal(doneSets(log, d, "pecdeck"), 3);
  assert.equal(doneSets(log, "2026-09-24", "legpress"), 0); // 다른 날은 따로
});

test("오늘 진행률은 기본 세트 기준, 더 한 세트로 100% 를 넘지 않는다", () => {
  const d = "2026-09-25";
  const plan = planFor(day(25)); // A: 걷기1 + 폼롤러1 + 4×3 + 유산소1 = 15
  let log = {};
  assert.deepEqual(progressOf(log, d, plan), { done: 0, total: 15, pct: 0 });
  log = tapSet(log, d, "walk", 1);
  log = tapSet(log, d, "legpress", 5);
  assert.deepEqual(progressOf(log, d, plan), { done: 4, total: 15, pct: 27 });
  assert.deepEqual(progressOf({}, d, planFor(day(27))), { done: 0, total: 0, pct: 0 });
});

test("60일 넘은 기록은 정리한다", () => {
  const log = { "2026-07-01": { walk: 1 }, "2026-07-27": { walk: 1 }, "2026-09-25": { walk: 1 } };
  assert.deepEqual(Object.keys(pruneLog(log, day(25))), ["2026-07-27", "2026-09-25"]);
});

// ---------- v3.1 유산소 몇 분 달렸는지 ----------
test("v3.1 유산소 분 칩은 은월이 고른 여섯 개: 12 · 15 · 17 · 22 · 27 · 30", () => {
  assert.deepEqual(CARDIO_MINUTES, [12, 15, 17, 22, 27, 30]);
});

test("v3.1 분 칩을 누르면 분이 적히고 유산소를 한 것으로, 같은 칩을 다시 누르면 지워지고 안 한 것으로", () => {
  const d = "2026-09-25";
  const plan = planFor(day(25));
  let s = tapCardio({}, {}, d, 22);
  assert.equal(cardioMinutes(s.mins, d), 22);
  assert.equal(doneSets(s.log, d, "cardio"), 1);
  assert.equal(progressOf(s.log, d, plan).done, 1, "분을 적으면 오늘 진행률에도 한 세트로");
  s = tapCardio(s.log, s.mins, d, 30); // 다른 칩으로 바꾸기
  assert.equal(cardioMinutes(s.mins, d), 30);
  assert.equal(doneSets(s.log, d, "cardio"), 1);
  s = tapCardio(s.log, s.mins, d, 30); // 같은 칩 다시
  assert.equal(cardioMinutes(s.mins, d), null);
  assert.deepEqual(s.mins, {}, "지운 날은 칸에서 사라진다");
  assert.equal(doneSets(s.log, d, "cardio"), 0);
  assert.equal(progressOf(s.log, d, plan).done, 0);
});

test("v3.1 다른 운동 기록 · 다른 날의 분은 건드리지 않고, 목록에 없는 분은 무시한다", () => {
  const d = "2026-09-25";
  const log = { [d]: { legpress: 3 }, "2026-09-24": { cardio: 1 } };
  const mins = { "2026-09-23": 15 };
  const s = tapCardio(log, mins, d, 12);
  assert.deepEqual(s.log, { [d]: { legpress: 3, cardio: 1 }, "2026-09-24": { cardio: 1 } });
  assert.deepEqual(s.mins, { "2026-09-23": 15, [d]: 12 });
  assert.deepEqual(log, { [d]: { legpress: 3 }, "2026-09-24": { cardio: 1 } }, "받은 값은 안 바꾼다");
  for (const bad of [0, 1, 31, 120, -5, NaN]) {
    const same = tapCardio(log, mins, d, bad);
    assert.equal(same.log, log, `${bad}분`);
    assert.equal(same.mins, mins, `${bad}분`);
  }
});

test("v3.1 옛 기록 (분 없이 한 것으로만 있는 날): 한 것은 그대로, 분은 없음. 칩을 누르면 분이 붙는다", () => {
  const d = "2026-09-25";
  const old = { [d]: { cardio: 1 } };
  assert.equal(cardioMinutes({}, d), null);
  assert.equal(doneSets(old, d, "cardio"), 1);
  const s = tapCardio(old, {}, d, 17);
  assert.equal(doneSets(s.log, d, "cardio"), 1);
  assert.equal(cardioMinutes(s.mins, d), 17);
});

test("v3.1 분 기록도 60일 넘으면 정리하고, 주간리뷰 운동 숫자는 분 때문에 바뀌지 않는다", () => {
  assert.deepEqual(Object.keys(pruneLog({ "2026-07-01": 30, "2026-09-25": 12 }, day(25))), ["2026-09-25"]);
  const d = "2026-09-25";
  const before = workoutReport({ [d]: { cardio: 1 } }, [d]);
  const s = tapCardio({}, {}, d, 30);
  assert.deepEqual(workoutReport(s.log, [d]), before, "30분이 30세트로 세어지지 않는다");
  assert.equal(before.avgSets, 1);
});
