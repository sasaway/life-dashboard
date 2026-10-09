import { test } from "node:test";
import assert from "node:assert/strict";
import { settingRows, weekRows, scheduleSnapshot, NEXT_DAYS } from "../js/schedule-sync.js";
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES, dayPlan, parseDate } from "../js/schedule.js";
import { planWeek, workMeal } from "../js/meals.js";

// 월·화 오픈반 · 수 중간반 · 목·금 마감반 · 토·일 휴무 (dayShifts 는 일요일부터)
const settings = { ...DEFAULT_SETTINGS, dayShifts: ["off", "open", "open", "mid", "close", "close", "off"] };
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const sunday = at(2026, 10, 4); // 일요일 낮
const rowsOf = (rows, day) => rows.filter((r) => r[0] === day);
const names = (rows) => rows.map((r) => `${r[4]} ${r[6]}`.trim());

test("일정 설정 · 요일별 알바: 월~일 7줄, 반 이름과 알바 시간 · 쉬는 요일은 '휴무'", () => {
  const rows = settingRows(settings, sunday).filter((r) => r[0] === "요일별 알바");
  assert.deepEqual(rows, [
    ["요일별 알바", "월", "08:30", "15:30", "오픈반", ""],
    ["요일별 알바", "화", "08:30", "15:30", "오픈반", ""],
    ["요일별 알바", "수", "12:00", "19:00", "중간반", ""],
    ["요일별 알바", "목", "15:00", "22:00", "마감반", ""],
    ["요일별 알바", "금", "15:00", "22:00", "마감반", ""],
    ["요일별 알바", "토", "", "", "휴무", ""],
    ["요일별 알바", "일", "", "", "휴무", ""],
  ]);
});

test("일정 설정 · 일과표: 반마다 칸마다 한 줄, 끝은 다음 칸의 시작 (취침은 다음 날 첫 칸까지)", () => {
  const rows = settingRows(settings, sunday).filter((r) => r[0] === "일과표");
  assert.equal(rows.length, DEFAULT_TEMPLATES.open.length + DEFAULT_TEMPLATES.mid.length + DEFAULT_TEMPLATES.close.length);
  assert.equal(rows.length, 14 * 3, "반마다 취침 · 아침 칸이 늘었다 (핫픽스 v3.0.4)");
  assert.deepEqual(rows.slice(0, 2), [["일과표", "오픈반", "06:00", "06:30", "취침", ""], ["일과표", "오픈반", "06:30", "07:00", "아침", ""]]);
  assert.deepEqual(rows[4], ["일과표", "오픈반", "08:30", "15:30", "알바 · 오픈반", ""]);
  assert.deepEqual(rows.filter((r) => r[5] !== ""), [], "설명 칸은 전부 빈칸 (핫픽스 v3.0.3), 칸 수는 그대로");
  for (const r of rows) assert.equal(r.length, 6);
  assert.deepEqual(rows.filter((r) => r[1] === "오픈반").at(-1), ["일과표", "오픈반", "23:00", "06:00", "취침", ""]);
  assert.deepEqual(rows.find((r) => r[1] === "중간반" && r[4] === "운동"), ["일과표", "중간반", "19:30", "21:00", "운동", ""]);
  assert.deepEqual(rows.find((r) => r[1] === "오픈반" && r[4] === "취미").slice(2, 4), ["19:00", "21:00"], "취미 2시간 (핫픽스 v3.0.1)");
  assert.deepEqual([...new Set(rows.map((r) => r[1]))], ["오픈반", "중간반", "마감반"]);
});

test("일정 설정 · 직접 고친 일과표는 고친 시각 그대로 들어간다", () => {
  const open = DEFAULT_TEMPLATES.open.map((x) => (x.kind === "exercise" ? { ...x, start: "16:10", name: "운동 (헬스장)" } : x));
  const mine = { ...settings, templates: { ...DEFAULT_TEMPLATES, open } };
  const rows = settingRows(mine, sunday).filter((r) => r[0] === "일과표" && r[1] === "오픈반");
  assert.deepEqual(rows.find((r) => r[4] === "운동 (헬스장)").slice(2, 4), ["16:10", "17:30"]);
  assert.deepEqual(rows.find((r) => r[2] === "15:30").slice(3, 5), ["16:10", "휴식"], "앞 칸의 끝도 같이 바뀐다");
  // '앞으로 7일' 에도: 월요일(오픈반)
  const mon = rowsOf(weekRows(mine, {}, sunday), "2026-10-05");
  assert.deepEqual(mon.find((r) => r[6] === "운동 (헬스장)").slice(4, 6), ["16:10", "17:30"]);
});

test("일정 설정 · 규칙: 쉬는 날 · 일요일 · 캘린더 · 끼니 규칙이 글로 들어간다 (코드의 값 그대로)", () => {
  const rules = settingRows(settings, sunday).filter((r) => r[0] === "규칙");
  assert.ok(rules.some((r) => r[1] === "쉬는 날" && r[4] === "알바 · 출근 준비 → 휴식"));
  assert.ok(rules.some((r) => r[1] === "일요일" && r[4] === "운동 · 샤워 → 휴식"));
  assert.deepEqual(rules.find((r) => r[1] === "쉬는 날 (오픈반 일과)").slice(2, 5), ["12:00", "13:00", "점심"]);
  assert.deepEqual(rules.find((r) => r[1] === "쉬는 날 (마감반 일과)").slice(2, 5), ["18:00", "19:00", "저녁"]);
  assert.equal(rules.find((r) => r[1] === "집 끼니")[4], "아침: 간장 계란 볶음밥 → 김치 계란 볶음밥 → 통밀빵 세트");
  assert.equal(rules.find((r) => r[1] === "집 끼니")[5], "점심 · 저녁: 오픈반 알바 날 저녁은 짜글이 먼저, 다음 점심 · 저녁은 짜글이 (남은 것). 안성탕면 은 주 2번까지. 같은 날 같은 메뉴는 한 번");
  const open = workMeal(parseDate("2026-10-05"), settings);
  assert.deepEqual(rules.find((r) => r[1] === "알바 중 끼니").slice(4), [`늘 ${open.dish.short}`, ""], "시각 글은 없다 (핫픽스 v3.0.3)");
  assert.ok(!JSON.stringify(settingRows(settings, sunday)).match(/13~14|40분/));
  // 규칙 글이 실제 계산과 맞는지: 쉬는 토요일(마감반 일과)에는 18:00 저녁이 생긴다
  assert.ok(dayPlan(parseDate("2026-10-10"), settings).blocks.some((x) => x.start === "18:00" && x.name === "저녁"));
});

test("핫픽스 v3.0.4 · 규칙 12줄: 아침 · 교회 줄은 맨 아래에 더하고 앞의 10줄 순서는 그대로", () => {
  const rules = settingRows(settings, sunday).filter((r) => r[0] === "규칙");
  assert.deepEqual(rules.map((r) => r[1]), ["쉬는 날", "쉬는 날 (오픈반 일과)", "쉬는 날 (중간반 일과)", "쉬는 날 (마감반 일과)", "쉬는 날", "일요일",
    "캘린더", "알바 중 끼니", "집 끼니", "하루", "아침", "일요일"]);
  assert.deepEqual(rules[10].slice(1, 5), ["아침", "06:30", "07:00", "월~토 아침"]);
  assert.deepEqual(rules[11].slice(1, 5), ["일요일", "09:30", "12:00", "교회"]);
  for (const r of rules) assert.equal(r.length, 6);
});

test("핫픽스 v3.0.4 · v3.0.5 · 앞으로 7일: 아침 줄은 월~토에만 (끼니 메뉴가 빈칸이 아니다), 교회 줄은 일요일에만", () => {
  const rows = weekRows(settings, {}, sunday); // 10/4 일 ~ 10/10 토
  assert.deepEqual(rows.filter((r) => r[6] === "아침").map((r) => [r[0], r[4], r[5], r[8]]),
    ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"].map((d, i) =>
      [d, "06:30", "07:00", ["간장 계란 볶음밥", "김치 계란 볶음밥", "통밀빵 세트"][i % 3]]));
  assert.ok(rows.filter((r) => /아침|점심|저녁/.test(r[6])).every((r) => r[8] !== ""), "끼니 줄에 메뉴 빈칸이 없다");
  assert.deepEqual(rows.filter((r) => r[6] === "교회").map((r) => r.slice(0, 6)), [["2026-10-04", "일", "쉬는 날", "요일별", "09:30", "12:00"]]);
  assert.deepEqual([...new Set(rows.filter((r) => r[8]).map((r) => r[6]))].sort(), ["아침", "알바 중 저녁", "알바 중 점심", "저녁", "점심"].sort());
  for (const r of rows) assert.equal(r.length, 9);
});

test("앞으로 7일 · 오늘부터 7일, 날마다 반과 출처", () => {
  const rows = weekRows(settings, {}, sunday);
  const days = [...new Set(rows.map((r) => r[0]))];
  assert.equal(days.length, NEXT_DAYS);
  assert.deepEqual([days[0], days[6]], ["2026-10-04", "2026-10-10"]);
  const head = (day) => rowsOf(rows, day)[0].slice(1, 4);
  assert.deepEqual(head("2026-10-04"), ["일", "쉬는 날", "요일별"]);
  assert.deepEqual(head("2026-10-05"), ["월", "오픈반", "요일별"]);
  assert.deepEqual(head("2026-10-07"), ["수", "중간반", "요일별"]);
  assert.deepEqual(head("2026-10-08"), ["목", "마감반", "요일별"]);
  for (const r of rows) assert.equal(r.length, 9);
});

test("앞으로 7일 · 오픈반 날: 메인 일과표 칸 그대로 + 알바 칸 아래 '알바 중 점심' 줄", () => {
  const mon = rowsOf(weekRows(settings, {}, sunday), "2026-10-05");
  const blocks = dayPlan(parseDate("2026-10-05"), settings).blocks;
  assert.deepEqual(mon.filter((r) => r[4]).map((r) => [r[4], r[6], r[7]]), blocks.map((x) => [x.start, x.name, ""]));
  assert.deepEqual(weekRows(settings, {}, sunday).filter((r) => r[7] !== ""), [], "설명 칸은 전부 빈칸 (핫픽스 v3.0.3)");
  const i = mon.findIndex((r) => r[6] === "알바 · 오픈반");
  assert.deepEqual(mon[i].slice(4), ["08:30", "15:30", "알바 · 오픈반", "", ""]);
  assert.deepEqual(mon[i + 1].slice(4), ["", "", "알바 중 점심", "", "닭가슴살 + 햇반"], "시각 · 설명은 빈칸");
  assert.deepEqual(mon.find((r) => r[6] === "저녁").slice(4), ["18:00", "19:00", "저녁", "", "짜글이"]);
  assert.deepEqual(mon.find((r) => r[6] === "운동").slice(4, 8), ["16:00", "17:30", "운동", ""]);
  assert.deepEqual(mon.at(-1).slice(4, 7), ["23:00", "06:00", "취침"]);
});

test("앞으로 7일 · 중간반 · 마감반 날: '알바 중 저녁' 줄, 집 점심 메뉴", () => {
  const rows = weekRows(settings, {}, sunday);
  const wed = rowsOf(rows, "2026-10-07");
  const lunch = wed.findIndex((r) => r[6] === "점심");
  assert.deepEqual(names(wed).slice(lunch, lunch + 5), ["10:00 점심", "11:00 출근 준비", "12:00 알바 · 중간반", "알바 중 저녁", "19:00 휴식"]);
  assert.deepEqual(names(wed).slice(0, lunch), ["06:00 취침", "06:30 아침", "07:00 취미", "09:00 가사", "09:30 휴식"]);
  assert.equal(wed.find((r) => r[6] === "아침")[8], "통밀빵 세트", "아침 메뉴 (핫픽스 v3.0.5)");
  assert.equal(wed.find((r) => r[6] === "알바 중 저녁")[8], "닭가슴살 + 햇반");
  assert.equal(wed.find((r) => r[6] === "점심")[8], "안성탕면");
  const thu = rowsOf(rows, "2026-10-08");
  assert.deepEqual(thu.find((r) => r[6] === "알바 · 마감반").slice(4, 6), ["15:00", "22:00"]);
  assert.equal(thu[thu.findIndex((r) => r[6] === "알바 · 마감반") + 1][6], "알바 중 저녁");
});

test("앞으로 7일 · 쉬는 날: 알바 · 출근 준비가 휴식으로, 집에서 두 끼 · 알바 중 끼니 줄은 없다", () => {
  const sat = rowsOf(weekRows(settings, {}, sunday), "2026-10-10"); // 토요일 휴무 → 금요일(마감반) 일과
  assert.ok(!sat.some((r) => /알바|출근 준비/.test(r[6])));
  assert.deepEqual(sat.filter((r) => r[8]).map((r) => [r[4], r[6]]), [["06:30", "아침"], ["12:00", "점심"], ["18:00", "저녁"]]);
  assert.ok(sat.some((r) => r[6] === "운동"), "쉬는 날에도 운동은 한다");
});

test("앞으로 7일 · 일요일: 운동 · 샤워가 휴식으로", () => {
  const sun = rowsOf(weekRows(settings, {}, sunday), "2026-10-04");
  assert.ok(!sun.some((r) => r[6] === "운동" || r[6] === "샤워"));
  assert.deepEqual(names(sun), dayPlan(sunday, settings).blocks.map((x) => `${x.start} ${x.name}`));
  // 일요일에 알바를 하는 설정이어도 운동은 쉰다
  const work = { ...settings, dayShifts: ["open", "open", "open", "mid", "close", "close", "off"] };
  const sun2 = rowsOf(weekRows(work, {}, sunday), "2026-10-04");
  assert.equal(sun2[0][2], "오픈반");
  assert.ok(sun2.some((r) => r[6] === "알바 중 점심") && !sun2.some((r) => r[6] === "운동"));
});

test("앞으로 7일 · 직접 바꾼 식단 칸과 '안 먹음 · 외식' 이 그대로 들어간다 (식단표와 같은 메뉴)", () => {
  const overrides = { "2026-10-05 저녁": "chapa", "2026-10-06 저녁": "skip" };
  const rows = weekRows(settings, overrides, sunday);
  const menu = (day, label) => rowsOf(rows, day).find((r) => r[6] === label)[8];
  assert.equal(menu("2026-10-05", "저녁"), "짜파게티");
  assert.equal(menu("2026-10-06", "저녁"), "안 먹음 · 외식");
  // 식단(일상생활 탭)의 이번 주 식단표와 한 칸도 다르지 않다 (10/5 주)
  const week = planWeek(parseDate("2026-10-05"), settings, overrides);
  for (const d of week.filter((x) => x.day <= "2026-10-10")) {
    assert.deepEqual(rowsOf(rows, d.day).filter((r) => r[4] && r[8]).map((r) => [r[6], r[8]]), d.meals.map((m) => [m.label, m.dish.short]), d.day);
  }
});

test("앞으로 7일 · 캘린더에서 받은 알바가 요일별보다 먼저, 출처는 '캘린더'", () => {
  const cal = { at: 1, from: "2026-10-05", until: "2026-10-07", shifts: { "2026-10-05": "close", "2026-10-06": "mid" } };
  const rows = weekRows({ ...settings, cal }, {}, sunday);
  const head = (day) => rowsOf(rows, day)[0].slice(2, 4);
  assert.deepEqual(head("2026-10-05"), ["마감반", "캘린더"]);
  assert.deepEqual(head("2026-10-06"), ["중간반", "캘린더"]);
  assert.deepEqual(head("2026-10-07"), ["쉬는 날", "캘린더"], "받은 기간 안인데 알바가 없는 날");
  assert.deepEqual(head("2026-10-08"), ["마감반", "요일별"], "받은 기간 밖은 요일별");
});

test("06시 전 경계: 새벽은 아직 어제 → 첫 날이 어제", () => {
  const first = (now) => weekRows(settings, {}, now)[0][0];
  assert.equal(first(at(2026, 10, 5, 5, 59)), "2026-10-04");
  assert.equal(first(at(2026, 10, 5, 6, 0)), "2026-10-05");
  const rows = weekRows(settings, {}, at(2026, 10, 5, 2, 0));
  assert.deepEqual([...new Set(rows.map((r) => r[0]))].at(-1), "2026-10-10");
});

test("옛 설정(요일별 알바가 없는 폰)도 줄이 만들어진다 · 몸무게·키는 어디에도 없다", () => {
  const snap = scheduleSnapshot({ settings: DEFAULT_SETTINGS }, sunday);
  assert.deepEqual(Object.keys(snap), ["plan", "next7"]);
  assert.equal(snap.plan.filter((r) => r[0] === "요일별 알바").length, 7);
  assert.ok(snap.next7.length > 7 * 10);
  assert.doesNotMatch(JSON.stringify(scheduleSnapshot({ settings }, sunday)), /kg|cm|몸무게|체중|키/);
  for (const r of [...snap.plan, ...snap.next7]) for (const v of r) assert.ok(v.length <= 100, "한 칸 100자 안 (심부름꾼이 자른다)");
});
