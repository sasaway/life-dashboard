import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../js/store.js";

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    raw: m,
  };
}

test("저장한 값을 그대로 다시 읽는다", () => {
  const s = createStore(fakeStorage());
  s.save("list", [{ name: "계란", star: true }]);
  assert.deepEqual(s.load("list", []), [{ name: "계란", star: true }]);
});

test("없는 값은 기본값을 돌려준다", () => {
  const s = createStore(fakeStorage());
  assert.deepEqual(s.load("nothing", []), []);
});

test("다른 앱 값과 섞이지 않게 앞에 ld: 를 붙인다", () => {
  const storage = fakeStorage();
  createStore(storage).save("x", 1);
  assert.equal(storage.raw.get("ld:x"), "1");
});

test("내용이 깨져 있으면 기본값을 돌려준다", () => {
  const storage = fakeStorage();
  storage.setItem("ld:bad", "{깨짐");
  assert.equal(createStore(storage).load("bad", "기본"), "기본");
});

test("저장이 막혀도 앱이 멈추지 않고 false 를 돌려준다", () => {
  const s = createStore({
    getItem: () => null,
    setItem: () => { throw new Error("QuotaExceededError"); },
  });
  assert.equal(s.save("x", 1), false);
});
