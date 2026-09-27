import { test } from "node:test";
import assert from "node:assert/strict";
import { gearRows, otherRows, partyRows, payload, replyError, EMPTY_SLOT } from "../js/hobby-sync.js";

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

test("주소나 암호 글자가 없으면 보내지 않는다 · 있으면 세 탭과 암호만 보낸다", () => {
  const data = { gear, parties: [], builds: {}, chars };
  assert.equal(payload({ url: "", token: "t" }, data), null);
  assert.equal(payload({ url: "https://script.google.com/macros/s/x/exec", token: "" }, data), null);
  const body = JSON.parse(payload({ url: "https://script.google.com/macros/s/x/exec", token: "t" }, data));
  assert.deepEqual(Object.keys(body), ["token", "warframe", "others", "wuwa"]);
  assert.equal(body.token, "t");
  assert.equal(body.warframe.length, 2);
});

test("심부름꾼 답 읽기", () => {
  assert.equal(replyError({ ok: true }), "");
  assert.match(replyError({ ok: false, error: "token" }), /암호/);
  assert.match(replyError({ ok: false, error: "no-setup" }), /setup/);
  assert.match(replyError(null), /이상해/);
});
