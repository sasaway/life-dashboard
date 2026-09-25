// 워프레임 모딩 시뮬레이터: 칸 구성, 모드 비용, 용량, 포르마 개수, A/B/C 빌드.
// 규칙 출처: 워프레임 위키 'Mod'(칸 구성)·'Polarity'(극성 비용) 문서 (2026-09-25 확인)
import { newId } from "./shopping.js";

export const KINDS = {
  warframe: { label: "워프레임", special: ["aura", "exilus"], general: 8, boost: "오로킨 리액터" },
  primary: { label: "주무기", special: ["exilus"], general: 8, boost: "오로킨 카탈리스트" },
  secondary: { label: "보조무기", special: ["exilus"], general: 8, boost: "오로킨 카탈리스트" },
  melee: { label: "근접무기", special: ["stance", "exilus"], general: 8, boost: "오로킨 카탈리스트" },
  // 동반자는 모두 일반 10칸 (센티넬은 안 쓴다 — 사용자)
  companion: { label: "동반자", special: [], general: 10, boost: "오로킨 리액터" },
};
export const SLOT_KO = { aura: "오라", exilus: "엑실러스", stance: "스탠스", general: "" };

// 극성. 'aura' 는 아무 극성과 맞는 칸(오라 포르마·옴니 포르마), 'universal' 은 극성 없는 모드
export const POLARITIES = [
  { id: "madurai", sym: "V", name: "Madurai" },
  { id: "vazarin", sym: "D", name: "Vazarin" },
  { id: "naramon", sym: "—", name: "Naramon" },
  { id: "zenurik", sym: "=", name: "Zenurik" },
  { id: "unairu", sym: "R", name: "Unairu" },
  { id: "penjaga", sym: "Y", name: "Penjaga" },
  { id: "umbra", sym: "U", name: "Umbra" },
  { id: "aura", sym: "*", name: "Any" },
];
export const polSym = (id) => POLARITIES.find((p) => p.id === id)?.sym ?? "";

export const layout = (kind) => [...KINDS[kind].special, ...Array(KINDS[kind].general).fill("general")];

// ---------- 빌드 ----------
// { boost: 리액터·카탈리스트, slots: [칸 종류], base: [원래 극성], pols: [지금 극성], mods: [{ u, rank } | null] }
function innate(item) {
  const general = [...item.pols];
  return layout(item.kind).map((slot) => (slot === "general" ? general.shift() ?? null : item[slot] ?? null));
}
export function newBuild(item) {
  const pols = innate(item);
  return { boost: false, slots: layout(item.kind), base: [...pols], pols, mods: pols.map(() => null) };
}

const setAt = (arr, i, v) => arr.map((x, k) => (k === i ? v : x));
export const setPol = (b, i, pol) => ({ ...b, pols: setAt(b.pols, i, pol) });
export const toggleBoost = (b) => ({ ...b, boost: !b.boost });
export const rebase = (b) => ({ ...b, base: [...b.pols] }); // 지금 극성을 원래 극성으로 (게임 데이터가 틀렸을 때)
export const clearMod = (b, i) => ({ ...b, mods: setAt(b.mods, i, null) });
// 같은 모드는 한 번만: 다른 칸에 있으면 옮겨 온다. 넣을 때는 최대 랭크
export function placeMod(b, i, mod) {
  const mods = b.mods.map((m) => (m?.u === mod.u ? null : m));
  return { ...b, mods: setAt(mods, i, { u: mod.u, rank: mod.max }) };
}
export function setRank(b, i, rank, modOf) {
  const m = b.mods[i];
  if (!m) return b;
  const max = modOf(m.u)?.max ?? 0;
  return { ...b, mods: setAt(b.mods, i, { ...m, rank: Math.max(0, Math.min(max, rank)) }) };
}

// ---------- 비용 ----------
// 일반 모드: 같은 극성이면 절반(올림), 다른 극성이면 25% 더(반올림).
// 오라·스탠스: 용량을 늘려 준다. 같은 극성이면 두 배, 다른 극성이면 20% 덜 → 음수로 돌려준다
export function modCost(mod, rank, slotPol, slot) {
  const bonus = slot === "aura" || slot === "stance";
  const base = Math.abs(mod.drain) + rank;
  const neutral = !slotPol || !mod.pol || mod.pol === "universal";
  const match = !neutral && (slotPol === mod.pol || (slotPol === "aura" && mod.pol !== "umbra"));
  if (bonus) return -(neutral ? base : match ? base * 2 : Math.round(base * 0.8));
  return neutral ? base : match ? Math.ceil(base / 2) : Math.round(base * 1.25);
}

export function capacity(b, modOf) {
  let max = b.boost ? 60 : 30;
  let used = 0;
  b.mods.forEach((m, i) => {
    const mod = m && modOf(m.u);
    if (!mod) return;
    const c = modCost(mod, m.rank, b.pols[i], b.slots[i]);
    if (c < 0) max -= c;
    else used += c;
  });
  return { max, used, left: max - used };
}

// 포르마: 원래 극성과 달라진 칸. 오라 칸은 오라 포르마, 스탠스 칸은 스탠스 포르마로 따로 센다
export function formaCount(b) {
  const out = { forma: 0, aura: 0, stance: 0 };
  b.pols.forEach((p, i) => {
    if (p === b.base[i]) return;
    const slot = b.slots[i];
    out[slot === "aura" || slot === "stance" ? slot : "forma"] += 1;
  });
  return out;
}

// ---------- 끼울 수 있는 모드 ----------
const MOD_TYPES = {
  warframe: ["Warframe Mod"],
  primary: ["Primary Mod"],
  secondary: ["Secondary Mod"],
  melee: ["Melee Mod", "Stance Mod"],
  companion: ["Companion Mod"],
};
// 다른 장비 전용(증강 등)은 뺀다. 동반자의 발톱(Claws) 모드는 동반자 무기용이라 뺀다
export function modsFor(mods, item, equipNames) {
  const types = item.kind === "primary" && item.type === "Shotgun" ? ["Shotgun Mod"] : MOD_TYPES[item.kind];
  const others = new Set(equipNames.filter((n) => n !== item.en));
  return mods.filter((m) => types.includes(m.type) && !others.has(m.compat) && !(item.kind === "companion" && m.compat === "Claws"));
}
export function canPlace(mod, slot) {
  if (slot === "aura") return mod.compat === "AURA";
  if (slot === "stance") return mod.type === "Stance Mod";
  return mod.compat !== "AURA" && mod.type !== "Stance Mod";
}

// ---------- 모딩할 장비 목록 ----------
// [{ id, u, ko, en, kind, type, builds: { A, B, C } }] — type 은 산탄총 모드를 가리려고 둔다
export const BUILD_NAMES = ["A", "B", "C"];
export function addEquip(list, item, id = newId()) {
  if (list.some((e) => e.u === item.u)) return list;
  const builds = Object.fromEntries(BUILD_NAMES.map((n) => [n, newBuild(item)]));
  return [...list, { id, u: item.u, ko: item.ko, en: item.en, kind: item.kind, type: item.type, builds }];
}
export const removeEquip = (list, id) => list.filter((e) => e.id !== id);
export const buildOf = (equip, name) => equip.builds[name];
export const setBuild = (list, id, name, build) =>
  list.map((e) => (e.id === id ? { ...e, builds: { ...e.builds, [name]: build } } : e));
