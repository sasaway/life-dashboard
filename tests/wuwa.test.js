import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY, WEEKLY, BUILD, gameDay, dailyKey, weeklyKey, dailyDone, weeklyDone, toggleDaily, tapWeekly,
  dailyCount, weeklyCount, cleanCharacters, searchCharacters, addParty, renameParty, removeParty,
  placeCharacter, clearSlot, whereIs, toggleBuild, buildCount, ELEMENTS, elementKey, filterCharacters,
  partyMembers, filledCount,
} from "../js/wuwa.js";

const at = (d, h, m = 0) => new Date(2026, 8, d, h, m); // 2026-09-21 월

test("Notion 의 체크리스트 그대로: 일일 4개, 주간 4개(주간보스 3칸), 육성 5개", () => {
  assert.deepEqual(DAILY.map((d) => d.label), ["일일 의뢰", "플레이트 소모", "잔상군락", "이벤트 확인"]);
  assert.equal(WEEKLY.length, 4);
  assert.equal(WEEKLY.find((w) => w.id === "boss").max, 3);
  assert.deepEqual(BUILD.map((b) => b.label), ["레벨 돌파", "무기 돌파", "스킬작", "에코작 대충", "에코작 준종결"]);
});

test("하루는 새벽 5시에 바뀐다", () => {
  assert.equal(dailyKey(at(25, 4, 59)), "2026-09-24");
  assert.equal(dailyKey(at(25, 5, 0)), "2026-09-25");
  assert.equal(gameDay(at(1 + 30, 3)).getDate(), 30); // 10/1 03시 → 9/30
});

test("주는 월요일 새벽 5시에 바뀐다 (일요일 밤·월요일 새벽 4시는 아직 지난주)", () => {
  assert.equal(weeklyKey(at(27, 23)), "2026-09-21");
  assert.equal(weeklyKey(at(28, 4, 59)), "2026-09-21");
  assert.equal(weeklyKey(at(28, 5)), "2026-09-28");
});

test("일일 체크: 누르면 켜지고 다시 누르면 꺼지며, 5시가 지나면 비어 있다", () => {
  let s = toggleDaily({}, at(25, 10), "commission");
  s = toggleDaily(s, at(25, 11), "plate");
  assert.deepEqual(dailyCount(s, at(25, 23)), { done: 2, total: 4 });
  assert.deepEqual(dailyCount(s, at(26, 4)), { done: 2, total: 4 }); // 새벽 4시는 아직 같은 날
  assert.deepEqual(dailyCount(s, at(26, 5)), { done: 0, total: 4 }); // 초기화
  s = toggleDaily(s, at(25, 12), "commission");
  assert.deepEqual(dailyDone(s, at(25, 12)), { commission: 0, plate: 1 });
});

test("주간보스는 3칸: n번째를 누르면 n까지, 같은 칸을 다시 누르면 하나 되돌림", () => {
  let s = tapWeekly({}, at(22, 12), "boss", 2);
  assert.equal(weeklyDone(s, at(22, 12)).boss, 2);
  s = tapWeekly(s, at(23, 12), "boss", 2);
  assert.equal(weeklyDone(s, at(23, 12)).boss, 1);
  s = tapWeekly(s, at(23, 12), "boss", 3);
  s = tapWeekly(s, at(23, 12), "synth");
  assert.deepEqual(weeklyCount(s, at(27, 22)), { done: 4, total: 6 });
  assert.deepEqual(weeklyCount(s, at(28, 5)), { done: 0, total: 6 }); // 월요일 5시 초기화
});

test("encore.moe 목록 정리: 같은 이름은 하나만, 5성 먼저, 그다음 이름순", () => {
  const raw = [
    { Id: 1, Name: "양양", QualityId: 4, Element: { Name: "기류" }, RoleHeadIcon: "a.webp" },
    { Id: 2, Name: "방랑자 · 기류", QualityId: 5, Element: { Name: "기류" }, RoleHeadIcon: "b.webp" },
    { Id: 3, Name: "방랑자 · 기류", QualityId: 5, Element: { Name: "기류" }, RoleHeadIcon: "c.webp" },
    { Id: 4, Name: "금희", QualityId: 5, Element: { Name: "회절" }, RoleHeadIcon: "d.webp" },
  ];
  const list = cleanCharacters(raw);
  assert.deepEqual(list.map((c) => c.name), ["금희", "방랑자 · 기류", "양양"]);
  assert.deepEqual(list[0], { id: "4", name: "금희", stars: 5, element: "회절", icon: "d.webp" });
  assert.deepEqual(searchCharacters(list, "방랑 자").map((c) => c.id), ["2"]); // 띄어쓰기 무시
  assert.deepEqual(searchCharacters(list, "기류").map((c) => c.id), ["2", "1"]); // 속성으로도
  assert.equal(searchCharacters(list, " ").length, 3);
});

test("파티 추가·이름 바꾸기·지우기", () => {
  let ps = addParty([], "p1");
  ps = addParty(ps, "p2");
  assert.deepEqual(ps.map((p) => [p.name, p.slots]), [["파티 1", [null, null, null]], ["파티 2", [null, null, null]]]);
  ps = renameParty(ps, "p1", " 메인 딜 ");
  assert.equal(ps[0].name, "메인 딜");
  assert.equal(renameParty(ps, "p1", "   ")[0].name, "메인 딜"); // 빈 이름이면 그대로
  assert.deepEqual(removeParty(ps, "p1").map((p) => p.id), ["p2"]);
});

test("캐릭터를 다른 칸에 넣으면 원래 칸에서 옮겨 온다 (한 캐릭터는 한 칸)", () => {
  let ps = addParty(addParty([], "p1"), "p2");
  ps = placeCharacter(ps, "p1", 0, "금희");
  ps = placeCharacter(ps, "p1", 1, "양양");
  assert.deepEqual(whereIs(ps, "금희"), { pid: "p1", name: "파티 1", idx: 0 });
  ps = placeCharacter(ps, "p2", 2, "금희");
  assert.deepEqual(ps.map((p) => p.slots), [[null, "양양", null], [null, null, "금희"]]);
  ps = clearSlot(ps, "p1", 1);
  assert.equal(whereIs(ps, "양양"), null);
});

test("육성 체크는 캐릭터마다 따로 5개", () => {
  let b = toggleBuild({}, "금희", "lv");
  b = toggleBuild(b, "금희", "skill");
  b = toggleBuild(b, "양양", "lv");
  assert.equal(buildCount(b, "금희"), 2);
  b = toggleBuild(b, "금희", "lv");
  assert.equal(buildCount(b, "금희"), 1);
  assert.equal(buildCount(b, "없는캐릭"), 0);
});

test("속성은 게임 순서 6개, 이름으로 색 이름을 찾는다", () => {
  assert.deepEqual(ELEMENTS.map((e) => e.name), ["응결", "용융", "전도", "기류", "회절", "인멸"]);
  assert.equal(elementKey("회절"), "spectro");
  assert.equal(elementKey("모름"), "");
});

test("고르기 창: 찾는 글자와 속성 칩이 둘 다 맞는 캐릭터만", () => {
  const list = [
    { id: "1", name: "금희", element: "회절" },
    { id: "2", name: "카멜리아", element: "인멸" },
    { id: "3", name: "파수인", element: "회절" },
  ];
  assert.deepEqual(filterCharacters(list, "", "회절").map((c) => c.id), ["1", "3"]);
  assert.deepEqual(filterCharacters(list, "금", "회절").map((c) => c.id), ["1"]);
  assert.deepEqual(filterCharacters(list, "금", "인멸"), []);
  assert.equal(filterCharacters(list, "", "").length, 3);
});

test("육성 목록: 파티에 넣은 캐릭터를 파티·칸 순서대로, 빈칸은 빼고", () => {
  const parties = [
    { id: "a", name: "파티 1", slots: ["x", null, "y"] },
    { id: "b", name: "파티 2", slots: [null, "z", null] },
  ];
  assert.deepEqual(partyMembers(parties).map((m) => `${m.partyName}:${m.idx}:${m.id}`), ["파티 1:0:x", "파티 1:2:y", "파티 2:1:z"]);
  assert.equal(filledCount(parties[0]), 2);
  assert.equal(filledCount(parties[1]), 1);
});
