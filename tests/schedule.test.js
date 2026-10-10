import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS, DEFAULT_TEMPLATES, SHIFTS, SHIFT_IDS, OFF, toMin, shiftFor, withDayShifts, setDayShift, hasDayShifts,
  dayPlan, currentIndex, nowInfo, leftLabel, checkTemplate, sortBlocks, upgradeTemplates, blockLengths, lengthLabel, endOf,
} from "../js/schedule.js";
import { alignCloseOnce, CLOSE_RESET, clearNotesOnce, NOTES_CLEARED, renameWakeOnce, WAKE_NAMED, WAKE } from "../js/schedule.js";

// 칸마다 [시작, 끝] 분. 마지막 칸은 다음 날 첫 칸까지.
function spans(blocks) {
  return blocks.map((x, i) => {
    const s = toMin(x.start);
    const e = i < blocks.length - 1 ? toMin(blocks[i + 1].start) : toMin(blocks[0].start) + 1440;
    return { ...x, s, e, len: e - s };
  });
}
const find = (blocks, kind) => spans(blocks).filter((x) => x.kind === kind);

// ---------- Notion 규칙 ----------
for (const shift of ["open", "mid", "close"]) {
  const blocks = DEFAULT_TEMPLATES[shift];
  const label = SHIFTS[shift].label;

  test(`${label} 주: 취침은 22:30 부터 다음 날 05:30 까지 7시간 — 하루 첫 칸 05:30~06:00 은 이름이 '기상' (핫픽스 v3.1.1 새벽형)`, () => {
    const [morning, night] = find(blocks, "sleep");
    assert.deepEqual([morning.start, morning.len, morning.name], ["05:30", 30, "기상"]);
    assert.equal(blocks[0], DEFAULT_TEMPLATES[shift][0]);
    assert.deepEqual([night.start, night.len, night.name], ["22:30", 420, "취침"], "마지막 칸은 22:30 → 다음 날 첫 칸 05:30");
    assert.equal(blocks.at(-1).kind, "sleep");
    assert.equal(blocks.length, 14, "칸 수는 반마다 14칸 그대로");
  });

  test(`${label} 주: 아침은 30분 (오픈반 06:00, 중간반 · 마감반은 취미 뒤 08:00), 점심 · 저녁과 다른 종류다 (핫픽스 v3.1.1)`, () => {
    const [am] = find(blocks, "breakfast");
    assert.deepEqual([am.start, am.len, am.name], [shift === "open" ? "06:00" : "08:00", 30, "아침"]);
    assert.equal(find(blocks, "breakfast").length, 1);
    assert.equal(spans(blocks).reduce((a, x) => a + x.len, 0), 1440, "하루 24시간을 빈틈없이");
  });

  test(`${label} 주: 알바 시간은 ${SHIFTS[shift].start}~${SHIFTS[shift].end}`, () => {
    const [work] = find(blocks, "work");
    assert.equal(work.start, SHIFTS[shift].start);
    assert.equal(work.s + work.len, toMin(SHIFTS[shift].end));
  });

  test(`${label} 주: 출근 전 1시간은 출근 준비`, () => {
    const [prep] = find(blocks, "prep");
    assert.equal(prep.len, 60);
    assert.equal(prep.e, toMin(SHIFTS[shift].start));
  });

  test(`${label} 주: 운동은 이동 포함 1시간 30분, 바로 뒤에 샤워 30분 (핫픽스 v3.0.1)`, () => {
    const all = spans(blocks);
    const i = all.findIndex((x) => x.kind === "exercise");
    assert.equal(all[i].len, 90);
    assert.equal(all[i + 1].kind, "shower");
    assert.equal(all[i + 1].len, 30);
  });

  test(`${label} 주: 가사 30분, 취미 2시간`, () => {
    assert.equal(find(blocks, "chores")[0].len, 30);
    assert.equal(find(blocks, "hobby")[0].len, 120);
  });

  test(`${label} 주: 집에서 먹는 끼니는 1시간씩, 알바 중 끼니는 없다`, () => {
    const meals = find(blocks, "meal");
    assert.equal(meals.length, 1); // 나머지 한 끼는 알바 중 (닭가슴살 + 햇반)
    assert.equal(meals[0].len, 60);
  });

  test(`${label} 주: 리뷰 30분은 밤 21:30 뒤, 리뷰와 취침 사이에는 휴식뿐 (마감반은 알바 뒤 바로 리뷰 — 은월 확인)`, () => {
    const all = spans(blocks);
    const i = all.findIndex((x) => x.kind === "review");
    assert.deepEqual([all[i].start, all[i].len], [shift === "close" ? "22:00" : "21:30", 30]);
    assert.ok(all.slice(i + 1, -1).every((x) => x.kind === "rest"));
    if (shift === "close") assert.equal(all[i - 1].kind, "work");
  });

  test(`${label} 주: 칸은 시간순이고 겹치지 않는다`, () => {
    assert.deepEqual(sortBlocks(blocks), blocks);
    assert.equal(checkTemplate(blocks), "");
  });
}

test("취미 시간은 세 반이 같거나 12시간 차이다", () => {
  const [a, m, c] = ["open", "mid", "close"].map((shift) => find(DEFAULT_TEMPLATES[shift], "hobby")[0].s);
  assert.ok(a === c || Math.abs(a - c) === 720);
  assert.ok(a === m || Math.abs(a - m) === 720);
});

// 핫픽스 v3.1.1 새벽형: 취미는 중간반 · 마감반 아침 06:00, 오픈반만 저녁 18:00 (12시간 차이). 저녁 8시 전에 끝난다
test("취미는 오픈반 18:00 ~ 20:00 (저녁 8시 전에 끝난다), 12시간 차이로 마감반 · 중간반 06:00 ~ 08:00", () => {
  assert.equal(find(DEFAULT_TEMPLATES.open, "hobby")[0].start, "18:00");
  assert.equal(find(DEFAULT_TEMPLATES.close, "hobby")[0].start, "06:00");
  assert.equal(find(DEFAULT_TEMPLATES.mid, "hobby")[0].start, "06:00");
  assert.ok(find(DEFAULT_TEMPLATES.open, "hobby")[0].e <= toMin("20:00"));
});

test("오픈반 주: 알바 15:30 끝 + 휴식 30분 + 운동 1시간 30분 + 샤워 30분 → 취미 18:00, 그 뒤에 저녁 1시간", () => {
  const all = spans(DEFAULT_TEMPLATES.open);
  const i = all.findIndex((x) => x.kind === "work");
  assert.deepEqual(all.slice(i + 1, i + 6).map((x) => [x.kind, x.len]), [["rest", 30], ["exercise", 90], ["shower", 30], ["hobby", 120], ["meal", 60]]);
  assert.equal(toMin(SHIFTS.open.end) + 30 + 90 + 30, toMin("18:00"));
});

test("핫픽스 v3.1.1 세 반의 새 시간표 (은월 2026-10-09)", () => {
  const names = (shift) => DEFAULT_TEMPLATES[shift].map((x) => `${x.start} ${x.name}`);
  assert.deepEqual(names("open"), ["05:30 기상", "06:00 아침", "06:30 휴식", "07:30 출근 준비", "08:30 알바 · 오픈반", "15:30 휴식", "16:00 운동",
    "17:30 샤워", "18:00 취미", "20:00 저녁", "21:00 가사", "21:30 리뷰", "22:00 휴식", "22:30 취침"]);
  assert.deepEqual(names("close"), ["05:30 기상", "06:00 취미", "08:00 아침", "08:30 가사", "09:00 휴식", "09:30 운동", "11:00 샤워", "11:30 휴식",
    "12:00 점심", "13:00 휴식", "14:00 출근 준비", "15:00 알바 · 마감반", "22:00 리뷰", "22:30 취침"]);
});

test("오픈반 주: 알바가 끝나면 30분 쉬고 운동 (Notion 09-28)", () => {
  const all = spans(DEFAULT_TEMPLATES.open);
  const i = all.findIndex((x) => x.kind === "work");
  assert.deepEqual([all[i + 1].kind, all[i + 1].len, all[i + 2].kind], ["rest", 30, "exercise"]);
});

test("가사는 이른 아침(08시 전)·늦은 저녁(22시 뒤)에 넣지 않는다 (Notion 09-28, 21:30 까지는 괜찮음)", () => {
  for (const shift of ["open", "mid", "close"]) {
    const [c] = find(DEFAULT_TEMPLATES[shift], "chores");
    assert.ok(c.s >= toMin("08:00") && c.e <= toMin("22:00"), `${shift} ${c.start}`);
  }
});

test("핫픽스 v3.0.3: 기본 일과표 세 반의 칸 설명은 전부 빈칸이다", () => {
  for (const shift of ["open", "mid", "close"]) {
    assert.deepEqual(DEFAULT_TEMPLATES[shift].filter((x) => x.note), [], shift);
  }
});

test("핫픽스 v3.0.3: 폰에 저장된 칸 설명을 한 번만 비운다 (시각 · 이름은 그대로, 직접 고친 반도)", () => {
  const mine = v30Blocks("open").map((x) => (x.kind === "exercise" ? { ...x, start: "16:10", name: "운동 (헬스장)" } : x));
  const phone = { dayShifts: ["off", "open", "open", "open", "open", "open", "off"], templates: { open: mine, mid: v30Blocks("mid"), close: DEFAULT_TEMPLATES.close } };
  assert.ok(mine.some((x) => x.note), "옛 일과표에는 설명이 있었다");
  const out = clearNotesOnce(phone);
  assert.equal(out.notesCleared, NOTES_CLEARED);
  for (const shift of ["open", "mid", "close"]) assert.deepEqual(out.templates[shift].filter((x) => x.note), [], shift);
  assert.deepEqual(out.templates.open.map((x) => `${x.start} ${x.kind} ${x.name}`), mine.map((x) => `${x.start} ${x.kind} ${x.name}`));
  assert.equal(out.templates.close, DEFAULT_TEMPLATES.close, "비울 게 없는 반은 그대로");
  assert.deepEqual(out.dayShifts, phone.dayShifts, "다른 설정은 안 건드린다");
  assert.equal(mine.find((x) => x.kind === "exercise").note, "이동 포함 2시간", "원본은 건드리지 않는다");
  assert.equal(clearNotesOnce(out), out, "표시가 있으면 다시 하지 않는다");
});

test("폰에 옛 기본 일과표가 그대로 있으면 새 기본값으로, 직접 고친 건 그대로", () => {
  const b = (start, name) => ({ start, kind: "x", name, note: "" });
  const oldOpen = ["06:00 휴식", "07:30 출근 준비", "08:30 알바 · 오픈반", "15:30 휴식", "16:00 운동", "18:00 샤워",
    "18:30 저녁", "19:30 가사", "20:00 취미", "22:00 휴식", "22:30 리뷰", "23:00 취침"].map((x) => b(x.slice(0, 5), x.slice(6)));
  const mine = [b("06:00", "기상"), b("23:00", "취침")];
  const up = upgradeTemplates({ open: oldOpen, close: mine });
  assert.equal(up.open, DEFAULT_TEMPLATES.open);
  assert.equal(up.close, mine);
  assert.equal(upgradeTemplates(DEFAULT_TEMPLATES).open, DEFAULT_TEMPLATES.open);
});

test("v2.0 까지의 기본 일과표(취미 19:00 / 07:00)도 새 기본값으로 바뀐다", () => {
  const v23 = {
    open: [["06:00", "rest", "휴식"], ["07:30", "prep", "출근 준비"], ["08:30", "work", "알바 · 오픈반", "점심은 식대"], ["15:30", "exercise", "운동"],
      ["17:30", "shower", "샤워"], ["18:00", "meal", "저녁"], ["19:00", "hobby", "취미"], ["21:00", "chores", "가사"], ["21:30", "rest", "휴식"],
      ["22:30", "review", "리뷰"], ["23:00", "sleep", "취침"]],
    close: [["06:00", "chores", "가사"], ["06:30", "rest", "휴식"], ["07:00", "hobby", "취미"], ["09:00", "rest", "휴식"], ["10:00", "exercise", "운동"],
      ["12:00", "shower", "샤워"], ["12:30", "meal", "점심"], ["13:30", "rest", "휴식"], ["14:00", "prep", "출근 준비"],
      ["15:00", "work", "알바 · 마감반", "저녁은 식대"], ["22:00", "rest", "휴식"], ["22:30", "review", "리뷰"], ["23:00", "sleep", "취침"]],
  };
  const toBlocks = (rows) => rows.map(([start, kind, name, note = ""]) => ({ start, kind, name, note }));
  const up = upgradeTemplates({ open: toBlocks(v23.open), close: toBlocks(v23.close) });
  assert.equal(up.open, DEFAULT_TEMPLATES.open);
  assert.equal(up.close, DEFAULT_TEMPLATES.close);
});

// 핫픽스 v3.0.1: v2.1 ~ v3.0 기본값(운동 2시간, 취미 19:30 / 07:30)이 폰에 그대로 있으면 새 기본값으로. 중간반(v2.8.1 ~ v3.0)도
const V30 = {
  open: "06:00 rest 휴식|07:30 prep 출근 준비|08:30 work 알바 · 오픈반/점심 · 13~14시 사이 · 40분|15:30 rest 휴식/알바 끝나고 30분|16:00 exercise 운동/이동 포함 2시간|18:00 shower 샤워|18:30 meal 저녁|19:30 hobby 취미/명조 · 워프레임|21:30 chores 가사|22:00 rest 휴식|22:30 review 리뷰/오늘 4가지 질문|23:00 sleep 취침",
  mid: "06:00 rest 휴식|07:30 hobby 취미/명조 · 워프레임|09:30 chores 가사|10:00 meal 점심|11:00 prep 출근 준비|12:00 work 알바 · 중간반/저녁 · 닭가슴살 + 햇반|19:00 rest 휴식/알바 끝나고 30분|19:30 exercise 운동/이동 포함 2시간|21:30 shower 샤워|22:00 rest 휴식|22:30 review 리뷰/오늘 4가지 질문|23:00 sleep 취침",
  close: "06:00 rest 휴식|07:30 hobby 취미/명조 · 워프레임|09:30 chores 가사|10:00 exercise 운동/이동 포함 2시간|12:00 shower 샤워|12:30 meal 점심|13:30 rest 휴식|14:00 prep 출근 준비|15:00 work 알바 · 마감반/저녁 · 닭가슴살 + 햇반|22:00 rest 휴식|22:30 review 리뷰/오늘 4가지 질문|23:00 sleep 취침",
};
const v30Blocks = (shift) => V30[shift].split("|").map((x) => {
  const [head, note = ""] = x.split("/");
  const [start, kind, ...name] = head.split(" ");
  return { start, kind, name: name.join(" "), note };
});

test("핫픽스 v3.0.1: v3.0 까지의 기본 일과표(세 반)가 폰에 그대로 있으면 새 기본값으로 바뀐다", () => {
  const phone = { open: v30Blocks("open"), mid: v30Blocks("mid"), close: v30Blocks("close") };
  // 옛 기본값이 정말 그때 규칙이었는지: 운동 2시간, 취미 19:30 / 07:30
  assert.equal(find(phone.open, "exercise")[0].len, 120);
  assert.deepEqual(["open", "mid", "close"].map((k) => find(phone[k], "hobby")[0].start), ["19:30", "07:30", "07:30"]);
  const up = upgradeTemplates(phone);
  for (const shift of ["open", "mid", "close"]) assert.equal(up[shift], DEFAULT_TEMPLATES[shift], shift);
  // 한 번 더 돌려도 같다
  const again = upgradeTemplates(up);
  for (const shift of ["open", "mid", "close"]) assert.equal(again[shift], DEFAULT_TEMPLATES[shift], `${shift} 다시`);
  assert.deepEqual(upgradeTemplates(JSON.parse(JSON.stringify(DEFAULT_TEMPLATES))), DEFAULT_TEMPLATES, "저장됐다 읽힌 새 기본값도 그대로");
});

test("핫픽스 v3.0.1: 직접 고친 일과표는 한 칸만 달라도 그대로 둔다 (세 반 모두)", () => {
  for (const shift of ["open", "mid", "close"]) {
    const mine = v30Blocks(shift).map((x) => (x.kind === "exercise" ? { ...x, name: "운동 (헬스장)" } : x));
    const later = v30Blocks(shift).map((x) => (x.kind === "sleep" ? { ...x, start: "23:30" } : x));
    assert.equal(upgradeTemplates({ [shift]: mine })[shift], mine, `${shift} 이름을 고친 것`);
    assert.equal(upgradeTemplates({ [shift]: later })[shift], later, `${shift} 시각을 고친 것`);
    assert.equal(find(upgradeTemplates({ [shift]: mine })[shift], "exercise")[0].note, "이동 포함 2시간", "고친 일과표의 설명도 건드리지 않는다");
  }
});

test("직접 고친 일과표는 그대로 둔다 (옛 설명 '식대' 는 핫픽스 v3.0.3 의 설명 비우기가 지운다)", () => {
  const mine = [
    { start: "06:00", kind: "rest", name: "기상", note: "" },
    { start: "15:00", kind: "work", name: "알바 · 마감반", note: "저녁은 식대" },
    { start: "23:00", kind: "sleep", name: "취침", note: "" },
  ];
  const up = upgradeTemplates({ close: mine });
  assert.equal(up.close, mine);
  assert.deepEqual(clearNotesOnce({ templates: up }).templates.close.map((x) => `${x.start} ${x.name} ${x.note}`),
    ["06:00 기상 ", "15:00 알바 · 마감반 ", "23:00 취침 "]);
  assert.equal(mine[1].note, "저녁은 식대"); // 원본은 건드리지 않는다
});

// ---------- 격주 ----------
test("2026-09-21 주는 마감반, 다음 주는 오픈반, 그 전 주도 오픈반", () => {
  assert.equal(shiftFor(new Date(2026, 8, 21), DEFAULT_SETTINGS), "close");
  assert.equal(shiftFor(new Date(2026, 8, 27), DEFAULT_SETTINGS), "close"); // 일요일도 같은 주
  assert.equal(shiftFor(new Date(2026, 8, 28), DEFAULT_SETTINGS), "open");
  assert.equal(shiftFor(new Date(2026, 8, 14), DEFAULT_SETTINGS), "open");
  assert.equal(shiftFor(new Date(2026, 9, 5), DEFAULT_SETTINGS), "close");
});

// ---------- 요일별 알바 · 중간반 (핫픽스 v2.8.1) ----------
const names = (plan) => plan.blocks.map((x) => `${x.start} ${x.name}`);
//                      일      월      화     수     목       금       토
const week = (...d) => ({ ...DEFAULT_SETTINGS, dayShifts: d });
const mixed = week(OFF, "open", "open", "mid", "close", "close", OFF);

test("반은 세 가지: 오픈반 08:30~15:30 · 중간반 12:00~19:00 · 마감반 15:00~22:00", () => {
  assert.deepEqual(SHIFT_IDS, ["open", "mid", "close"]);
  assert.deepEqual(SHIFT_IDS.map((id) => `${SHIFTS[id].label} ${SHIFTS[id].start}~${SHIFTS[id].end}`),
    ["오픈반 08:30~15:30", "중간반 12:00~19:00", "마감반 15:00~22:00"]);
});

test("중간반 일과표: 아침에 취미 · 아침 · 가사, 10:00 점심, 알바 끝나고 30분 쉬고 운동", () => {
  assert.deepEqual(DEFAULT_TEMPLATES.mid.map((x) => `${x.start} ${x.name}`), [
    "05:30 기상", "06:00 취미", "08:00 아침", "08:30 가사", "09:00 휴식", "10:00 점심", "11:00 출근 준비", "12:00 알바 · 중간반",
    "19:00 휴식", "19:30 운동", "21:00 샤워", "21:30 리뷰", "22:00 휴식", "22:30 취침",
  ]);
  const all = spans(DEFAULT_TEMPLATES.mid);
  const i = all.findIndex((x) => x.kind === "work");
  assert.deepEqual([all[i + 1].kind, all[i + 1].len, all[i + 2].kind], ["rest", 30, "exercise"]);
});

test("요일별 알바: 요일마다 정한 반이 매주 같게 반복된다 (한 주씩 번갈아 가지 않는다)", () => {
  // 2026-10-05 (월) ~ 10-11 (일), 그리고 다음 주
  const shiftOf = (m, d) => { const p = dayPlan(new Date(2026, m - 1, d), mixed); return p.working ? p.shift : OFF; };
  assert.deepEqual([5, 6, 7, 8, 9, 10, 11].map((d) => shiftOf(10, d)), ["open", "open", "mid", "close", "close", OFF, OFF]);
  assert.deepEqual([12, 13, 14, 15, 16, 17, 18].map((d) => shiftOf(10, d)), ["open", "open", "mid", "close", "close", OFF, OFF], "다음 주도 같다");
  assert.equal(dayPlan(new Date(2026, 9, 7), mixed).blocks, DEFAULT_TEMPLATES.mid, "수요일은 중간반 일과표 그대로");
  assert.equal(dayPlan(new Date(2026, 9, 5), mixed).fromCal, false);
});

test("요일별 알바 · 쉬는 날: 거슬러 올라가 가장 가까운 알바 날의 일과표에서 알바를 뺀다", () => {
  const sat = dayPlan(new Date(2026, 9, 10), mixed); // 토요일 쉼 → 금요일 마감반 기준
  assert.deepEqual([sat.working, sat.shift], [false, "close"]);
  assert.ok(names(sat).includes("18:00 저녁"));
  assert.ok(!sat.blocks.some((x) => x.kind === "work" || x.kind === "prep"));
  const sun = dayPlan(new Date(2026, 9, 11), mixed); // 일요일 쉼 → 토요일도 쉼 → 금요일 마감반
  assert.equal(sun.shift, "close");
  assert.ok(!names(sun).some((n) => n.includes("운동")), "일요일은 운동도 쉰다");
  const midOff = dayPlan(new Date(2026, 9, 8), week(OFF, OFF, OFF, "mid", OFF, OFF, OFF)); // 목요일 쉼 → 수요일 중간반 기준
  assert.deepEqual(names(midOff), ["05:30 기상", "06:00 취미", "08:00 아침", "08:30 가사", "09:00 휴식", "10:00 점심", "11:00 휴식", "18:00 저녁", "19:00 휴식", "19:30 운동", "21:00 샤워", "21:30 리뷰", "22:00 휴식", "22:30 취침"]);
  const allOff = dayPlan(new Date(2026, 9, 6), week(OFF, OFF, OFF, OFF, OFF, OFF, OFF));
  assert.deepEqual([allOff.working, allOff.shift], [false, "open"], "한 주가 다 쉬는 날이면 오픈반 일과표 기준");
});

test("캘린더에 알바가 적힌 날은 캘린더가 먼저 (중간반도), 받은 기간 안인데 없으면 쉬는 날", () => {
  const cal = { from: "2026-10-05", until: "2026-10-09", shifts: { "2026-10-05": "mid", "2026-10-09": "open" } };
  const s = { ...mixed, cal };
  const mon = dayPlan(new Date(2026, 9, 5), s); // 요일별은 오픈반이지만 캘린더는 중간반
  assert.deepEqual([mon.shift, mon.working, mon.fromCal], ["mid", true, true]);
  const tue = dayPlan(new Date(2026, 9, 6), s); // 캘린더 기간 안인데 알바 없음 → 쉬는 날 (일과표는 요일별의 오픈반 기준)
  assert.deepEqual([tue.shift, tue.working, tue.fromCal], ["open", false, true]);
  const next = dayPlan(new Date(2026, 9, 14), s); // 캘린더 기간 밖 → 요일별 (수요일 중간반)
  assert.deepEqual([next.shift, next.working, next.fromCal], ["mid", true, false]);
});

test("옛 설정 옮기기: 알바 하는 요일은 지금 주의 반으로, 꺼 둔 요일은 쉬는 날로. 옛 칸은 지우지 않는다", () => {
  const old = { ...DEFAULT_SETTINGS, workdays: [false, true, true, true, true, true, false] }; // 일·토 끔
  assert.equal(hasDayShifts(old), false);
  const inClose = withDayShifts(old, new Date(2026, 8, 24)); // 9/21 주 = 마감반
  assert.deepEqual(inClose.dayShifts, [OFF, "close", "close", "close", "close", "close", OFF]);
  const inOpen = withDayShifts(old, new Date(2026, 9, 1));   // 9/28 주 = 오픈반
  assert.deepEqual(inOpen.dayShifts, [OFF, "open", "open", "open", "open", "open", OFF]);
  assert.deepEqual([inOpen.anchorMonday, inOpen.anchorShift, inOpen.workdays], [old.anchorMonday, old.anchorShift, old.workdays]);
  // 옮긴 그 주의 일과는 옮기기 전과 같다
  for (let d = 28; d <= 30; d++) {
    const day = new Date(2026, 8, d);
    assert.deepEqual(dayPlan(day, withDayShifts(old, day)).blocks, dayPlan(day, old).blocks);
  }
  assert.equal(withDayShifts(inOpen, new Date(2026, 9, 8)), inOpen, "한 번 옮기면 다시 안 바꾼다");
  assert.equal(hasDayShifts({ ...old, dayShifts: ["open", "night"] }), false, "모양이 이상하면 다시 옮긴다");
});

test("요일 하나 고치기: 그 요일만 바뀌고, 모르는 값은 무시한다", () => {
  const s = setDayShift(mixed, 3, "close");
  assert.deepEqual(s.dayShifts, [OFF, "open", "open", "close", "close", "close", OFF]);
  assert.equal(setDayShift(mixed, "0", "mid").dayShifts[0], "mid", "버튼에서 오는 글자 번호도 받는다");
  assert.equal(setDayShift(mixed, 3, "night"), mixed);
});

// ---------- 쉬는 날 ----------
test("오픈반 주 쉬는 날: 알바·출근 준비 대신 휴식, 12:00 점심이 생긴다", () => {
  const s = { ...DEFAULT_SETTINGS, workdays: [true, true, true, true, true, true, false] };
  const plan = dayPlan(new Date(2026, 9, 3), s); // 오픈반 주 토요일
  assert.equal(plan.shift, "open");
  assert.equal(plan.working, false);
  assert.equal(plan.blocks.some((x) => x.kind === "work" || x.kind === "prep"), false);
  assert.deepEqual(plan.blocks.slice(0, 6).map((x) => [x.start, x.name]),
    [["05:30", "기상"], ["06:00", "아침"], ["06:30", "휴식"], ["12:00", "점심"], ["13:00", "휴식"], ["16:00", "운동"]]);
});

test("마감반 주 쉬는 날: 18:00 저녁이 생긴다", () => {
  const s = { ...DEFAULT_SETTINGS, workdays: [true, true, true, true, true, true, false] };
  const plan = dayPlan(new Date(2026, 8, 26), s); // 마감반 주 토요일
  const names = plan.blocks.map((x) => `${x.start} ${x.name}`);
  assert.ok(names.includes("18:00 저녁"));
  assert.ok(names.includes("19:00 휴식"));
  assert.equal(find(plan.blocks, "meal").every((x) => x.len === 60), true);
});

test("일하는 평일은 일과표를 그대로 쓴다", () => {
  const plan = dayPlan(new Date(2026, 8, 25), DEFAULT_SETTINGS);
  assert.equal(plan.blocks, DEFAULT_TEMPLATES.close);
});

test("일요일은 운동·샤워 칸이 휴식이 되고, 이어진 휴식은 하나로 합친다", () => {
  const sun = dayPlan(new Date(2026, 8, 27), DEFAULT_SETTINGS); // 마감반 주 일요일
  assert.equal(sun.blocks.some((x) => x.kind === "exercise" || x.kind === "shower"), false);
  assert.deepEqual(sun.blocks.slice(0, 6).map((x) => `${x.start} ${x.name}`),
    ["05:30 기상", "06:00 취미", "08:00 휴식", "08:30 가사", "09:00 휴식", "09:30 교회", "12:00 점심"].slice(0, 6), "아침 자리는 휴식, 운동 + 샤워 자리는 교회 (핫픽스 v3.0.4 · v3.1.1)");
  const openSun = dayPlan(new Date(2026, 9, 4), DEFAULT_SETTINGS); // 오픈반 주 일요일
  assert.deepEqual(openSun.blocks.slice(4, 7).map((x) => `${x.start} ${x.name}`),
    ["15:30 휴식", "18:00 취미", "20:00 저녁"], "알바 뒤 휴식 + 운동 + 샤워가 한 칸으로");
  assert.equal(find(DEFAULT_TEMPLATES.open, "exercise").length, 1); // 기본 일과표는 그대로
});

test("쉬는 일요일: 쉬는 날 규칙과 운동 없음이 같이 적용된다", () => {
  const s = { ...DEFAULT_SETTINGS, workdays: [false, true, true, true, true, true, true] };
  const names = dayPlan(new Date(2026, 8, 27), s).blocks.map((x) => `${x.start} ${x.name}`);
  assert.ok(names.includes("18:00 저녁"));
  assert.ok(!names.some((n) => n.includes("운동")));
});

// ---------- 핫픽스 v3.0.4 아침 · 일요일 교회 + 핫픽스 v3.1.1 새벽형 (기상 05:30) ----------
const everyDay = (v) => ({ ...DEFAULT_SETTINGS, dayShifts: Array(7).fill(v) });
const offSundayAfter = (v) => ({ ...DEFAULT_SETTINGS, dayShifts: [OFF, v, v, v, v, v, v] }); // 일요일만 쉼 → 토요일 반의 일과
const planNames = (date, s) => dayPlan(date, s).blocks.map((x) => `${x.start} ${x.name}`);
const SUN = new Date(2026, 9, 11);
const WEEKDAYS = [12, 13, 14, 15, 16, 17].map((d) => new Date(2026, 9, d)); // 월~토

test("월~토: 세 반 모두 알바 날 · 쉬는 날에 05:30 기상, 아침 30분, 하루 24시간이 빈틈 · 겹침 없이 이어진다 (쉬는 날 취미는 그 반 일과 그대로 — 은월 선택)", () => {
  for (const shift of ["open", "mid", "close"]) {
    for (const s of [everyDay(shift), { ...DEFAULT_SETTINGS, dayShifts: [shift, OFF, OFF, OFF, OFF, OFF, shift] }]) {
      for (const d of WEEKDAYS) {
        const blocks = dayPlan(d, s).blocks;
        const all = spans(blocks);
        assert.deepEqual(blocks.slice(0, 2).map((x) => `${x.start} ${x.kind}`), ["05:30 sleep", shift === "open" ? "06:00 breakfast" : "06:00 hobby"], `${shift} ${d.getDate()}일`);
        assert.deepEqual(find(blocks, "breakfast").map((x) => [x.start, x.len]), [[shift === "open" ? "06:00" : "08:00", 30]]);
        assert.deepEqual([blocks.at(-1).start, all.at(-1).len], ["22:30", 420], "취침 22:30 → 05:30");
        assert.deepEqual(sortBlocks(blocks), blocks);
        assert.equal(checkTemplate(blocks), "", "같은 시각에 칸이 둘이면 안 된다");
        assert.equal(all.reduce((a, x) => a + x.len, 0), 1440);
        assert.ok(!blocks.some((x) => x.kind === "church"), "교회는 일요일에만");
        assert.equal(find(blocks, "hobby")[0].start, shift === "open" ? "18:00" : "06:00");
        assert.equal(find(blocks, "hobby")[0].len, 120);
        const i = all.findIndex((x) => x.kind === "exercise");
        assert.deepEqual([all[i].len, all[i + 1].kind, all[i + 1].len], [90, "shower", 30]);
      }
    }
  }
  // 알바 뒤 30분 휴식 (오픈반 · 중간반)
  for (const shift of ["open", "mid"]) {
    const all = spans(dayPlan(WEEKDAYS[0], everyDay(shift)).blocks);
    const i = all.findIndex((x) => x.kind === "work");
    assert.deepEqual([all[i + 1].kind, all[i + 1].len, all[i + 2].kind], ["rest", 30, "exercise"], shift);
  }
});

test("일요일 · 마감반으로 알바: 아침 없음 (그 30분은 휴식), 취미 06:00 그대로, 교회 09:30~12:00", () => {
  assert.deepEqual(planNames(SUN, everyDay("close")), ["05:30 기상", "06:00 취미", "08:00 휴식", "08:30 가사", "09:00 휴식", "09:30 교회", "12:00 점심",
    "13:00 휴식", "14:00 출근 준비", "15:00 알바 · 마감반", "22:00 리뷰", "22:30 취침"]);
});

test("일요일 · 쉬는 날: 오픈반 일과는 저녁 취미 18:00 (20:00 저녁도 그대로), 마감반 · 중간반 일과는 취미 06:00", () => {
  assert.deepEqual(planNames(SUN, offSundayAfter("open")), ["05:30 기상", "06:00 휴식", "09:30 교회", "12:00 점심", "13:00 휴식", "18:00 취미",
    "20:00 저녁", "21:00 가사", "21:30 리뷰", "22:00 휴식", "22:30 취침"]);
  assert.deepEqual(planNames(SUN, offSundayAfter("close")), ["05:30 기상", "06:00 취미", "08:00 휴식", "08:30 가사", "09:00 휴식", "09:30 교회", "12:00 점심",
    "13:00 휴식", "18:00 저녁", "19:00 휴식", "22:00 리뷰", "22:30 취침"]);
  // 중간반 일과로 쉬는 일요일: 10:00 점심이 교회에 덮여 집 끼니는 저녁 하나 (v3.0.4 부터 그대로)
  assert.deepEqual(planNames(SUN, offSundayAfter("mid")), ["05:30 기상", "06:00 취미", "08:00 휴식", "08:30 가사", "09:00 휴식", "09:30 교회", "12:00 휴식",
    "18:00 저녁", "19:00 휴식", "21:30 리뷰", "22:00 휴식", "22:30 취침"]);
});

test("일요일 · 알바 · 출근 준비가 교회 시간과 겹치면 교회 칸을 넣지 않는다 (중간반 — 은월 선택, 오픈반도 같은 이유)", () => {
  assert.deepEqual(planNames(SUN, everyDay("mid")), ["05:30 기상", "06:00 취미", "08:00 휴식", "08:30 가사", "09:00 휴식", "10:00 점심",
    "11:00 출근 준비", "12:00 알바 · 중간반", "19:00 휴식", "21:30 리뷰", "22:00 휴식", "22:30 취침"]);
  assert.deepEqual(planNames(SUN, everyDay("open")), ["05:30 기상", "06:00 휴식", "07:30 출근 준비", "08:30 알바 · 오픈반", "15:30 휴식", "18:00 취미",
    "20:00 저녁", "21:00 가사", "21:30 리뷰", "22:00 휴식", "22:30 취침"]);
  // 캘린더에서 온 반이어도 같은 규칙 (요일이 기준)
  const cal = { ...everyDay("open"), cal: { from: "2026-10-05", until: "2026-10-18", shifts: { "2026-10-11": "close" } } };
  assert.ok(planNames(SUN, cal).includes("09:30 교회"));
});

test("일요일: 어느 경우든 아침 칸이 없고, 하루 24시간이 빈틈 · 겹침 없이 이어지며, 취미는 2시간", () => {
  for (const shift of ["open", "mid", "close"]) {
    for (const s of [everyDay(shift), offSundayAfter(shift)]) {
      const blocks = dayPlan(SUN, s).blocks;
      assert.ok(!blocks.some((x) => x.kind === "breakfast" || x.kind === "exercise" || x.kind === "shower"), shift);
      assert.deepEqual(sortBlocks(blocks), blocks);
      assert.equal(checkTemplate(blocks), "");
      assert.equal(spans(blocks).reduce((a, x) => a + x.len, 0), 1440);
      assert.deepEqual([blocks[0].start, blocks[0].kind], ["05:30", "sleep"]);
      const hobby = find(blocks, "hobby");
      assert.deepEqual(hobby.map((x) => [x.start, x.len]), [[shift === "open" ? "18:00" : "06:00", 120]], shift);
      const church = find(blocks, "church");
      if (church.length) assert.deepEqual([church[0].start, church[0].len, church[0].name], ["09:30", 150, "교회"]);
    }
  }
});

test("v3.0.4 직접 고친 일과표(아침 칸 없음)도 일요일에는 교회 칸이 들어가고, 덮인 칸은 12:00 부터 이어진다", () => {
  const mine = [{ start: "07:00", kind: "custom", name: "산책", note: "" }, { start: "08:00", kind: "custom", name: "공부", note: "" },
    { start: "13:00", kind: "meal", name: "점심", note: "" }, { start: "23:00", kind: "sleep", name: "취침", note: "" }];
  const s = { ...everyDay(OFF), templates: { ...DEFAULT_TEMPLATES, open: mine } };
  assert.deepEqual(planNames(SUN, s), ["07:00 산책", "08:00 공부", "09:30 교회", "12:00 공부", "13:00 점심", "23:00 취침"]);
  assert.deepEqual(planNames(WEEKDAYS[0], s), ["07:00 산책", "08:00 공부", "13:00 점심", "23:00 취침"]);
});

// v3.0.1 ~ v3.0.3 기본값 (기상 06:00, 아침 칸 없음)
const V303 = {
  open: "06:00 rest 휴식|07:30 prep 출근 준비|08:30 work 알바 · 오픈반|15:30 rest 휴식|16:00 exercise 운동|17:30 shower 샤워|18:00 meal 저녁|19:00 hobby 취미|21:00 chores 가사|21:30 rest 휴식|22:30 review 리뷰|23:00 sleep 취침",
  mid: "06:00 rest 휴식|07:00 hobby 취미|09:00 chores 가사|09:30 rest 휴식|10:00 meal 점심|11:00 prep 출근 준비|12:00 work 알바 · 중간반|19:00 rest 휴식|19:30 exercise 운동|21:00 shower 샤워|21:30 rest 휴식|22:30 review 리뷰|23:00 sleep 취침",
  close: "06:00 rest 휴식|07:00 hobby 취미|09:00 chores 가사|09:30 rest 휴식|10:00 exercise 운동|11:30 shower 샤워|12:00 meal 점심|13:00 rest 휴식|14:00 prep 출근 준비|15:00 work 알바 · 마감반|22:00 rest 휴식|22:30 review 리뷰|23:00 sleep 취침",
};
const v303Blocks = (shift) => V303[shift].split("|").map((x) => {
  const [start, kind, ...name] = x.split(" ");
  return { start, kind, name: name.join(" "), note: "" };
});

test("v3.0.4 폰에 v3.0.1 ~ v3.0.3 기본 일과표가 그대로 있으면 새 기본값(아침 칸)으로, 한 칸이라도 고친 반은 그대로", () => {
  const up = upgradeTemplates({ open: v303Blocks("open"), mid: v303Blocks("mid"), close: v303Blocks("close") });
  for (const shift of ["open", "mid", "close"]) {
    assert.equal(up[shift], DEFAULT_TEMPLATES[shift], shift);
    assert.equal(upgradeTemplates(up)[shift], DEFAULT_TEMPLATES[shift], `${shift} 두 번 돌려도 같다`);
    const mine = v303Blocks(shift).map((x) => (x.kind === "sleep" ? { ...x, start: "23:30" } : x));
    assert.equal(upgradeTemplates({ [shift]: mine })[shift], mine, `${shift} 직접 고친 것`);
  }
  assert.deepEqual(upgradeTemplates(JSON.parse(JSON.stringify(DEFAULT_TEMPLATES))), DEFAULT_TEMPLATES, "저장됐다 읽힌 새 기본값도 그대로");
});

test("'지금': 05:40 은 기상(05:30~06:00), 06:10 은 아침, 일요일 07:00 은 취미 · 10:00 은 교회, 새벽 3시는 어젯밤 취침", () => {
  const mon = dayPlan(WEEKDAYS[0], everyDay("open")).blocks;
  const at = (blocks, hhmm) => nowInfo(blocks, toMin(hhmm));
  assert.deepEqual([at(mon, "05:40").block.name, at(mon, "05:40").start, at(mon, "05:40").end, at(mon, "05:40").leftMin], ["기상", "05:30", "06:00", 20]);
  assert.deepEqual([at(mon, "06:10").block.name, at(mon, "06:10").next.name], ["아침", "휴식"]);
  assert.deepEqual([at(mon, "03:00").block.name, at(mon, "03:00").start, at(mon, "03:00").end], ["취침", "22:30", "05:30"]);
  assert.deepEqual([at(mon, "05:29").block.name, at(mon, "05:30").block.name], ["취침", "기상"]);
  const sun = dayPlan(SUN, everyDay("close")).blocks;
  assert.equal(at(sun, "07:00").block.name, "취미");
  assert.deepEqual([at(sun, "10:00").block.name, at(sun, "10:00").end], ["교회", "12:00"]);
});

// ---------- 지금 ----------
test("지금 칸: 경계 시각에는 새 칸이 시작된다", () => {
  const blocks = DEFAULT_TEMPLATES.open;
  assert.equal(blocks[currentIndex(blocks, toMin("08:29"))].name, "출근 준비");
  assert.equal(blocks[currentIndex(blocks, toMin("08:30"))].name, "알바 · 오픈반");
});

test("새벽 3시는 전날 밤부터 이어진 취침이다", () => {
  const info = nowInfo(DEFAULT_TEMPLATES.open, toMin("03:00"));
  assert.equal(info.block.kind, "sleep");
  assert.equal(info.end, "05:30");
  assert.equal(info.leftMin, 150);
  assert.equal(info.pct, 64); // 22:30~05:30 중 4시간 30분 지남
  assert.equal(info.next.start, "05:30");
});

test("'지금' 카드 값: 남은 시간과 진행률", () => {
  const info = nowInfo(DEFAULT_TEMPLATES.open, toMin("09:30"));
  assert.equal(info.block.name, "알바 · 오픈반");
  assert.equal(info.end, "15:30");
  assert.equal(info.leftMin, 360);
  assert.equal(info.pct, 14);
  assert.equal(info.next.name, "휴식"); // 알바 끝나고 30분 쉰다
  assert.equal(leftLabel(360), "남은 시간 6시간 0분");
  assert.equal(leftLabel(45), "남은 시간 45분");
});

// ---------- 설정 확인 ----------
test("설정에서 고친 일과표의 잘못을 알려 준다", () => {
  assert.match(checkTemplate([{ start: "9:00", name: "a" }]), /못 읽겠어/);
  assert.match(checkTemplate([{ start: "09:00", name: " " }]), /이름이 없어/);
  assert.match(checkTemplate([{ start: "09:00", name: "a" }, { start: "09:00", name: "b" }]), /두 개/);
  assert.match(checkTemplate([]), /하나도/);
  assert.equal(checkTemplate([{ start: "", name: "" }]), "새 칸에 시각을 적어 줘.");
});

test("핫픽스 v2.5.1: 기본값과 다른 마감반은 한 번만 기본값으로 맞추고, 예전 것은 oldClose 에 남긴다", () => {
  const now = new Date(2026, 9, 2, 9);
  const edited = [b2("06:00", "chores", "가사"), b2("06:30", "rest", "휴식"), b2("09:00", "hobby", "취미"), b2("15:00", "work", "알바 · 마감반"), b2("23:00", "sleep", "취침")];
  const phone = { ...DEFAULT_SETTINGS, templates: { open: DEFAULT_TEMPLATES.open, close: edited } };
  const fixed = alignCloseOnce(phone, now);
  assert.deepEqual(fixed.templates.close, DEFAULT_TEMPLATES.close);
  assert.deepEqual(fixed.templates.open, DEFAULT_TEMPLATES.open, "오픈반은 그대로");
  assert.deepEqual(fixed.oldClose, { at: now.toISOString(), blocks: edited }, "예전 마감반은 지우지 않는다");
  assert.equal(fixed.closeReset, CLOSE_RESET);
  // 그 뒤에 직접 고친 마감반은 다시 건드리지 않는다
  const later = { ...fixed, templates: { ...fixed.templates, close: edited } };
  assert.equal(alignCloseOnce(later, now), later);
  // 이미 기본값이면 표시만 남기고 보관할 것 없음
  const same = alignCloseOnce({ ...DEFAULT_SETTINGS }, now);
  assert.equal(same.closeReset, CLOSE_RESET);
  assert.equal(same.oldClose, undefined);
  // 오픈반을 고쳐 둔 폰도 오픈반은 그대로
  const openEdited = [...DEFAULT_TEMPLATES.open.slice(0, -1), b2("23:30", "sleep", "취침")];
  assert.deepEqual(alignCloseOnce({ ...DEFAULT_SETTINGS, templates: { open: openEdited, close: edited } }, now).templates.open, openEdited);
});
function b2(start, kind, name, note = "") { return { start, kind, name, note }; }

test("v2.9 칸 길이: 시각 순서로 다음 칸까지, 마지막 칸은 다음 날 첫 칸까지 · 못 읽는 시각은 비워 둔다", () => {
  const open = DEFAULT_TEMPLATES.open;
  const lens = blockLengths(open);
  assert.deepEqual(lens.slice(0, 6), [30, 30, 60, 60, 420, 30]);
  assert.equal(lens.at(-1), 420, "취침 22:30 → 다음 날 05:30");
  assert.equal(lens.reduce((a, n) => a + n, 0), 1440, "하루를 빈틈없이 채운다");
  // 고치는 중: 순서가 섞여 있고 새 칸은 시각이 비어 있다
  const draft = [{ start: "22:00" }, { start: "06:00" }, { start: "" }, { start: "07:30" }];
  assert.deepEqual(blockLengths(draft), [480, 90, null, 870]);
  assert.deepEqual(blockLengths([{ start: "06:00" }]), [1440]);
  assert.deepEqual([lengthLabel(90), lengthLabel(60), lengthLabel(30), lengthLabel(420)], ["1시간 30분", "1시간", "30분", "7시간"]);
  assert.deepEqual([endOf(open, 0), endOf(open, open.length - 1)], ["06:00", "05:30"]);
});

// ---------- 핫픽스 v3.0.7: 하루 첫 칸 이름 '기상' ----------
// v3.0.7 ~ v3.1 기본값 (기상 06:00 · 취침 23:00). v3.0.4 ~ v3.0.6 은 같은 모양에 첫 칸 이름만 '취침'
const V31 = {
  open: "06:00 sleep 기상|06:30 breakfast 아침|07:00 rest 휴식|07:30 prep 출근 준비|08:30 work 알바 · 오픈반|15:30 rest 휴식|16:00 exercise 운동|17:30 shower 샤워|18:00 meal 저녁|19:00 hobby 취미|21:00 chores 가사|21:30 rest 휴식|22:30 review 리뷰|23:00 sleep 취침",
  mid: "06:00 sleep 기상|06:30 breakfast 아침|07:00 hobby 취미|09:00 chores 가사|09:30 rest 휴식|10:00 meal 점심|11:00 prep 출근 준비|12:00 work 알바 · 중간반|19:00 rest 휴식|19:30 exercise 운동|21:00 shower 샤워|21:30 rest 휴식|22:30 review 리뷰|23:00 sleep 취침",
  close: "06:00 sleep 기상|06:30 breakfast 아침|07:00 hobby 취미|09:00 chores 가사|09:30 rest 휴식|10:00 exercise 운동|11:30 shower 샤워|12:00 meal 점심|13:00 rest 휴식|14:00 prep 출근 준비|15:00 work 알바 · 마감반|22:00 rest 휴식|22:30 review 리뷰|23:00 sleep 취침",
};
const v31Blocks = (shift) => V31[shift].split("|").map((x) => {
  const [start, kind, ...name] = x.split(" ");
  return { start, kind, name: name.join(" "), note: "" };
});
const v306Blocks = (shift) => v31Blocks(shift).map((x, i) => (i === 0 ? { ...x, name: "취침" } : x));

test("기본 일과표: 세 반의 첫 칸(05:30~06:00) 이름은 '기상' (v3.0.7), 밤 22:30 은 '취침', 반마다 14칸", () => {
  assert.equal(WAKE, "기상");
  for (const shift of ["open", "mid", "close"]) {
    const blocks = DEFAULT_TEMPLATES[shift];
    assert.deepEqual([blocks[0].start, blocks[0].kind, blocks[0].name, blocks[1].start], ["05:30", "sleep", "기상", "06:00"], shift);
    assert.deepEqual([blocks.at(-1).start, blocks.at(-1).kind, blocks.at(-1).name], ["22:30", "sleep", "취침"], shift);
    assert.equal(blocks.length, 14);
    assert.equal(blocks.filter((x) => x.name === "기상").length, 1);
  }
});

test("v3.0.7 폰에 v3.0.4 ~ v3.0.6 기본 일과표(첫 칸 '취침')가 그대로 있으면 새 기본값으로, 두 번 돌려도 같다", () => {
  const up = upgradeTemplates({ open: v306Blocks("open"), mid: v306Blocks("mid"), close: v306Blocks("close") });
  for (const shift of ["open", "mid", "close"]) {
    assert.equal(up[shift], DEFAULT_TEMPLATES[shift], shift);
    assert.equal(upgradeTemplates(up)[shift], DEFAULT_TEMPLATES[shift]);
  }
  assert.deepEqual(upgradeTemplates(JSON.parse(JSON.stringify(DEFAULT_TEMPLATES))), DEFAULT_TEMPLATES, "저장됐다 읽힌 새 기본값도 그대로");
});

test("핫픽스 v3.1.1 폰에 v3.0.7 ~ v3.1 기본 일과표(기상 06:00 · 취침 23:00)가 그대로 있으면 새벽형으로, 한 칸이라도 고친 반은 그대로", () => {
  const phone = { open: v31Blocks("open"), mid: v31Blocks("mid"), close: v31Blocks("close") };
  assert.deepEqual(["open", "mid", "close"].map((k) => [phone[k][0].start, phone[k].at(-1).start, phone[k].length]), [["06:00", "23:00", 14], ["06:00", "23:00", 14], ["06:00", "23:00", 14]]);
  const up = upgradeTemplates(JSON.parse(JSON.stringify(phone))); // 폰에서 읽은 것처럼
  for (const shift of ["open", "mid", "close"]) {
    assert.equal(up[shift], DEFAULT_TEMPLATES[shift], shift);
    assert.deepEqual([up[shift][0].start, up[shift].at(-1).start], ["05:30", "22:30"]);
    assert.equal(upgradeTemplates(up)[shift], DEFAULT_TEMPLATES[shift], `${shift} 두 번 돌려도 같다`);
    const renamed = v31Blocks(shift).map((x) => (x.kind === "hobby" ? { ...x, name: "게임" } : x));
    const moved = v31Blocks(shift).map((x) => (x.kind === "review" ? { ...x, start: "22:40" } : x));
    const fewer = v31Blocks(shift).filter((x) => x.kind !== "chores");
    for (const mine of [renamed, moved, fewer]) assert.equal(upgradeTemplates({ [shift]: mine })[shift], mine, `${shift} 직접 고친 것`);
  }
  // 한 반만 고친 폰: 고친 반은 그대로, 나머지 두 반만 새벽형
  const mixedPhone = upgradeTemplates({ ...phone, mid: phone.mid.map((x) => (x.kind === "hobby" ? { ...x, name: "게임" } : x)) });
  assert.deepEqual([mixedPhone.open === DEFAULT_TEMPLATES.open, mixedPhone.mid[0].start, mixedPhone.close === DEFAULT_TEMPLATES.close], [true, "06:00", true]);
  // 직접 고친 반(첫 칸 06:00)도 안 깨진다: 05:40 은 전날부터 이어진 취침, 하루는 빈틈없이
  const s = { ...DEFAULT_SETTINGS, dayShifts: Array(7).fill("mid"), templates: mixedPhone };
  const blocks = dayPlan(WEEKDAYS[0], s).blocks;
  assert.equal(nowInfo(blocks, toMin("05:40")).block.name, "취침");
  assert.equal(spans(blocks).reduce((a, x) => a + x.len, 0), 1440);
});

test("v3.0.7 저장된 첫 칸 이름 옮기기: 06:00 에 시작하고 이름이 정확히 '취침' 일 때만 '기상' 으로, 한 번만", () => {
  const edited = v306Blocks("open").map((x) => (x.kind === "exercise" ? { ...x, start: "16:10", name: "운동 (헬스장)" } : x)); // 직접 고친 반
  const named = v306Blocks("mid").map((x, i) => (i === 0 ? { ...x, name: "늦잠" } : x));                                         // 직접 지은 이름
  const late = [{ start: "07:00", kind: "sleep", name: "취침", note: "" }, { start: "08:00", kind: "custom", name: "산책", note: "" }, { start: "23:00", kind: "sleep", name: "취침", note: "" }];
  const phone = { dayShifts: ["off", "open", "open", "mid", "close", "close", "off"], templates: { open: edited, mid: named, close: late } };
  const out = renameWakeOnce(phone);
  assert.equal(out.wakeNamed, WAKE_NAMED);
  // 직접 고친 반: 첫 칸 이름만 바뀌고 나머지는 그대로
  assert.deepEqual(out.templates.open[0], { ...edited[0], name: "기상" });
  assert.deepEqual(out.templates.open.slice(1), edited.slice(1));
  assert.equal(out.templates.open.at(-1).name, "취침", "밤 취침은 그대로");
  assert.equal(out.templates.mid, named, "직접 지은 이름은 건드리지 않는다");
  assert.equal(out.templates.close, late, "06:00 에 시작하지 않는 첫 칸은 그대로");
  assert.deepEqual(out.dayShifts, phone.dayShifts);
  assert.equal(edited[0].name, "취침", "원본은 건드리지 않는다");
  assert.equal(renameWakeOnce(out), out, "표시가 있으면 다시 하지 않는다");
  // 이미 '기상' 이면 아무 일도 없다 (표시만 남는다)
  const already = renameWakeOnce({ templates: DEFAULT_TEMPLATES });
  assert.equal(already.templates.open, DEFAULT_TEMPLATES.open);
  // 옮긴 뒤 일부러 '취침' 으로 다시 적은 건 또 바꾸지 않는다
  const back = { ...out, templates: { ...out.templates, open: edited } };
  assert.equal(renameWakeOnce(back).templates.open[0].name, "취침");
  // 이름을 보고 동작하는 곳은 없다: 옛 이름이어도 '지금' · 일요일 규칙이 똑같이 돈다
  const s = (templates) => ({ ...DEFAULT_SETTINGS, dayShifts: Array(7).fill("close"), templates });
  const oldName = DEFAULT_TEMPLATES.close.map((x, i) => (i === 0 ? { ...x, name: "취침" } : x));
  const [oldSun, newSun] = [dayPlan(SUN, s({ ...DEFAULT_TEMPLATES, close: oldName })).blocks, dayPlan(SUN, s(DEFAULT_TEMPLATES)).blocks];
  assert.deepEqual(oldSun.map((x) => `${x.start} ${x.kind}`), newSun.map((x) => `${x.start} ${x.kind}`));
  assert.deepEqual([nowInfo(oldSun, toMin("05:40")).block.name, nowInfo(newSun, toMin("05:40")).block.name], ["취침", "기상"]);
});
