// 명조: 일일·주간 체크리스트와 목표 육성 파티표. 규칙은 Notion '취미 — 명조'.
import { ymd } from "./schedule.js";
import { newId } from "./shopping.js";

// 아시아 서버 초기화: 매일 05:00 (한국 시간), 주간은 월요일 05:00 (사용자 확인)
export const RESET_HOUR = 5;

export const DAILY = [
  { id: "commission", label: "일일 의뢰" },
  { id: "plate", label: "플레이트 소모" },
  { id: "field", label: "잔상군락" },
  { id: "event", label: "이벤트 확인" },
];
export const WEEKLY = [
  { id: "synth", label: "지정합성 · 에코가방 정리", max: 1 },
  { id: "content", label: "주간 컨텐츠 (짭즈메 · 놀이동산)", max: 1 },
  { id: "boss", label: "주간보스", max: 3 },
  { id: "end", label: "엔드컨텐츠 확인 (역경의 탑 · 해역 · 매트릭스)", max: 1 },
];
export const BUILD = [
  { id: "lv", label: "레벨 돌파" },
  { id: "weapon", label: "무기 돌파" },
  { id: "skill", label: "스킬작" },
  { id: "echo1", label: "에코작 대충" },
  { id: "echo2", label: "에코작 준종결" },
];
export const PARTY_SIZE = 3;

// ---------- 초기화 ----------
// 초기화 시각(명조 05:00) 전이면 아직 '어제' 게임 날이다. 워프레임도 시각만 바꿔 쓴다
export function gameDay(now, hour = RESET_HOUR) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < hour) d.setDate(d.getDate() - 1);
  return d;
}
export const dailyKey = (now) => ymd(gameDay(now));
export function weeklyKey(now) {
  const d = gameDay(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}

// 체크 상태: { daily: { key, done: { id: 1 } }, weekly: { key, done: { id: n } } }
// 저장된 key 가 지금과 다르면 초기화된 것으로 본다
export const dailyDone = (state, now) => (state.daily?.key === dailyKey(now) ? state.daily.done : {});
export const weeklyDone = (state, now) => (state.weekly?.key === weeklyKey(now) ? state.weekly.done : {});

export function toggleDaily(state, now, id) {
  const done = { ...dailyDone(state, now) };
  done[id] = done[id] ? 0 : 1;
  return { ...state, daily: { key: dailyKey(now), done } };
}

// n번째 칸을 누르면 n까지, 이미 n이면 한 칸 되돌린다 (주간보스 3칸)
export function tapWeekly(state, now, id, n = 1) {
  const max = WEEKLY.find((w) => w.id === id).max;
  const done = { ...weeklyDone(state, now) };
  const cur = done[id] ?? 0;
  done[id] = Math.max(0, Math.min(max, cur >= n ? n - 1 : n));
  return { ...state, weekly: { key: weeklyKey(now), done } };
}

export function dailyCount(state, now) {
  const done = dailyDone(state, now);
  return { done: DAILY.filter((d) => done[d.id]).length, total: DAILY.length };
}
export function weeklyCount(state, now) {
  const done = weeklyDone(state, now);
  return {
    done: WEEKLY.reduce((s, w) => s + Math.min(w.max, done[w.id] ?? 0), 0),
    total: WEEKLY.reduce((s, w) => s + w.max, 0),
  };
}

// ---------- 캐릭터 목록 (encore.moe) ----------
// 같은 이름(방랑자 남녀 등)은 하나만, 5성 먼저, 그다음 이름순
export function cleanCharacters(roleList) {
  const seen = new Set();
  return roleList
    .filter((r) => r.Name && !seen.has(r.Name) && seen.add(r.Name))
    .map((r) => ({ id: String(r.Id), name: r.Name, stars: r.QualityId, element: r.Element?.Name ?? "", icon: r.RoleHeadIcon ?? "" }))
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name, "ko"));
}

export function searchCharacters(list, text) {
  const q = text.trim().replace(/\s+/g, "");
  if (!q) return list;
  return list.filter((c) => c.name.replace(/\s+/g, "").includes(q) || c.element.includes(q));
}

// ---------- 파티표 ----------
// parties: [{ id, name, slots: [charId|null ×3] }] · builds: { charId: { lv: 1, ... } }
export function addParty(parties, id = newId()) {
  return [...parties, { id, name: `파티 ${parties.length + 1}`, slots: Array(PARTY_SIZE).fill(null) }];
}

export const renameParty = (parties, pid, name) =>
  parties.map((p) => (p.id === pid ? { ...p, name: name.trim() || p.name } : p));

export const removeParty = (parties, pid) => parties.filter((p) => p.id !== pid);

// 캐릭터를 칸에 넣는다. 다른 칸에 이미 있으면 거기서 빼서 옮긴다 (한 캐릭터는 한 칸에만)
export function placeCharacter(parties, pid, idx, charId) {
  return parties.map((p) => ({
    ...p,
    slots: p.slots.map((s, i) => {
      if (p.id === pid && i === idx) return charId;
      return s === charId ? null : s;
    }),
  }));
}

export const clearSlot = (parties, pid, idx) =>
  parties.map((p) => (p.id === pid ? { ...p, slots: p.slots.map((s, i) => (i === idx ? null : s)) } : p));

// 캐릭터가 어느 파티 몇 번째 칸에 있는지
export function whereIs(parties, charId) {
  for (const p of parties) {
    const i = p.slots.indexOf(charId);
    if (i >= 0) return { pid: p.id, name: p.name, idx: i };
  }
  return null;
}

export function toggleBuild(builds, charId, key) {
  const cur = builds[charId] ?? {};
  return { ...builds, [charId]: { ...cur, [key]: cur[key] ? 0 : 1 } };
}

export const buildCount = (builds, charId) => BUILD.filter((b) => builds[charId]?.[b.id]).length;
