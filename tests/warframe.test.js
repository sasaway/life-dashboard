import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY, dayKey, dailyDone, toggleDaily, dailyCount, addTodo, toggleTodo, removeTodo, pruneTodos, leftTodos,
  DEFAULT_GEAR, isWish, addRow, updateRow, removeRow, addOther, removeOther,
  sortieView, rewardHits, invasionView, alertView, timeLeft, missionKo, factionKo,
} from "../js/warframe.js";

const at = (d, h, m = 0) => new Date(2026, 8, d, h, m); // 2026-09-21 월

test("Notion 그대로: 오늘 체크는 출격 · 포르마 제작", () => {
  assert.deepEqual(DAILY.map((d) => d.label), ["출격", "포르마 제작"]);
});

test("하루는 새벽 1시에 바뀐다 (출격이 바뀌는 시각)", () => {
  assert.equal(dayKey(at(25, 0, 59)), "2026-09-24");
  assert.equal(dayKey(at(25, 1)), "2026-09-25");
});

test("오늘 체크: 누르면 켜지고 다시 누르면 꺼지며, 새벽 1시가 지나면 비어 있다", () => {
  let s = toggleDaily({}, at(25, 20), "sortie");
  assert.deepEqual(dailyCount(s, at(26, 0, 30)), { done: 1, total: 2 });
  assert.deepEqual(dailyCount(s, at(26, 1)), { done: 0, total: 2 });
  s = toggleDaily(s, at(25, 21), "sortie");
  assert.deepEqual(dailyDone(s, at(25, 21)), { sortie: 0 });
});

test("오늘 할 일: 빈 줄은 안 들어가고, 체크한 것만 새벽 1시에 사라지며 못 한 건 남는다", () => {
  let t = addTodo([], "  넥서스 확인 ", "a");
  t = addTodo(t, "   ", "x");
  t = addTodo(t, "렐릭 정제", "b");
  assert.deepEqual(t.map((x) => x.text), ["넥서스 확인", "렐릭 정제"]);
  t = toggleTodo(t, at(25, 22), "a");
  assert.equal(leftTodos(t), 1);
  assert.equal(pruneTodos(t, at(26, 0, 30)).length, 2); // 아직 같은 날
  assert.deepEqual(pruneTodos(t, at(26, 1)).map((x) => x.id), ["b"]);
  t = toggleTodo(t, at(25, 23), "a"); // 체크 풀기
  assert.equal(pruneTodos(t, at(27, 9)).length, 2);
  assert.deepEqual(removeTodo(t, "a").map((x) => x.id), ["b"]);
});

test("장비 목록 기본값은 Notion 로드아웃 표 (플레이스타일 6줄 + 그 외 육성 무기 8개)", () => {
  assert.deepEqual(DEFAULT_GEAR.rows.map((r) => r.style), ["Invisibility", "Damage", "Support", "Survival", "Crowd Control", "Wish List"]);
  const inv = DEFAULT_GEAR.rows[0];
  assert.deepEqual([inv.frame, inv.sortie, inv.primary, inv.secondary, inv.melee, inv.companion],
    ["오락시아", "Shotgun", "쿠바 소백", "사이오티드", "스피너랙스", "스미타 카밧"]);
  assert.equal(DEFAULT_GEAR.rows[1].frame, "");
  assert.equal(DEFAULT_GEAR.others.length, 8);
  assert.equal(isWish(DEFAULT_GEAR.rows[5]), true);
  assert.equal(isWish(inv), false);
});

test("장비 줄 추가·고치기·지우기, 그 외 무기 추가·지우기", () => {
  let g = addRow(DEFAULT_GEAR, "n1");
  assert.equal(g.rows.at(-1).id, "n1");
  assert.equal(DEFAULT_GEAR.rows.length, 6); // 기본값은 그대로
  g = updateRow(g, "n1", { style: " Damage ", frame: " 세반 " });
  assert.deepEqual([g.rows.at(-1).style, g.rows.at(-1).frame], ["Damage", "세반"]);
  g = removeRow(g, "n1");
  assert.equal(g.rows.length, 6);
  g = addOther(g, " 브라톤 ");
  g = addOther(g, "  ");
  assert.equal(g.others.at(-1), "브라톤");
  assert.equal(g.others.length, 9);
  assert.deepEqual(removeOther(g, 8).others, DEFAULT_GEAR.others);
});

test("미션 종류·세력만 한국어, 모르는 이름은 영어 그대로", () => {
  assert.equal(missionKo("Mobile Defense"), "이동 방어");
  assert.equal(missionKo("Netracells"), "Netracells");
  assert.equal(factionKo("Corpus"), "코퍼스");
  assert.equal(factionKo(undefined), "");
});

const SORTIE = {
  expiry: "2026-09-25T16:00:00.000Z", boss: "Hyena Pack", faction: "Corpus",
  variants: [
    { missionType: "Rescue", modifier: "Enemy Physical Enhancement: Slash", node: "Adrastea (Jupiter)" },
    { missionType: "Assassination", modifier: "Energy Reduction", node: "Psamathe (Neptune)" },
  ],
};

test("출격: 세 미션을 한국어 종류 · 지역 · 조건(영어)으로, 끝나면 없음", () => {
  const v = sortieView(SORTIE, new Date("2026-09-25T12:00:00Z"));
  assert.equal(v.boss, "Hyena Pack");
  assert.equal(v.faction, "코퍼스");
  assert.equal(v.left, 4 * 3600e3);
  assert.deepEqual(v.missions[0], { type: "구출", node: "Adrastea (Jupiter)", modifier: "Enemy Physical Enhancement: Slash" });
  assert.equal(sortieView(SORTIE, new Date("2026-09-25T16:00:01Z")), null);
  assert.equal(sortieView(null, new Date()), null);
});

test("침공: 오로킨 리액터·카탈리스트를 주는 편만, 끝난 침공은 빼고", () => {
  const side = (faction, type) => ({ faction, reward: { countedItems: [{ type, count: 1 }] } });
  const list = [
    { node: "Rhea (Saturn)", completed: false, attacker: side("Corpus", "Dera Vandal Stock"), defender: side("Grineer", "Orokin Reactor Blueprint") },
    { node: "Hades (Pluto)", completed: false, attacker: { faction: "Infested" }, defender: side("Corpus", "Mutalist Alad V Nav Coordinate") },
    { node: "Ceres", completed: true, attacker: side("Grineer", "Orokin Catalyst Blueprint"), defender: side("Corpus", "Fieldron") },
  ];
  assert.deepEqual(invasionView(list), [{ node: "Rhea (Saturn)", side: "그리니어", reward: "오로킨 리액터 설계도" }]);
  assert.deepEqual(rewardHits({ countedItems: [{ type: "Orokin Catalyst", count: 2 }] }), ["오로킨 카탈리스트 ×2"]);
});

test("얼럿: 리액터·카탈리스트를 주는 것만, 남은 시간과 함께", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const list = [
    { expiry: "2026-09-25T13:30:00Z", mission: { type: "Defense", node: "Kiliken (Venus)", faction: "Grineer", reward: { items: ["Orokin Catalyst Blueprint"], credits: 10000 } } },
    { expiry: "2026-09-25T13:30:00Z", mission: { type: "Spy", node: "Ose (Europa)", faction: "Corpus", reward: { items: ["Nitain Extract"] } } },
    { expiry: "2026-09-25T11:00:00Z", mission: { type: "Spy", node: "Old", faction: "Corpus", reward: { items: ["Orokin Reactor Blueprint"] } } },
  ];
  assert.deepEqual(alertView(list, now), [{ type: "방어", node: "Kiliken (Venus)", faction: "그리니어", reward: "오로킨 카탈리스트 설계도", left: 90 * 60e3 }]);
  assert.deepEqual(alertView(undefined, now), []);
});

test("남은 시간 글자", () => {
  assert.equal(timeLeft(3 * 3600e3 + 12 * 60e3 + 30e3), "3시간 12분");
  assert.equal(timeLeft(12 * 60e3), "12분");
  assert.equal(timeLeft(30e3), "곧 끝나");
});
