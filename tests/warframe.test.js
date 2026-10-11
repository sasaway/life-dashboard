import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY, dayKey, dailyDone, toggleDaily, dailyCount, addTodo, toggleTodo, removeTodo, pruneTodos, leftTodos,
  PLAYSTYLES, SORTIE_TYPES, DEFAULT_GEAR, migrateGear, addFrame, updateFrame, toggleStyle, setSortie, toggleWish,
  removeFrame, isBlankFrame, addOther, removeOther,
  sortieView, rewardHits, invasionView, alertView, timeLeft, missionKo, factionKo,
  liveDue, liveAtLabel, moveTodo, GEAR_SLOTS, MAX_FORMA, catLabel, otherKey, buildOf, setBuild, gearPct, gearItems,
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

test("장비 목록은 워프레임 기준: Notion 표의 병합 칸은 두 플레이스타일을 다 가진다", () => {
  assert.deepEqual(PLAYSTYLES, ["Invisibility", "Damage", "Support", "Survival", "Crowd Control"]);
  assert.deepEqual(SORTIE_TYPES, ["Shotgun", "Rifle", "Precision Rifle", "(Cross) Bow"]);
  assert.deepEqual(DEFAULT_GEAR.frames.map((f) => [f.frame, f.styles, f.wish]), [
    ["오락시아", ["Invisibility", "Damage"], false],
    ["트리니티", ["Support", "Survival"], false],
    ["벤쉬", ["Crowd Control"], false],
    ["나린", [], true],
  ]);
  const ora = DEFAULT_GEAR.frames[0];
  assert.deepEqual([ora.primary, ora.sortie, ora.secondary, ora.melee, ora.companion],
    ["쿠바 소백", "Shotgun", "사이오티드", "스피너랙스", "스미타 카밧"]);
  assert.equal(DEFAULT_GEAR.frames[2].sortie, "Precision Rifle");
  assert.equal(DEFAULT_GEAR.others.length, 8);
});

test("옛 형식(플레이스타일 줄)은 워프레임 기준으로 옮긴다: 빈 줄은 바로 위 워프레임에 합친다", () => {
  const old = {
    rows: [
      { id: "inv", style: "Invisibility", frame: "오락시아", sortie: "Shotgun", primary: "쿠바 소백", secondary: "", melee: "", companion: "" },
      { id: "dmg", style: "Damage", frame: "", sortie: "", primary: "", secondary: "", melee: "", companion: "" },
      { id: "sup", style: "Support", frame: "세반", sortie: "Pistol", primary: "", secondary: "", melee: "", companion: "" },
      { id: "wish", style: "Wish List", frame: "나린", sortie: "(Cross) Bow", primary: "", secondary: "", melee: "", companion: "" },
    ],
    others: ["볼터"],
  };
  const g = migrateGear(old);
  assert.deepEqual(g.frames.map((f) => [f.id, f.frame, f.styles, f.wish, f.sortie]), [
    ["inv", "오락시아", ["Invisibility", "Damage"], false, "Shotgun"],
    ["sup", "세반", ["Support"], false, ""], // 네 가지에 없는 분류는 비운다
    ["wish", "나린", [], true, "(Cross) Bow"],
  ]);
  assert.deepEqual(g.others, ["볼터"]);
  assert.equal(migrateGear(DEFAULT_GEAR), DEFAULT_GEAR); // 새 형식은 그대로
});

test("워프레임 추가·고치기: 플레이스타일은 여러 개 체크, Sortie 분류는 넷 중 하나", () => {
  let g = addFrame(DEFAULT_GEAR, "n1");
  assert.deepEqual(g.frames.at(-1), { id: "n1", frame: "", styles: [], wish: false, sortie: "", primary: "", secondary: "", melee: "", companion: "" });
  assert.equal(DEFAULT_GEAR.frames.length, 4); // 기본값은 그대로
  g = updateFrame(g, "n1", { frame: " 세반 " });
  g = toggleStyle(g, "n1", "Survival");
  g = toggleStyle(g, "n1", "Damage");
  assert.deepEqual(g.frames.at(-1).styles, ["Damage", "Survival"]); // 표 순서대로
  g = toggleStyle(g, "n1", "Survival");
  assert.deepEqual(g.frames.at(-1).styles, ["Damage"]);
  g = setSortie(g, "n1", "Rifle");
  assert.equal(g.frames.at(-1).sortie, "Rifle");
  g = setSortie(g, "n1", "Rifle"); // 같은 걸 다시 누르면 비운다
  assert.equal(g.frames.at(-1).sortie, "");
  g = toggleWish(g, "n1");
  assert.deepEqual([g.frames.at(-1).frame, g.frames.at(-1).wish], ["세반", true]);
  assert.equal(removeFrame(g, "n1").frames.length, 4);
});

test("그 외 육성 무기 추가·지우기", () => {
  let g = addOther(DEFAULT_GEAR, " 브라톤 ");
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

test("워프레임 추가 후 아무것도 안 적은 카드만 빈 카드로 본다", () => {
  const g = addFrame(DEFAULT_GEAR, "n1");
  const blank = g.frames.at(-1);
  assert.equal(isBlankFrame(blank), true);
  assert.equal(isBlankFrame(updateFrame(g, "n1", { melee: "보" }).frames.at(-1)), false);
  assert.equal(isBlankFrame(toggleStyle(g, "n1", "Damage").frames.at(-1)), false);
  assert.equal(isBlankFrame(toggleWish(g, "n1").frames.at(-1)), false);
  assert.equal(DEFAULT_GEAR.frames.some(isBlankFrame), false);
});

test("실시간 현황은 하루 한 번, 아침 브리핑 시각(05:21)에 새로 받는다 (v2.8.2 · v2.9 에서 05:51 → 05:21)", () => {
  assert.equal(liveAtLabel, "05:21");
  const at = (d, h, m) => new Date(2026, 9, d, h, m);
  assert.equal(liveDue(0, at(4, 12, 0)), true, "받은 적이 없으면 받는다");
  assert.equal(liveDue(at(4, 5, 20).getTime(), at(4, 5, 20)), false, "05:21 전에는 어제 것 그대로");
  assert.equal(liveDue(at(4, 5, 20).getTime(), at(4, 5, 21)), true, "05:21 이 되면 새로");
  assert.equal(liveDue(at(4, 5, 21).getTime(), at(4, 23, 0)), false, "그 날에는 다시 안 받는다 (10분마다 X)");
  assert.equal(liveDue(at(4, 5, 21).getTime(), at(5, 5, 20)), false, "다음 날 05:20 까지도");
  assert.equal(liveDue(at(4, 5, 21).getTime(), at(5, 5, 21)), true, "다음 날 05:21 에 새로");
  assert.equal(liveDue(at(3, 22, 0).getTime(), at(4, 2, 0)), false, "어제 저녁에 받았으면 새벽에는 안 받는다");
  assert.equal(liveDue(at(2, 22, 0).getTime(), at(4, 2, 0)), true, "어제 05:21 보다 앞이면 받는다");
});

// ---------- v3.3 오늘 할 일 순위 바꾸기 ----------
test("v3.3 순위 바꾸기: 줄을 맨 위 · 맨 아래 · 가운데로, 범위를 벗어나면 끝으로, 없는 줄 · 같은 자리는 그대로", () => {
  const todos = ["a", "b", "c", "d"].map((id) => ({ id, text: id, done: null }));
  const ids = (list) => list.map((t) => t.id).join("");
  assert.equal(ids(moveTodo(todos, "c", 0)), "cabd");
  assert.equal(ids(moveTodo(todos, "a", 3)), "bcda");
  assert.equal(ids(moveTodo(todos, "a", 2)), "bcad");
  assert.equal(ids(moveTodo(todos, "d", 1)), "adbc");
  assert.equal(ids(moveTodo(todos, "b", -5)), "bacd", "위로 넘치면 맨 위");
  assert.equal(ids(moveTodo(todos, "b", 99)), "acdb", "아래로 넘치면 맨 아래");
  assert.equal(moveTodo(todos, "b", 1), todos, "같은 자리면 받은 값 그대로");
  assert.equal(moveTodo(todos, "없음", 0), todos);
  assert.equal(moveTodo(todos, "a", NaN), todos);
  assert.equal(ids(todos), "abcd", "받은 값은 안 바꾼다");
  assert.deepEqual(moveTodo([], "a", 0), []);
  assert.equal(moveTodo(todos, "c", 0)[0], todos[2], "줄 내용은 그대로 (id · 글 · 체크)");
});

test("v3.3 순위를 바꿔도 체크 · 새벽 1시 규칙은 그대로: 체크한 줄도 옮겨지고, 새벽 1시가 지나면 체크한 것만 사라지고 순서는 남는다", () => {
  const night = new Date(2026, 9, 11, 22, 0);
  let todos = [];
  for (const [id, text] of [["a", "렐릭"], ["b", "포르마"], ["c", "평판"]]) todos = addTodo(todos, text, id);
  todos = toggleTodo(todos, night, "b"); // 체크한 줄
  todos = moveTodo(todos, "c", 0);
  todos = moveTodo(todos, "b", 1);
  assert.deepEqual(todos.map((t) => [t.id, Boolean(t.done)]), [["c", false], ["b", true], ["a", false]]);
  assert.equal(leftTodos(todos), 2);
  assert.deepEqual(pruneTodos(todos, night).map((t) => t.id), ["c", "b", "a"], "같은 날에는 그대로");
  assert.deepEqual(pruneTodos(todos, new Date(2026, 9, 12, 1, 0)).map((t) => t.id), ["c", "a"], "새벽 1시 뒤: 체크한 것만 사라지고 순서 유지");
  assert.deepEqual(addTodo(todos, "새 일", "n").map((t) => t.id), ["c", "b", "a", "n"], "새 항목은 맨 아래");
});

// ---------- v3.3 장비마다 육성: 리액터/카탈리스트 · 목표 모딩 · 포르마 · % ----------
test("v3.3 세 칸: 기록이 없는 장비는 전부 0, 켜고 끄기 · 글 다듬기 · 포르마는 0~99", () => {
  const g0 = DEFAULT_GEAR;
  assert.deepEqual(buildOf(g0, "inv:primary"), { cat: false, goal: "", done: false, forma: 0 });
  let g = setBuild(g0, "inv:primary", { cat: true });
  g = setBuild(g, "inv:primary", { goal: "  부식   세팅  " });
  g = setBuild(g, "inv:primary", { forma: 3 });
  assert.deepEqual(buildOf(g, "inv:primary"), { cat: true, goal: "부식 세팅", done: false, forma: 3 });
  assert.deepEqual(buildOf(g, "inv:secondary"), { cat: false, goal: "", done: false, forma: 0 }, "다른 장비는 그대로");
  assert.equal(buildOf(setBuild(g, "inv:primary", { cat: false }), "inv:primary").cat, false);
  assert.deepEqual([-1, 0, 99, 100, 2.9, "7", "abc", NaN].map((n) => buildOf(setBuild(g, "inv:primary", { forma: n }), "inv:primary").forma), [0, 0, 99, 99, 2, 7, 3, 3]);
  assert.equal(MAX_FORMA, 99);
  assert.equal(buildOf(setBuild(g, "inv:primary", { goal: "가".repeat(60) }), "inv:primary").goal.length, 40);
  assert.equal(g0.build, undefined, "받은 값은 안 바꾼다");
  assert.deepEqual([g.frames, g.others], [g0.frames, g0.others], "frames · others 는 그대로 (시트 두 탭이 안 바뀐다)");
});

test("v3.3 진행도 % = 장착 50 + 목표 모딩 완료 50 (포르마는 안 넣는다): 0 · 50 · 100", () => {
  assert.equal(gearPct({ cat: false, done: false, forma: 9, goal: "x" }), 0);
  assert.equal(gearPct({ cat: true, done: false, forma: 0, goal: "" }), 50, "카탈리스트는 꽂았고 모딩은 아직");
  assert.equal(gearPct({ cat: false, done: true, forma: 0, goal: "" }), 50);
  assert.equal(gearPct({ cat: true, done: true, forma: 0, goal: "" }), 100);
  assert.equal(gearPct(buildOf(DEFAULT_GEAR, "없는 열쇠")), 0);
});

test("v3.3 장비 줄: 이름이 적힌 자리만, 워프레임 · 동반자는 리액터 / 무기는 카탈리스트, 위시리스트는 아래 · 그 외 무기는 맨 아래", () => {
  assert.deepEqual(GEAR_SLOTS.map(([k]) => k), ["frame", "primary", "secondary", "melee", "companion"]);
  assert.deepEqual(["frame", "primary", "secondary", "melee", "companion", "other"].map(catLabel), ["리액터", "카탈리스트", "카탈리스트", "카탈리스트", "리액터", "카탈리스트"]);
  const g = setBuild(setBuild(DEFAULT_GEAR, "inv:primary", { cat: true, forma: 2 }), otherKey("볼터"), { cat: true, done: true });
  const items = gearItems(g);
  assert.equal(items.length, 5 + 5 + 5 + 4 + 8, "나린(위시리스트)은 동반자가 비어 4줄");
  assert.deepEqual(items.slice(0, 5).map((x) => `${x.label} ${x.name} ${x.pct}`), ["워프레임 오락시아 0", "주무기 쿠바 소백 50", "보조무기 사이오티드 0", "근접무기 스피너랙스 0", "동반자 스미타 카밧 0"]);
  assert.deepEqual([items[1].key, items[1].frame, items[1].sortie, items[1].cat, items[1].build.forma], ["inv:primary", "오락시아", "Shotgun", "카탈리스트", 2]);
  assert.equal(items[0].sortie, undefined, "Sortie 분류는 주무기 줄에만");
  assert.deepEqual(items.slice(15, 19).map((x) => x.frame), ["나린", "나린", "나린", "나린"], "위시리스트는 다른 워프레임 뒤");
  const volt = items.find((x) => x.key === "o:볼터");
  assert.deepEqual([volt.slot, volt.label, volt.frame, volt.index, volt.pct], ["other", "그 외 무기", "", 1, 100]);
  assert.deepEqual(gearItems({ frames: [], others: [] }), []);
  assert.equal(gearItems(addFrame(DEFAULT_GEAR, "new")).length, items.length, "이름이 하나도 없는 새 카드는 줄이 없다");
});

test("v3.3 무기 이름을 고쳐도 그 자리의 기록은 남고, 워프레임 · 그 외 무기를 지우면 그 기록도 지운다", () => {
  let g = setBuild(DEFAULT_GEAR, "inv:primary", { cat: true, goal: "부식", forma: 4 });
  g = setBuild(g, "sup:frame", { done: true });
  g = setBuild(g, otherKey("볼터"), { forma: 1 });
  const renamed = updateFrame(g, "inv", { primary: "쿠바 소백 프라임" });
  assert.deepEqual(buildOf(renamed, "inv:primary"), { cat: true, goal: "부식", done: false, forma: 4 });
  assert.equal(gearItems(renamed).find((x) => x.key === "inv:primary").name, "쿠바 소백 프라임");
  const noFrame = removeFrame(g, "inv");
  assert.deepEqual(Object.keys(noFrame.build).sort(), ["o:볼터", "sup:frame"]);
  const noOther = removeOther(g, g.others.indexOf("볼터"));
  assert.deepEqual(Object.keys(noOther.build).sort(), ["inv:primary", "sup:frame"]);
  // 같은 이름이 두 번 있으면 하나를 지워도 기록은 남는다
  const twice = addOther(g, "볼터");
  assert.ok("o:볼터" in removeOther(twice, twice.others.lastIndexOf("볼터")).build);
  // 기록이 없는 장비를 지울 때는 받은 build 를 그대로
  assert.equal(removeFrame(g, "cc").build, g.build);
  assert.equal(removeFrame(DEFAULT_GEAR, "cc").build, undefined);
});

test("v3.3 옛 저장 호환: build 가 없는 장비 목록 · v16 모양도 그대로 열리고, 옮길 때 육성 기록은 남는다", () => {
  const old = JSON.parse(JSON.stringify(DEFAULT_GEAR));
  assert.equal(migrateGear(old), old);
  assert.ok(gearItems(old).every((x) => x.pct === 0 && x.build.forma === 0));
  const v16 = { rows: [{ id: "r1", style: "Damage", frame: "오락시아", sortie: "Shotgun", primary: "쿠바 소백", secondary: "", melee: "", companion: "" }], others: ["볼터"] };
  const moved = migrateGear(v16);
  assert.equal("build" in moved, false);
  assert.deepEqual(gearItems(moved).map((x) => x.key), ["r1:frame", "r1:primary", "o:볼터"]);
  assert.deepEqual(migrateGear({ ...v16, build: { "r1:primary": { cat: true, goal: "", done: false, forma: 1 } } }).build, { "r1:primary": { cat: true, goal: "", done: false, forma: 1 } });
  // 저장됐다 읽혀도 같다
  const g = setBuild(DEFAULT_GEAR, "inv:primary", { cat: true, goal: "부식", forma: 4 });
  assert.deepEqual(gearItems(JSON.parse(JSON.stringify(g))), gearItems(g));
});
