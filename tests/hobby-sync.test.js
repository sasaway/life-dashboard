import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gearRows, otherRows, partyRows, payload, replyError, EMPTY_SLOT, SENT_TABS } from "../js/hobby-sync.js";
import { DEFAULT_SETTINGS } from "../js/schedule.js";

const gear = {
  frames: [
    { id: "w", frame: "나린", styles: [], wish: true, sortie: "(Cross) Bow", primary: "눈차사", secondary: "아크손돌", melee: "데스트레자", companion: "" },
    { id: "a", frame: "트리니티", styles: ["Support", "Survival"], wish: false, sortie: "Rifle", primary: "볼토", secondary: "라토", melee: "스컬", companion: "카밧" },
  ],
  others: ["쏜바크", "볼터"],
};
const chars = [{ id: "1503", name: "벨리나" }, { id: "1102", name: "산화" }, { id: "pre-suoming", name: "쇄명" }];

test("장비 → 시트 행: 칸 순서대로, 플레이스타일은 쉼표, 위시리스트는 예/아니오 · 맨 아래", () => {
  assert.deepEqual(gearRows(gear), [
    ["트리니티", "Support, Survival", "볼토", "Rifle", "라토", "스컬", "카밧", "아니오"],
    ["나린", "", "눈차사", "(Cross) Bow", "아크손돌", "데스트레자", "", "예"],
  ]);
  assert.deepEqual(otherRows(gear), [["쏜바크"], ["볼터"]]);
  assert.deepEqual(gearRows({ frames: [], others: [] }), []);
});

test("파티 → 이름으로 바꾼 행: 빈칸은 '(비어 있음)', 체크는 O / 빈칸", () => {
  const parties = [{ id: "p1", name: "메인", slots: ["1102", null, "pre-suoming"] }];
  const builds = { 1102: { lv: 1, skill: 1, echo2: 1 } };
  assert.deepEqual(partyRows(parties, builds, chars), [
    ["메인", "1", "산화", "O", "", "O", "", "O"],
    ["메인", "2", EMPTY_SLOT, "", "", "", "", ""],
    ["메인", "3", "쇄명", "", "", "", "", ""],
  ]);
  assert.equal(partyRows([{ id: "p", name: "x", slots: ["9"] }], {}, chars)[0][2], "알 수 없는 공명자 (9)");
});

test("코스트 2 공명자가 두 파티에 있으면 두 줄 다, 육성 체크는 같게", () => {
  const parties = [{ id: "p1", name: "A", slots: ["1503", null, null] }, { id: "p2", name: "B", slots: [null, "1503", null] }];
  const rows = partyRows(parties, { 1503: { lv: 1 } }, chars).filter((r) => r[2] === "벨리나");
  assert.deepEqual(rows, [["A", "1", "벨리나", "O", "", "", "", ""], ["B", "2", "벨리나", "O", "", "", "", ""]]);
});

test("주소나 암호 글자가 없으면 보내지 않는다 · 있으면 아홉 탭과 암호만 보낸다", () => {
  const data = { gear, parties: [], builds: {}, chars, settings: DEFAULT_SETTINGS, workoutLog: {}, mealLog: {}, reviews: {}, weekReviews: {}, hobbyLog: {}, todos: [] };
  const now = new Date(2026, 9, 3, 20, 0);
  assert.equal(payload({ url: "", token: "t" }, data, now), null);
  assert.equal(payload({ url: "https://script.google.com/macros/s/x/exec", token: "" }, data, now), null);
  const body = JSON.parse(payload({ url: "https://script.google.com/macros/s/x/exec", token: "t" }, data, now));
  assert.deepEqual(Object.keys(body), ["token", "warframe", "others", "wuwa", "today", "recent", "meals", "workouts", "hobby", "reviews"]);
  assert.equal(body.token, "t");
  assert.equal(body.warframe.length, 2);
});

// 심부름꾼 코드(TABS)와 앱이 보내는 것이 어긋나지 않게: 탭 이름 · 보내는 이름 · 칸 수
test("심부름꾼의 탭 목록과 앱이 보내는 것이 같다 (이름 · 칸 수), '픽업 일정' 은 앱이 적는 탭이 아니다", () => {
  const gs = readFileSync(new URL("../apps-script/hobby-sync.gs", import.meta.url), "utf8");
  const DAY = [...gs.match(/const DAY = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const tabs = [...gs.matchAll(/\{ key: "(\w+)", name: "([^"]+)", header: (DAY|\[[^\]]*\])/g)].map((m) => ({
    key: m[1], name: m[2], width: m[3] === "DAY" ? DAY.length : [...m[3].matchAll(/"([^"]+)"/g)].length,
  }));
  assert.deepEqual(tabs.map((t) => t.name), SENT_TABS);
  assert.ok(!SENT_TABS.includes("픽업 일정"));
  const data = {
    gear, parties: [{ id: "p", name: "x", slots: ["1102", null, null] }], builds: {}, chars, settings: DEFAULT_SETTINGS,
    workoutLog: { "2026-10-03": { legpress: 2 } }, mealLog: { "2026-10-03": [{ label: "저녁", dish: "jja" }] },
    reviews: { "2026-10-03": { answers: ["a", "", "", ""] } }, weekReviews: {}, hobbyLog: { days: { "2026-10-03": { ww: [1, 4] } } }, todos: [],
  };
  const body = JSON.parse(payload({ url: "u", token: "t" }, data, new Date(2026, 9, 3, 20, 0)));
  assert.deepEqual(Object.keys(body).slice(1), tabs.map((t) => t.key));
  for (const t of tabs) {
    assert.ok(body[t.key].length > 0, `${t.name} 에 줄이 있다`);
    for (const row of body[t.key]) assert.equal(row.length, t.width, `${t.name} 칸 수`);
  }
});

test("심부름꾼 답 읽기", () => {
  assert.equal(replyError({ ok: true }), "");
  assert.match(replyError({ ok: false, error: "token" }), /암호/);
  assert.match(replyError({ ok: false, error: "no-setup" }), /setup/);
  assert.match(replyError(null), /이상해/);
});
