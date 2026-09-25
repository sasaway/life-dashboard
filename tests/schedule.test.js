import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS, DEFAULT_TEMPLATES, SHIFTS, toMin, shiftFor, setThisWeek,
  dayPlan, currentIndex, nowInfo, leftLabel, checkTemplate, sortBlocks,
} from "../js/schedule.js";

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
for (const shift of ["open", "close"]) {
  const blocks = DEFAULT_TEMPLATES[shift];
  const label = SHIFTS[shift].label;

  test(`${label} 주: 취침은 23:00~06:00`, () => {
    const [sleep] = find(blocks, "sleep");
    assert.equal(sleep.start, "23:00");
    assert.equal(blocks[0].start, "06:00");
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

  test(`${label} 주: 운동 2시간 바로 뒤에 샤워 30분`, () => {
    const all = spans(blocks);
    const i = all.findIndex((x) => x.kind === "exercise");
    assert.equal(all[i].len, 120);
    assert.equal(all[i + 1].kind, "shower");
    assert.equal(all[i + 1].len, 30);
  });

  test(`${label} 주: 가사 30분, 취미 2시간`, () => {
    assert.equal(find(blocks, "chores")[0].len, 30);
    assert.equal(find(blocks, "hobby")[0].len, 120);
  });

  test(`${label} 주: 집에서 먹는 끼니는 1시간씩, 알바 중 끼니는 없다`, () => {
    const meals = find(blocks, "meal");
    assert.equal(meals.length, 1); // 나머지 한 끼는 알바 식대
    assert.equal(meals[0].len, 60);
  });

  test(`${label} 주: 자기 직전이 리뷰`, () => {
    const all = spans(blocks);
    assert.equal(all[all.length - 2].kind, "review");
  });

  test(`${label} 주: 칸은 시간순이고 겹치지 않는다`, () => {
    assert.deepEqual(sortBlocks(blocks), blocks);
    assert.equal(checkTemplate(blocks), "");
  });
}

test("취미 시간은 두 주가 같거나 12시간 차이다", () => {
  const a = find(DEFAULT_TEMPLATES.open, "hobby")[0].s;
  const c = find(DEFAULT_TEMPLATES.close, "hobby")[0].s;
  assert.ok(a === c || Math.abs(a - c) === 720);
});

// ---------- 격주 ----------
test("2026-09-21 주는 마감반, 다음 주는 오픈반, 그 전 주도 오픈반", () => {
  assert.equal(shiftFor(new Date(2026, 8, 21), DEFAULT_SETTINGS), "close");
  assert.equal(shiftFor(new Date(2026, 8, 27), DEFAULT_SETTINGS), "close"); // 일요일도 같은 주
  assert.equal(shiftFor(new Date(2026, 8, 28), DEFAULT_SETTINGS), "open");
  assert.equal(shiftFor(new Date(2026, 8, 14), DEFAULT_SETTINGS), "open");
  assert.equal(shiftFor(new Date(2026, 9, 5), DEFAULT_SETTINGS), "close");
});

test("'이번 주는 오픈반' 으로 바꾸면 이번 주와 다다음 주가 오픈반이 된다", () => {
  const s = setThisWeek(DEFAULT_SETTINGS, new Date(2026, 8, 24), "open");
  assert.equal(s.anchorMonday, "2026-09-21");
  assert.equal(shiftFor(new Date(2026, 8, 25), s), "open");
  assert.equal(shiftFor(new Date(2026, 9, 1), s), "close");
  assert.equal(shiftFor(new Date(2026, 9, 8), s), "open");
});

// ---------- 쉬는 날 ----------
test("오픈반 주 쉬는 날: 알바·출근 준비 대신 휴식, 12:00 점심이 생긴다", () => {
  const s = { ...DEFAULT_SETTINGS, workdays: [true, true, true, true, true, true, false] };
  const plan = dayPlan(new Date(2026, 9, 3), s); // 오픈반 주 토요일
  assert.equal(plan.shift, "open");
  assert.equal(plan.working, false);
  assert.equal(plan.blocks.some((x) => x.kind === "work" || x.kind === "prep"), false);
  assert.deepEqual(plan.blocks.slice(0, 4).map((x) => [x.start, x.name]),
    [["06:00", "휴식"], ["12:00", "점심"], ["13:00", "휴식"], ["16:00", "운동"]]);
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
  assert.deepEqual(sun.blocks.slice(0, 5).map((x) => `${x.start} ${x.name}`),
    ["06:00 가사", "06:30 휴식", "08:00 취미", "10:00 휴식", "12:30 점심"]);
  const openSun = dayPlan(new Date(2026, 9, 4), DEFAULT_SETTINGS); // 오픈반 주 일요일
  assert.deepEqual(openSun.blocks.slice(3, 6).map((x) => `${x.start} ${x.name}`),
    ["15:30 휴식", "18:30 저녁", "19:30 가사"]);
});

test("쉬는 일요일: 쉬는 날 규칙과 운동 없음이 같이 적용된다", () => {
  const s = { ...DEFAULT_SETTINGS, workdays: [false, true, true, true, true, true, true] };
  const names = dayPlan(new Date(2026, 8, 27), s).blocks.map((x) => `${x.start} ${x.name}`);
  assert.ok(names.includes("18:00 저녁"));
  assert.ok(!names.some((n) => n.includes("운동")));
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
  assert.equal(info.end, "06:00");
  assert.equal(info.leftMin, 180);
  assert.equal(info.pct, 57); // 23:00~06:00 중 4시간 지남
  assert.equal(info.next.start, "06:00");
});

test("'지금' 카드 값: 남은 시간과 진행률", () => {
  const info = nowInfo(DEFAULT_TEMPLATES.open, toMin("09:30"));
  assert.equal(info.block.name, "알바 · 오픈반");
  assert.equal(info.end, "15:30");
  assert.equal(info.leftMin, 360);
  assert.equal(info.pct, 14);
  assert.equal(info.next.name, "휴식");
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
