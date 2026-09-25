// 워프레임: 오늘 체크(출격·포르마), 오늘 할 일 메모, 장비 목록, 실시간 현황 정리. 규칙은 Notion '취미 — 워프레임'.
import { ymd } from "./schedule.js";
import { newId } from "./shopping.js";
import { gameDay } from "./wuwa.js";

// 출격이 바뀌는 시각: 16:00 UTC = 한국 새벽 1시 (사용자 확인)
export const RESET_HOUR = 1;

export const DAILY = [
  { id: "sortie", label: "출격" },
  { id: "forma", label: "포르마 제작" },
];

export const dayKey = (now) => ymd(gameDay(now, RESET_HOUR));

// ---------- 오늘 체크 ----------
// 상태: { key, done: { id: 1 } } — key 가 오늘과 다르면 초기화된 것으로 본다
export const dailyDone = (state, now) => (state?.key === dayKey(now) ? state.done : {});

export function toggleDaily(state, now, id) {
  const done = { ...dailyDone(state, now) };
  done[id] = done[id] ? 0 : 1;
  return { key: dayKey(now), done };
}

export function dailyCount(state, now) {
  const done = dailyDone(state, now);
  return { done: DAILY.filter((d) => done[d.id]).length, total: DAILY.length };
}

// ---------- 오늘 할 일 ----------
// [{ id, text, done: 체크한 날 key | null }] — 체크한 것만 새벽 1시에 사라지고, 못 한 건 다음 날로 이어진다 (사용자 결정)
export function addTodo(todos, text, id = newId()) {
  const t = text.trim();
  return t ? [...todos, { id, text: t, done: null }] : todos;
}
export const toggleTodo = (todos, now, id) =>
  todos.map((t) => (t.id === id ? { ...t, done: t.done ? null : dayKey(now) } : t));
export const removeTodo = (todos, id) => todos.filter((t) => t.id !== id);
export const pruneTodos = (todos, now) => todos.filter((t) => !t.done || t.done === dayKey(now));
export const leftTodos = (todos) => todos.filter((t) => !t.done).length;

// ---------- 장비 목록 (워프레임 기준) ----------
// 워프레임 위키의 플레이스타일 다섯 가지 (Notion 로드아웃 표의 줄 순서)
export const PLAYSTYLES = ["Invisibility", "Damage", "Support", "Survival", "Crowd Control"];
// Sortie 무기 분류: 지금 표에 있는 네 가지. 주무기에 붙는다
export const SORTIE_TYPES = ["Shotgun", "Rifle", "Precision Rifle", "(Cross) Bow"];
// 글자로 적는 칸 (Sortie 분류는 주무기 바로 아래에서 고른다)
export const GEAR_FIELDS = [
  ["primary", "주무기"],
  ["secondary", "보조무기"],
  ["melee", "근접무기"],
  ["companion", "동반자"],
];

// { id, frame, styles: [플레이스타일], wish: 위시리스트(구매할 예정 — 사용자 설명), sortie, primary, secondary, melee, companion }
const frame = (id, name = "", styles = [], wish = false, sortie = "", primary = "", secondary = "", melee = "", companion = "") =>
  ({ id, frame: name, styles, wish, sortie, primary, secondary, melee, companion });

// 기본값: Notion '워프레임 계정 수칙' 의 '현재 계획중인 Loadout' 표 (2026-09-25 11:59)
// 표에서 병합된 칸(아래 줄이 통째로 빈 칸)은 그 워프레임이 두 플레이스타일을 다 가진 것 (사용자 확인)
export const DEFAULT_GEAR = {
  frames: [
    frame("inv", "오락시아", ["Invisibility", "Damage"], false, "Shotgun", "쿠바 소백", "사이오티드", "스피너랙스", "스미타 카밧"),
    frame("sup", "트리니티", ["Support", "Survival"], false, "Rifle", "브래튼", "라토", "조리스", "팬저 불파파일라"),
    frame("cc", "벤쉬", ["Crowd Control"], false, "Precision Rifle", "벡티스", "퓨리스", "보", "하운드"),
    frame("wish", "나린", [], true, "(Cross) Bow", "눈차사", "아크손돌", "데스트레자"),
  ],
  // '그 외의 육성 무기들' — 표의 칸 순서대로
  others: ["쏜바크", "볼터", "나타루크", "패리스", "워 프라임", "스키아자티", "브로큰워", "럼블잭"],
};

// v16 형식 { rows: [{ style, frame, ... }] } → 워프레임 기준. 통째로 빈 줄은 바로 위 워프레임의 병합 칸으로 본다
export function migrateGear(gear) {
  if (!gear.rows) return gear;
  const frames = [];
  for (const r of gear.rows) {
    const empty = !["frame", "sortie", "primary", "secondary", "melee", "companion"].some((k) => r[k]);
    const style = PLAYSTYLES.includes(r.style) ? [r.style] : [];
    if (empty) {
      const prev = frames.at(-1);
      if (prev && !prev.wish) prev.styles = sortStyles([...prev.styles, ...style]);
      continue;
    }
    const wish = /wish/i.test(r.style);
    frames.push(frame(r.id, r.frame, wish ? [] : style, wish, SORTIE_TYPES.includes(r.sortie) ? r.sortie : "",
      r.primary, r.secondary, r.melee, r.companion));
  }
  return { frames, others: gear.others ?? [] };
}

const sortStyles = (list) => PLAYSTYLES.filter((p) => list.includes(p));
const patchFrame = (gear, id, fn) => ({ ...gear, frames: gear.frames.map((f) => (f.id === id ? { ...f, ...fn(f) } : f)) });

export const addFrame = (gear, id = newId()) => ({ ...gear, frames: [...gear.frames, frame(id)] });
export const updateFrame = (gear, id, patch) =>
  patchFrame(gear, id, () => Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v).trim()])));
export const toggleStyle = (gear, id, style) =>
  patchFrame(gear, id, (f) => ({ styles: f.styles.includes(style) ? f.styles.filter((s) => s !== style) : sortStyles([...f.styles, style]) }));
export const setSortie = (gear, id, type) => patchFrame(gear, id, (f) => ({ sortie: f.sortie === type ? "" : type }));
export const toggleWish = (gear, id) => patchFrame(gear, id, (f) => ({ wish: !f.wish }));
export const removeFrame = (gear, id) => ({ ...gear, frames: gear.frames.filter((f) => f.id !== id) });
export function addOther(gear, name) {
  const n = name.trim();
  return n ? { ...gear, others: [...gear.others, n] } : gear;
}
export const removeOther = (gear, i) => ({ ...gear, others: gear.others.filter((_, k) => k !== i) });

// ---------- 실시간 현황 (warframestat.us, 영어로만 온다) ----------
// 미션 종류·세력만 한국어로 (사용자 결정). 사전에 없는 건 영어 그대로 둔다
const MISSION_KO = {
  Exterminate: "섬멸", Capture: "생포", Rescue: "구출", Defense: "방어", "Mobile Defense": "이동 방어",
  Survival: "생존", Spy: "첩보", Interception: "요격", Excavation: "발굴", Assassination: "암살",
  Disruption: "교란", Defection: "망명", Sabotage: "파괴 공작", Hijack: "탈취",
};
const FACTION_KO = {
  Grineer: "그리니어", Corpus: "코퍼스", Infested: "감염체", Orokin: "오로킨", Corrupted: "오로킨", Sentient: "센티언트",
};
export const missionKo = (s) => MISSION_KO[s] ?? s ?? "";
export const factionKo = (s) => FACTION_KO[s] ?? s ?? "";

// 보상 중 오로킨 리액터·카탈리스트만 한국어 이름으로
const HIT = /^Orokin (Reactor|Catalyst)( Blueprint)?$/i;
const hitKo = (name) => name.replace(HIT, (_, what, bp) =>
  `오로킨 ${/reactor/i.test(what) ? "리액터" : "카탈리스트"}${bp ? " 설계도" : ""}`);
export function rewardHits(reward) {
  const names = [
    ...(reward?.countedItems ?? []).map((c) => [c.type, c.count]),
    ...(reward?.items ?? []).map((n) => [n, 1]),
  ];
  return names.filter(([n]) => HIT.test(n)).map(([n, c]) => `${hitKo(n)}${c > 1 ? ` ×${c}` : ""}`);
}

export function sortieView(sortie, now) {
  if (!sortie || new Date(sortie.expiry) <= now) return null;
  const list = sortie.variants?.length ? sortie.variants : sortie.missions ?? [];
  return {
    boss: sortie.boss ?? "",
    faction: factionKo(sortie.faction),
    left: new Date(sortie.expiry) - now,
    missions: list.map((m) => ({ type: missionKo(m.missionType), node: m.node ?? "", modifier: m.modifier ?? "" })),
  };
}

// 침공: 리액터·카탈리스트를 주는 편 (그 편을 도우면 받는다)
export function invasionView(list) {
  const out = [];
  for (const inv of list ?? []) {
    if (inv.completed) continue;
    for (const side of [inv.attacker, inv.defender]) {
      for (const reward of rewardHits(side?.reward)) out.push({ node: inv.node, side: factionKo(side.faction), reward });
    }
  }
  return out;
}

export function alertView(list, now) {
  return (list ?? [])
    .filter((a) => new Date(a.expiry) > now)
    .map((a) => ({ a, hits: rewardHits(a.mission?.reward) }))
    .filter(({ hits }) => hits.length)
    .map(({ a, hits }) => ({
      type: missionKo(a.mission.type),
      node: a.mission.node ?? "",
      faction: factionKo(a.mission.faction),
      reward: hits.join(", "),
      left: new Date(a.expiry) - now,
    }));
}

export function timeLeft(ms) {
  const m = Math.floor(ms / 60e3);
  if (m < 1) return "곧 끝나";
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
}
