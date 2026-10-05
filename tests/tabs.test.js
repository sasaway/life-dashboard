import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const tokens = readFileSync(new URL("../design/tokens.css", import.meta.url), "utf8");
const count = (re) => [...html.matchAll(re)].length;

// v3.0: 하단 탭을 Notion 의 큰 틀대로 네 개로 (메인 / 일상생활 = 식단 + 돈 / 자기계발 = 운동 / 취미)
test("하단 탭은 네 개이고, 탭마다 열 화면이 하나씩 있다", () => {
  const tabs = [...html.matchAll(/<button class="tab" data-screen="(\w+)"[^>]*>.*?<\/svg>([^<]+)<\/button>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(tabs, [["main", "메인"], ["life", "일상생활"], ["grow", "자기계발"], ["hobby", "취미"]]);
  const screens = [...html.matchAll(/<section class="screen" id="screen-(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(screens, tabs.map((t) => t[0]), "탭이 여는 화면만 .screen 이다");
  assert.match(tokens, /\.tabs nav\{[^}]*repeat\(4,1fr\)/, "탭 줄도 네 칸");
});

test("식단 · 돈 · 운동 화면은 새 탭 안에 그대로 있다 (id 가 그대로라 기능 코드는 안 바뀐다)", () => {
  for (const id of ["screen-meal", "screen-money", "screen-gym"]) {
    assert.equal(count(new RegExp(`id="${id}"`, "g")), 1, id);
    assert.equal(count(new RegExp(`class="sub-page" id="${id}"`, "g")), 1, `${id} 는 탭 안의 화면`);
  }
  const at = (text) => html.indexOf(text);
  assert.ok(at('id="screen-life"') < at('id="screen-meal"') && at('id="screen-meal"') < at('id="screen-money"') && at('id="screen-money"') < at('id="screen-grow"'), "일상생활 안에 식단 · 돈");
  assert.ok(at('id="screen-grow"') < at('id="screen-gym"') && at('id="screen-gym"') < at('id="screen-hobby"'), "자기계발 안에 운동");
});

test("일상생활은 [식단 · 돈] 을 고르고 처음에는 식단이 보인다 · 메인 운동 카드는 자기계발 탭으로 간다", () => {
  const picks = [...html.matchAll(/<button data-life="(\w+)" aria-pressed="(true|false)">([^<]+)<\/button>/g)].map((m) => m.slice(1));
  assert.deepEqual(picks, [["meal", "true", "식단"], ["money", "false", "돈"]]);
  assert.doesNotMatch(html.match(/<div class="sub-page" id="screen-meal"[^>]*>/)[0], /hidden/);
  assert.match(html.match(/<div class="sub-page" id="screen-money"[^>]*>/)[0], /hidden/);
  assert.match(html, /data-go="grow"/);
  assert.doesNotMatch(html, /data-go="gym"|data-screen="(meal|gym|money)"/);
});
