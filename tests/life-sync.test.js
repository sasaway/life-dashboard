import { test } from "node:test";
import assert from "node:assert/strict";
import { recentDays, dayRow, mealRows, workoutRows, hobbyRows, reviewRows, lifeSnapshot, SYNC_DAYS } from "../js/life-sync.js";
import { DEFAULT_SETTINGS } from "../js/schedule.js";

// 2026-09-21 주 = 마감반, 09-28 주 = 오픈반 (기본 격주). 알바는 매일
const settings = DEFAULT_SETTINGS;
const empty = { settings, workoutLog: {}, mealLog: {}, reviews: {}, weekReviews: {}, hobbyLog: {}, todos: [] };
const at = (y, m, d, h = 20, min = 0) => new Date(y, m - 1, d, h, min);

test("보낼 날: 오늘부터 14일, 최근 날이 먼저", () => {
  const days = recentDays(at(2026, 10, 3));
  assert.equal(days.length, SYNC_DAYS);
  assert.equal(days[0], "2026-10-03");
  assert.equal(days[1], "2026-10-02");
  assert.equal(days[13], "2026-09-20", "달을 넘어도");
});

test("새벽 경계: 06시 전은 아직 어제 (회고와 같은 하루)", () => {
  assert.equal(recentDays(at(2026, 10, 3, 2, 0))[0], "2026-10-02");
  assert.equal(recentDays(at(2026, 10, 3, 5, 59))[0], "2026-10-02");
  assert.equal(recentDays(at(2026, 10, 3, 6, 0))[0], "2026-10-03");
  assert.equal(lifeSnapshot(empty, at(2026, 10, 1, 1, 30)).today[0][0], "2026-09-30");
});

test("오늘 요약 · 오픈반 날: 반, 운동(근력 / 준비·마무리 따로), 끼니, 단백질, 회고, 취미, 남은 할 일", () => {
  const day = "2026-10-01"; // 목요일 · 오픈반 주 · 운동 B
  const data = {
    settings,
    workoutLog: { [day]: { walk: 1, cardio: 1, chest: 3, shoulder: 5, pecdeck: 1 } },
    mealLog: { [day]: [{ label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "rice" }] },
    reviews: { [day]: { answers: ["잘 됨", "", "배움", "  "] } },
    weekReviews: {},
    hobbyLog: { days: { [day]: { ww: [3, 4], wwWeek: [5, 6], wf: [2, 2] } } },
    todos: [{ id: "a", text: "x", done: null }, { id: "b", text: "y", done: "2026-10-01" }, { id: "c", text: "z", done: null }],
  };
  assert.deepEqual(dayRow(day, data), [
    "2026-10-01", "목", "오픈반", "가슴 · 어깨 · 복근", "7/12", "2/3",
    "저녁 계란 볶음밥", "점심 닭가슴살 + 햇반", "47", "1/2", "2/4", "3/4", "5/6", "2/2", "2",
  ]);
});

test("마감반 날 · 쉬는 날 · 일요일", () => {
  const close = dayRow("2026-09-24", empty); // 목요일 · 마감반 주
  assert.deepEqual(close.slice(1, 4), ["목", "마감반", "가슴 · 어깨 · 복근"]);
  // 캘린더에서 받은 기간 안인데 알바가 없는 날 = 쉬는 날
  const cal = { from: "2026-09-28", until: "2026-10-04", shifts: { "2026-09-28": "open" } };
  const off = dayRow("2026-09-30", { ...empty, settings: { ...settings, cal } });
  assert.equal(off[2], "쉬는 날");
  assert.equal(off[3], "하체 · 등 · 허리", "쉬는 날에도 운동은 한다");
  const sun = dayRow("2026-10-04", empty);
  assert.deepEqual(sun.slice(1, 6), ["일", "오픈반", "쉬는 날", "", ""], "일요일은 운동을 쉰다 → 세트 칸은 빈칸");
});

test("빈 기록: 숫자 칸은 0, 기록이 없는 칸은 빈칸 · 다른 탭은 줄이 없다", () => {
  const snap = lifeSnapshot(empty, at(2026, 10, 3));
  assert.deepEqual(snap.today, [["2026-10-03", "토", "오픈반", "가슴 · 어깨 · 복근", "0/12", "0/3", "", "", "", "", "0/4", "", "", "", "0"]]);
  assert.equal(snap.recent.length, 14);
  assert.deepEqual(snap.recent[0], snap.today[0]);
  assert.equal(snap.recent[1][14], "", "남은 할 일은 오늘 줄에만");
  assert.deepEqual([snap.meals, snap.workouts, snap.hobby, snap.reviews], [[], [], [], []]);
});

test("14일 자르기: 최근 14일 · 식단 · 취미 · 회고는 14일 안만, 운동 기록은 남은 만큼", () => {
  const old = "2026-09-19"; // 15일 전
  const edge = "2026-09-20"; // 14일째
  const data = {
    ...empty,
    mealLog: { [old]: [{ label: "저녁", dish: "jja" }], [edge]: [{ label: "저녁", dish: "ramen" }] },
    workoutLog: { [old]: { legpress: 3 }, [edge]: { latpull: 2 } },
    hobbyLog: { days: { [old]: { ww: [4, 4] }, [edge]: { wf: [1, 2] } } },
    reviews: { [old]: { answers: ["옛", "", "", ""] }, [edge]: { answers: ["끝", "", "", ""] } },
  };
  const snap = lifeSnapshot(data, at(2026, 10, 3));
  assert.equal(snap.recent.at(-1)[0], edge);
  assert.ok(!snap.recent.some((r) => r[0] === old));
  assert.deepEqual(snap.meals, [[edge, "저녁", "안성탕면", "30"]]);
  assert.deepEqual(snap.hobby, [[edge, "", "", "1/2"]]);
  assert.deepEqual(snap.reviews, [[edge, "하루 회고", "오늘 잘 되었던 일은?", "끝"]]);
  assert.deepEqual(snap.workouts, [[edge, "등", "랫 풀 다운", "2/3"], [old, "하체", "시티드 레그프레스", "3/3"]]);
});

test("식단 기록: 먹는 차례대로, 알바 끼니 표시, '안 먹음 · 외식' 은 단백질 빈칸", () => {
  const log = { "2026-10-02": [{ label: "점심", dish: "chicken", work: true }, { label: "저녁", dish: "skip" }], "2026-10-01": [{ label: "저녁", dish: "jja-left" }] };
  assert.deepEqual(mealRows(log, ["2026-10-02", "2026-10-01", "2026-09-30"]), [
    ["2026-10-02", "점심 (알바)", "닭가슴살 + 햇반", "29"],
    ["2026-10-02", "저녁", "안 먹음 · 외식", ""],
    ["2026-10-01", "저녁", "짜글이 (남은 것)", "25"],
  ]);
  const row = dayRow("2026-10-02", { ...empty, mealLog: log });
  assert.deepEqual(row.slice(6, 10), ["저녁 안 먹음 · 외식", "점심 닭가슴살 + 햇반", "29", "1/1"]);
});

test("운동 기록: 한 세트라도 한 운동만, 더 한 세트는 그대로 (5/3)", () => {
  assert.deepEqual(workoutRows({ "2026-10-01": { walk: 1, shoulder: 5, chest: 0 } }), [
    ["2026-10-01", "준비", "걷기 웜업", "1/1"],
    ["2026-10-01", "어깨", "숄더 프레스", "5/3"],
  ]);
});

test("취미 체크: 기록이 있는 날만", () => {
  const log = { days: { "2026-10-02": { ww: [4, 4], wwWeek: [2, 6], wf: [0, 2] } } };
  assert.deepEqual(hobbyRows(log, ["2026-10-03", "2026-10-02"]), [["2026-10-02", "4/4", "2/6", "0/2"]]);
  assert.deepEqual(hobbyRows({}, ["2026-10-03"]), []);
});

test("회고 기록: 글을 그대로 (줄바꿈 포함), 주간회고는 그 주 월요일 날짜로", () => {
  const reviews = { "2026-10-02": { answers: ["운동 다 함\n저녁도 잘 먹음", "", "", "일찍 자기"] } };
  const weekReviews = { "2026-09-28": { answers: ["", "", "", "가사부터"] }, "2026-09-07": { answers: ["옛 주", "", "", ""] } };
  assert.deepEqual(reviewRows(reviews, weekReviews, recentDays(at(2026, 10, 3))), [
    ["2026-10-02", "하루 회고", "오늘 잘 되었던 일은?", "운동 다 함\n저녁도 잘 먹음"],
    ["2026-10-02", "하루 회고", "내일 처음으로 할 일은?", "일찍 자기"],
    ["2026-09-28", "주간회고", "다음 주 처음으로 할 일은?", "가사부터"],
  ]);
});

test("몸무게·키는 어디에도 없다 · 가챠도 보내지 않는다", () => {
  const snap = lifeSnapshot(empty, at(2026, 10, 3));
  assert.deepEqual(Object.keys(snap), ["today", "recent", "meals", "workouts", "hobby", "reviews"]);
  assert.doesNotMatch(JSON.stringify(snap), /kg|cm|몸무게|체중|키|별소|연/);
});

// ---------- v3.1 유산소 분 ----------
test("v3.1 운동 기록 탭: 유산소 줄의 마지막 칸에 달린 분이 붙는다 ('1/1 · 22분'), 분이 없으면 예전처럼 '1/1' — 칸 수는 그대로", () => {
  const log = { "2026-10-09": { cardio: 1, chest: 3 }, "2026-10-08": { cardio: 1 }, "2026-10-07": { walk: 1 } };
  const rows = workoutRows(log, { "2026-10-09": 22, "2026-10-07": 30 });
  assert.deepEqual(rows, [
    ["2026-10-09", "가슴", "체스트 프레스", "3/3"],
    ["2026-10-09", "마무리", "유산소", "1/1 · 22분"],
    ["2026-10-08", "마무리", "유산소", "1/1"],
    ["2026-10-07", "준비", "걷기 웜업", "1/1"], // 유산소를 안 한 날의 분은 어디에도 안 나간다
  ]);
  assert.ok(rows.every((r) => r.length === 4));
  assert.deepEqual(workoutRows(log), workoutRows(log, {}), "분 칸이 없는 옛 폰도 그대로");
});

test("v3.1 시트 한 벌: 유산소 분은 '운동 기록' 에만 나가고 '오늘 요약' · '최근 14일' 은 15칸 그대로", () => {
  const now = new Date(2026, 9, 9, 20, 0);
  const data = { ...empty, workoutLog: { "2026-10-09": { cardio: 1 } }, cardioMin: { "2026-10-09": 12 } };
  const snap = lifeSnapshot(data, now);
  assert.deepEqual(snap.workouts, [["2026-10-09", "마무리", "유산소", "1/1 · 12분"]]);
  assert.equal(snap.today[0].length, 15);
  assert.ok(snap.recent.every((r) => r.length === 15));
  assert.deepEqual(snap.today, lifeSnapshot({ ...data, cardioMin: undefined }, now).today);
  assert.deepEqual(lifeSnapshot({ ...empty, workoutLog: data.workoutLog }, now).workouts, [["2026-10-09", "마무리", "유산소", "1/1"]]);
});
