import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_CHORES, TAGS, PERIODS, normalizeChores, choreList, choreDay, choreWeek, choreDone, toggleChore, choreSections,
  addChore, removeChore, resetChores, hiddenCount,
} from "../js/wf-chores.js";

// 한국 시간으로 적는다 (테스트를 돌리는 곳의 시간대와 상관없게 UTC 로 바꿔서)
const kst = (m, d, h, min = 0) => new Date(Date.UTC(2026, m - 1, d, h - 9, min));
const byName = (name) => DEFAULT_CHORES.find((c) => c.name === name);

test("v3.4 기본 숙제 42줄: 기호 ＊19 · 표시 없음 14 · ＃5 · §4, id 는 c01 ~ c42 로 겹치지 않는다", () => {
  assert.equal(DEFAULT_CHORES.length, 42);
  const n = (tag) => DEFAULT_CHORES.filter((c) => c.tag === tag).length;
  assert.deepEqual([n("star"), n(""), n("hash"), n("sec")], [19, 14, 5, 4]);
  assert.deepEqual([DEFAULT_CHORES[0].id, DEFAULT_CHORES.at(-1).id], ["c01", "c42"]);
  assert.equal(new Set(DEFAULT_CHORES.map((c) => c.id)).size, 42);
  assert.equal(new Set(DEFAULT_CHORES.map((c) => c.name)).size, 42);
  assert.ok(DEFAULT_CHORES.every((c) => c.place && c.group && c.name && c.tag in TAGS && c.period in PERIODS));
  assert.deepEqual([...new Set(DEFAULT_CHORES.map((c) => c.place))], ["일반", "릴레이", "지구", "금성", "데이모스", "자리만", "천왕성", "두비리", "1999", "XX99"]);
  // 기호가 세부 구분에 붙은 줄: 콘클레이브 세 줄은 모두 §
  assert.deepEqual(DEFAULT_CHORES.filter((c) => c.group === "콘클레이브").map((c) => c.tag), ["sec", "sec", "sec"]);
  assert.deepEqual([byName("집정관 사냥").tag, byName("출격").tag, byName("오스트론").tag, byName("클렘 도와주기").tag], ["star", "", "hash", "sec"]);
});

test("v3.4 기간: 일간은 매일, 주간은 매주. '일/주간' 두 줄은 매일, '격주 주말' 한 줄은 매주 — 원래 글자는 note 에 남긴다", () => {
  const p = (period) => DEFAULT_CHORES.filter((c) => c.period === period).length;
  assert.deepEqual([p("day"), p("week")], [21, 21]);
  assert.deepEqual(DEFAULT_CHORES.filter((c) => c.note).map((c) => [c.name, c.period, c.note]), [
    ["나이트웨이브 미션", "day", "일/주간"], ["바로 키 티어 상점", "week", "격주 주말"], ["아크리티스 일/주간 상점", "day", "일/주간"],
  ]);
});

test("v3.4 화면 묶음: 필수(＊) 19줄 = 매일 7 + 이번 주 12, 선택 23줄은 표시 없음 → ＃ → § 순서 (같은 기호 안에서는 표 순서)", () => {
  const s = choreSections({}, kst(10, 11, 14));
  assert.deepEqual(s.counts, { must: { done: 0, total: 19 }, day: { done: 0, total: 7 }, week: { done: 0, total: 12 }, optional: { done: 0, total: 23 } });
  assert.deepEqual(s.day.map((c) => c.name), ["나이트웨이브 미션", "일일 포커스 경험치", "솔라리스 연합", "엔트라티", "네크랄로이드", "카비아", "헥스"]);
  assert.equal(s.week[0].name, "집정관 사냥");
  assert.ok(s.week.some((c) => c.name === "바로 키 티어 상점"));
  assert.deepEqual(s.optional.map((c) => c.tag), [...Array(14).fill(""), ...Array(5).fill("hash"), ...Array(4).fill("sec")]);
  assert.deepEqual([s.optional[0].name, s.optional[14].name, s.optional[19].name], ["나이트웨이브 주간 상점", "세팔론 시마리스", "클렘 도와주기"]);
  assert.ok([...s.day, ...s.week].every((c) => c.tag === "star"));
});

test("v3.4 체크 / 풀기와 진행도: 필수 3 / 19 처럼 센다, 선택 숙제는 필수 숫자에 안 들어간다", () => {
  const now = kst(10, 11, 14);
  let s = toggleChore({}, byName("일일 포커스 경험치").id, now);
  s = toggleChore(s, byName("솔라리스 연합").id, now);
  s = toggleChore(s, byName("네트라셀").id, now);
  s = toggleChore(s, byName("출격").id, now); // 선택
  const c = choreSections(s, now).counts;
  assert.deepEqual([c.must, c.day, c.week, c.optional], [{ done: 3, total: 19 }, { done: 2, total: 7 }, { done: 1, total: 12 }, { done: 1, total: 23 }]);
  s = toggleChore(s, byName("솔라리스 연합").id, now);
  assert.equal(choreSections(s, now).counts.must.done, 2, "다시 누르면 풀린다");
  assert.equal(toggleChore(s, "없는 줄", now).done.c06, s.done.c06);
  assert.deepEqual(toggleChore({}, "없는 줄", now), { hidden: [], custom: [], done: {} });
});

test("v3.4 매일 숙제는 한국 09:00 (00:00 UTC) 에 비워진다: 08:59 까지는 어제 체크가 남고 09:00 부터 비어 있다", () => {
  assert.deepEqual([choreDay(kst(10, 12, 8, 59)), choreDay(kst(10, 12, 9, 0))], ["2026-10-11", "2026-10-12"]);
  const item = byName("일일 포커스 경험치");
  const s = toggleChore({}, item.id, kst(10, 11, 22)); // 일요일 밤에 체크
  assert.equal(choreDone(s, item, kst(10, 11, 23, 59)), true);
  assert.equal(choreDone(s, item, kst(10, 12, 1, 30)), true, "새벽 1시(오늘 체크가 비는 때)에도 숙제는 남는다");
  assert.equal(choreDone(s, item, kst(10, 12, 8, 59)), true);
  assert.equal(choreDone(s, item, kst(10, 12, 9, 0)), false);
  // '일/주간' 줄도 매일
  const nw = byName("나이트웨이브 미션");
  const t = toggleChore({}, nw.id, kst(10, 13, 10));
  assert.deepEqual([choreDone(t, nw, kst(10, 14, 8, 59)), choreDone(t, nw, kst(10, 14, 9, 0))], [true, false]);
});

test("v3.4 주간 숙제는 월요일 한국 09:00 에 비워진다: 주중 · 일요일 밤 · 월요일 08:59 까지 남는다. '격주 주말' 줄도 같다", () => {
  assert.deepEqual([choreWeek(kst(10, 12, 8, 59)), choreWeek(kst(10, 12, 9, 0)), choreWeek(kst(10, 18, 23)), choreWeek(kst(10, 19, 9, 0))],
    ["2026-10-05", "2026-10-12", "2026-10-12", "2026-10-19"]);
  const item = byName("네트라셀");
  const s = toggleChore({}, item.id, kst(10, 13, 20)); // 화요일
  for (const when of [kst(10, 14, 9, 0), kst(10, 16, 3), kst(10, 18, 23, 59), kst(10, 19, 8, 59)]) assert.equal(choreDone(s, item, when), true);
  assert.equal(choreDone(s, item, kst(10, 19, 9, 0)), false, "다음 월요일 09:00");
  assert.equal(choreDone(s, item, kst(10, 12, 9, 0)), true, "그 주 월요일 09:00 부터");
  const baro = byName("바로 키 티어 상점");
  const b = toggleChore({}, baro.id, kst(10, 17, 12));
  assert.deepEqual([choreDone(b, baro, kst(10, 19, 8, 59)), choreDone(b, baro, kst(10, 19, 9, 0))], [true, false]);
  // 연 · 달이 바뀌는 주
  assert.equal(choreWeek(new Date(Date.UTC(2027, 0, 1, 12))), "2026-12-28");
});

test("v3.4 지난 날 · 지난 주의 체크는 다음에 체크할 때 치운다 (저장이 불어나지 않게)", () => {
  let s = toggleChore({}, byName("일일 포커스 경험치").id, kst(10, 11, 22));
  s = toggleChore(s, byName("네트라셀").id, kst(10, 11, 22));
  s = toggleChore(s, byName("헥스").id, kst(10, 12, 10)); // 월요일 09:00 뒤: 어제 · 지난주 체크는 다 지난 것
  assert.deepEqual(Object.keys(s.done), [byName("헥스").id]);
});

test("v3.4 목록 고치기: 기본 줄을 지우면 숨기고 체크도 치운다, '되돌리기' 로 지운 기본 줄이 전부 돌아온다", () => {
  const now = kst(10, 11, 14);
  let s = toggleChore({}, byName("출격").id, now);
  s = removeChore(s, byName("출격").id);
  s = removeChore(s, byName("집정관 사냥").id);
  assert.deepEqual(s.hidden, ["c04", "c05"]);
  assert.equal("c04" in s.done, false);
  assert.equal(choreList(s).length, 40);
  assert.deepEqual([choreSections(s, now).counts.must.total, choreSections(s, now).counts.optional.total], [18, 22]);
  assert.equal(hiddenCount(s), 2);
  assert.deepEqual(removeChore(s, "c04"), s, "이미 지운 줄 · 없는 줄은 그대로");
  assert.deepEqual(removeChore(s, "없는 줄"), s);
  const back = resetChores(s);
  assert.deepEqual([back.hidden, choreList(back).length], [[], 42]);
});

test("v3.4 목록 고치기: 새 숙제 더하기 (이름 + 기호 + 매일/매주), 이름이 없거나 같은 이름이면 막는다. 직접 더한 줄은 지우면 사라지고 되돌리기로 안 돌아온다", () => {
  const now = kst(10, 11, 14);
  let r = addChore({}, "  렐릭   까기 ", "star", "week", "x1");
  assert.equal(r.error, "");
  assert.deepEqual(r.chores.custom, [{ id: "x1", name: "렐릭 까기", tag: "star", period: "week" }]);
  assert.match(addChore(r.chores, "   ", "star", "day").error, /이름/);
  assert.match(addChore(r.chores, "렐릭 까기", "", "day").error, /이미/);
  assert.match(addChore(r.chores, "출격", "", "day").error, /이미/, "기본 줄과 같은 이름도");
  assert.equal(addChore(r.chores, "출격", "", "day").chores.custom.length, 1, "막으면 그대로");
  r = addChore(r.chores, "가".repeat(50), "이상한 기호", "언젠가", "x2");
  assert.deepEqual([r.chores.custom[1].name.length, r.chores.custom[1].tag, r.chores.custom[1].period], [30, "", "day"], "글자 수 · 모르는 값 다듬기");
  let s = r.chores;
  const sec = choreSections(s, now);
  assert.deepEqual([sec.counts.must.total, sec.counts.week.total, sec.counts.optional.total], [20, 13, 24]);
  assert.equal(sec.week.at(-1).name, "렐릭 까기");
  assert.equal(sec.week.at(-1).custom, true);
  s = toggleChore(s, "x1", now);
  assert.equal(choreSections(s, now).counts.must.done, 1);
  s = removeChore(s, "x1");
  assert.deepEqual([s.custom.length, "x1" in s.done, s.hidden], [1, false, []]);
  assert.equal(resetChores(s).custom.length, 1, "되돌리기는 직접 더한 줄을 안 건드린다");
  assert.equal(addChore({}, "새 숙제", "hash", "day").chores.custom[0].id.startsWith("x"), true);
});

test("v3.4 저장은 기본값에서 바뀐 것만: 옛 폰(칸 없음) · 깨진 값도 기본 목록으로 열리고, 기본 목록이 바뀌어도 은월이 지우고 더한 것은 남는다", () => {
  for (const bad of [null, undefined, "x", 3, [], { hidden: "c01", custom: "x", done: [] }]) {
    assert.deepEqual(normalizeChores(bad), { hidden: [], custom: [], done: {} });
    assert.equal(choreList(bad).length, 42);
  }
  // 나중 버전에서 없어진 기본 줄(c99)을 지워 둔 저장, 모르는 줄의 체크, 모양이 이상한 직접 줄
  const saved = { hidden: ["c04", "c99", 7], custom: [{ id: "x1", name: "렐릭 까기", tag: "star", period: "week" }, { id: "x2" }, null, { id: "x3", name: " ", tag: "", period: "day" }], done: { c99: "2026-10-11", x1: "2026-10-05" } };
  const s = normalizeChores(saved);
  assert.deepEqual(s.hidden, ["c04", "c99"]);
  assert.deepEqual(s.custom.map((c) => c.id), ["x1"]);
  assert.equal(choreList(saved).length, 42 - 1 + 1);
  assert.equal(hiddenCount(saved), 1, "없어진 줄은 '지운 기본 숙제' 로 세지 않는다");
  assert.equal(choreDone(saved, choreList(saved).at(-1), kst(10, 11, 14)), true);
  assert.doesNotThrow(() => choreSections(saved, kst(10, 11, 14)));
  // 받은 값은 안 바꾼다
  const before = JSON.stringify(saved);
  toggleChore(saved, "c01", kst(10, 11, 14)); removeChore(saved, "c01"); addChore(saved, "새것", "", "day"); resetChores(saved);
  assert.equal(JSON.stringify(saved), before);
  assert.deepEqual(normalizeChores(JSON.parse(JSON.stringify(s))), s, "저장됐다 읽혀도 같다");
});

test("v3.4 숙제는 취미 첫 화면의 '오늘 n / 2' 와 기록 시트로 나가지 않는다 (은월 선택), 새 파일은 오프라인 목록에 들어 있다", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  for (const f of ["../js/hobby-sync.js", "../js/hobby-sync-view.js", "../js/life-sync.js", "../js/hobby-log.js", "../js/hobby-log-view.js", "../apps-script/hobby-sync.gs"]) {
    assert.ok(!/wfChores|wf-chores|숙제/.test(read(f)), f);
  }
  const view = read("../js/wf-chores-view.js");
  assert.match(view, /const KEY = "wfChores"/);
  assert.ok(!view.includes("markSyncDirty"), "시트로 보내지 않는다");
  const sw = read("../sw.js");
  assert.ok(sw.includes('"js/wf-chores.js"') && sw.includes('"js/wf-chores-view.js"'));
  const html = read("../index.html");
  assert.ok(html.indexOf('id="wfTodayCard"') < html.indexOf('id="wfChoreCard"') && html.indexOf('id="wfChoreCard"') < html.indexOf('id="wfTodoForm"'), "오늘 체크 아래 · 할 일 위");
  assert.match(html, /매일 09:00 · 월요일 09:00 에 비워져/);
});
