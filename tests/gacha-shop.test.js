import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHOP, TOPUP_TIERS, shopDef, defaultPaid, normalizePaid, cleanCustom, addCustom, updateCustom, removeCustom, stepCount,
  tierLunite, topupLunite, topupCount, topupWon, passCharDate, passCharCounts, firstsUntil, limitOf, lineOf, paidIncome, contentLabel,
  CYCLE_LABEL, CUSTOM_CYCLES,
} from "../js/gacha-shop.js";
import { normalizeGacha, income, pullsOf, defaultGacha, daysUntil } from "../js/gacha.js";
import { pickupsOf, phasesUntil } from "../js/pickups.js";

const withItem = (id, patch) => { const p = defaultPaid(); p.items[id] = { ...p.items[id], ...patch }; return p; };
const ctx = (days, planDate = "2026-10-21", more = {}) => ({ days, planDate, phases: null, versions: null, ...more });
const got = (paid, c) => paidIncome(paid, c).total;

test("기본 상품 7종: 종류 · 주기 · 내용물 (확인한 값)", () => {
  assert.deepEqual(SHOP.map((d) => [d.id, d.cycle]), [
    ["topup", "any"], ["sub", "monthly"], ["pass", "version"], ["phaseChar", "phase"], ["phaseCharBig", "phase"], ["phaseWeapon", "phase"], ["monthly", "monthly"],
  ]);
  const p = defaultPaid();
  assert.deepEqual(p.items.sub, { name: "월정액", count: 0, price: 5900, lunite: 300, perDay: 90 });
  assert.deepEqual(p.items.pass, { name: "패스", count: 0, price: 12000, astrite: 680, charPulls: 5, date: "" });
  assert.deepEqual(p.items.phaseChar, { name: "캐릭뽑 팩", count: 0, price: 0, astrite: 400, charPulls: 5, weaponPulls: 0 });
  assert.deepEqual(p.items.phaseCharBig, { name: "캐릭뽑 팩 (큰 것)", count: 0, price: 0, astrite: 500, charPulls: 15, weaponPulls: 0 });
  assert.deepEqual(p.items.phaseWeapon, { name: "무기뽑 팩", count: 0, price: 0, astrite: 400, charPulls: 0, weaponPulls: 5 });
  assert.deepEqual(p.items.monthly, { name: "월간 지원 팩", count: 0, price: 0, astrite: 500, charPulls: 5, weaponPulls: 5 });
  assert.deepEqual(TOPUP_TIERS.map((t) => [t.base, t.bonus]), [[60, 0], [300, 30], [980, 110], [1980, 260], [3280, 600], [6480, 1600]]);
  assert.ok(shopDef("monthly").unsure, "확인이 덜 된 것은 표시가 있다");
  assert.ok(!shopDef("phaseChar").unsure);
  assert.deepEqual(got(p, ctx(18)), { astrite: 0, char: 0, weap: 0 }, "아무것도 안 사면 0");
  assert.deepEqual(CUSTOM_CYCLES.map((c) => CYCLE_LABEL[c]), ["한 번만", "매달", "페이즈마다", "버전마다"]);
});

test("루나이트 충전: 첫충전 2배 켬/끔 — 켜면 첫 개만 기본 × 2, 그 뒤로는 기본 + 보너스. 루나이트는 별소와 1:1", () => {
  const doubled = TOPUP_TIERS.map((t) => tierLunite(t, { count: 1, first: true }));
  assert.deepEqual(doubled, [120, 600, 1960, 3960, 6560, 12960]);
  const normal = TOPUP_TIERS.map((t) => tierLunite(t, { count: 1, first: false }));
  assert.deepEqual(normal, [60, 330, 1090, 2240, 3880, 8080]);
  const top = TOPUP_TIERS[5];
  assert.equal(tierLunite(top, { count: 3, first: true }), 12960 + 8080 * 2);
  assert.equal(tierLunite(top, { count: 0, first: true }), 0, "안 사면 2배도 없다");
  const p = defaultPaid();
  p.items.topup.tiers[5] = { count: 1, first: true };
  p.items.topup.tiers[1] = { count: 2, first: false };
  assert.equal(topupLunite(p.items.topup), 12960 + 660);
  assert.equal(topupCount(p.items.topup), 3);
  assert.equal(topupWon(p.items.topup), 119000 + 5900 * 2);
  const r = paidIncome(p, ctx(null, ""));
  assert.deepEqual(r.total, { astrite: 13620, char: 0, weap: 0 }, "루나이트 → 별소");
  assert.equal(pullsOf(r.total), 85);
  assert.equal(r.won, 130800);
});

test("월정액: 살 때 루나이트 300 + 하루 별소 × 남은 날 (한 개에 30일까지)", () => {
  const one = withItem("sub", { count: 1 });
  assert.equal(got(one, ctx(14)).astrite, 300 + 90 * 14);
  assert.equal(got(one, ctx(45)).astrite, 300 + 90 * 30, "한 개는 30일까지");
  assert.equal(got(withItem("sub", { count: 2 }), ctx(45)).astrite, 600 + 90 * 45, "두 개면 60일까지 — 남은 날만큼만");
  assert.equal(got(one, ctx(null, "")).astrite, 300, "날짜가 없으면 살 때 받는 것만");
  assert.equal(got(one, ctx(-3)).astrite, 300);
  assert.deepEqual(limitOf(shopDef("sub"), ctx(45)), { max: 2, cap: false });
  assert.deepEqual(limitOf(shopDef("sub"), ctx(0)), { max: 1, cap: false });
  assert.equal(limitOf(shopDef("sub"), ctx(null, "")).max, null, "날짜가 없으면 힌트 없음");
});

test("패스 3주 규칙: 별소는 바로, 캐릭뽑은 산 날 + 21일이 픽업 날(당일 포함)까지일 때만. 한 개까지만 센다", () => {
  const pass = (date, count = 1) => withItem("pass", { count, date });
  assert.equal(passCharDate({ date: "2026-09-30" }), "2026-10-21");
  assert.equal(passCharCounts({ count: 1, date: "2026-09-30" }, "2026-10-21"), true);
  assert.equal(passCharCounts({ count: 1, date: "2026-09-30" }, "2026-10-20"), false);
  assert.equal(passCharCounts({ count: 0, date: "2026-09-30" }, "2026-12-01"), false);
  assert.deepEqual(got(pass("2026-09-30"), ctx(18, "2026-10-21")), { astrite: 680, char: 5, weap: 0 });
  assert.deepEqual(got(pass("2026-09-30"), ctx(17, "2026-10-20")), { astrite: 680, char: 0, weap: 0 });
  assert.deepEqual(got(pass(""), ctx(18)), { astrite: 680, char: 0, weap: 0 }, "산 날을 모르면 캐릭뽑은 뺀다");
  assert.deepEqual(got(pass("2026-09-30", 3), ctx(18, "2026-10-21")), { astrite: 680, char: 5, weap: 0 }, "여러 개를 적어도 하나만");
  assert.deepEqual(limitOf(shopDef("pass"), ctx(18)), { max: 1, cap: true });
});

test("페이즈 팩: 개수만큼 그대로 (별소 400 = 2연 + 160 남음, 캐릭뽑 5 = 5연)", () => {
  const one = got(withItem("phaseChar", { count: 1 }), ctx(18));
  assert.deepEqual(one, { astrite: 400, char: 5, weap: 0 });
  assert.equal(pullsOf(one), 7);
  assert.deepEqual(got(withItem("phaseCharBig", { count: 2 }), ctx(18)), { astrite: 1000, char: 30, weap: 0 });
  assert.deepEqual(got(withItem("phaseWeapon", { count: 1 }), ctx(null, "")), { astrite: 400, char: 0, weap: 5 }, "날짜가 없어도 센다");
});

test("페이즈 힌트: 픽업 일정에서 남은 페이즈 수 × 구매 제한. 힌트만 — 합계는 적은 개수대로", () => {
  const def = shopDef("phaseChar");
  assert.deepEqual(limitOf(def, ctx(18, "2026-10-21", { phases: 2 })), { max: 2, cap: false });
  assert.equal(limitOf(def, ctx(18)).max, null, "일정이 없으면 힌트 없음");
  assert.equal(limitOf(def, ctx(null, "", { phases: 2 })).max, null, "날짜가 없으면 힌트 없음");
  assert.equal(got(withItem("phaseChar", { count: 5 }), ctx(18, "2026-10-21", { phases: 2 })).char, 25);
  // 픽업 일정에서 세기: 지금(10/4)부터 픽업 날까지 걸치는 페이즈 · 버전
  const row = (v, ph, s, e, c) => [v, ph, s, e, c, "", "아니오", "확정", "", ""];
  const list = pickupsOf({ rows: [
    row("3.7", "1페이즈", "2026-09-30 11:00", "2026-10-21 09:59", "가"), row("3.7", "2페이즈", "2026-10-21 10:00", "2026-11-11 09:59", "나"),
    row("3.8", "1페이즈", "2026-11-12 11:00", "2026-12-03 09:59", "다"), row("3.8", "1페이즈", "2026-11-12 11:00", "2026-12-03 09:59", "라"),
  ] });
  const now = new Date(2026, 9, 4, 12);
  assert.deepEqual(phasesUntil(list, now, "2026-10-20"), { phases: 1, versions: 1 });
  assert.deepEqual(phasesUntil(list, now, "2026-10-21"), { phases: 2, versions: 1 }, "픽업 날에 시작하는 페이즈도 센다");
  assert.deepEqual(phasesUntil(list, now, "2026-11-12"), { phases: 3, versions: 2 }, "한 페이즈 두 줄은 한 번");
  assert.deepEqual(phasesUntil(list.slice(1), now, "2026-10-25"), { phases: 2, versions: 1 }, "진행 중인 페이즈가 시트에 없으면 하나 더");
  assert.equal(phasesUntil([], now, "2026-10-21"), null);
  assert.equal(phasesUntil(list, now, ""), null);
});

test("월간 팩 1일 세기: 이번 달 것 1개 + 앞으로 올 1일 수. 넘게 적으면 받을 수 있는 만큼만 합계에", () => {
  assert.equal(firstsUntil("2026-10-21", 17), 0, "10/4 → 10/21: 1일 없음");
  assert.equal(firstsUntil("2026-11-01", 28), 1, "픽업 날이 1일이면 센다");
  assert.equal(firstsUntil("2026-10-31", 27), 0);
  assert.equal(firstsUntil("2027-01-15", 103), 3, "해를 넘어도 (11/1 · 12/1 · 1/1)");
  assert.equal(firstsUntil("2026-11-01", 31), 1, "오늘이 1일이면 오늘은 이번 달 것");
  assert.equal(firstsUntil("", 10), 0);
  const def = shopDef("monthly");
  assert.deepEqual(limitOf(def, ctx(17)), { max: 1, cap: true });
  assert.deepEqual(limitOf(def, ctx(28, "2026-11-01")), { max: 2, cap: true });
  const three = withItem("monthly", { count: 3 });
  assert.deepEqual(got(three, ctx(28, "2026-11-01")), { astrite: 1000, char: 10, weap: 10 }, "3개를 적어도 2개만");
  assert.equal(lineOf(def, three.items.monthly, ctx(28, "2026-11-01")).n, 2);
  assert.deepEqual(got(three, ctx(null, "")), { astrite: 1500, char: 15, weap: 15 }, "날짜가 없으면 적은 대로");
});

test("직접 추가: 추가 · 고치기 · 삭제, 내용물이 다 0 이거나 이름이 없으면 저장 안 됨", () => {
  let p = defaultPaid();
  p = addCustom(p, { id: "c1", name: " 3.7 기념 패키지 ", astrite: 1600, cycle: "once", price: "33000", count: 1 });
  assert.deepEqual(p.custom, [{ id: "c1", name: "3.7 기념 패키지", lunite: 0, astrite: 1600, charPulls: 0, weaponPulls: 0, cycle: "once", price: 33000, count: 1 }]);
  assert.equal(pullsOf(got(p, ctx(18))), 10, "별소 1600 = 10연");
  assert.equal(addCustom(p, { id: "c2", name: "빈 상품", cycle: "once", count: 1 }), p, "내용물이 다 0");
  assert.equal(addCustom(p, { id: "c2", name: "  ", astrite: 100 }), p, "이름 없음");
  assert.equal(cleanCustom({ id: "c2", name: "x", lunite: -5, astrite: "abc", charPulls: 0, weaponPulls: "" }), null, "음수·글자는 0");
  assert.equal(cleanCustom({ id: "c2", name: "x", charPulls: 1, cycle: "이상한 것" }).cycle, "once");
  p = updateCustom(p, "c1", { lunite: 300, charPulls: 2, weaponPulls: 1, count: 2 });
  assert.deepEqual(got(p, ctx(18)), { astrite: 3800, char: 4, weap: 2 }, "루나이트 + 별소, 개수만큼");
  assert.equal(updateCustom(p, "c1", { lunite: 0, astrite: 0, charPulls: 0, weaponPulls: 0 }), p, "다 0 으로는 못 고친다");
  p = removeCustom(p, "c1");
  assert.deepEqual(p.custom, []);
  assert.deepEqual(got(p, ctx(18)), { astrite: 0, char: 0, weap: 0 });
});

test("직접 추가 · 주기별 계산: 매달은 월간 팩처럼 받을 수 있는 만큼만, 페이즈·버전은 힌트만, 한 번만은 힌트 없음", () => {
  const c = (cycle, count) => ({ id: "c", name: "x", lunite: 0, astrite: 160, charPulls: 0, weaponPulls: 0, cycle, price: 0, count });
  const at = ctx(28, "2026-11-01", { phases: 2, versions: 1 });
  assert.deepEqual(limitOf(c("monthly", 5), at), { max: 2, cap: true });
  assert.deepEqual(limitOf(c("phase", 5), at), { max: 2, cap: false });
  assert.deepEqual(limitOf(c("version", 5), at), { max: 1, cap: false });
  assert.deepEqual(limitOf(c("once", 5), at), { max: null, cap: false });
  const sum = (cycle) => got({ ...defaultPaid(), custom: [c(cycle, 5)] }, at).astrite;
  assert.deepEqual(["monthly", "phase", "version", "once"].map(sum), [320, 800, 800, 800]);
});

test("개수 − / +: 0 ~ 99, 패스는 1 까지 · 처음 넣으면 산 날 = 오늘, 빼면 비움", () => {
  let p = defaultPaid();
  p = stepCount(p, "phaseChar", 1, "2026-10-04");
  p = stepCount(p, "phaseChar", 1, "2026-10-04");
  assert.equal(p.items.phaseChar.count, 2);
  p = stepCount(stepCount(stepCount(p, "phaseChar", -1), "phaseChar", -1), "phaseChar", -1);
  assert.equal(p.items.phaseChar.count, 0, "0 밑으로 안 간다");
  p = stepCount(stepCount(p, "pass", 1, "2026-10-04"), "pass", 1, "2026-10-05");
  assert.deepEqual([p.items.pass.count, p.items.pass.date], [1, "2026-10-04"]);
  p = stepCount(p, "pass", -1, "2026-10-04");
  assert.deepEqual([p.items.pass.count, p.items.pass.date], [0, ""]);
  p = addCustom(p, { id: "c1", name: "x", astrite: 1, count: 99 });
  assert.equal(stepCount(p, "c1", 1).custom[0].count, 99);
  assert.equal(stepCount(p, "c1", -1).custom[0].count, 98);
  assert.equal(stepCount(p, "topup", 1), p, "루나이트 충전은 단계에서 고른다");
  assert.equal(stepCount(p, "없는 것", 1), p);
});

test("옛 데이터 옮기기: 월정액 · 패스 값은 기본 상품으로, 숫자와 '모두 합쳐 n연' 은 그대로", () => {
  const old = { have: { astrite: 16000, char: 3, weap: 1 }, free: { daily: 60, astrite: 1000, char: 2 },
    paid: { monthly: true, monthlyDay: 90, pass: true, passAstrite: 680, passChar: 2, passDate: "2026-09-20", topup: 500 }, plan: { date: "2026-10-14" } };
  const g = normalizeGacha(old);
  assert.deepEqual([g.paid.items.sub.count, g.paid.items.sub.perDay, g.paid.items.sub.lunite], [1, 90, 0], "살 때 받는 루나이트는 전에 안 셌으니 0");
  assert.deepEqual(g.paid.items.pass, { name: "패스", count: 1, price: 12000, astrite: 680, charPulls: 2, date: "2026-09-20" }, "켜 둔 패스의 캐릭뽑 2 는 그대로");
  const r = income(g, 14);
  assert.deepEqual(r.paid, { astrite: 90 * 14 + 680 + 500, char: 2, weap: 0 }, "v2.7 의 계산과 같다");
  assert.equal(pullsOf(r.withPaid), Math.floor((17840 + 2440) / 160) + 7 + 1);
  // 한 번 옮긴 걸 저장했다가 다시 열어도 그대로
  const again = normalizeGacha(JSON.parse(JSON.stringify(g)));
  assert.deepEqual(again, g);
  // 고친 값(하루 별소 100, 패스 별소 700)도 그대로
  const edited = normalizeGacha({ paid: { monthly: true, monthlyDay: 100, pass: true, passAstrite: 700, passChar: 3, passDate: "2026-09-20" }, plan: { date: "2026-10-14" } });
  assert.deepEqual(income(edited, 14).paid, { astrite: 1400 + 700, char: 3, weap: 0 });
});

test("옛 '직접 충전' 옮기기: 0 보다 크면 직접 추가 상품 '직접 충전' (한 번만 · 1개), 0 이면 아무것도 안 만든다", () => {
  const some = normalizePaid({ monthly: false, pass: false, topup: 3200 });
  assert.deepEqual(some.custom, [{ id: "c-topup", name: "직접 충전", lunite: 0, astrite: 3200, charPulls: 0, weaponPulls: 0, cycle: "once", price: 0, count: 1 }]);
  assert.equal(got(some, ctx(null, "")).astrite, 3200);
  assert.deepEqual(normalizePaid({ monthly: false, pass: false, topup: 0 }).custom, []);
  assert.deepEqual(normalizePaid({ monthly: true }).custom, []);
  // 꺼 둔 것은 0개, 꺼 둔 패스의 옛 기본 캐릭뽑 2 는 새 기본값 5 로 (합계가 안 바뀌니까)
  const off = normalizePaid({ monthly: false, monthlyDay: 90, pass: false, passAstrite: 680, passChar: 2, passDate: "", topup: 0 });
  assert.deepEqual([off.items.sub.count, off.items.sub.lunite, off.items.pass.count, off.items.pass.charPulls], [0, 300, 0, 5]);
  assert.deepEqual(got(off, ctx(14)), { astrite: 0, char: 0, weap: 0 });
});

test("빈칸 · 음수 · 깨진 저장: 기본값으로 열고, 숫자가 아닌 건 0", () => {
  assert.deepEqual(normalizePaid(null), defaultPaid());
  assert.deepEqual(normalizePaid({}), defaultPaid());
  const p = normalizePaid({ items: { phaseChar: { count: -3, price: "abc", astrite: "", name: "  " }, pass: { count: 500, date: "어제" },
    topup: { tiers: [{ count: 2, first: 1 }, null] } }, custom: [{ id: "a", name: "x" }, "엉뚱", { id: "b", name: "y", astrite: 10, count: -1 }] });
  assert.deepEqual(p.items.phaseChar, { name: "캐릭뽑 팩", count: 0, price: 0, astrite: 0, charPulls: 5, weaponPulls: 0 });
  assert.deepEqual([p.items.pass.count, p.items.pass.date], [99, ""]);
  assert.deepEqual(p.items.topup.tiers.slice(0, 2), [{ count: 2, first: true }, { count: 0, first: false }]);
  assert.equal(p.items.topup.tiers.length, 6);
  assert.deepEqual(p.custom.map((c) => [c.id, c.count]), [["b", 0]]);
  assert.deepEqual(defaultGacha().paid, defaultPaid());
});

test("가격: 적은 상품만 과금 합계(원)에, 안 적은 상품 수는 따로. 가격이 없어도 연차 계산은 된다", () => {
  let p = withItem("phaseChar", { count: 2, price: 12000 });
  p.items.phaseWeapon = { ...p.items.phaseWeapon, count: 1 }; // 가격 빈칸
  p.items.sub = { ...p.items.sub, count: 1 };                  // 5,900원
  const r = paidIncome(p, ctx(14));
  assert.equal(r.won, 24000 + 5900);
  assert.equal(r.unpriced, 1);
  assert.deepEqual(r.total, { astrite: 800 + 400 + 300 + 1260, char: 10, weap: 5 });
  assert.deepEqual(r.priced, { astrite: 800 + 300 + 1260, char: 10, weap: 0 }, "1연에 약 n원은 가격을 적은 상품끼리만");
  assert.equal(Math.round(r.won / pullsOf(r.priced)), Math.round(29900 / 24));
  const none = paidIncome(withItem("phaseChar", { count: 1 }), ctx(14));
  assert.deepEqual([none.won, none.unpriced, pullsOf(none.total)], [0, 1, 7]);
  // 받을 수 있는 만큼만 계산하는 상품은 가격도 그만큼만
  assert.equal(paidIncome(withItem("monthly", { count: 3, price: 25000 }), ctx(17)).won, 25000);
});

test("내용물 요약 글자", () => {
  const p = defaultPaid();
  const label = (id) => contentLabel(shopDef(id), p.items[id]);
  assert.equal(label("phaseChar"), "별소 400 · 캐릭뽑 5");
  assert.equal(label("monthly"), "별소 500 · 캐릭뽑 5 · 무기뽑 5");
  assert.equal(label("pass"), "별소 680 · 캐릭뽑 5 (3주 뒤)");
  assert.equal(label("sub"), "루나이트 300 + 하루 별소 90 × 30일");
  assert.equal(label("topup"), "6단계 · 첫충전은 2배");
  const c = cleanCustom({ id: "c", name: "x", lunite: 1000, weaponPulls: 3 });
  assert.equal(contentLabel(c, c), "루나이트 1,000 · 무기뽑 3");
  assert.equal(daysUntil("2026-10-21", new Date(2026, 9, 4)), 17);
});

test("상품 이름에서 '페이즈' 를 뺀다 (v2.8.1): 폰에 옛 기본 이름이 저장돼 있으면 새 이름으로, 은월이 고친 이름은 그대로", () => {
  assert.deepEqual(["phaseChar", "phaseCharBig", "phaseWeapon"].map((id) => shopDef(id).name), ["캐릭뽑 팩", "캐릭뽑 팩 (큰 것)", "무기뽑 팩"]);
  // v2.8.2: '루나이트 충전' → '충전' (단계에서 고른 개수는 그대로)
  assert.equal(shopDef("topup").name, "충전");
  const old = defaultPaid();
  old.items.topup = { name: "루나이트 충전", tiers: old.items.topup.tiers.map((t, i) => (i === 5 ? { count: 1, first: true } : t)) };
  const moved = normalizePaid(old);
  assert.deepEqual([moved.items.topup.name, topupLunite(moved.items.topup)], ["충전", 12960]);
  const saved = defaultPaid();
  saved.items.phaseChar = { ...saved.items.phaseChar, name: "페이즈 캐릭뽑 팩", count: 2, price: 12000 };
  saved.items.phaseCharBig = { ...saved.items.phaseCharBig, name: "페이즈 캐릭뽑 팩 (큰 것)" };
  saved.items.phaseWeapon = { ...saved.items.phaseWeapon, name: "구도자의 단조 컬렉션" };
  const p = normalizePaid(saved);
  assert.deepEqual([p.items.phaseChar.name, p.items.phaseChar.count, p.items.phaseChar.price], ["캐릭뽑 팩", 2, 12000], "이름만 바뀌고 개수·가격은 그대로");
  assert.equal(p.items.phaseCharBig.name, "캐릭뽑 팩 (큰 것)");
  assert.equal(p.items.phaseWeapon.name, "구도자의 단조 컬렉션");
  assert.equal(CYCLE_LABEL[shopDef("phaseChar").cycle], "페이즈마다", "주기 알약은 그대로");
});
