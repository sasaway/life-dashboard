import { test } from "node:test";
import assert from "node:assert/strict";
import { addItem, toggleStar, bring, starred, mainEmptyText } from "../js/shopping.js";

test("물건을 추가하면 목록 끝에 별표 없이 들어간다", () => {
  const { list, error } = addItem([], "  계란   30구 ", "a");
  assert.equal(error, "");
  assert.deepEqual(list, [{ id: "a", name: "계란 30구", star: false }]);
});

test("빈 이름과 이미 있는 이름은 막는다 (대소문자·앞뒤 공백 무시)", () => {
  const base = [{ id: "a", name: "Spam", star: false }];
  assert.match(addItem(base, "   ").error, /적어 줘/);
  assert.match(addItem(base, " spam ").error, /이미 목록에/);
  assert.equal(addItem(base, " spam ").list, base);
});

test("별표는 누를 때마다 켜지고 꺼진다, 다른 물건은 그대로", () => {
  const base = [{ id: "a", name: "계란", star: false }, { id: "b", name: "두부", star: false }];
  const once = toggleStar(base, "a");
  assert.deepEqual(starred(once).map((x) => x.name), ["계란"]);
  assert.deepEqual(starred(toggleStar(once, "a")), []);
  assert.equal(base[0].star, false); // 원래 목록은 안 바뀐다
});

test("가져옴: 목록에서 사라지고 산 재료 맨 앞에 남는다", () => {
  const list = [{ id: "a", name: "계란", star: true }, { id: "b", name: "두부", star: false }];
  const r = bring(list, [{ name: "양파", day: "2026-09-24" }], "a", "2026-09-25");
  assert.deepEqual(r.list.map((x) => x.name), ["두부"]);
  assert.deepEqual(r.bought, [{ name: "계란", day: "2026-09-25" }, { name: "양파", day: "2026-09-24" }]);
});

test("없는 물건을 가져옴 해도 아무 일 없다", () => {
  const list = [{ id: "a", name: "계란", star: false }];
  const r = bring(list, [], "zzz", "2026-09-25");
  assert.equal(r.list, list);
  assert.deepEqual(r.bought, []);
});

test("산 재료는 최근 100개까지만 남긴다", () => {
  let bought = [];
  let list = [];
  for (let i = 0; i < 105; i++) {
    list = addItem(list, `재료${i}`, `id${i}`).list;
    ({ list, bought } = bring(list, bought, `id${i}`, "2026-09-25"));
  }
  assert.equal(bought.length, 100);
  assert.equal(bought[0].name, "재료104");
});

test("메인 카드 빈 문구: 목록이 비었을 때와 별표만 없을 때가 다르다", () => {
  assert.equal(mainEmptyText([]), "다 샀어. 목록이 비었어.");
  assert.match(mainEmptyText([{ id: "a", name: "두부", star: false }]), /별표 붙인 게 없어/);
});
