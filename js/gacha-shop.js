// 명조 과금 상품 (v2.8, 은월 요청 2026-10-03). 계산만 — 화면은 gacha-view.js. 앱에서는 결제하지 않는다 (계산만).
// 상품은 버전마다 이름만 바뀌고 내용물은 같은 경우가 많아서 '이름' 이 아니라 '종류' 로 정해 둔다. 이름·숫자는 은월이 고칠 수 있다.
// 목록에 없는 상품은 '상품 직접 추가' (paid.custom). 육성 재료 팩·과금 누적 이벤트는 넣지 않는다 (뽑기 재화가 없거나 버전마다 달라서).
// 루나이트(달빛)는 별소와 1:1 로 바꿀 수 있다고 계산한다.
import { parseDate, ymd } from "./schedule.js";

// ---------- 기본 상품 (여기 한 곳에만 둔다) — 확인한 날 2026-10-03 ----------
// 루나이트 충전: 단계마다 첫 구매 한 번은 기본 × 2, 그 뒤로는 기본 + 보너스.
//   숫자: buffhub · topuplist · lootbar 충전 안내, 나무위키 '상점' (같은 값). 원화(PC·안드로이드): 나무위키 + 네이버 블로그 2곳 (PS5 는 더 비쌈)
export const TOPUP_TIERS = [
  { base: 60, bonus: 0, price: 1200 },
  { base: 300, bonus: 30, price: 5900 },
  { base: 980, bonus: 110, price: 19000 },
  { base: 1980, bonus: 260, price: 37000 },
  { base: 3280, bonus: 600, price: 65000 },
  { base: 6480, bonus: 1600, price: 119000 },
];
export const SUB_DAYS = 30;        // 월정액 한 번에 30일
export const PASS_CHAR_DELAY = 21; // 패스 캐릭뽑은 산 뒤 3주에 받는다고 친다 (은월 결정 v2.4.1)
export const PASS_MAX = 1;         // 패스는 지금 버전 것 하나만 계산한다 (다음 버전 패스의 캐릭뽑이 언제 오는지 알 수 없어서)

// cycle: any 언제든 · once 한 번만 · monthly 매달 · phase 페이즈마다 · version 버전마다
// limit = 한 주기에 살 수 있는 수. unsure = 확인이 덜 된 것 (화면에 '확인 필요')
//  - sub 월정액: 루나이트 300 + 하루 별소 90 × 30일, 5,900원 (나무위키 · game8 · 아카라이브)
//  - pass 패스(선약 방송국 유료 채널): 별소 680 + 캐릭뽑 5, 12,000원 (fandom 위키 · game8 · topuplive · slyraf / 가격: 나무위키 · 아카라이브 · 루리웹)
//  - phaseChar · phaseCharBig · phaseWeapon: $9.99 · $29.99 · $9.99, 페이즈마다 1번 (game8 3.4 · topuplive · slyraf). 원화는 두 곳에서 안 맞춰져 빈칸
//  - monthly 월간 지원 팩: 별소 500 + 캐릭뽑 5 + 무기뽑 5, $19.99 (game8 · topuplive · slyraf). '매달 1일 초기화' 는 slyraf 한 곳뿐
export const SHOP = [
  { id: "topup", name: "충전", cycle: "any" },
  { id: "sub", name: "월정액", cycle: "monthly", lunite: 300, perDay: 90, price: 5900 },
  { id: "pass", name: "패스", cycle: "version", astrite: 680, charPulls: 5, price: 12000 },
  { id: "phaseChar", name: "캐릭뽑 팩", cycle: "phase", astrite: 400, charPulls: 5, limit: 1 },
  { id: "phaseCharBig", name: "캐릭뽑 팩 (큰 것)", cycle: "phase", astrite: 500, charPulls: 15, limit: 1 },
  { id: "phaseWeapon", name: "무기뽑 팩", cycle: "phase", astrite: 400, weaponPulls: 5, limit: 1 },
  { id: "monthly", name: "월간 지원 팩", cycle: "monthly", astrite: 500, charPulls: 5, weaponPulls: 5, limit: 1,
    unsure: "매달 1일에 다시 살 수 있다는 건 출처가 한 곳뿐이야. 게임 안 상점에서 확인해 줘." },
];
export const shopDef = (id) => SHOP.find((d) => d.id === id);
export const CYCLE_LABEL = { any: "언제든", once: "한 번만", monthly: "매달", phase: "페이즈마다", version: "버전마다" };
export const CUSTOM_CYCLES = ["once", "monthly", "phase", "version"];
export const MAX_ITEM_COUNT = 99;
const MAX_NUM = 9_999_999;

// 숫자 칸: 0 이상의 정수만 (빈칸·음수·글자는 0)
const num = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_NUM) : 0;
};
const cnt = (v) => Math.min(num(v), MAX_ITEM_COUNT);

// ---------- 저장 모양 (wuwaGacha.paid) ----------
// { items: { topup: { name, tiers: [{ count, first }] × 6 },                          ← first = 그 단계 '첫충전 2배 남음'
//            sub:   { name, count, price, lunite, perDay },
//            pass:  { name, count, price, astrite, charPulls, date },                  ← date = 산 날
//            phaseChar · phaseCharBig · phaseWeapon · monthly: { name, count, price, astrite, charPulls, weaponPulls } },
//   custom: [{ id, name, lunite, astrite, charPulls, weaponPulls, cycle, price, count }] }   ← 상품 직접 추가
export function defaultItem(def) {
  if (def.id === "topup") return { name: def.name, tiers: TOPUP_TIERS.map(() => ({ count: 0, first: false })) };
  const item = { name: def.name, count: 0, price: def.price ?? 0 };
  if (def.id === "sub") return { ...item, lunite: def.lunite, perDay: def.perDay };
  if (def.id === "pass") return { ...item, astrite: def.astrite, charPulls: def.charPulls, date: "" };
  return { ...item, astrite: def.astrite ?? 0, charPulls: def.charPulls ?? 0, weaponPulls: def.weaponPulls ?? 0 };
}
export const defaultPaid = () => ({ items: Object.fromEntries(SHOP.map((d) => [d.id, defaultItem(d)])), custom: [] });

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? "");
// 옛 기본 이름 (핫픽스 v2.8.1 에서 '페이즈' 를, v2.8.2 에서 '루나이트' 를 뺌). 폰에 이 이름 그대로 저장돼 있으면 새 기본 이름으로, 은월이 고친 이름은 그대로
const OLD_NAMES = ["페이즈 캐릭뽑 팩", "페이즈 캐릭뽑 팩 (큰 것)", "페이즈 무기뽑 팩", "루나이트 충전"];
const cleanName = (v, fallback) => {
  const name = String(v ?? "").trim().slice(0, 30);
  return !name || OLD_NAMES.includes(name) ? fallback : name;
};

function cleanItem(def, saved) {
  const base = defaultItem(def);
  if (!saved || typeof saved !== "object") return base;
  if (def.id === "topup") {
    return { name: cleanName(saved.name, base.name),
      tiers: base.tiers.map((t, i) => ({ count: cnt(saved.tiers?.[i]?.count), first: Boolean(saved.tiers?.[i]?.first) })) };
  }
  const out = { ...base, name: cleanName(saved.name, base.name), count: cnt(saved.count), price: num(saved.price ?? base.price) };
  for (const k of ["lunite", "perDay", "astrite", "charPulls", "weaponPulls"]) if (k in base) out[k] = num(saved[k] ?? base[k]);
  if ("date" in base) out.date = isDate(saved.date) ? saved.date : "";
  return out;
}

// 직접 추가 상품 한 개를 다듬는다. 이름이 없거나 내용물이 전부 0 이면 null (저장 안 됨)
export function cleanCustom(c) {
  const name = String(c?.name ?? "").trim().slice(0, 30);
  const out = {
    id: String(c?.id ?? ""), name, lunite: num(c?.lunite), astrite: num(c?.astrite), charPulls: num(c?.charPulls), weaponPulls: num(c?.weaponPulls),
    cycle: CUSTOM_CYCLES.includes(c?.cycle) ? c.cycle : "once", price: num(c?.price), count: cnt(c?.count),
  };
  return name && out.id && out.lunite + out.astrite + out.charPulls + out.weaponPulls > 0 ? out : null;
}

// v2.7 까지의 모양: { monthly, monthlyDay, pass, passAstrite, passChar, passDate, topup }
const OLD = { monthly: false, monthlyDay: 90, pass: false, passAstrite: 680, passChar: 2, passDate: "", topup: 0 };
const isOld = (p) => !p.items && Object.keys(OLD).some((k) => k in p);

// 옛 저장을 새 모양으로 옮긴다. 은월이 적어 둔 숫자와 '모두 합쳐 n연' 이 그대로여야 한다
//  - 월정액 켬 → 월정액 1개 (하루 별소 그대로, 살 때 받는 루나이트는 전에 안 셌으니 0 으로)
//  - 패스 켬 → 패스 1개 (별소·캐릭뽑·산 날 그대로). 꺼져 있고 캐릭뽑이 옛 기본값 2 면 새 기본값으로
//  - 직접 충전이 0 보다 크면 → 직접 추가 상품 '직접 충전' (한 번만 · 1개). 0 이면 아무것도 안 만든다
function migrateOld(saved) {
  const p = { ...OLD, ...saved };
  const out = defaultPaid();
  const { sub, pass } = out.items;
  out.items.sub = { ...sub, count: p.monthly ? 1 : 0, perDay: num(p.monthlyDay), lunite: p.monthly ? 0 : sub.lunite };
  out.items.pass = { ...pass, count: p.pass ? 1 : 0, astrite: num(p.passAstrite), date: isDate(p.passDate) ? p.passDate : "",
    charPulls: !p.pass && num(p.passChar) === OLD.passChar ? pass.charPulls : num(p.passChar) };
  if (num(p.topup) > 0) {
    out.custom.push({ id: "c-topup", name: "직접 충전", lunite: 0, astrite: num(p.topup), charPulls: 0, weaponPulls: 0, cycle: "once", price: 0, count: 1 });
  }
  return out;
}

export function normalizePaid(saved) {
  if (!saved || typeof saved !== "object") return defaultPaid();
  if (isOld(saved)) return migrateOld(saved);
  return {
    items: Object.fromEntries(SHOP.map((d) => [d.id, cleanItem(d, saved.items?.[d.id])])),
    custom: (Array.isArray(saved.custom) ? saved.custom : []).map(cleanCustom).filter(Boolean),
  };
}

// ---------- 계산 ----------
// 루나이트 충전 한 단계: '첫충전 2배 남음' 이면 첫 개는 기본 × 2, 나머지는 기본 + 보너스
export function tierLunite(tier, state) {
  const n = cnt(state?.count);
  if (!n) return 0;
  const normal = tier.base + tier.bonus;
  return state.first ? tier.base * 2 + normal * (n - 1) : normal * n;
}
export const topupLunite = (item) => TOPUP_TIERS.reduce((s, t, i) => s + tierLunite(t, item.tiers[i]), 0);
export const topupCount = (item) => item.tiers.reduce((s, t) => s + cnt(t.count), 0);
export const topupWon = (item) => TOPUP_TIERS.reduce((s, t, i) => s + t.price * cnt(item.tiers[i].count), 0);

// 패스 캐릭뽑을 받는 날 (산 날 + 3주). 그 날이 픽업 날(당일 포함)까지면 합계에 넣는다
export function passCharDate(pass) {
  if (!isDate(pass?.date)) return null;
  const d = parseDate(pass.date);
  return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + PASS_CHAR_DELAY));
}
export const passCharCounts = (pass, planDate) =>
  Boolean(pass.count > 0 && isDate(planDate) && passCharDate(pass) && passCharDate(pass) <= planDate);

// 오늘(= 픽업 날 − 남은 날) 다음 날부터 픽업 날까지 '1일' 이 몇 번 있나
export function firstsUntil(planDate, days) {
  if (!isDate(planDate) || !(days > 0)) return 0;
  const end = parseDate(planDate);
  const today = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days);
  return (end.getFullYear() - today.getFullYear()) * 12 + end.getMonth() - today.getMonth();
}

// ctx = { days: 픽업까지 남은 날 (없으면 null · 지났으면 음수), planDate, phases · versions: 픽업 일정(v2.7)에서 센 남은 페이즈·버전 수 (모르면 null) }
// '픽업 날까지 최대 n개'. max = null 이면 힌트 없음. cap = true 면 그보다 많이 적어도 max 개까지만 합계에 넣는다
//  - 매달: 이번 달 것 1개 + 앞으로 올 1일 수 (날짜로 딱 정해지니 넘는 건 합계에서 뺀다 — 패스 캐릭뽑 규칙처럼)
//  - 월정액: 30일짜리라 남은 날 ÷ 30 올림 (더 사도 받는 날은 남은 날까지)
//  - 페이즈마다 · 버전마다: 픽업 일정에 나온 수 × 구매 제한. 일정이 다 안 적혀 있을 수 있어 힌트만 (합계는 적은 개수대로)
export function limitOf(def, ctx) {
  const has = ctx.days != null && ctx.days >= 0;
  if (def.id === "pass") return { max: PASS_MAX, cap: true };
  if (!has) return { max: null, cap: false };
  if (def.id === "sub") return { max: Math.max(1, Math.ceil(ctx.days / SUB_DAYS)), cap: false };
  if (def.cycle === "monthly") return { max: (1 + firstsUntil(ctx.planDate, ctx.days)) * (def.limit ?? 1), cap: true };
  if (def.cycle === "phase") return { max: ctx.phases == null ? null : ctx.phases * (def.limit ?? 1), cap: false };
  if (def.cycle === "version") return { max: ctx.versions ?? null, cap: false };
  return { max: null, cap: false };
}

const zero = () => ({ astrite: 0, char: 0, weap: 0 });
const add = (a, b) => ({ astrite: a.astrite + b.astrite, char: a.char + b.char, weap: a.weap + b.weap });

// 상품 한 줄이 주는 것. n = 합계에 넣은 개수, got = { astrite(루나이트 포함), char, weap }, won = 가격 × n
export function lineOf(def, item, ctx) {
  const days = ctx.days > 0 ? ctx.days : 0;
  const { max, cap } = limitOf(def, ctx);
  if (def.id === "topup") {
    return { n: topupCount(item), max, cap, got: { ...zero(), astrite: topupLunite(item) }, won: topupWon(item), priced: true };
  }
  const n = cap && max != null ? Math.min(item.count, max) : item.count;
  const won = item.price * n;
  let got;
  if (def.id === "sub") got = { ...zero(), astrite: item.lunite * n + item.perDay * Math.min(days, SUB_DAYS * n) };
  else if (def.id === "pass") got = { astrite: item.astrite * n, char: passCharCounts(item, ctx.planDate) ? item.charPulls * n : 0, weap: 0 };
  else got = { astrite: ((item.lunite ?? 0) + item.astrite) * n, char: item.charPulls * n, weap: item.weaponPulls * n };
  return { n, max, cap, got, won, priced: item.price > 0 };
}

// 과금으로 받는 것 전부. total = 합계, won = 가격을 적은 상품의 합계(원), priced = 그 상품들이 주는 것 (1연에 약 n원 계산용),
// unpriced = 합계에 들어가는데 가격이 빈 상품 수, lines = { id: lineOf 결과 }
export function paidIncome(paid, ctx) {
  const rows = [...SHOP.map((d) => [d.id, d, paid.items[d.id]]), ...paid.custom.map((c) => [c.id, c, c])];
  const out = { total: zero(), won: 0, priced: zero(), unpriced: 0, lines: {} };
  for (const [id, def, item] of rows) {
    const line = lineOf(def, item, ctx);
    out.lines[id] = line;
    out.total = add(out.total, line.got);
    if (!line.n) continue;
    if (line.priced) { out.won += line.won; out.priced = add(out.priced, line.got); }
    else out.unpriced += 1;
  }
  return out;
}

// ---------- 직접 추가 상품 고치기 ----------
export const addCustom = (paid, c) => {
  const clean = cleanCustom(c);
  return clean ? { ...paid, custom: [...paid.custom, clean] } : paid;
};
export const updateCustom = (paid, id, patch) => {
  const clean = cleanCustom({ ...paid.custom.find((c) => c.id === id), ...patch, id });
  return clean ? { ...paid, custom: paid.custom.map((c) => (c.id === id ? clean : c)) } : paid;
};
export const removeCustom = (paid, id) => ({ ...paid, custom: paid.custom.filter((c) => c.id !== id) });

// 개수 − / + (0 ~ 99, 패스는 1 까지). 패스를 처음 넣으면 산 날을 today 로
export function stepCount(paid, id, delta, today) {
  const custom = paid.custom.find((c) => c.id === id);
  if (custom) return { ...paid, custom: paid.custom.map((c) => (c.id === id ? { ...c, count: Math.max(0, Math.min(MAX_ITEM_COUNT, c.count + delta)) } : c)) };
  const item = paid.items[id];
  if (!item || id === "topup") return paid;
  const count = Math.max(0, Math.min(id === "pass" ? PASS_MAX : MAX_ITEM_COUNT, item.count + delta));
  const next = { ...item, count };
  if (id === "pass") next.date = count ? (item.date || today) : "";
  return { ...paid, items: { ...paid.items, [id]: next } };
}

// 내용물 요약 '별소 400 · 캐릭뽑 5'
export function contentLabel(def, item) {
  const f = (n) => n.toLocaleString("ko-KR");
  if (def.id === "topup") return topupCount(item) ? `루나이트 ${f(topupLunite(item))}` : "6단계 · 첫충전은 2배";
  if (def.id === "sub") return [item.lunite ? `루나이트 ${f(item.lunite)}` : "", `하루 별소 ${f(item.perDay)} × ${SUB_DAYS}일`].filter(Boolean).join(" + ");
  return [
    item.lunite ? `루나이트 ${f(item.lunite)}` : "", item.astrite ? `별소 ${f(item.astrite)}` : "",
    item.charPulls ? `캐릭뽑 ${f(item.charPulls)}${def.id === "pass" ? " (3주 뒤)" : ""}` : "", item.weaponPulls ? `무기뽑 ${f(item.weaponPulls)}` : "",
  ].filter(Boolean).join(" · ") || "내용물 없음";
}
