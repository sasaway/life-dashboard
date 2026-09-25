import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KINDS, layout, newBuild, modCost, capacity, formaCount, setPol, placeMod, clearMod, setRank, toggleBoost, rebase,
  modsFor, canPlace, addEquip, removeEquip, buildOf, setBuild,
} from "../js/modding.js";

const BANSHEE = { u: "/B", ko: "밴쉬", en: "Banshee", kind: "warframe", type: "", aura: "madurai", exilus: null, stance: null, pols: ["madurai", "madurai"] };
const BO = { u: "/Bo", ko: "보", en: "Bo", kind: "melee", type: "Melee", aura: null, exilus: null, stance: "unairu", pols: ["vazarin"] };
const SMEETA = { u: "/S", ko: "스미타 카밧", en: "Smeeta Kavat", kind: "companion", type: "Pets", aura: null, exilus: null, stance: null, pols: ["penjaga", "penjaga"] };
const mod = (u, pol, drain, max, type = "Warframe Mod", compat = "WARFRAME") => ({ u, ko: u, en: u, type, compat, pol, drain, max });
const MODS = [
  mod("Intensify", "madurai", 6, 5),
  mod("Streamline", "naramon", 4, 5),
  mod("Vitality", "vazarin", 2, 10),
  mod("SteelCharge", "madurai", -4, 5, "Warframe Mod", "AURA"),
  mod("Savage Silence", "madurai", 6, 3, "Warframe Mod", "Banshee"), // 밴쉬 증강
  mod("Pillage", "madurai", 6, 3, "Warframe Mod", "Hildryn"), // 다른 워프레임 증강
  mod("Serration", "madurai", 4, 10, "Primary Mod", "Rifle"),
  mod("Tempo Royale", "unairu", -2, 5, "Stance Mod", "Staves"),
  mod("Pressure Point", "madurai", 4, 5, "Melee Mod", "Melee"),
  mod("Pack Leader", "penjaga", 2, 5, "Companion Mod", "BEAST"),
  mod("Claw Mod", "madurai", 4, 5, "Companion Mod", "Claws"),
];
const byU = (u) => MODS.find((m) => m.u === u);

test("장비 종류마다 칸 구성 (위키 'Mod' 문서): 워프레임 오라+엑실러스+8, 근접 스탠스+엑실러스+8, 동반자 10", () => {
  assert.deepEqual(layout("warframe"), ["aura", "exilus", ...Array(8).fill("general")]);
  assert.deepEqual(layout("primary"), ["exilus", ...Array(8).fill("general")]);
  assert.deepEqual(layout("melee"), ["stance", "exilus", ...Array(8).fill("general")]);
  assert.deepEqual(layout("companion"), Array(10).fill("general"));
  assert.equal(KINDS.primary.boost, "오로킨 카탈리스트");
});

test("새 빌드는 게임의 원래 극성으로 시작한다", () => {
  const b = newBuild(BANSHEE);
  assert.deepEqual(b.pols, ["madurai", null, "madurai", "madurai", null, null, null, null, null, null]);
  assert.deepEqual(b.base, b.pols);
  assert.equal(b.mods.length, 10);
  assert.equal(b.boost, false);
  assert.deepEqual(newBuild(BO).pols.slice(0, 3), ["unairu", null, "vazarin"]);
});

test("모드 비용 (위키 'Polarity'): 같은 극성 절반 올림, 다른 극성 25% 더(반올림), 오라·스탠스는 용량을 늘린다", () => {
  assert.equal(modCost(byU("Intensify"), 5, null, "general"), 11);
  assert.equal(modCost(byU("Intensify"), 5, "madurai", "general"), 6); // 11/2 = 5.5 → 6
  assert.equal(modCost(byU("Intensify"), 5, "naramon", "general"), 14); // 13.75 → 14
  assert.equal(modCost(byU("Intensify"), 5, "aura", "general"), 6); // 아무 극성(오라 포르마·옴니)은 맞는 것으로
  assert.equal(modCost(byU("SteelCharge"), 5, "madurai", "aura"), -18); // 9 × 2
  assert.equal(modCost(byU("SteelCharge"), 5, "naramon", "aura"), -7); // 9 × 0.8 = 7.2 → 7
  assert.equal(modCost(byU("SteelCharge"), 5, null, "aura"), -9);
});

test("용량: 30, 리액터·카탈리스트면 60, 오라 보너스를 더하고 쓴 만큼 뺀다", () => {
  let b = newBuild(BANSHEE);
  b = placeMod(b, 0, byU("SteelCharge"));
  b = placeMod(b, 2, byU("Intensify")); // 마두라이 칸 → 6
  b = placeMod(b, 4, byU("Streamline")); // 빈 칸 → 9
  assert.deepEqual(capacity(b, byU), { max: 48, used: 15, left: 33 });
  b = toggleBoost(b);
  assert.deepEqual(capacity(b, byU), { max: 78, used: 15, left: 63 });
  b = setRank(b, 4, 0, byU); // 랭크 0 → 4
  assert.equal(capacity(b, byU).used, 10);
});

test("모드 넣기: 최대 랭크로 들어가고, 이미 다른 칸에 있으면 옮겨 온다. 빼기·랭크는 0~최대", () => {
  let b = newBuild(BANSHEE);
  b = placeMod(b, 2, byU("Vitality"));
  assert.deepEqual(b.mods[2], { u: "Vitality", rank: 10 });
  b = placeMod(b, 5, byU("Vitality"));
  assert.equal(b.mods[2], null);
  assert.deepEqual(b.mods[5], { u: "Vitality", rank: 10 });
  assert.equal(setRank(b, 5, 99, byU).mods[5].rank, 10);
  assert.equal(setRank(b, 5, -1, byU).mods[5].rank, 0);
  assert.equal(clearMod(b, 5).mods[5], null);
});

test("포르마: 원래 극성과 달라진 칸 수 (오라·스탠스 칸은 오라·스탠스 포르마로 따로)", () => {
  let b = newBuild(BANSHEE);
  assert.deepEqual(formaCount(b), { forma: 0, aura: 0, stance: 0 });
  b = setPol(b, 4, "naramon"); // 빈 칸에 극성
  b = setPol(b, 2, "vazarin"); // 원래 마두라이 칸을 바꿈
  b = setPol(b, 0, "naramon"); // 오라 칸
  assert.deepEqual(formaCount(b), { forma: 2, aura: 1, stance: 0 });
  b = setPol(b, 2, "madurai"); // 원래대로 되돌리면 포르마 필요 없음
  assert.deepEqual(formaCount(b), { forma: 1, aura: 1, stance: 0 });
  const r = rebase(b); // 지금 극성을 원래 극성으로 (게임 데이터가 틀렸을 때)
  assert.deepEqual(formaCount(r), { forma: 0, aura: 0, stance: 0 });
  const m = setPol(newBuild(BO), 0, "madurai");
  assert.deepEqual(formaCount(m), { forma: 0, aura: 0, stance: 1 });
});

test("끼울 수 있는 모드: 종류가 맞고, 다른 장비 전용(증강)은 빼고, 오라·스탠스는 전용 칸에만", () => {
  const names = (item) => modsFor(MODS, item, ["Hildryn", "Banshee", "Bo"]).map((m) => m.u);
  assert.deepEqual(names(BANSHEE), ["Intensify", "Streamline", "Vitality", "SteelCharge", "Savage Silence"]);
  assert.deepEqual(names(BO), ["Tempo Royale", "Pressure Point"]);
  assert.deepEqual(names(SMEETA), ["Pack Leader"]); // 발톱(Claws) 모드는 동반자 무기용
  assert.equal(canPlace(byU("SteelCharge"), "aura"), true);
  assert.equal(canPlace(byU("SteelCharge"), "general"), false);
  assert.equal(canPlace(byU("Intensify"), "aura"), false);
  assert.equal(canPlace(byU("Tempo Royale"), "stance"), true);
  assert.equal(canPlace(byU("Pressure Point"), "stance"), false);
  assert.equal(canPlace(byU("Pressure Point"), "exilus"), true);
});

test("장비 추가·빼기, A/B/C 빌드는 따로 저장", () => {
  let eq = addEquip([], BANSHEE, "e1");
  eq = addEquip(eq, BANSHEE, "e2"); // 같은 장비는 한 번만
  assert.equal(eq.length, 1);
  assert.deepEqual(Object.keys(eq[0].builds), ["A", "B", "C"]);
  const b = setPol(buildOf(eq[0], "B"), 4, "naramon");
  eq = setBuild(eq, "e1", "B", b);
  assert.equal(formaCount(buildOf(eq[0], "B")).forma, 1);
  assert.equal(formaCount(buildOf(eq[0], "A")).forma, 0);
  assert.deepEqual(removeEquip(eq, "e1"), []);
});
