// 하루 일과표 만들기. 규칙은 Notion '일정' (2026-10-09 08:20 수정본).
// 칸(block)은 시작 시각만 갖고, 끝은 다음 칸의 시작이다. 마지막 칸(취침)은 다음 날 첫 칸까지.

export const SHIFTS = {
  open: { label: "오픈반", start: "08:30", end: "15:30" },
  mid: { label: "중간반", start: "12:00", end: "19:00" }, // 핫픽스 v2.8.1 (은월 2026-10-04)
  close: { label: "마감반", start: "15:00", end: "22:00" },
};
export const SHIFT_IDS = Object.keys(SHIFTS);
export const OFF = "off"; // 쉬는 날

const b = (start, kind, name, note = "") => ({ start, kind, name, note });

// 기본 일과표. 설정에서 고칠 수 있다. (핫픽스 v3.0.1, 은월 2026-10-05 'A안' — Notion 핫픽스 '취미 당기기' · '운동 1시간 반')
// 칸 설명(note)은 전부 빈칸이다 (핫픽스 v3.0.3, Notion '일정표에 있는 회색설명 삭제하기' — 은월 선택: 전부)
// - 운동은 이동 포함 1시간 30분, 바로 뒤에 샤워 30분
// - 알바가 끝나면 30분 쉬고 운동 (오픈반 · 중간반. 마감반은 운동이 알바 전)
// - 취미 2시간: 오픈반 19:00, 마감반 · 중간반은 12시간 차이로 07:00.
//   Notion 은 '저녁 6시부터' 지만, 알바 뒤 30분 휴식 · 운동 · 샤워 · 저녁 1시간을 다 지키면 오픈반은 19:00 이 가장 이르다 (은월 선택: 규칙을 지키고 되는 만큼만 당긴다)
// - 가사 30분은 이른 아침·늦은 저녁을 피한다 (21:30 까지는 괜찮다고 봄, 사용자 선택)
// - 기상 06:30 (핫픽스 v3.0.4, 은월 2026-10-09): 하루는 그대로 06:00 에 바뀌고, 첫 칸 06:00~06:30 은 어젯밤부터 이어진 취침.
//   아침 30분(06:30~07:00)은 식사 1시간 규칙의 예외 — 취미 07:00 / 19:00 을 지키려고. 메뉴가 아직 없어서 종류를 점심 · 저녁("meal")과
//   따로 "breakfast" 로 둔다 (식단 · 시트 끼니 메뉴는 "meal" 칸만 센다). 일요일은 아래 sunday() 가 바꾼다
export const DEFAULT_TEMPLATES = {
  open: [
    b("06:00", "sleep", "취침"),
    b("06:30", "breakfast", "아침"),
    b("07:00", "rest", "휴식"),
    b("07:30", "prep", "출근 준비"),
    b("08:30", "work", "알바 · 오픈반"),
    b("15:30", "rest", "휴식"),
    b("16:00", "exercise", "운동"),
    b("17:30", "shower", "샤워"),
    b("18:00", "meal", "저녁"),
    b("19:00", "hobby", "취미"),
    b("21:00", "chores", "가사"),
    b("21:30", "rest", "휴식"),
    b("22:30", "review", "리뷰"),
    b("23:00", "sleep", "취침"),
  ],
  // 중간반 (12:00~19:00): 아침은 마감반처럼 취미 · 가사, 알바 끝나고 30분 쉬고 운동 (은월 선택 'B안', 2026-10-04)
  mid: [
    b("06:00", "sleep", "취침"),
    b("06:30", "breakfast", "아침"),
    b("07:00", "hobby", "취미"),
    b("09:00", "chores", "가사"),
    b("09:30", "rest", "휴식"),
    b("10:00", "meal", "점심"),
    b("11:00", "prep", "출근 준비"),
    b("12:00", "work", "알바 · 중간반"),
    b("19:00", "rest", "휴식"),
    b("19:30", "exercise", "운동"),
    b("21:00", "shower", "샤워"),
    b("21:30", "rest", "휴식"),
    b("22:30", "review", "리뷰"),
    b("23:00", "sleep", "취침"),
  ],
  close: [
    b("06:00", "sleep", "취침"),
    b("06:30", "breakfast", "아침"),
    b("07:00", "hobby", "취미"),
    b("09:00", "chores", "가사"),
    b("09:30", "rest", "휴식"),
    b("10:00", "exercise", "운동"),
    b("11:30", "shower", "샤워"),
    b("12:00", "meal", "점심"),
    b("13:00", "rest", "휴식"),
    b("14:00", "prep", "출근 준비"),
    b("15:00", "work", "알바 · 마감반"),
    b("22:00", "rest", "휴식"),
    b("22:30", "review", "리뷰"),
    b("23:00", "sleep", "취침"),
  ],
};

// 옛 기본 일과표들. 폰에 이 모양(시각·이름)이 그대로 저장돼 있으면 새 기본값으로 바꾼다.
// 사용자가 설정에서 고친 일과표는 건드리지 않는다.
const OLD_DEFAULTS = {
  open: [
    "06:00 휴식|07:30 출근 준비|08:30 알바 · 오픈반|15:30 휴식|16:00 운동|18:00 샤워|18:30 저녁|19:30 가사|20:00 취미|22:00 휴식|22:30 리뷰|23:00 취침", // v22 까지
    "06:00 휴식|07:30 출근 준비|08:30 알바 · 오픈반|15:30 운동|17:30 샤워|18:00 저녁|19:00 취미|21:00 가사|21:30 휴식|22:30 리뷰|23:00 취침", // v23 ~ v2.0
    "06:00 휴식|07:30 출근 준비|08:30 알바 · 오픈반|15:30 휴식|16:00 운동|18:00 샤워|18:30 저녁|19:30 취미|21:30 가사|22:00 휴식|22:30 리뷰|23:00 취침", // v2.1 ~ v3.0 (운동 2시간, 취미 19:30)
    "06:00 휴식|07:30 출근 준비|08:30 알바 · 오픈반|15:30 휴식|16:00 운동|17:30 샤워|18:00 저녁|19:00 취미|21:00 가사|21:30 휴식|22:30 리뷰|23:00 취침", // v3.0.1 ~ v3.0.3 (기상 06:00, 아침 칸 없음)
  ],
  mid: [
    "06:00 휴식|07:30 취미|09:30 가사|10:00 점심|11:00 출근 준비|12:00 알바 · 중간반|19:00 휴식|19:30 운동|21:30 샤워|22:00 휴식|22:30 리뷰|23:00 취침", // v2.8.1 ~ v3.0
    "06:00 휴식|07:00 취미|09:00 가사|09:30 휴식|10:00 점심|11:00 출근 준비|12:00 알바 · 중간반|19:00 휴식|19:30 운동|21:00 샤워|21:30 휴식|22:30 리뷰|23:00 취침", // v3.0.1 ~ v3.0.3
  ],
  close: [
    "06:00 가사|06:30 휴식|08:00 취미|10:00 운동|12:00 샤워|12:30 점심|13:30 휴식|14:00 출근 준비|15:00 알바 · 마감반|22:00 휴식|22:30 리뷰|23:00 취침",
    "06:00 가사|06:30 휴식|07:00 취미|09:00 휴식|10:00 운동|12:00 샤워|12:30 점심|13:30 휴식|14:00 출근 준비|15:00 알바 · 마감반|22:00 휴식|22:30 리뷰|23:00 취침",
    "06:00 휴식|07:30 취미|09:30 가사|10:00 운동|12:00 샤워|12:30 점심|13:30 휴식|14:00 출근 준비|15:00 알바 · 마감반|22:00 휴식|22:30 리뷰|23:00 취침", // v2.1 ~ v3.0 (운동 2시간, 취미 07:30)
    "06:00 휴식|07:00 취미|09:00 가사|09:30 휴식|10:00 운동|11:30 샤워|12:00 점심|13:00 휴식|14:00 출근 준비|15:00 알바 · 마감반|22:00 휴식|22:30 리뷰|23:00 취침", // v3.0.1 ~ v3.0.3
  ],
};
const shape = (blocks) => blocks.map((x) => `${x.start} ${x.name}`).join("|");
export function upgradeTemplates(templates) {
  const out = { ...templates };
  for (const shift of SHIFT_IDS) { // 중간반도 (핫픽스 v3.0.1)
    if (!out[shift]) continue;
    if (OLD_DEFAULTS[shift].includes(shape(out[shift]))) out[shift] = DEFAULT_TEMPLATES[shift];
  }
  return out;
}

// 핫픽스 v3.0.3: 일정표 칸 아래 설명을 전부 없앴다. 폰에 저장된 일과표의 칸 설명도 한 번만 비운다 (시각 · 이름은 그대로).
// 설명을 고치는 화면이 없어서 저장된 설명은 모두 옛 기본 글이다. 비운 뒤 notesCleared 표시가 남는다.
export const NOTES_CLEARED = "3.0.3";
export function clearNotesOnce(settings) {
  if (settings.notesCleared === NOTES_CLEARED) return settings;
  const templates = Object.fromEntries(Object.entries(settings.templates ?? {}).map(([shift, blocks]) =>
    [shift, blocks.some((x) => x.note) ? blocks.map((x) => ({ ...x, note: "" })) : blocks]));
  return { ...settings, templates, notesCleared: NOTES_CLEARED };
}

// 핫픽스 v2.5.1 (은월 10-02): 폰의 마감반 일과표가 기본값과 다르게 남아 있었다 (한 번 고친 옛 일과표는 위 자동 바꾸기가 건너뜀).
// 한 번만 마감반을 기본값으로 맞춘다. 바뀌기 전 일과표는 지우지 않고 oldClose 에 남긴다 (백업에도 들어간다).
// 맞춘 뒤 closeReset 표시가 남아서, 그 뒤에 설정에서 직접 고친 마감반은 다시 건드리지 않는다.
export const CLOSE_RESET = "2.5.1";
export function alignCloseOnce(settings, now) {
  if (settings.closeReset === CLOSE_RESET) return settings;
  const cur = settings.templates?.close;
  const same = !cur || JSON.stringify(cur) === JSON.stringify(DEFAULT_TEMPLATES.close);
  if (same) return { ...settings, closeReset: CLOSE_RESET };
  return {
    ...settings,
    templates: { ...settings.templates, close: DEFAULT_TEMPLATES.close },
    oldClose: { at: now.toISOString(), blocks: cur },
    closeReset: CLOSE_RESET,
  };
}

// 쉬는 날 알바 대신 집에서 먹는 끼니
export const DAY_OFF_MEAL = {
  open: b("12:00", "meal", "점심"),
  mid: b("18:00", "meal", "저녁"),
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

// ---------- 요일별 알바 (핫픽스 v2.8.1, 은월 2026-10-04) ----------
// settings.dayShifts = [일, 월, 화, 수, 목, 금, 토] 마다 "open" · "mid" · "close" · "off"(쉬는 날). 매주 같게 반복된다.
// 예전의 '한 주씩 번갈아 가기'(anchorMonday · anchorShift) 와 '알바 하는 요일'(workdays) 을 대신한다.
const validDay = (v) => v === OFF || SHIFT_IDS.includes(v);
export const hasDayShifts = (settings) => Array.isArray(settings.dayShifts) && settings.dayShifts.length === 7 && settings.dayShifts.every(validDay);

// 옛 설정을 요일별로 옮긴다: 알바 하는 요일은 지금 주의 반(격주 규칙)으로, 꺼 둔 요일은 쉬는 날로. 옛 칸은 지우지 않는다
export function withDayShifts(settings, now) {
  if (hasDayShifts(settings)) return settings;
  const shift = shiftFor(now, settings);
  return { ...settings, dayShifts: settings.workdays.map((on) => (on ? shift : OFF)) };
}

export function setDayShift(settings, day, value) {
  if (!validDay(value)) return settings;
  return { ...settings, dayShifts: settings.dayShifts.map((v, i) => (i === Number(day) ? value : v)) };
}

// 쉬는 날에 쓸 일과표: 그 요일에서 거슬러 올라가 가장 가까운 알바 날의 반 (한 주가 다 쉬는 날이면 오픈반)
function restBase(dayShifts, day) {
  for (let i = 1; i <= 7; i++) {
    const v = dayShifts[(day - i + 7) % 7];
    if (v !== OFF) return v;
  }
  return "open";
}

// 이어진 휴식 칸은 하나로 합친다
const mergeRest = (blocks) => blocks.filter((x, i) => !(x.kind === "rest" && blocks[i - 1]?.kind === "rest"));

// 쉬는 날: 알바·출근 준비 → 휴식, 알바 중에 먹던 끼니를 집에서 먹는다
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

// 일요일 (핫픽스 v3.0.4, 은월 2026-10-09). 판단 기준은 요일 — 알바 날이든 쉬는 날이든, 캘린더 반이든 요일별 반이든 같다
// 1) 아침 칸이 없다. 바로 뒤가 취미(마감반 · 중간반 일과)면 취미를 그 자리(06:30)로 당기고 남는 30분은 휴식, 아니면 그 30분이 휴식
// 2) 교회 09:30~12:00 이 겹치는 칸을 덮는다. 알바 · 출근 준비와 겹치는 날만 빼고 —
//    중간반으로 알바하는 일요일(출근 준비 11:00, 은월 선택)과 오픈반으로 알바하는 일요일(알바 08:30~)은 교회 칸이 없다
export const CHURCH = { start: "09:30", end: "12:00", name: "교회" };
function sunday(blocks) {
  let out = blocks;
  const i = out.findIndex((x) => x.kind === "breakfast");
  if (i >= 0) {
    const [am, next] = [out[i], out[i + 1]];
    const moved = next?.kind === "hobby"
      ? [{ ...next, start: am.start }, b(toHHMM(toMin(am.start) + toMin(endOf(out, i + 1)) - toMin(next.start)), "rest", "휴식")]
      : [b(am.start, "rest", "휴식"), ...(next ? [next] : [])];
    out = mergeRest([...out.slice(0, i), ...moved, ...out.slice(i + 2)]);
  }
  const [s, e] = [toMin(CHURCH.start), toMin(CHURCH.end)];
  const atWork = out.some((x, j) => (x.kind === "work" || x.kind === "prep") && toMin(x.start) < e && out[j + 1] && toMin(out[j + 1].start) > s);
  if (atWork) return out;
  const running = out.findLast((x) => toMin(x.start) < e); // 교회가 끝날 때 하고 있던 칸은 12:00 부터 이어진다
  const after = running && !out.some((x) => toMin(x.start) === e) ? [{ ...running, start: CHURCH.end }] : [];
  return mergeRest(sortBlocks([...out.filter((x) => toMin(x.start) < s || toMin(x.start) >= e), b(CHURCH.start, "church", CHURCH.name), ...after]));
}

// 그 날의 일과표
// 캘린더에서 받은 그 날의 알바: "open" · "mid" · "close" · "off"(받은 기간 안인데 알바 없음) · null(모름 → 요일별 알바)
export function calShift(date, cal) {
  if (!cal?.shifts) return null;
  const day = ymd(date);
  if (cal.shifts[day]) return cal.shifts[day];
  return cal.until && cal.from <= day && day <= cal.until ? "off" : null;
}

// 그 날의 일과표. 캘린더에 알바가 있으면 그걸 먼저 따른다.
// 캘린더에 없는 날은 요일별 알바(dayShifts)를 따른다. dayShifts 가 없는 옛 설정은 격주 규칙 · 알바 하는 요일 그대로 (앱은 열 때 옮긴다)
export function dayPlan(date, settings) {
  const c = calShift(date, settings.cal);
  const day = date.getDay();
  const byDay = hasDayShifts(settings);
  const own = byDay ? settings.dayShifts[day] : settings.workdays[day] ? shiftFor(date, settings) : OFF;
  const base = own !== OFF ? own : byDay ? restBase(settings.dayShifts, day) : shiftFor(date, settings);
  const shift = SHIFTS[c] ? c : base;
  const working = c ? c !== OFF : own !== OFF;
  let blocks = settings.templates[shift] ?? DEFAULT_TEMPLATES[shift];
  if (!working) blocks = toDayOff(blocks, shift);
  if (day === 0) blocks = sunday(noExercise(blocks));
  return { shift, working, blocks, fromCal: Boolean(c) };
}

// 칸의 끝 = 다음 칸의 시작. 마지막 칸(취침)은 다음 날 첫 칸까지
export const endOf = (blocks, i) => (blocks[i + 1] ?? blocks[0]).start;

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

// 칸마다 길이(분): 시각 순서로 다음 칸까지, 마지막 칸은 다음 날 첫 칸까지. 시각을 못 읽는 칸은 null (일과표 고치기 화면, v2.9)
export function blockLengths(blocks) {
  const times = blocks.map((x) => (isHHMM(x.start) ? toMin(x.start) : null));
  const sorted = times.filter((t) => t !== null).sort((p, q) => p - q);
  return times.map((t) => (t === null ? null : (sorted.find((s) => s > t) ?? sorted[0] + 1440) - t));
}
// 90 → "1시간 30분", 60 → "1시간", 30 → "30분"
export function lengthLabel(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h}시간` : "", m ? `${m}분` : ""].filter(Boolean).join(" ");
}

export function sortBlocks(blocks) {
  return [...blocks].sort((p, q) => toMin(p.start) - toMin(q.start));
}
