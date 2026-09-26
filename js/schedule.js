// 하루 일과표 만들기. 규칙은 Notion '일정' (2026-09-25 22:25 수정본).
// 칸(block)은 시작 시각만 갖고, 끝은 다음 칸의 시작이다. 마지막 칸(취침)은 다음 날 첫 칸까지.

export const SHIFTS = {
  open: { label: "오픈반", start: "08:30", end: "15:30" },
  close: { label: "마감반", start: "15:00", end: "22:00" },
};

const b = (start, kind, name, note = "") => ({ start, kind, name, note });

// 기본 일과표. 설정에서 고칠 수 있다.
// 취미: 저녁 8시부터 인터넷이 몰려서 저녁 7시에 시작한다. 두 주가 같은 시각이 안 되니 12시간 차이 (오픈반 주 19:00, 마감반 주 07:00)
export const DEFAULT_TEMPLATES = {
  open: [
    b("06:00", "rest", "휴식"),
    b("07:30", "prep", "출근 준비"),
    b("08:30", "work", "알바 · 오픈반", "점심은 식대"),
    b("15:30", "exercise", "운동", "이동 포함 2시간"),
    b("17:30", "shower", "샤워"),
    b("18:00", "meal", "저녁"),
    b("19:00", "hobby", "취미", "명조 · 워프레임"),
    b("21:00", "chores", "가사"),
    b("21:30", "rest", "휴식"),
    b("22:30", "review", "리뷰", "오늘 4가지 질문"),
    b("23:00", "sleep", "취침"),
  ],
  close: [
    b("06:00", "chores", "가사"),
    b("06:30", "rest", "휴식"),
    b("07:00", "hobby", "취미", "명조 · 워프레임"),
    b("09:00", "rest", "휴식"),
    b("10:00", "exercise", "운동", "이동 포함 2시간"),
    b("12:00", "shower", "샤워"),
    b("12:30", "meal", "점심"),
    b("13:30", "rest", "휴식"),
    b("14:00", "prep", "출근 준비"),
    b("15:00", "work", "알바 · 마감반", "저녁은 식대"),
    b("22:00", "rest", "휴식"),
    b("22:30", "review", "리뷰", "오늘 4가지 질문"),
    b("23:00", "sleep", "취침"),
  ],
};

// v22 까지의 기본 일과표 (취미 20:00 / 08:00). 폰에 이것이 그대로 저장돼 있으면 새 기본값으로 바꾼다.
// 사용자가 설정에서 고친 일과표는 건드리지 않는다.
const V22 = {
  open: "06:00 휴식|07:30 출근 준비|08:30 알바 · 오픈반|15:30 휴식|16:00 운동|18:00 샤워|18:30 저녁|19:30 가사|20:00 취미|22:00 휴식|22:30 리뷰|23:00 취침",
  close: "06:00 가사|06:30 휴식|08:00 취미|10:00 운동|12:00 샤워|12:30 점심|13:30 휴식|14:00 출근 준비|15:00 알바 · 마감반|22:00 휴식|22:30 리뷰|23:00 취침",
};
const shape = (blocks) => blocks.map((x) => `${x.start} ${x.name}`).join("|");
export function upgradeTemplates(templates) {
  const out = { ...templates };
  for (const shift of ["open", "close"]) {
    if (out[shift] && shape(out[shift]) === V22[shift]) out[shift] = DEFAULT_TEMPLATES[shift];
  }
  return out;
}

// 쉬는 날 알바 대신 집에서 먹는 끼니
const DAY_OFF_MEAL = {
  open: b("12:00", "meal", "점심"),
  close: b("18:00", "meal", "저녁"),
};

export const DEFAULT_SETTINGS = {
  // 이 월요일이 속한 주가 anchorShift 다. 한 주씩 번갈아 간다.
  anchorMonday: "2026-09-21",
  anchorShift: "close",
  workdays: [true, true, true, true, true, true, true], // 일~토
  templates: DEFAULT_TEMPLATES,
};

// ---------- 시각 ----------
export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const pad = (n) => String(n).padStart(2, "0");
export const toHHMM = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
export const isHHMM = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// ---------- 날짜 (다른 파일도 여기 것을 쓴다) ----------
// 그 날이 속한 주의 월요일
export function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
// 월요일부터 7일
export const weekDates = (monday) =>
  Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
// "2026-09-25" → 날짜
export function parseDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 그 날이 오픈반 주인지 마감반 주인지
export function shiftFor(date, settings) {
  const weeks = Math.round((mondayOf(date) - parseDate(settings.anchorMonday)) / (7 * 864e5));
  const same = ((weeks % 2) + 2) % 2 === 0;
  return same ? settings.anchorShift : settings.anchorShift === "open" ? "close" : "open";
}

// '이번 주는 ○○반' 으로 기준을 다시 잡는다
export function setThisWeek(settings, date, shift) {
  return { ...settings, anchorMonday: ymd(mondayOf(date)), anchorShift: shift };
}

// 이어진 휴식 칸은 하나로 합친다
function mergeRest(blocks) {
  return blocks.filter((x, i) => !(i > 0 && x.kind === "rest" && blocks[i - 1].kind === "rest"));
}

// 쉬는 날: 알바·출근 준비 → 휴식, 알바 때 식대로 먹던 끼니를 집에서 먹는다
function toDayOff(blocks, shift) {
  const rested = mergeRest(blocks.map((x) =>
    x.kind === "work" || x.kind === "prep" ? b(x.start, "rest", "휴식") : x));
  const meal = DAY_OFF_MEAL[shift];
  const m = toMin(meal.start);
  // 끼니 1시간이 통째로 들어가는 휴식 칸을 찾아 쪼갠다
  const i = rested.findIndex((x, j) =>
    x.kind === "rest" && toMin(x.start) <= m && rested[j + 1] && m + 60 <= toMin(rested[j + 1].start));
  if (i < 0) return rested;
  const parts = [];
  if (toMin(rested[i].start) < m) parts.push(rested[i]);
  parts.push(meal);
  if (m + 60 < toMin(rested[i + 1].start)) parts.push(b(toHHMM(m + 60), "rest", "휴식"));
  return [...rested.slice(0, i), ...parts, ...rested.slice(i + 1)];
}

// 일요일은 운동을 쉰다 (Notion '운동': 일요일 제외 6일) → 운동·샤워 칸이 휴식이 된다
function noExercise(blocks) {
  return mergeRest(blocks.map((x) =>
    x.kind === "exercise" || x.kind === "shower" ? b(x.start, "rest", "휴식") : x));
}

// 그 날의 일과표
export function dayPlan(date, settings) {
  const shift = shiftFor(date, settings);
  const working = settings.workdays[date.getDay()];
  let blocks = settings.templates[shift];
  if (!working) blocks = toDayOff(blocks, shift);
  if (date.getDay() === 0) blocks = noExercise(blocks);
  return { shift, working, blocks };
}

// 그 날 어떤 칸(운동·취미·알바 등)의 "시작–끝" (없으면 null). 마지막 칸이면 minutes 만큼으로 본다.
export function blockRange(blocks, kind, minutes = 120) {
  const i = blocks.findIndex((b) => b.kind === kind);
  if (i < 0) return null;
  const end = blocks[i + 1] ? blocks[i + 1].start : toHHMM(toMin(blocks[i].start) + minutes);
  return `${blocks[i].start}–${end}`;
}

// 지금 몇 번째 칸인가. 첫 칸보다 이르면(새벽) 전날부터 이어진 마지막 칸(취침)이다.
export function currentIndex(blocks, nowMin) {
  if (nowMin < toMin(blocks[0].start)) return blocks.length - 1;
  let idx = 0;
  blocks.forEach((x, i) => { if (toMin(x.start) <= nowMin) idx = i; });
  return idx;
}

// '지금' 카드에 필요한 값
export function nowInfo(blocks, nowMin) {
  const i = currentIndex(blocks, nowMin);
  const start = toMin(blocks[i].start);
  const last = i === blocks.length - 1;
  const end = last ? toMin(blocks[0].start) + 1440 : toMin(blocks[i + 1].start);
  const now = nowMin < start ? nowMin + 1440 : nowMin;
  const pct = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
  return {
    index: i,
    block: blocks[i],
    start: blocks[i].start,
    end: toHHMM(end),
    next: last ? blocks[0] : blocks[i + 1],
    pct,
    leftMin: end - now,
  };
}

export function leftLabel(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `남은 시간 ${h ? `${h}시간 ` : ""}${m}분`;
}

// 설정에서 고친 일과표 확인. 문제가 있으면 이유를 돌려준다.
export function checkTemplate(blocks) {
  if (!blocks.length) return "칸이 하나도 없어.";
  for (const x of blocks) {
    if (!x.start) return `${x.name.trim() || "새"} 칸에 시각을 적어 줘.`;
    if (!isHHMM(x.start)) return `시각 '${x.start}' 을 못 읽겠어. 09:00 처럼 적어 줘.`;
    if (!x.name.trim()) return `${x.start} 칸에 이름이 없어.`;
  }
  const times = blocks.map((x) => x.start);
  const dup = times.find((t, i) => times.indexOf(t) !== i);
  if (dup) return `${dup} 에 칸이 두 개야.`;
  return "";
}

export function sortBlocks(blocks) {
  return [...blocks].sort((p, q) => toMin(p.start) - toMin(q.start));
}
