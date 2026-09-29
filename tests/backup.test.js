import { test } from "node:test";
import assert from "node:assert/strict";
import {
  x9Of, versionTag, makeBackup, readBackupText, checkBackup, restoreItems, photosOf, fileName, sizeLabel,
} from "../js/backup.js";
import { syncMealLog } from "../js/meals.js";
import { emptyHobbyLog, noteDay, noteWeek } from "../js/hobby-log.js";
import { DEFAULT_SETTINGS } from "../js/schedule.js";

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
