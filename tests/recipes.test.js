import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECIPES, HEATS, DISH_RECIPES, recipesForDish, hasTimer, totalMinutes, mmss, proteinOf, PROTEIN_GOAL,
} from "../js/recipes.js";
import { DISHES, LEFTOVER, CHAPA, OLD_RICE } from "../js/meals.js";
import { newTimer, start, pause, reset, remaining, isRunning, progress } from "../js/timer.js";

test("식단의 모든 요리(남은 짜글이 포함)에 레시피가 있다", () => {
  for (const d of [...DISHES, CHAPA, LEFTOVER, OLD_RICE]) {
    const list = recipesForDish(d.id);
    assert.ok(list.length > 0, d.id);
    assert.ok(list.every(Boolean), `${d.id} 의 레시피 id 가 틀렸다`);
  }
  assert.deepEqual(recipesForDish("ramen").map((r) => r.name), ["안성탕면 + 단백질"]);
  assert.deepEqual(recipesForDish("chapa").map((r) => r.name), ["짜파게티 + 계란 프라이"]);
  assert.deepEqual(recipesForDish("skip"), []); // '안 먹음 · 외식' 은 레시피 없음
  assert.deepEqual(Object.keys(DISH_RECIPES).sort(), [...DISHES, CHAPA, LEFTOVER, OLD_RICE].map((d) => d.id).sort());
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

test("김치 대패 짜글이: 김치가 양념을 대신해 1분링 한 알 + 설탕만, 물 350ml, 두 끼 분량", () => {
  const jja = RECIPES.find((r) => r.id === "jja");
  const ing = Object.fromEntries(jja.ingredients);
  assert.match(ing["백설 육수에는 1분링"], /^1알/);
  assert.equal(ing["물"], "350ml");
  assert.equal(ing["냉동 대패삼겹"], "250g");
  assert.match(jja.serves, /2끼/);
  const timed = jja.steps.filter(hasTimer).map((st) => [HEATS[st.heat].label, st.sec]);
  assert.deepEqual(timed, [["중불", 240], ["중불", 180], ["센불", 180], ["센불", 60], ["중불", 480]]);
  assert.equal(jja.name, "김치 대패 짜글이");
  assert.match(ing["익은 김치"], /^200g/);
  assert.match(ing["익은 김치"], /깍두기/);
  for (const gone of ["맛술", "진간장", "고추장", "다진 마늘", "후추", "감자", "애호박"]) assert.ok(!(gone in ing), `${gone} 은 뺐다`);
  assert.equal(jja.protein, 25, "고기·두부가 그대로라 단백질도 그대로");
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

test("레시피 설명에 키·몸무게 숫자를 적지 않는다 (공개 저장소)", () => {
  for (const r of RECIPES) assert.ok(!/\d{2,3}\s*(cm|kg)/.test(r.why ?? ""), r.name); // "1kg당" 같은 단위 설명은 괜찮다
});

test("요리마다 한 끼 단백질 숫자 (v2.2.1, 은월 확인)", () => {
  for (const r of RECIPES) assert.ok(Number.isInteger(r.protein) && r.protein > 0, r.name);
  assert.deepEqual(Object.fromEntries(["jja", "jja-left", "rice", "ramen", "chapa", "chicken", "skip"].map((id) => [id, proteinOf(id)])),
    { jja: 25, "jja-left": 25, rice: 18, ramen: 30, chapa: 24, chicken: 29, skip: null });
  assert.equal(PROTEIN_GOAL, 22);
});

test("핫픽스 v3.0.5 새 레시피: 통밀빵 세트 · 김치 계란 볶음밥 (제안이라고 출처에 적고, 계란 굽기에 타이머, 한 끼 단백질)", () => {
  const [bread, kimchi, soy] = ["bread", "rice-kimchi", "rice"].map((id) => RECIPES.find((r) => r.id === id));
  assert.deepEqual([bread.name, kimchi.name, soy.name], ["통밀빵 세트", "김치 계란 볶음밥", "간장 계란 볶음밥"]);
  assert.match(bread.source, /제안/, "통밀빵: 영상에서 읽은 게 아니라 제안");
  // 볶음밥 둘은 핫픽스 v3.0.8 에서 영상(자동 자막) 방식으로 — 분 · 양은 영상에 없어 제안이라고 적는다 (아래 v3.0.8 테스트)
  // 통밀빵 세트: 빵 2장 + 계란 + 우유, 계란 프라이는 짜파게티 레시피와 같은 불 · 시간
  const ing = Object.fromEntries(bread.ingredients);
  assert.equal(ing["통밀빵"], "2장");
  assert.match(ing["계란"], /^2개.*3개/);
  assert.match(ing["우유"], /200ml/);
  const fry = RECIPES.find((r) => r.id === "ramen-chapa").steps[0];
  assert.deepEqual([bread.steps[0].heat, bread.steps[0].sec], [fry.heat, fry.sec]);
  assert.ok(bread.steps.filter(hasTimer).length >= 2);
  assert.match(Object.fromEntries(kimchi.ingredients)["익은 김치"], /^100g/);
  assert.deepEqual(["bread", "rice-kimchi", "rice-soy", "rice"].map(proteinOf), [26, 20, 18, 18]);
  assert.deepEqual(recipesForDish("rice-soy"), recipesForDish("rice"), "옛 계란 볶음밥 기록도 같은 레시피를 연다");
  for (const r of [bread, kimchi, soy]) assert.match(r.why, /계란을 3개/, `${r.id}: 오픈반 날 아침 안내`);
});

test("핫픽스 v3.0.8 볶음밥 둘은 어남선생 영상 방식: 출처에 '영상 자동 자막 · 분과 양은 제안' 을 있는 그대로 적는다", () => {
  const [soy, kimchi] = ["rice", "rice-kimchi"].map((id) => RECIPES.find((r) => r.id === id));
  for (const r of [soy, kimchi]) {
    assert.match(r.source, /어남선생.*영상.*자동 자막/, r.id);
    assert.match(r.source, /분 · 양은 .*제안/, `${r.id}: 영상에 숫자가 없어 제안이라고 밝힌다`);
    assert.match(r.source, /틀린 글자/, `${r.id}: 자동 자막이라는 한계`);
    const ing = Object.fromEntries(r.ingredients);
    for (const gone of ["굴소스", "버터", "후추", "멸치액젓"]) assert.ok(!(gone in ing), `${r.id}: ${gone} 줄은 없다`);
    assert.match(ing["진간장"], r.id === "rice" ? /^1스푼/ : /^0\.5스푼/, `${r.id}: 양념은 진간장 (핫픽스 v3.0.9, 은월 선택)`);
    assert.match(ing["밥"], /데우지 않고/);
    assert.match(ing["계란"], /^2개 \(오픈반 날 아침은 3개\)/);
    assert.match(r.why, /계란을 3개/);
    // 불을 쓰는 단계에는 전부 타이머가 있다
    for (const st of r.steps.filter((x) => HEATS[x.heat].fire)) assert.equal(hasTimer(st), true, `${r.id}: ${st.text}`);
    assert.equal(r.steps.at(-1).heat, "off");
  }
  // 이름 · id · 단백질 · 식단 연결은 그대로
  assert.deepEqual([soy.id, soy.name, soy.protein, kimchi.id, kimchi.name, kimchi.protein], ["rice", "간장 계란 볶음밥", 18, "rice-kimchi", "김치 계란 볶음밥", 20]);
  assert.deepEqual([DISH_RECIPES["rice-soy"], DISH_RECIPES.rice, DISH_RECIPES["rice-kimchi"]], [["rice"], ["rice"], ["rice-kimchi"]]);
  // 간장 계란 볶음밥: 파기름 → 진간장 + 설탕 → 밥 → 스크램블 → 얹기. 영상과 양념이 다른 걸 설명 한 줄로
  assert.match(soy.why, /영상은 멸치액젓.*지금은 진간장/);
  assert.deepEqual(soy.steps.filter(hasTimer).map((st) => [HEATS[st.heat].label, st.sec]), [["약불", 120], ["약불", 20], ["중강불", 180], ["약불", 90]]);
  assert.match(soy.steps.at(-1).text, /얹는다 \(섞지 않는다\).*참기름/);
  assert.equal(totalMinutes(soy), 9);
  // 김치 계란 볶음밥: 센불을 쓰지 않고, 김치 국물은 밥 다음, 계란은 프라이 (짜파게티 레시피와 같은 시간)
  const k = Object.fromEntries(kimchi.ingredients);
  assert.match(k["익은 김치"], /^100g/);
  assert.equal(k["김치 국물"], "2스푼");
  assert.equal(k["설탕"], "1/2스푼");
  assert.ok(!kimchi.steps.some((st) => st.heat === "high" || st.heat === "midhigh"), "센불 · 중강불 없음 (설탕이 타기 쉽다)");
  assert.deepEqual(kimchi.steps.filter(hasTimer).map((st) => [HEATS[st.heat].label, st.sec]), [["약불", 120], ["약불", 30], ["중불", 240], ["중불", 120], ["중불", 60], ["중불", 150]]);
  const fry = RECIPES.find((r) => r.id === "ramen-chapa").steps[0];
  assert.deepEqual([kimchi.steps[6].heat, kimchi.steps[6].sec], [fry.heat, fry.sec]);
  assert.ok(kimchi.steps.findIndex((st) => /김치 국물 2스푼/.test(st.text)) > kimchi.steps.findIndex((st) => /밥을 데우지 않고/.test(st.text)));
});

test("핫픽스 v3.0.9 볶음밥 양념은 진간장: 재료 · 단계 어디에도 액젓이 없고, 멸치액젓은 '참고' 글 끝의 메모로만 남는다", () => {
  const [soy, kimchi] = ["rice", "rice-kimchi"].map((id) => RECIPES.find((r) => r.id === id));
  for (const r of [soy, kimchi]) {
    const shown = [...r.ingredients.flat(), ...r.steps.flatMap((st) => [st.text, st.note])].join(" | ");
    assert.doesNotMatch(shown, /액젓/, `${r.id}: 재료 · 단계 글`);
    assert.match(shown, /진간장/, r.id);
    assert.match(r.source, /양념은 영상과 달리 진간장 \(은월이 고름\)/, r.id);
    assert.match(r.source, /메모: 영상은 간장 대신 멸치액젓 — 나중에 써 보면 진간장 자리에 조금만/, `${r.id}: 나중에 써 볼 메모`);
    assert.ok(r.source.indexOf("메모:") > r.source.indexOf("틀린 글자"), `${r.id}: 메모는 맨 끝`);
    assert.match(r.source, /분 · 양은 .*제안/);
  }
  assert.deepEqual([Object.fromEntries(soy.ingredients)["진간장"], Object.fromEntries(kimchi.ingredients)["진간장"]], ["1스푼", "0.5스푼 (김치가 짜서 조금만)"]);
  assert.match(soy.steps[2].text, /진간장 1스푼과 설탕 한 꼬집/);
  assert.match(kimchi.steps[2].text, /진간장 0\.5스푼과 설탕 1\/2스푼/);
  assert.match(soy.steps.at(-1).text, /짜면 다음엔 진간장을 줄인다/);
  // 양념 말고는 v3.0.8 그대로: 순서(불 · 시간) · 단백질 · 계란 · 김치 국물
  assert.deepEqual(soy.steps.map((st) => [st.heat, st.sec]), [["none", 0], ["low", 120], ["low", 20], ["midhigh", 180], ["low", 90], ["off", 0]]);
  assert.deepEqual(kimchi.steps.map((st) => [st.heat, st.sec]), [["none", 0], ["low", 120], ["low", 30], ["mid", 240], ["mid", 120], ["mid", 60], ["mid", 150], ["off", 0]]);
  assert.deepEqual([soy.protein, kimchi.protein, soy.name, kimchi.name], [18, 20, "간장 계란 볶음밥", "김치 계란 볶음밥"]);
  for (const r of [soy, kimchi]) assert.match(Object.fromEntries(r.ingredients)["계란"], /^2개 \(오픈반 날 아침은 3개\)/);
  assert.equal(Object.fromEntries(kimchi.ingredients)["김치 국물"], "2스푼");
});
