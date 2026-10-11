// 워프레임 숙제 리스트 (v3.4, Notion '취미 › 워프레임 › 오늘 해야할 일 체크리스트'). 계산만 — 화면은 wf-chores-view.js.
// 기본 목록: 아카라이브 '워프레임 주간 소식 (26년 10월 2주차)' 의 숙제표 42줄 (은월이 캡처해 준 것을 Cowork 가 옮겨 적음, 2026-10-11).
// 기호: ＊ 중요함 = 필수 / 표시 없음 → ＃ 그렇게 중요하진 않음 → § 보통 안 함 = 선택 (은월: Notion 의 '고리모양' 태그는 §).
// 이 표는 매주 새 글로 나온다. 앱은 받아 오지 않고, 바뀐 곳은 은월이 [목록 고치기] 에서 지우고 더한다.
import { newId } from "./shopping.js";

// tag: "star" ＊ · "" 표시 없음 · "hash" ＃ · "sec" §
export const TAGS = { star: "＊", "": "", hash: "＃", sec: "§" };
export const TAG_NAMES = { star: "＊ 필수", "": "표시 없음", hash: "＃", sec: "§" };
const OPTIONAL_ORDER = ["", "hash", "sec"]; // 선택 목록의 순서
// period: 언제 비우나 — "day" 매일 · "week" 매주. 게임 초기화 시각(00:00 UTC = 한국 09:00, 주간은 월요일)에 맞춘다 (은월 선택)
export const PERIODS = { day: "매일", week: "매주" };

// [위치, 세부 구분, 숙제, 기호, 기간, 원래 기간 글자(일간 · 주간이 아닐 때)]
// '일/주간' 은 매일, '격주 주말' 은 주간처럼 비운다
const ROWS = [
  ["일반", "나이트웨이브", "나이트웨이브 미션", "star", "day", "일/주간"],
  ["일반", "나이트웨이브", "나이트웨이브 주간 상점", "", "week"],
  ["일반", "마루의 암시장", "주간 아야탄 보물 사냥", "", "week"],
  ["일반", "일/주간 미션", "출격", "", "day"],
  ["일반", "일/주간 미션", "집정관 사냥", "star", "week"],
  ["일반", "포커스", "일일 포커스 경험치", "star", "day"],
  ["일반", "칼의 주둔지", "칼 주간 미션", "star", "week"],
  ["일반", "강철의 길", "강철의 길 급습", "", "day"],
  ["일반", "강철의 길", "테신 주간 상점", "star", "week"],
  ["릴레이", "6 신디케이트", "6 신디 (마스터리 랭크 3단계 달성)", "", "day"],
  ["릴레이", "6 신디케이트", "일일 미션 (신디케이트 1랭크 달성)", "", "day"],
  ["릴레이", "다르보의 상점", "클렘 도와주기", "sec", "week"],
  ["릴레이", "세팔론 시마리스", "세팔론 시마리스", "hash", "day"],
  ["릴레이", "세팔론 시마리스", "신디시스 목표물", "hash", "day"],
  ["릴레이", "콘클레이브", "콘클레이브", "sec", "day"],
  ["릴레이", "콘클레이브", "도전과제", "sec", "day"],
  ["릴레이", "콘클레이브", "임무", "sec", "week"],
  ["릴레이", "바로 키 티어", "바로 키 티어 상점", "star", "week", "격주 주말"],
  ["지구", "시터스", "오스트론", "hash", "day"],
  ["지구", "시터스", "퀼", "hash", "day"],
  ["지구", "아이언 웨이크", "팔라디노 주간 상점", "", "week"],
  ["지구", "유반의 산마루", "세팔론 멜리카 상점 쿠바 (크리살리스에도 있음)", "", "week"],
  ["금성", "포르투나", "솔라리스 연합", "star", "day"],
  ["금성", "포르투나", "벤트키즈", "hash", "day"],
  ["금성", "포르투나", "복스 솔라리스", "", "day"],
  ["데이모스", "네크랄리스크", "엔트라티", "star", "day"],
  ["데이모스", "네크랄리스크", "네크랄로이드", "star", "day"],
  ["데이모스", "해부의 성역", "카비아", "star", "day"],
  ["데이모스", "해부의 성역", "새 3호 주간 판매 샤드", "star", "week"],
  ["데이모스", "해부의 성역", "네트라셀", "star", "week"],
  ["데이모스", "해부의 성역", "심층 아르키메디아 (카비아 평판 5단계 달성)", "star", "week"],
  ["자리만", "크리살리스", "사수자들", "", "day"],
  ["자리만", "크리살리스", "욘타 상점 쿠바", "", "week"],
  ["천왕성", "폰티스 탑", "헌하우 기념품 쿠바", "", "week"],
  ["두비리", "두비리 순환로", "일반 순환로", "", "week"],
  ["두비리", "두비리 순환로", "강철의 길 순환로", "star", "week"],
  ["두비리", "아크리티스", "아크리티스 일/주간 상점", "", "day", "일/주간"],
  ["1999", "홀바니아 중앙 쇼핑몰", "헥스", "star", "day"],
  ["1999", "홀바니아 중앙 쇼핑몰", "템포럴 아르키메디아 (헥스 평판 5단계 달성)", "star", "week"],
  ["1999", "POM-2 PC", "달력", "star", "week"],
  ["XX99", "다크 리프랙토리", "디센디아", "star", "week"],
  ["XX99", "다크 리프랙토리", "강철의 길 디센디아", "star", "week"],
];
// id 는 표의 줄 번호로 굳힌다 (c01 ~ c42). 나중에 줄을 더하면 뒤 번호를, 빼면 그 번호를 비워 둔다 — 은월이 지운 것 · 체크가 안 꼬이게
export const DEFAULT_CHORES = ROWS.map(([place, group, name, tag, period, note = ""], i) =>
  ({ id: `c${String(i + 1).padStart(2, "0")}`, place, group, name, tag, period, note }));

const NAME_LEN = 30;
const MAX_CUSTOM = 60;

// ---------- 저장 칸 wfChores: 기본값에서 바뀐 것만 ----------
// { hidden: [지운 기본 줄 id], custom: [{ id, name, tag, period }], done: { 줄 id: 체크한 날(그 날 열쇠) 또는 주(그 주 월요일 열쇠) } }
const validTag = (t) => Object.hasOwn(TAGS, t);
const validPeriod = (p) => Object.hasOwn(PERIODS, p);
export function normalizeChores(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  return {
    hidden: Array.isArray(s.hidden) ? s.hidden.filter((id) => typeof id === "string") : [],
    custom: (Array.isArray(s.custom) ? s.custom : []).filter((x) => x && typeof x.id === "string" && typeof x.name === "string" && x.name.trim())
      .map((x) => ({ id: x.id, name: x.name, tag: validTag(x.tag) ? x.tag : "", period: validPeriod(x.period) ? x.period : "day" })),
    done: s.done && typeof s.done === "object" && !Array.isArray(s.done) ? { ...s.done } : {},
  };
}

// 지금 보이는 목록: 기본 줄(지운 것 빼고) + 직접 더한 줄
export function choreList(saved) {
  const s = normalizeChores(saved);
  return [
    ...DEFAULT_CHORES.filter((c) => !s.hidden.includes(c.id)),
    ...s.custom.map((c) => ({ ...c, place: "", group: "", note: "", custom: true })),
  ];
}

// ---------- 언제 비우나: 게임의 하루 · 한 주 (00:00 UTC = 한국 09:00, 주간은 월요일) ----------
const iso = (d) => d.toISOString().slice(0, 10);
export const choreDay = (now) => iso(now);
export function choreWeek(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}
const keyOf = (item, now) => (item.period === "week" ? choreWeek(now) : choreDay(now));
export const choreDone = (saved, item, now) => normalizeChores(saved).done[item.id] === keyOf(item, now);

// 체크 / 풀기. 지난 날 · 지난 주의 체크와 없어진 줄의 체크는 이때 같이 치운다
export function toggleChore(saved, id, now) {
  const s = normalizeChores(saved);
  const list = choreList(s);
  const item = list.find((c) => c.id === id);
  if (!item) return s;
  const done = Object.fromEntries(list.filter((c) => s.done[c.id] === keyOf(c, now)).map((c) => [c.id, s.done[c.id]]));
  if (done[id]) delete done[id];
  else done[id] = keyOf(item, now);
  return { ...s, done };
}

// ---------- 화면에 놓는 모양 ----------
// 필수(＊)는 매일 / 이번 주 두 묶음, 선택은 표시 없음 → ＃ → § 순서 (같은 기호 안에서는 표의 순서 그대로)
export function choreSections(saved, now) {
  const list = choreList(saved).map((c) => ({ ...c, done: choreDone(saved, c, now) }));
  const count = (rows) => ({ done: rows.filter((c) => c.done).length, total: rows.length });
  const must = list.filter((c) => c.tag === "star");
  const day = must.filter((c) => c.period === "day");
  const week = must.filter((c) => c.period === "week");
  const optional = OPTIONAL_ORDER.flatMap((tag) => list.filter((c) => c.tag === tag));
  return { day, week, optional, counts: { must: count(must), day: count(day), week: count(week), optional: count(optional) } };
}

// ---------- 목록 고치기: 지우기 · 더하기 · 되돌리기 ----------
export function addChore(saved, name, tag, period, id = `x${newId()}`) {
  const s = normalizeChores(saved);
  const clean = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, NAME_LEN);
  if (!clean) return { chores: s, error: "숙제 이름을 적어 줘." };
  if (choreList(s).some((c) => c.name === clean)) return { chores: s, error: `'${clean}' 은(는) 이미 있어.` };
  if (s.custom.length >= MAX_CUSTOM) return { chores: s, error: "직접 더한 숙제가 너무 많아. 안 쓰는 걸 지워 줘." };
  const item = { id, name: clean, tag: validTag(tag) ? tag : "", period: validPeriod(period) ? period : "day" };
  return { chores: { ...s, custom: [...s.custom, item] }, error: "" };
}

// 기본 줄은 숨기고(되돌리기로 돌아온다), 직접 더한 줄은 지운다. 그 줄의 체크도 치운다
export function removeChore(saved, id) {
  const s = normalizeChores(saved);
  const { [id]: _, ...done } = s.done;
  if (s.custom.some((c) => c.id === id)) return { ...s, custom: s.custom.filter((c) => c.id !== id), done };
  if (DEFAULT_CHORES.some((c) => c.id === id) && !s.hidden.includes(id)) return { ...s, hidden: [...s.hidden, id], done };
  return s;
}

// 지운 기본 줄을 전부 되살린다. 직접 더한 줄 · 체크는 그대로
export const resetChores = (saved) => ({ ...normalizeChores(saved), hidden: [] });
export const hiddenCount = (saved) => normalizeChores(saved).hidden.filter((id) => DEFAULT_CHORES.some((c) => c.id === id)).length;
