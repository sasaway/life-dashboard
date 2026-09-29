// 취미 기록 (v2.2.2, 주간리뷰 보고서용). 계산만 — 저장은 hobby-log-view.js.
// 명조·워프레임 체크는 초기화 때마다 덮여서 지난 날이 안 남는다 → 날마다 몇 개 했는지 적어 둔다.
// 파티표·육성·장비 목록은 '지금' 만 있다 → 한 주를 처음 열 때 한 벌 저장해 두고, 일요일에 지금과 비교한다.
// { days: { "2026-09-29": { ww: [3, 4], wwWeek: [5, 6], wf: [2, 2] } },   ← [한 것, 전체], 날짜는 게임마다 초기화 기준 날
//   weeks: { "2026-09-28": { at, parties, builds, gear } } }              ← 그 주(월요일)를 처음 열었을 때의 모습
import { ymd } from "./schedule.js";

export const HOBBY_LOG_DAYS = 60;
export const HOBBY_LOG_WEEKS = 8;

export const emptyHobbyLog = () => ({ days: {}, weeks: {} });

// 지금 체크 수를 그 날 칸에 적는다. 명조는 새벽 5시, 워프레임은 새벽 1시에 날이 바뀌어서 날짜 key 를 따로 받는다.
export function noteDay(log, { wwKey, ww, wwWeek, wfKey, wf }) {
  const days = { ...log.days };
  days[wwKey] = { ...days[wwKey], ww: [ww.done, ww.total], wwWeek: [wwWeek.done, wwWeek.total] };
  days[wfKey] = { ...days[wfKey], wf: [wf.done, wf.total] };
  return { ...log, days };
}

// 그 주를 처음 열 때 한 번만 한 벌 저장 (read 는 그때만 부른다)
export function noteWeek(log, monday, read, now) {
  if (log.weeks[monday]) return log;
  return { ...log, weeks: { ...log.weeks, [monday]: { at: now.toISOString(), ...read() } } };
}

// 날 기록은 60일, 주 기록은 최근 8주만
export function pruneHobbyLog(log, now) {
  const fromKey = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - HOBBY_LOG_DAYS));
  const days = Object.fromEntries(Object.entries(log.days).filter(([d]) => d >= fromKey));
  const keep = Object.keys(log.weeks).sort().slice(-HOBBY_LOG_WEEKS);
  const weeks = Object.fromEntries(keep.map((m) => [m, log.weeks[m]]));
  return { days, weeks };
}
