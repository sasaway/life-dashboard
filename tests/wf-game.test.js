import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, prepareGameData, searchItems, searchMods } from "../js/wf-game.js";

// warframestat.us /items 의 영어·한국어 목록을 줄인 것
const EN = [
  { uniqueName: "/Lotus/Powersuits/Banshee/Banshee", name: "Banshee", category: "Warframes", aura: "madurai", polarities: ["madurai", "madurai"] },
  { uniqueName: "/Lotus/Powersuits/Jade/Jade", name: "Jade", category: "Warframes", aura: ["aura", "vazarin"], polarities: ["vazarin"], exilusPolarity: "naramon" },
  { uniqueName: "/W/KuvaSobek", name: "Kuva Sobek", category: "Primary", type: "Shotgun", exilusPolarity: "naramon" },
  { uniqueName: "/W/Bo", name: "Bo", category: "Melee", type: "Melee", polarities: ["vazarin"], stancePolarity: "unairu" },
  { uniqueName: "/P/Smeeta", name: "Smeeta Kavat", category: "Pets", type: "Pets", polarities: ["penjaga", "penjaga"] },
  { uniqueName: "/P/Core", name: "Adlet Core", category: "Pets", type: "Pet Resource" },
  { uniqueName: "/Mods/Serration", name: "Serration", category: "Mods", type: "Primary Mod", compatName: "Rifle", polarity: "madurai", baseDrain: 4, fusionLimit: 10 },
  { uniqueName: "/Mods/Beginner/Serration", name: "Serration", category: "Mods", type: "Primary Mod", compatName: "Rifle", polarity: "madurai", baseDrain: 2, fusionLimit: 3 },
  { uniqueName: "/Mods/PvPMods/Fast", name: "Fast Hands", category: "Mods", type: "Primary Mod", compatName: "Rifle", polarity: "naramon", baseDrain: 2, fusionLimit: 5 },
  { uniqueName: "/Mods/Riven", name: "Rifle Riven Mod", category: "Mods", type: "Rifle Riven Mod", polarity: "naramon", baseDrain: 18, fusionLimit: 8 },
  { uniqueName: "/Skins/Banshee", name: "Banshee Chorus Glyph", category: "Glyphs" },
  { uniqueName: "/Relics/Axi", name: "Axi A1 Intact", category: "Relics" },
  { uniqueName: "/Misc/Reactor", name: "Orokin Reactor", category: "Misc" },
];
const KO = [
  { uniqueName: "/Lotus/Powersuits/Banshee/Banshee", name: "밴쉬" },
  { uniqueName: "/Lotus/Powersuits/Jade/Jade", name: "제이드" },
  { uniqueName: "/W/KuvaSobek", name: "쿠바 소벡" },
  { uniqueName: "/W/Bo", name: "보" },
  { uniqueName: "/P/Smeeta", name: "스미타 카밧" },
  { uniqueName: "/P/Core", name: "애들릿 코어" },
  { uniqueName: "/Mods/Serration", name: "서레이션" },
  { uniqueName: "/Mods/Beginner/Serration", name: "결함 있는 서레이션" },
  { uniqueName: "/Mods/PvPMods/Fast", name: "패스트 핸즈" },
  { uniqueName: "/Mods/Riven", name: "라이플 리벤 모드" },
  { uniqueName: "/Skins/Banshee", name: "밴쉬 코러스 글리프" },
  { uniqueName: "/Relics/Axi", name: "Axi A1 Intact" },
  { uniqueName: "/Misc/Reactor", name: "<SHARD> 오로킨 리액터" },
];
const data = prepareGameData(EN, KO);

test("한글은 자모로 풀고, ㅐ/ㅔ 처럼 헷갈리는 모음과 띄어쓰기는 같은 것으로 본다", () => {
  assert.equal(normalize("벤쉬"), normalize("밴쉬"));
  assert.equal(normalize("쿠바 소백"), normalize("쿠바소벡"));
  assert.equal(normalize("Kuva Sobek"), "kuvasobek");
  assert.notEqual(normalize("보"), normalize("바"));
});

test("장비 찾기: 게임 표기와 조금 달라도(벤쉬·쿠바 소백) 찾고, 영어로도 찾는다", () => {
  assert.deepEqual(searchItems(data.items, "벤쉬").map((i) => i.en), ["Banshee"]);
  assert.deepEqual(searchItems(data.items, "쿠바 소백").map((i) => i.en), ["Kuva Sobek"]);
  assert.deepEqual(searchItems(data.items, "sobek").map((i) => i.ko), ["쿠바 소벡"]);
  assert.deepEqual(searchItems(data.items, " "), []);
  assert.deepEqual(searchItems(data.items, "보어"), []);
  assert.equal(searchItems(data.items, "보")[0].en, "Bo"); // 딱 맞는 이름이 먼저
});

test("모드 찾기: 한국어·영어 어느 쪽으로도, 띄어쓰기 무시", () => {
  assert.deepEqual(searchMods(data.mods, "서 레이션").map((m) => m.en), ["Serration"]);
  assert.deepEqual(searchMods(data.mods, "serra").map((m) => m.ko), ["서레이션"]);
});

test("모딩 장비: 워프레임·주·보조·근접·동반자만, 원래 극성과 함께", () => {
  const b = data.items.find((i) => i.en === "Banshee");
  assert.deepEqual(b, { u: "/Lotus/Powersuits/Banshee/Banshee", ko: "밴쉬", en: "Banshee", kind: "warframe", type: "", aura: "madurai", exilus: null, stance: null, pols: ["madurai", "madurai"] });
  assert.equal(data.items.find((i) => i.en === "Jade").aura, "aura"); // 오라 칸이 둘이면 첫 칸
  const bo = data.items.find((i) => i.en === "Bo");
  assert.deepEqual([bo.kind, bo.stance, bo.pols], ["melee", "unairu", ["vazarin"]]);
  assert.equal(data.items.find((i) => i.en === "Kuva Sobek").type, "Shotgun");
  assert.equal(data.items.find((i) => i.en === "Smeeta Kavat").kind, "companion");
  assert.equal(data.items.find((i) => i.en === "Adlet Core"), undefined); // 동반자 재료는 아님
});

test("모드: 이름이 같으면 기본 모드 하나만, 결함 있는·콘클레이브·리벤은 뺀다", () => {
  assert.deepEqual(data.mods.map((m) => m.en), ["Serration"]);
  assert.equal(data.names, undefined); // 이름 찾기는 뺐다 (사용자 요청)
  assert.deepEqual(data.mods[0], { u: "/Mods/Serration", ko: "서레이션", en: "Serration", type: "Primary Mod", compat: "Rifle", pol: "madurai", drain: 4, max: 10 });
});
