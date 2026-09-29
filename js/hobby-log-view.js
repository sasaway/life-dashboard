// 취미 기록 저장 (v2.2.2). 명조·워프레임 체크 화면이 다시 그릴 때마다(누를 때 · 1분마다) 부른다.
// 폰에 저장된 걸 새로 읽어서 적는다 — 화면 코드와 얽히지 않게 (hobby-sync-view 와 같은 방식)
import { store } from "./store.js";
import { ymd, mondayOf } from "./schedule.js";
import { dailyKey as wwKey, dailyCount as wwDaily, weeklyCount as wwWeekly } from "./wuwa.js";
import { dayKey as wfKey, dailyCount as wfDaily, migrateGear, DEFAULT_GEAR } from "./warframe.js";
import { emptyHobbyLog, noteDay, noteWeek, pruneHobbyLog } from "./hobby-log.js";

let log = { ...emptyHobbyLog(), ...store.load("hobbyLog", {}) };

export function noteHobby(now = new Date()) {
  const ww = store.load("wuwaChecks", {});
  const wf = store.load("wfChecks", {});
  let next = noteDay(log, {
    wwKey: wwKey(now), ww: wwDaily(ww, now), wwWeek: wwWeekly(ww, now),
    wfKey: wfKey(now), wf: wfDaily(wf, now),
  });
  next = noteWeek(next, ymd(mondayOf(now)), () => ({
    parties: store.load("wuwaParties", []),
    builds: store.load("wuwaBuilds", {}),
    gear: migrateGear(store.load("wfGear", DEFAULT_GEAR)),
  }), now);
  next = pruneHobbyLog(next, now);
  if (JSON.stringify(next) === JSON.stringify(log)) return; // 바뀐 게 있을 때만 저장
  log = next;
  store.save("hobbyLog", log);
}
