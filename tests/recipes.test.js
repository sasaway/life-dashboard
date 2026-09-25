import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECIPES, HEATS, DISH_RECIPES, recipesForDish, hasTimer, totalMinutes, mmss,
} from "../js/recipes.js";
import { DISHES, LEFTOVER } from "../js/meals.js";
import { newTimer, start, pause, reset, remaining, isRunning, progress } from "../js/timer.js";

test("식단의 모든 요리(남은 짜글이 포함)에 레시피가 있다", () => {
  for (const d of [...DISHES, LEFTOVER]) {
    const list = recipesForDish(d.id);
    assert.ok(list.length > 0, d.id);
    assert.ok(list.every(Boolean), `${d.id} 의 레시피 id 가 틀렸다`);
  }
  assert.deepEqual(recipesForDish("ramen").map((r) => r.name), ["안성탕면 + 단백질", "짜파게티 + 계란 프라이"]);
  assert.deepEqual(Object.keys(DISH_RECIPES).sort(), [...DISHES, LEFTOVER].map((d) => d.id).sort());
});

test("모든 단계에 불 세기가 있고, 재료에는 양이 적혀 있다", () => {
  for (const r of RECIPES) {
    assert.ok(r.ingredients.length > 0, r.id);
    for (const [name, amount] of r.ingredients) assert.ok(name && amount, `${r.id}: ${name}`);
    for (const st of r.steps) assert.ok(HEATS[st.heat], `${r.id}: ${st.text}`);
  }
});

test("불을 쓰는 단계에는 시간이 있어 타이머가 달린다 (Notion: 불을 쓰면 타이머)", () => {
  for (const r of RECIPES) {
    for (const st of r.steps) {
      if (!HEATS[st.heat].fire) continue;
      // 재료를 넣기만 하는 짧은 단계는 예외로 둔다
      if (st.sec === 0) assert.match(st.text, /넣는다/, `${r.id}: 불 단계에 시간이 없다 — ${st.text}`);
      else assert.equal(hasTimer(st), true);
    }
    assert.ok(r.steps.some(hasTimer), `${r.id}: 타이머가 하나도 없다`);
  }
  // 불 없는 단계엔 타이머가 없다
  assert.equal(hasTimer({ heat: "micro", sec: 120 }), false);
  assert.equal(hasTimer({ heat: "off", sec: 0 }), false);
});

test("짜글이: 1분링 한 알 + 물 350ml, 두 끼 분량, 영상의 불 세기와 시간", () => {
  const jja = RECIPES.find((r) => r.id === "jja");
  const ing = Object.fromEntries(jja.ingredients);
  assert.match(ing["백설 육수에는 1분링"], /^1알/);
  assert.equal(ing["물"], "350ml");
  assert.equal(ing["냉동 대패삼겹"], "250g");
  assert.match(jja.serves, /2끼/);
  const timed = jja.steps.filter(hasTimer).map((st) => [HEATS[st.heat].label, st.sec]);
  assert.deepEqual(timed, [["중불", 240], ["중불", 120], ["약불", 90], ["센불", 180], ["센불", 60], ["중불", 540]]);
});

test("짜파게티는 봉지 조리법(물 600ml, 5분, 물 8스푼)", () => {
  const chapa = RECIPES.find((r) => r.id === "ramen-chapa");
  assert.equal(Object.fromEntries(chapa.ingredients)["물"], "600ml");
  assert.ok(chapa.steps.some((st) => st.sec === 300 && st.heat === "high"));
  assert.ok(chapa.steps.some((st) => st.text.includes("8스푼")));
});

test("시간 글자와 전체 시간", () => {
  assert.equal(mmss(540), "9:00");
  assert.equal(mmss(89.2), "1:30");
  assert.equal(mmss(-3), "0:00");
  assert.equal(totalMinutes({ steps: [{ sec: 0 }, { sec: 240 }, { sec: 90 }] }), 7); // 60+240+90초 = 6.5분 → 반올림 7
});

// ---------- 타이머 ----------
test("타이머: 시작·일시정지·다시 시작·끝", () => {
  let t = newTimer(90);
  assert.equal(isRunning(t), false);
  t = start(t, 0);
  assert.equal(remaining(t, 30_000), 60);
  assert.equal(progress(t, 30_000), 33);
  t = pause(t, 30_000);
  assert.equal(remaining(t, 999_999), 60); // 멈춘 동안은 줄지 않는다
  t = start(t, 100_000);
  assert.equal(remaining(t, 160_000), 0); // 끝나면 0 (앱은 이걸로 끝났는지 본다)
  assert.equal(remaining(t, 200_000), 0); // 음수로 안 간다
});

test("타이머: 두 번 눌러도 끝나는 시각이 밀리지 않고, 되돌리면 처음 시간", () => {
  let t = start(newTimer(60), 0);
  assert.equal(start(t, 10_000), t);
  t = reset(t);
  assert.deepEqual(t, newTimer(60));
  const idle = newTimer(60);
  assert.equal(pause(idle, 5), idle); // 안 돌고 있으면 일시정지해도 그대로
});
