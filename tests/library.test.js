import { test } from "node:test";
import assert from "node:assert/strict";
import { CATS, catOf, blankEntry, entryProblem, saveEntry, removeEntry, entriesOf, countsBy } from "../js/library.js";

const T1 = new Date("2026-09-25T10:00:00");
const T2 = new Date("2026-09-26T10:00:00");

test("Notion '프로젝트: 라이브러리' 그대로: 네 분류와 작성 구조 순서", () => {
  assert.deepEqual(CATS.map((c) => c.label), ["인덱스", "포트폴리오", "프로필", "큐레이터"]);
  assert.deepEqual(catOf("index").fields, ["title", "body", "source"]);
  assert.deepEqual(catOf("portfolio").fields, ["title", "kind", "body", "ref", "photos"]);
  assert.deepEqual(catOf("profile").fields, ["title", "source", "body"]);
  assert.deepEqual(catOf("curator").fields, ["title", "kind", "body"]);
  assert.deepEqual(catOf("portfolio").kinds, ["프로젝트", "협업"]);
  assert.deepEqual(catOf("curator").kinds, ["철학적 고찰", "예술적 고찰"]);
  assert.match(catOf("index").tone, /간결/);
});

test("새 기록: 분류가 있는 곳은 첫 분류로 시작, 제목이 비면 저장 안 됨", () => {
  const e = blankEntry("curator", "c1", T1);
  assert.equal(e.kind, "철학적 고찰");
  assert.equal(blankEntry("index", "i1", T1).kind, "");
  assert.equal(entryProblem({ ...e, title: "   " }), "제목을 적어 줘.");
  assert.equal(entryProblem({ ...e, title: "에반게리온" }), null);
});

test("저장: 글자 앞뒤 공백을 지우고, 그 분류에 없는 칸은 버리고, 고치면 같은 자리", () => {
  const e = { ...blankEntry("index", "i1", T1), title: " 아주 작은 습관의 힘 ", body: "1% 개선", source: "책", ref: "쓸데없는 칸", photos: ["p"] };
  let list = saveEntry([], e, T1);
  assert.deepEqual(list, [{ id: "i1", cat: "index", title: "아주 작은 습관의 힘", kind: "", body: "1% 개선", source: "책", ref: "", photos: [], at: T1.toISOString(), updated: T1.toISOString() }]);
  list = saveEntry(list, { ...list[0], body: "정체성 기반 습관" }, T2);
  assert.equal(list.length, 1);
  assert.equal(list[0].body, "정체성 기반 습관");
  assert.equal(list[0].at, T1.toISOString()); // 처음 적은 날은 그대로
  assert.equal(list[0].updated, T2.toISOString());
  assert.equal(saveEntry(list, { ...list[0], title: "" }, T2), list); // 제목이 비면 그대로
});

test("포트폴리오는 사진 칸을 지키고, 분류가 목록에 없으면 첫 분류로", () => {
  const e = { ...blankEntry("portfolio", "p1", T1), title: "라이프대시보드", kind: "엉뚱한 값", photos: ["a", "b"] };
  const [saved] = saveEntry([], e, T1);
  assert.deepEqual([saved.kind, saved.photos], ["프로젝트", ["a", "b"]]);
});

test("분류별 목록은 최근 것부터, 개수 세기, 지우기", () => {
  let list = saveEntry([], { ...blankEntry("index", "a", T1), title: "옛 책" }, T1);
  list = saveEntry(list, { ...blankEntry("index", "b", T2), title: "새 책" }, T2);
  list = saveEntry(list, { ...blankEntry("profile", "c", T1), title: "정보처리기사" }, T1);
  assert.deepEqual(entriesOf(list, "index").map((e) => e.title), ["새 책", "옛 책"]);
  assert.deepEqual(countsBy(list), { index: 2, portfolio: 0, profile: 1, curator: 0 });
  assert.deepEqual(removeEntry(list, "a").map((e) => e.id), ["b", "c"]);
});
