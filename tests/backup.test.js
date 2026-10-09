import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  x9Of, versionTag, makeBackup, readBackupText, checkBackup, restoreItems, photosOf, fileName, sizeLabel,
} from "../js/backup.js";
import { syncMealLog } from "../js/meals.js";
import { emptyHobbyLog, noteDay, noteWeek } from "../js/hobby-log.js";
import { DEFAULT_SETTINGS } from "../js/schedule.js";
import { normalizeGacha, income } from "../js/gacha.js";

// localStorage 흉내 (key · length 까지)
function fakeStorage(entries = {}) {
  const m = new Map(Object.entries(entries));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b))),
  };
}
const bytesOf = async (blob) => [...new Uint8Array(await blob.arrayBuffer())];

const ORIGINAL = {
  "ld:library": JSON.stringify([{ id: "a", title: "책 <제목> & \"따옴표\"", photos: ["p1", "p2"] }]),
  "ld:memo": JSON.stringify({ text: "줄바꿈\n이모지 없이 한글만", at: "2026-09-28T01:00:00.000Z" }),
  "ld:schedule": JSON.stringify({ workdays: [true, true, true, true, true, true, false] }),
  "ld:새로생긴칸": "\"나중에 생긴 칸도 저절로\"",
};
const PHOTOS = [
  { id: "p1", blob: new Blob([new Uint8Array([0, 1, 2, 250, 251, 255])], { type: "image/jpeg" }) },
  { id: "p2", blob: new Blob([new Uint8Array(70000).map((_, i) => i % 256)], { type: "image/png" }) },
];

test("x.9 버전만 자동 백업 대상이다", () => {
  assert.equal(x9Of("v1.9 설정 정리 · 9월 28일"), "1.9");
  assert.equal(x9Of("v1.9.1 고침 · 10월 1일"), "1.9");
  assert.equal(x9Of("v2.9"), "2.9");
  assert.equal(x9Of("v1.8 취미 시트 연결 · 9월 27일"), null);
  assert.equal(x9Of("v1.10 · 10월"), null);
  assert.equal(x9Of("v19 옛 번호"), null);
  assert.equal(versionTag("v1.9 설정 정리 · 9월 28일"), "v1.9");
});

test("백업 만들기 → 파일 글자 → 되살리기를 하면 기록과 사진이 원래와 똑같다", async () => {
  const phone = fakeStorage({ ...ORIGINAL, "other-app": "건드리면 안 됨" });
  const backup = await makeBackup({ storage: phone, photos: PHOTOS, appVersion: "v1.9 설정 정리 · 9월 28일", at: new Date(2026, 8, 28, 16, 5) });
  assert.deepEqual(backup.counts, { items: 4, photos: 2 });
  assert.ok(!("other-app" in backup.items), "ld: 로 시작하지 않는 칸은 넣지 않는다");
  assert.equal(backup.version, "v1.9 설정 정리 · 9월 28일");
  const text = JSON.stringify(backup);
  assert.ok(Math.abs(backup.size - Buffer.byteLength(text)) < 10, "크기가 파일 크기와 거의 같다");

  // 백업 뒤에 기록을 바꾸고, 칸을 새로 만들고, 사진을 지운 폰
  const later = fakeStorage({ "ld:memo": "\"바뀐 메모\"", "ld:백업뒤에생긴칸": "1", "other-app": "건드리면 안 됨" });
  const out = readBackupText(text);
  assert.equal(out.error, undefined);
  restoreItems(later, out.backup.items);
  assert.deepEqual(later.dump(), { ...ORIGINAL, "other-app": "건드리면 안 됨" });

  const photos = photosOf(out.backup);
  assert.deepEqual(photos.map((p) => [p.id, p.blob.type]), [["p1", "image/jpeg"], ["p2", "image/png"]]);
  for (let i = 0; i < PHOTOS.length; i++) assert.deepEqual(await bytesOf(photos[i].blob), await bytesOf(PHOTOS[i].blob));
});

test("사진이 없고 기록도 없는 폰도 백업·되살리기가 된다", async () => {
  const backup = await makeBackup({ storage: fakeStorage(), photos: [], appVersion: "v1.9" });
  const out = readBackupText(JSON.stringify(backup));
  assert.deepEqual(out.backup.counts, { items: 0, photos: 0 });
  const phone = fakeStorage({ "ld:memo": "\"지워질 것\"" });
  restoreItems(phone, out.backup.items);
  assert.deepEqual(phone.dump(), {});
});

test("깨진 파일 · 다른 앱 파일 · 손댄 파일은 거절한다", async () => {
  const good = await makeBackup({ storage: fakeStorage(ORIGINAL), photos: PHOTOS, appVersion: "v1.9" });
  const bad = (change) => {
    const b = structuredClone(good);
    change(b);
    return JSON.stringify(b);
  };
  assert.match(readBackupText("{ 깨진 글자").error, /깨졌어/);
  assert.match(readBackupText("").error, /깨졌어/);
  assert.match(readBackupText("[1, 2, 3]").error, /백업 파일이 아니야/);
  assert.match(readBackupText("null").error, /백업 파일이 아니야/);
  assert.match(readBackupText(JSON.stringify({ app: "other-app", format: 1 })).error, /라이프대시보드 백업 파일이 아니야/);
  assert.match(readBackupText(bad((b) => { b.format = 2; })).error, /형식/);
  assert.match(readBackupText(bad((b) => { b.at = "어제"; })).error, /날짜/);
  assert.match(readBackupText(bad((b) => { b.items["other-app"] = "x"; b.counts.items += 1; })).error, /기록이 깨졌어/);
  assert.match(readBackupText(bad((b) => { b.items["ld:memo"] = 3; })).error, /기록이 깨졌어/);
  assert.match(readBackupText(bad((b) => { b.photos[0].data = "사진아님!!"; })).error, /사진이 깨졌어/);
  assert.match(readBackupText(bad((b) => { b.photos[0].data = "abc"; })).error, /사진이 깨졌어/);
  assert.match(readBackupText(bad((b) => { b.photos.pop(); })).error, /개수/);
  assert.match(readBackupText(bad((b) => { delete b.items; })).error, /깨졌어/);
  assert.equal(checkBackup(good), "");
});

test("파일 이름은 버전과 백업한 날짜, 크기는 KB · MB 로", () => {
  assert.equal(fileName({ version: "v1.9 설정 정리 · 9월 28일", at: new Date(2026, 8, 28, 23, 59).toISOString() }), "life-dashboard-backup-v1.9-20260928.json");
  assert.equal(sizeLabel(300), "1KB");
  assert.equal(sizeLabel(812 * 1024), "812KB");
  assert.equal(sizeLabel(2.34 * 1024 * 1024), "2.3MB");
});

// 새 저장 칸이 생길 때마다 여기에 하나씩 (CLAUDE.md x.9 규칙: 새 칸이 백업에 빠짐없이 들어가는지)
test("v2.2 먹은 기록(mealLog)도 백업 → 되살리기로 그대로 돌아온다", async () => {
  const mealLog = syncMealLog({}, new Date(2026, 8, 30), DEFAULT_SETTINGS, { "2026-09-29 저녁": "skip" });
  const phone = fakeStorage({ "ld:mealLog": JSON.stringify(mealLog), "ld:memo": "\"메모\"" });
  const text = JSON.stringify(await makeBackup({ storage: phone, photos: [], appVersion: "v2.2 식단 기록 · 9월 29일" }));
  const later = fakeStorage({ "ld:memo": "\"바뀐 메모\"" }); // 기록이 날아간 폰
  restoreItems(later, readBackupText(text).backup.items);
  assert.deepEqual(JSON.parse(later.getItem("ld:mealLog")), mealLog);
  assert.equal(Object.keys(mealLog).length, 7);
});

test("v2.2.2 취미 기록(hobbyLog)도 백업 → 되살리기로 그대로 돌아온다", async () => {
  const now = new Date(2026, 8, 29, 20, 0);
  let hobbyLog = noteDay(emptyHobbyLog(), { wwKey: "2026-09-29", ww: { done: 3, total: 4 }, wwWeek: { done: 5, total: 6 }, wfKey: "2026-09-29", wf: { done: 2, total: 2 } });
  hobbyLog = noteWeek(hobbyLog, "2026-09-28", () => ({ parties: [{ id: "p1", name: "파티 \"1\"", slots: ["1503", null, null] }], builds: { 1503: { lv: 1 } }, gear: { frames: [{ id: "f1", name: "오락시아" }], others: [] } }), now);
  const phone = fakeStorage({ "ld:hobbyLog": JSON.stringify(hobbyLog) });
  const text = JSON.stringify(await makeBackup({ storage: phone, photos: [], appVersion: "v2.2.2 취미 기록 · 9월 29일" }));
  const later = fakeStorage({});
  restoreItems(later, readBackupText(text).backup.items);
  assert.deepEqual(JSON.parse(later.getItem("ld:hobbyLog")), hobbyLog);
});

test("v2.3 주간회고(weekReviews)도 백업 → 되살리기로 그대로, 옛 이번 주 메모(weekly)도 함께", async () => {
  const weekReviews = { "2026-09-28": { answers: ["운동 4일", "", "모딩 순서", "월요일 장보기"] } };
  const weekly = { "2026-09-21": "예전 메모" };
  const phone = fakeStorage({ "ld:weekReviews": JSON.stringify(weekReviews), "ld:weekly": JSON.stringify(weekly) });
  const text = JSON.stringify(await makeBackup({ storage: phone, photos: [], appVersion: "v2.3 주간리뷰 · 9월 29일" }));
  const later = fakeStorage({});
  restoreItems(later, readBackupText(text).backup.items);
  assert.deepEqual(JSON.parse(later.getItem("ld:weekReviews")), weekReviews);
  assert.deepEqual(JSON.parse(later.getItem("ld:weekly")), weekly);
});

test("v2.4 가챠 계산기(wuwaGacha)도 백업 → 되살리기로 그대로 돌아온다", async () => {
  const wuwaGacha = normalizeGacha({ have: { astrite: 16000, char: 3, weap: 1 }, paid: { monthly: true }, plan: { date: "2026-10-14" } });
  const phone = fakeStorage({ "ld:wuwaGacha": JSON.stringify(wuwaGacha), "ld:wuwaParties": "[]" });
  const text = JSON.stringify(await makeBackup({ storage: phone, photos: [], appVersion: "v2.4 가챠 재화 · 9월 30일" }));
  const later = fakeStorage({ "ld:wuwaGacha": JSON.stringify(normalizeGacha({})) }); // 되살리기 전에 비워 둔 폰
  restoreItems(later, readBackupText(text).backup.items);
  assert.deepEqual(JSON.parse(later.getItem("ld:wuwaGacha")), wuwaGacha);
  assert.equal(normalizeGacha(JSON.parse(later.getItem("ld:wuwaGacha"))).have.astrite, 16000);
});

test("핫픽스 v2.5.1 의 예전 마감반(oldClose)도 백업 → 되살리기로 그대로 돌아온다", async () => {
  const schedule = { workdays: [true, true, true, true, true, true, true], closeReset: "2.5.1",
    oldClose: { at: "2026-10-02T00:00:00.000Z", blocks: [{ start: "06:00", kind: "chores", name: "가사", note: "" }] } };
  const phone = fakeStorage({ "ld:schedule": JSON.stringify(schedule) });
  const text = JSON.stringify(await makeBackup({ storage: phone, photos: [], appVersion: "v2.5.1 핫픽스 · 10월 2일" }));
  const later = fakeStorage({});
  restoreItems(later, readBackupText(text).backup.items);
  assert.deepEqual(JSON.parse(later.getItem("ld:schedule")), schedule);
});

test("v2.7 픽업 일정(wuwaPickups)과 가챠 계획의 '직접' 표시도 백업 → 되살리기로 그대로 돌아온다", async () => {
  const wuwaPickups = { at: 1791000000000, updated: "마지막 갱신: 2026-10-03 09:00",
    rows: [["3.7", "2페이즈", "2026-10-21 10:00", "2026-11-11 09:59", "쇄명", "전무 \"이름\"", "아니오", "예정", "공식 공지", "2026-10-01"]] };
  const wuwaGacha = normalizeGacha({ plan: { date: "2026-10-15", char: "pre-suoming", charName: "쇄명", charBy: "auto", dateBy: "manual", autoKey: "", seenKey: "3.7|2페이즈|쇄명@a~b" } });
  const phone = fakeStorage({ "ld:wuwaPickups": JSON.stringify(wuwaPickups), "ld:wuwaGacha": JSON.stringify(wuwaGacha) });
  const text = JSON.stringify(await makeBackup({ storage: phone, photos: [], appVersion: "v2.7 픽업 일정 · 10월 3일" }));
  const later = fakeStorage({});
  restoreItems(later, readBackupText(text).backup.items);
  assert.deepEqual(JSON.parse(later.getItem("ld:wuwaPickups")), wuwaPickups);
  assert.deepEqual(normalizeGacha(JSON.parse(later.getItem("ld:wuwaGacha"))).plan, wuwaGacha.plan);
});

test("v2.8 과금 상품(wuwaGacha.paid): 새 모양은 백업 → 되살리기로 그대로, 옛 모양(v2.7 백업)은 되살린 뒤 열면 숫자가 그대로", async () => {
  // 새 모양: 기본 상품 + 루나이트 단계 + 직접 추가 상품
  const fresh = normalizeGacha({ plan: { date: "2026-10-21" } });
  fresh.paid.items.phaseChar = { ...fresh.paid.items.phaseChar, count: 2, price: 12000, name: "구도자의 \"찬란한\" 컬렉션" };
  fresh.paid.items.topup.tiers[5] = { count: 1, first: true };
  fresh.paid.custom.push({ id: "c-1", name: "3.7 기념 패키지", lunite: 0, astrite: 1600, charPulls: 0, weaponPulls: 0, cycle: "once", price: 33000, count: 1 });
  const phone = fakeStorage({ "ld:wuwaGacha": JSON.stringify(fresh) });
  const text = JSON.stringify(await makeBackup({ storage: phone, photos: [], appVersion: "v2.8 과금 상품 · 10월 4일" }));
  const later = fakeStorage({});
  restoreItems(later, readBackupText(text).backup.items);
  assert.deepEqual(JSON.parse(later.getItem("ld:wuwaGacha")), fresh);
  assert.deepEqual(normalizeGacha(JSON.parse(later.getItem("ld:wuwaGacha"))), fresh, "다시 열어도 그대로");
  // 옛 모양: v2.7 폰에서 만든 백업
  const old = { have: { astrite: 16000, char: 0, weap: 0 }, free: { daily: 60, astrite: 0, char: 0 },
    paid: { monthly: true, monthlyDay: 90, pass: true, passAstrite: 680, passChar: 2, passDate: "2026-09-20", topup: 500 }, plan: { date: "2026-10-14" } };
  const oldPhone = fakeStorage({ "ld:wuwaGacha": JSON.stringify(old) });
  const oldText = JSON.stringify(await makeBackup({ storage: oldPhone, photos: [], appVersion: "v2.7 픽업 일정 · 10월 3일" }));
  const newPhone = fakeStorage({});
  restoreItems(newPhone, readBackupText(oldText).backup.items);
  assert.deepEqual(JSON.parse(newPhone.getItem("ld:wuwaGacha")), old, "백업은 옛 모양 그대로 돌아온다");
  const opened = normalizeGacha(JSON.parse(newPhone.getItem("ld:wuwaGacha")));
  assert.deepEqual(income(opened, 14).paid, { astrite: 90 * 14 + 680 + 500, char: 2, weap: 0 });
  assert.equal(opened.paid.custom[0].name, "직접 충전");
});

test("핫픽스 v2.8.1 의 요일별 알바(schedule.dayShifts)와 중간반 일과표도 백업 → 되살리기로 그대로 돌아온다", async () => {
  const schedule = { ...DEFAULT_SETTINGS, dayShifts: ["off", "open", "open", "mid", "close", "close", "off"], closeReset: "2.5.1" };
  const phone = fakeStorage({ "ld:schedule": JSON.stringify(schedule) });
  const text = JSON.stringify(await makeBackup({ storage: phone, photos: [], appVersion: "v2.8.1 핫픽스 · 10월 4일" }));
  const later = fakeStorage({});
  restoreItems(later, readBackupText(text).backup.items);
  const back = JSON.parse(later.getItem("ld:schedule"));
  assert.deepEqual(back, JSON.parse(JSON.stringify(schedule)));
  const at = back.templates.mid.findIndex((x) => x.kind === "prep");
  assert.deepEqual(back.templates.mid.map((x) => x.start).slice(at, at + 3), ["11:00", "12:00", "19:00"]);
});

// x.9 규칙 (v2.9): v1.9 뒤로 생긴 저장 칸이 자동 백업에 빠짐없이 들어가는지 — 칸 이름을 손으로 적지 않고 코드에서 모은다
test("v2.9 자동 백업: 앱이 저장하는 칸이 하나도 빠지지 않고 백업 → 되살리기로 그대로 돌아온다", async () => {
  const dir = new URL("../js/", import.meta.url);
  const src = readdirSync(dir).map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
  const keys = [...new Set([...src.matchAll(/store\.save\("(\w+)"/g), ...src.matchAll(/^const (?:URL_)?KEY = "(\w+)"/gm)].map((m) => m[1]))].sort();
  // v1.9 뒤로 생긴 칸 (v2.2 mealLog · hobbyLog, v2.3 weekReviews, v2.4 wuwaGacha, v2.7 wuwaPickups) 과 요일별 알바가 든 schedule, 연결 설정
  for (const k of ["mealLog", "hobbyLog", "weekReviews", "wuwaGacha", "wuwaPickups", "wfLive", "mealOverrides", "schedule", "hobbySync", "calUrl"]) assert.ok(keys.includes(k), `${k} 를 코드에서 찾았다`);
  const phone = fakeStorage(Object.fromEntries(keys.map((k, i) => [`ld:${k}`, JSON.stringify({ k, i, text: "한글 \"따옴표\"" })])));
  phone.setItem("ld:schedule", JSON.stringify({ ...DEFAULT_SETTINGS, dayShifts: ["off", "open", "open", "mid", "close", "close", "off"] }));
  const version = "v2.9 일정 보내기 · 정리 · 10월 4일"; // 그때 화면에 보이던 버전 글자
  assert.equal(x9Of(version), "2.9", "v2.9 로 처음 켜질 때 자동 백업이 돈다");
  const backup = await makeBackup({ storage: phone, photos: PHOTOS, appVersion: version });
  assert.equal(backup.counts.items, keys.length);
  const out = readBackupText(JSON.stringify(backup));
  assert.equal(out.error, undefined);
  const later = fakeStorage({ "ld:schedule": "{}", "ld:나중에생긴칸": "1" });
  restoreItems(later, out.backup.items);
  assert.deepEqual(later.dump(), phone.dump());
  assert.equal(photosOf(out.backup).length, PHOTOS.length);
});

test("핫픽스 v3.0.6 식단 메뉴 설정(mealMenu)도 백업 → 되살리기로 그대로 돌아온다 (코드가 저장하는 칸 목록에도 들어 있다)", async () => {
  const dir = new URL("../js/", import.meta.url);
  const src = readdirSync(dir).map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
  assert.match(src, /^const KEY = "mealMenu"/m);
  const menu = { allowed: { bread: ["아침", "점심"] }, off: ["ramen"], custom: [{ id: "x-1", name: "샐러드 \"큰 것\"", allowed: ["점심", "저녁"] }], removed: [{ id: "x-0", name: "토스트" }] };
  const phone = fakeStorage({ "ld:mealMenu": JSON.stringify(menu), "ld:mealOverrides": JSON.stringify({ "2026-10-12 점심": "x-1" }) });
  const backup = await makeBackup({ storage: phone, photos: [], appVersion: "v3.0.6 핫픽스 · 10월 9일" });
  const out = readBackupText(JSON.stringify(backup));
  assert.equal(out.error, undefined);
  const later = fakeStorage({ "ld:mealMenu": "{}" });
  restoreItems(later, out.backup.items);
  assert.deepEqual(later.dump(), phone.dump());
  assert.deepEqual(JSON.parse(later.getItem("ld:mealMenu")), menu);
});

test("핫픽스 v3.0.7 첫 칸이 '취침' 인 옛 백업을 되살려도 안 깨지고, 앱이 불러올 때 '기상' 으로 읽힌다", async () => {
  const { upgradeTemplates, clearNotesOnce, renameWakeOnce, DEFAULT_TEMPLATES, dayPlan } = await import("../js/schedule.js");
  const oldTemplates = Object.fromEntries(Object.entries(DEFAULT_TEMPLATES).map(([k, blocks]) => [k, blocks.map((x, i) => (i === 0 ? { ...x, name: "취침" } : x))]));
  oldTemplates.open = oldTemplates.open.map((x) => (x.kind === "exercise" ? { ...x, name: "운동 (헬스장)" } : x)); // 한 반은 직접 고친 것
  const old = { ...DEFAULT_SETTINGS, dayShifts: ["off", "open", "open", "mid", "close", "close", "off"], notesCleared: "3.0.3", templates: oldTemplates };
  const phone = fakeStorage({ "ld:schedule": JSON.stringify(old) });
  const text = JSON.stringify(await makeBackup({ storage: phone, photos: [], appVersion: "v3.0.6 핫픽스 · 10월 9일" }));
  const later = fakeStorage({});
  restoreItems(later, readBackupText(text).backup.items);
  const saved = JSON.parse(later.getItem("ld:schedule"));
  assert.equal(saved.templates.open[0].name, "취침", "되살린 직후에는 백업 그대로");
  // 앱이 저장된 일과표를 불러오는 길 (schedule-view.js loadSettings 와 같은 순서)
  const loaded = renameWakeOnce(clearNotesOnce({ ...saved, templates: upgradeTemplates(saved.templates) }));
  for (const shift of ["open", "mid", "close"]) assert.equal(loaded.templates[shift][0].name, "기상", shift);
  assert.equal(loaded.templates.open.find((x) => x.kind === "exercise").name, "운동 (헬스장)", "직접 고친 칸은 그대로");
  assert.deepEqual(loaded.templates.mid, DEFAULT_TEMPLATES.mid, "안 고친 반은 새 기본값");
  assert.equal(dayPlan(new Date(2026, 9, 12), loaded).blocks[0].name, "기상");
});

test("v3.1 유산소 분(cardioMin)도 백업 → 되살리기로 그대로 돌아온다 (코드가 저장하는 칸 목록에도 들어 있다)", async () => {
  const dir = new URL("../js/", import.meta.url);
  const src = readdirSync(dir).map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
  assert.match(src, /store\.save\("cardioMin"/);
  const mins = { "2026-10-09": 22, "2026-10-10": 30 };
  const phone = fakeStorage({ "ld:cardioMin": JSON.stringify(mins), "ld:workoutLog": JSON.stringify({ "2026-10-09": { cardio: 1 }, "2026-10-10": { cardio: 1, chest: 3 } }) });
  const backup = await makeBackup({ storage: phone, photos: [], appVersion: "v3.1 · 10월 10일" });
  const out = readBackupText(JSON.stringify(backup));
  assert.equal(out.error, undefined);
  const later = fakeStorage({ "ld:cardioMin": "{}" });
  restoreItems(later, out.backup.items);
  assert.deepEqual(later.dump(), phone.dump());
  assert.deepEqual(JSON.parse(later.getItem("ld:cardioMin")), mins);
  // 분 칸이 없는 옛 백업을 되살리면 분 칸은 비고, 운동 기록은 그대로
  const old = await makeBackup({ storage: fakeStorage({ "ld:workoutLog": "{}" }), photos: [], appVersion: "v3.0.9 핫픽스 · 10월 10일" });
  restoreItems(later, readBackupText(JSON.stringify(old)).backup.items);
  assert.equal(later.getItem("ld:cardioMin"), null);
});
