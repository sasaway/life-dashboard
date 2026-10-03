import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FETCH_EVERY, emptyPickups, shouldFetch, readPickupReply, parseWhen, pickupsOf, pickupNames, nextPhase, planDate, livePickups,
  rowKey, signature, phaseLabel, applyPickup, autoFill, markByHand, hasNewPickup, byHand, isTentative, isRerun,
} from "../js/pickups.js";
import { withUpcoming, findByName, pickupPlaceholder, adoptRealIds, isPlaceholder } from "../js/wuwa.js";
import { defaultGacha, normalizeGacha } from "../js/gacha.js";

// 버전 · 페이즈 · 시작 · 끝 · 5성 공명자 · 전용 무기 · 복각 · 상태 · 출처 · 확인한 날
const row = (version, phase, start, end, char, status = "확정", rerun = "아니오") =>
  [version, phase, start, end, char, `${char} 전무`, rerun, status, "공식 공지", "2026-10-01"];
const A = row("3.7", "1페이즈", "2026-09-30 11:00", "2026-10-21 09:59", "여우의 별자리");
const B = row("3.7", "2페이즈", "2026-10-21 10:00", "2026-11-11 09:59", "쇄명");
const C1 = row("3.8", "1페이즈", "2026-11-12 11:00", "2026-12-03 09:59", "카르티시아", "예정", "예");
const C2 = row("3.8", "1페이즈", "2026-11-12 11:00", "2026-12-03 09:59", "새 공명자", "예정");
const saved = (...rows) => ({ at: 1, updated: "마지막 갱신: 2026-10-03 09:00", rows });
const chars = [{ id: "1407", name: "카르티시아", stars: 5 }, { id: "1102", name: "산화", stars: 4 }];
const all = (s) => withUpcoming(chars, pickupNames(s));
const resolver = (s) => (name) => findByName(all(s), name) ?? pickupPlaceholder(name);
const plan = () => defaultGacha().plan;
const at = (m, d, h = 12) => new Date(2026, m - 1, d, h, 0);

test("심부름꾼 답 읽기: 줄은 칸 10개 글자로, 옛 심부름꾼(rows 없음)이나 틀린 답은 null", () => {
  const got = readPickupReply({ ok: true, updated: "마지막 갱신: 2026-10-03 09:00", rows: [B, ["3.8", " 1페이즈 "], "엉뚱한 것"] }, 123);
  assert.equal(got.at, 123);
  assert.equal(got.rows.length, 2);
  assert.deepEqual(got.rows[1], ["3.8", "1페이즈", "", "", "", "", "", "", "", ""]);
  assert.equal(readPickupReply({ ok: true }, 1), null, "옛 심부름꾼");
  assert.equal(readPickupReply({ ok: false, error: "token" }, 1), null);
  assert.equal(readPickupReply(null, 1), null);
  assert.deepEqual(readPickupReply({ ok: true, rows: [] }, 5), { at: 5, updated: "", rows: [] }, "빈 탭도 받은 것");
});

test("받는 때: 마지막으로 받은 지 6시간이 넘었을 때만", () => {
  const t = Date.UTC(2026, 9, 3, 12);
  assert.equal(shouldFetch(emptyPickups(), t), true, "받은 적 없으면 받는다");
  assert.equal(shouldFetch({ at: t - FETCH_EVERY + 1 }, t), false);
  assert.equal(shouldFetch({ at: t - FETCH_EVERY }, t), true);
});

test("날짜 읽기: 'YYYY-MM-DD HH:mm' (한국 시간 = 폰 시계), 시각이 없으면 00:00, 못 읽는 줄은 뺀다", () => {
  assert.deepEqual(parseWhen("2026-10-21 10:00"), new Date(2026, 9, 21, 10, 0));
  assert.deepEqual(parseWhen("2026-10-21"), new Date(2026, 9, 21, 0, 0));
  assert.equal(parseWhen("10월 21일"), null);
  assert.equal(parseWhen(""), null);
  const list = pickupsOf(saved(B, row("3.9", "1페이즈", "미정", "미정", "누군가"), row("3.9", "2페이즈", "2026-12-01 10:00", "2026-12-20 09:59", " "), A));
  assert.deepEqual(list.map((p) => p.char), ["여우의 별자리", "쇄명"], "시작 순서대로, 못 읽는 줄 빠짐");
  assert.deepEqual(pickupsOf(null), []);
  assert.deepEqual(pickupsOf(emptyPickups()), []);
});

test("다음 픽업: 진행 중인 페이즈가 먼저, 없으면 가장 먼저 시작하는 페이즈, 끝난 건 빼고", () => {
  const list = pickupsOf(saved(A, B, C1, C2));
  assert.equal(nextPhase(list, at(10, 3)).key, "3.7|1페이즈");
  assert.equal(nextPhase(list, at(10, 21, 9)).key, "3.7|1페이즈", "끝나기 59분 전");
  assert.equal(nextPhase(list, at(10, 21, 12)).key, "3.7|2페이즈");
  assert.equal(nextPhase(pickupsOf(saved(B, C1)), at(10, 3)).key, "3.7|2페이즈", "진행 중이 없으면 다음 것");
  assert.equal(nextPhase(list, at(11, 20)).rows.length, 2, "한 페이즈 두 명");
  assert.equal(nextPhase(list, at(12, 25)), null, "다 끝났으면 없다");
  assert.equal(livePickups(list, at(11, 20)).length, 2);
  assert.equal(phaseLabel(nextPhase(list, at(10, 22))), "3.7 · 2페이즈 · 쇄명 · 10/21~11/11");
  assert.equal(isTentative(list[2]), true);
  assert.equal(isRerun(list[2]), true);
  assert.equal(isTentative(list[0]), false);
});

test("픽업 날짜 고르기: 진행 중이면 끝나는 날, 아직 안 시작했으면 시작하는 날", () => {
  const [a, b] = pickupsOf(saved(A, B));
  assert.equal(planDate(a, at(10, 3)), "2026-10-21", "진행 중 → 끝나는 날");
  assert.equal(planDate(b, at(10, 3)), "2026-10-21", "안 시작함 → 시작하는 날");
  assert.equal(planDate(b, at(10, 21, 10)), "2026-11-11", "시작하는 시각부터 진행 중");
  assert.equal(planDate(b, at(10, 21, 9)), "2026-10-21", "시작 1시간 전");
});

test("이름 맞추기: 띄어쓰기·가운뎃점 무시, 목록에 없는 새 공명자는 임시 번호 + 빈 얼굴", () => {
  const s = saved(row("3.8", "1페이즈", "2026-11-12 11:00", "2026-12-03 09:59", "카르 티시아"), C2, B);
  const list = all(s);
  assert.equal(resolver(s)("카르 티시아").id, "1407", "있는 공명자는 진짜 번호");
  assert.equal(resolver(s)("카르·티시아").id, "1407");
  const fresh = resolver(s)("새 공명자");
  assert.deepEqual(fresh, { id: "pre-pk-새공명자", name: "새 공명자", stars: 5, element: "", weapon: "", icon: "" });
  assert.ok(isPlaceholder(fresh));
  assert.ok(list.some((c) => c.id === "pre-pk-새공명자"), "고르기 창 목록에 들어간다");
  assert.equal(list.filter((c) => c.name === "쇄명").length, 1, "미리 넣어 둔 3.7 공명자와 겹치지 않는다");
  assert.equal(resolver(s)("쇄 명").id, "pre-suoming");
  assert.equal(list.filter((c) => c.name.replace(/\s/g, "") === "카르티시아").length, 1, "있는 이름은 더하지 않는다");
});

test("새 공명자가 encore.moe 에 올라오면 진짜 번호로: 목록 · 파티 칸 · 육성 체크 · 가챠 계획", () => {
  const s = saved(C2);
  const real = [...chars, { id: "1510", name: "새공명자", stars: 5 }];
  assert.ok(!withUpcoming(real, pickupNames(s)).some((c) => c.id.startsWith("pre-pk-")), "임시는 사라진다");
  const moved = adoptRealIds([{ id: "p", name: "x", slots: ["pre-pk-새공명자", "1102", null] }], { "pre-pk-새공명자": { lv: 1 } }, real);
  assert.deepEqual(moved.parties[0].slots, ["1510", "1102", null]);
  assert.deepEqual(moved.builds, { 1510: { lv: 1 } });
  assert.equal(adoptRealIds([{ id: "p", name: "x", slots: ["pre-pk-새공명자"] }], {}, chars), null, "아직 안 올라왔으면 그대로");
  // 가챠 계획: 자동으로 채운 건 다음에 그릴 때 진짜 번호로
  const list = pickupsOf(saved(row("3.8", "1페이즈", "2026-11-12 11:00", "2026-12-03 09:59", "새 공명자")));
  const before = autoFill(plan(), list, at(11, 1), (n) => findByName(withUpcoming(chars, [n]), n));
  assert.equal(before.char, "pre-pk-새공명자");
  const after = autoFill(before, list, at(11, 1), (n) => findByName(withUpcoming(real, [n]), n));
  assert.deepEqual([after.char, after.charName, after.date], ["1510", "새공명자", "2026-11-12"]);
});

test("자동 채우기: 공명자와 날짜만 — 체인·전무·스택은 그대로", () => {
  const s = saved(A, B);
  const mine = { ...plan(), chain: 2, owned: 0, weapon: true, stack: 41, guaranteed: true, wStack: 7 };
  const next = autoFill(mine, pickupsOf(s), at(10, 3), resolver(s));
  assert.deepEqual([next.char, next.charName, next.date], ["pre-hsin", "여우의 별자리", "2026-10-21"]);
  assert.deepEqual([next.charBy, next.dateBy, next.autoKey], ["auto", "auto", "3.7|1페이즈|여우의별자리"]);
  assert.deepEqual([next.chain, next.owned, next.weapon, next.stack, next.guaranteed, next.wStack], [2, 0, true, 41, true, 7]);
  assert.equal(autoFill(next, pickupsOf(s), at(10, 3), resolver(s)), next, "또 불러도 바뀌는 게 없다 (같은 객체)");
  // 1페이즈가 끝나면 다음 페이즈로 넘어간다 · 진행 중이니 끝나는 날
  const later = autoFill(next, pickupsOf(s), at(10, 22), resolver(s));
  assert.deepEqual([later.charName, later.date, later.autoKey], ["쇄명", "2026-11-11", "3.7|2페이즈|쇄명"]);
  // 아직 안 시작한 것만 있으면 시작하는 날
  assert.equal(autoFill(plan(), pickupsOf(saved(B)), at(10, 3), resolver(s)).date, "2026-10-21");
  // 일정이 없으면 그대로
  assert.deepEqual(autoFill(plan(), [], at(10, 3), resolver(s)), plan());
});

test("한 페이즈에 공명자가 여럿이면 자동으로 고르지 않는다 · 고르면 그 줄을 따라간다", () => {
  const s = saved(C1, C2);
  const list = pickupsOf(s);
  assert.deepEqual(autoFill(plan(), list, at(11, 1), resolver(s)), plan());
  const picked = applyPickup(plan(), list.find((p) => p.char === "카르티시아"), at(11, 1), resolver(s));
  assert.deepEqual([picked.char, picked.date, picked.charBy], ["1407", "2026-11-12", "auto"]);
  assert.equal(byHand(picked), false);
  assert.equal(autoFill(picked, list, at(11, 1), resolver(s)), picked, "고른 것을 그대로 둔다");
  assert.equal(autoFill(picked, list, at(11, 13), resolver(s)).date, "2026-12-03", "시작하면 끝나는 날로");
  // 앞 페이즈가 진행 중이어도, 뒤 페이즈에서 고른 것은 그대로
  const s2 = saved(B, C1, C2);
  const kept = autoFill(picked, pickupsOf(s2), at(10, 25), resolver(s2));
  assert.equal(kept.char, "1407");
});

test("'직접' 보호: 은월이 고친 공명자·날짜는 새 일정이 와도 절대 덮어쓰지 않고, 안내만", () => {
  const s = saved(A, B);
  const list = pickupsOf(s);
  const auto = autoFill(plan(), list, at(10, 3), resolver(s));
  // 날짜를 손으로 바꿈
  const mine = markByHand({ ...auto, date: "2026-10-15" }, "date", list, at(10, 3));
  assert.deepEqual([mine.dateBy, mine.charBy, mine.autoKey], ["manual", "auto", ""]);
  assert.equal(byHand(mine), true);
  assert.equal(autoFill(mine, list, at(10, 3), resolver(s)), mine, "안 덮어쓴다");
  assert.equal(hasNewPickup(mine, list, at(10, 3), resolver(s)), false, "고칠 때 본 일정이면 안내 없음");
  // 새 일정이 옴 (끝나는 날이 바뀜)
  const s2 = saved(row("3.7", "1페이즈", "2026-09-30 11:00", "2026-10-23 09:59", "여우의 별자리"), B);
  assert.equal(autoFill(mine, pickupsOf(s2), at(10, 3), resolver(s2)), mine);
  assert.equal(mine.date, "2026-10-15");
  assert.equal(hasNewPickup(mine, pickupsOf(s2), at(10, 3), resolver(s2)), true, "'새 픽업 일정이 있어'");
  // 다음 페이즈로 넘어가도 안 덮어쓰고 안내
  assert.equal(autoFill(mine, list, at(10, 22), resolver(s)), mine);
  assert.equal(hasNewPickup(mine, list, at(10, 22), resolver(s)), true);
  // '바꾸기' 를 누르면 다시 Claude 가 채운 것으로
  const back = applyPickup(mine, nextPhase(list, at(10, 22)).rows[0], at(10, 22), resolver(s));
  assert.deepEqual([back.charName, back.date, back.charBy, back.dateBy], ["쇄명", "2026-11-11", "auto", "auto"]);
  assert.equal(hasNewPickup(back, list, at(10, 22), resolver(s)), false);
  // 공명자를 손으로 바꿈 (비우는 것도 직접 고친 것)
  const cleared = markByHand({ ...auto, char: "", charName: "" }, "char", list, at(10, 3));
  assert.equal(autoFill(cleared, list, at(10, 3), resolver(s)).char, "");
  // 직접 적은 값이 일정과 같으면 안내하지 않는다
  const same = { ...plan(), char: "pre-hsin", charName: "여우의 별자리", date: "2026-10-21", charBy: "manual", dateBy: "manual" };
  assert.equal(hasNewPickup(same, list, at(10, 3), resolver(s)), false);
  assert.equal(hasNewPickup(plan(), list, at(10, 3), resolver(s)), false, "직접 고친 게 없으면 안내 대신 채운다");
  assert.equal(hasNewPickup(mine, [], at(10, 3), resolver(s)), false, "일정이 없으면 안내 없음");
});

test("v2.6 까지 적어 둔 공명자·날짜는 '직접' 으로 옮겨서 지킨다 (빈칸은 채울 수 있게 둔다)", () => {
  const old = normalizeGacha({ plan: { date: "2026-10-14", char: "1407", charName: "카르티시아", chain: 2 } });
  assert.deepEqual([old.plan.charBy, old.plan.dateBy, old.plan.autoKey, old.plan.seenKey], ["manual", "manual", "", ""]);
  const s = saved(A);
  assert.equal(autoFill(old.plan, pickupsOf(s), at(10, 3), resolver(s)), old.plan);
  assert.equal(hasNewPickup(old.plan, pickupsOf(s), at(10, 3), resolver(s)), true, "일정이 처음 오면 안내");
  const blank = normalizeGacha({ plan: { chain: 1 } });
  assert.deepEqual([blank.plan.charBy, blank.plan.dateBy], ["", ""]);
  assert.equal(autoFill(blank.plan, pickupsOf(s), at(10, 3), resolver(s)).charName, "여우의 별자리");
  const onlyDate = normalizeGacha({ plan: { date: "2026-10-14" } });
  assert.deepEqual([onlyDate.plan.charBy, onlyDate.plan.dateBy], ["", "manual"]);
  // v2.7 로 저장한 것은 다시 열어도 그대로
  const again = normalizeGacha({ plan: { ...blank.plan, char: "x", charBy: "auto", dateBy: "auto" } });
  assert.equal(again.plan.charBy, "auto");
});

test("일정이 바뀌었는지: 공명자·시작·끝이 같으면 같은 일정, 줄 순서는 상관없다", () => {
  const g1 = nextPhase(pickupsOf(saved(C1, C2)), at(11, 1));
  const g2 = nextPhase(pickupsOf(saved(C2, C1)), at(11, 1));
  assert.equal(signature(g1), signature(g2));
  assert.notEqual(signature(g1), signature(nextPhase(pickupsOf(saved(C1)), at(11, 1))));
  assert.equal(signature(null), "");
  assert.equal(rowKey(pickupsOf(saved(C2))[0]), "3.8|1페이즈|새공명자");
});
