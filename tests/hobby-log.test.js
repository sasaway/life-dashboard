import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyHobbyLog, noteDay, noteWeek, pruneHobbyLog, HOBBY_LOG_DAYS, HOBBY_LOG_WEEKS } from "../js/hobby-log.js";
import { dailyKey, toggleDaily, tapWeekly, dailyCount, weeklyCount } from "../js/wuwa.js";
import { dayKey, toggleDaily as wfToggle, dailyCount as wfCount } from "../js/warframe.js";

const note = (log, ww, wf, now) => noteDay(log, {
  wwKey: dailyKey(now), ww: dailyCount(ww, now), wwWeek: weeklyCount(ww, now), wfKey: dayKey(now), wf: wfCount(wf, now),
});

test("체크한 수를 그 날 칸에 적고, 초기화 뒤에도 지난 날 기록은 남는다", () => {
  const tue = new Date(2026, 8, 29, 20, 0);
  let ww = toggleDaily({}, tue, "commission");
  ww = tapWeekly(ww, tue, "boss", 2);
  const wf = wfToggle({}, tue, "sortie");
  let log = note(emptyHobbyLog(), ww, wf, tue);
  assert.deepEqual(log.days["2026-09-29"], { ww: [1, 4], wwWeek: [2, 6], wf: [1, 2] });
  // 다음 날 체크가 비워져도 어제 기록은 그대로, 오늘 칸이 새로
  const wed = new Date(2026, 8, 30, 20, 0);
  log = note(log, ww, wf, wed);
  assert.deepEqual(log.days["2026-09-29"], { ww: [1, 4], wwWeek: [2, 6], wf: [1, 2] });
  assert.deepEqual(log.days["2026-09-30"], { ww: [0, 4], wwWeek: [2, 6], wf: [0, 2] });
});

test("새벽: 명조(5시)와 워프레임(1시)은 날이 바뀌는 시각이 달라 서로 다른 날 칸에 적힌다", () => {
  const at3 = new Date(2026, 8, 30, 3, 0); // 명조는 아직 29일, 워프레임은 30일
  const log = note(emptyHobbyLog(), {}, {}, at3);
  assert.deepEqual(Object.keys(log.days).sort(), ["2026-09-29", "2026-09-30"]);
  assert.ok("ww" in log.days["2026-09-29"] && !("wf" in log.days["2026-09-29"]));
  assert.ok("wf" in log.days["2026-09-30"]);
});

test("한 주를 처음 열 때만 파티·육성·장비를 한 벌 저장한다", () => {
  let reads = 0;
  const read = () => { reads++; return { parties: [{ id: "p1", name: "파티 1", slots: ["1503", null, null] }], builds: { 1503: { lv: 1 } }, gear: { frames: [], others: [] } }; };
  const now = new Date(2026, 8, 29, 9, 0);
  let log = noteWeek(emptyHobbyLog(), "2026-09-28", read, now);
  log = noteWeek(log, "2026-09-28", read, new Date(2026, 8, 30));
  assert.equal(reads, 1);
  assert.equal(log.weeks["2026-09-28"].at, now.toISOString());
  assert.deepEqual(log.weeks["2026-09-28"].builds, { 1503: { lv: 1 } });
});

test("날 기록은 60일, 주 기록은 최근 8주만 남긴다", () => {
  assert.equal(HOBBY_LOG_DAYS, 60);
  assert.equal(HOBBY_LOG_WEEKS, 8);
  const weeks = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`2026-08-${String(i + 1).padStart(2, "0")}`, {}]));
  const out = pruneHobbyLog({ days: { "2026-07-01": {}, "2026-08-01": {} }, weeks }, new Date(2026, 8, 29));
  assert.deepEqual(Object.keys(out.days), ["2026-08-01"]);
  assert.deepEqual(Object.keys(out.weeks), ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09", "2026-08-10"]);
});
