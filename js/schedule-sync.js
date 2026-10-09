// 일정 설정 · 앞으로 7일 (v2.9, 은월 요청 2026-10-04): 폰에만 있던 요일별 알바 · 일과표를 구글 시트 '라이프 기록' 의 탭 모양으로 바꾼다.
// Claude 브리핑이 규칙을 따로 적어 두지 않고 이 탭을 읽게 하려는 것. 계산만 — 보내기는 hobby-sync-view.js.
// 탭과 칸 이름은 apps-script/hobby-sync.gs 의 TABS 에 있다. 여기서는 칸 순서대로 값만 만든다.
// 일과표 · 끼니는 새로 계산하지 않고 schedule.js · meals.js 것을 그대로 쓴다 (앱 화면과 늘 같게).
import { SHIFTS, SHIFT_IDS, OFF, DAY_OFF_MEAL, DEFAULT_TEMPLATES, CHURCH, dayPlan, withDayShifts, endOf, parseDate, ymd, toMin, toHHMM } from "./schedule.js";
import { DAYS, WEEK_ORDER } from "./time.js";
import { reviewDay } from "./review.js";
import { dayMeals, workMeal, dishById, ROTATION, LEFTOVER, WORK_DISH } from "./meals.js";

export const NEXT_DAYS = 7;
export const DAY_OFF_LABEL = "휴무"; // '일정 설정' 탭의 요일별 알바 줄. '앞으로 7일' 의 반 칸은 다른 탭처럼 '쉬는 날'

// 코드에 정해진 규칙을 글로: 구분 '규칙' | 무엇에 | 시작 | 끝 | 어떻게 | 설명. 글은 schedule.js · meals.js 의 값에서 만든다
const offMeal = (id) => {
  const m = DAY_OFF_MEAL[id];
  return ["규칙", `쉬는 날 (${SHIFTS[id].label} 일과)`, m.start, toHHMM(toMin(m.start) + 60), m.name, "알바 중에 먹던 끼니를 집에서 먹는다 (그 1시간이 통째로 휴식 칸일 때)"];
};
const amAt = DEFAULT_TEMPLATES.open.findIndex((x) => x.kind === "breakfast");
const breakfast = { start: DEFAULT_TEMPLATES.open[amAt].start, end: endOf(DEFAULT_TEMPLATES.open, amAt) };
const rotation = ROTATION.flatMap((d) => (d.makesTwo ? [d.short, LEFTOVER.short] : [d.short])).join(" → ");
const RULES = [
  ["규칙", "쉬는 날", "", "", "알바 · 출근 준비 → 휴식", "이어진 휴식 칸은 한 칸으로 합친다"],
  ...SHIFT_IDS.map(offMeal),
  ["규칙", "쉬는 날", "", "", "어느 반 일과표를 쓰나", "그 요일에서 거슬러 올라가 가장 가까운 알바 날의 반 (한 주가 다 휴무면 오픈반)"],
  ["규칙", "일요일", "", "", "운동 · 샤워 → 휴식", "일요일은 운동을 쉰다"],
  ["규칙", "캘린더", "", "", "캘린더 알바가 먼저", "캘린더에서 받은 날은 요일별 알바 대신 그 반. 받은 기간 안에 알바가 없는 날은 쉬는 날"],
  ["규칙", "알바 중 끼니", "", "", `늘 ${WORK_DISH.short}`, ""],
  ["규칙", "집 끼니", "", "", rotation, "이 순서로 돌고 월요일마다 처음부터. 직접 바꾼 칸은 순서를 쓰지 않는다"],
  ["규칙", "하루", "", "", "06:00 에 바뀐다", "06:00 전이면 '앞으로 7일' 의 첫 날은 어제"],
  // 핫픽스 v3.0.4: 맨 아래에 더한다 (위 줄들의 순서는 그대로)
  ["규칙", "아침", breakfast.start, breakfast.end, "월~토 아침", "일요일은 없음. 메뉴는 아직 없어서 끼니 메뉴 칸은 빈칸"],
  ["규칙", "일요일", CHURCH.start, CHURCH.end, CHURCH.name, `겹치는 칸을 덮는다. 아침 취미(마감반 · 중간반 일과)는 ${breakfast.start} 부터. 알바 · 출근 준비와 겹치는 일요일(중간반 · 오픈반 알바)은 교회 칸 없음`],
];

// 일정 설정: 구분 | 반/요일 | 시작 | 끝 | 칸 이름 | 설명
// 일과표 줄의 설명 칸은 늘 빈칸이다 (핫픽스 v3.0.3 에서 칸 설명을 없앰 — 칸 수 · 순서는 그대로, Claude 가 칸 위치로 읽는다)
// - 요일별 알바: 월~일 7줄 (반 이름 또는 '휴무', 알바 시작·끝)
// - 일과표: 설정 '일과표 고치기' 에 저장된 그대로, 반마다 칸마다 한 줄 (끝 = 다음 칸의 시작)
// - 규칙: 쉬는 날 · 일요일처럼 코드에 정해진 것
export function settingRows(settings, now) {
  const s = withDayShifts(settings, now);
  const days = WEEK_ORDER.map((d) => {
    const shift = SHIFTS[s.dayShifts[d]];
    return ["요일별 알바", DAYS[d], shift?.start ?? "", shift?.end ?? "", shift?.label ?? DAY_OFF_LABEL, ""];
  });
  const tables = SHIFT_IDS.flatMap((id) => {
    const blocks = s.templates?.[id] ?? DEFAULT_TEMPLATES[id];
    return blocks.map((x, i) => ["일과표", SHIFTS[id].label, x.start, endOf(blocks, i), x.name, ""]);
  });
  return [...days, ...tables, ...RULES];
}

// 앞으로 7일: 날짜 | 요일 | 반 | 반 출처 | 시작 | 끝 | 칸 이름 | 설명 | 끼니 메뉴
// 오늘(06:00 전이면 어제)부터 7일, 메인 일과표가 보여 주는 칸 그대로 (쉬는 날 · 일요일 바뀜 포함).
// 식사 칸에는 그 끼니 메뉴 (직접 바꾼 칸 · '안 먹음 · 외식' 그대로). 알바 중 끼니는 알바 칸 바로 아래 '알바 중 점심/저녁' 줄 — 시각은 정해진 게 없어 빈칸
export function weekRows(settings, overrides, now) {
  const first = parseDate(reviewDay(now));
  const dates = Array.from({ length: NEXT_DAYS }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  return dates.flatMap((d) => {
    const plan = dayPlan(d, settings);
    const head = [ymd(d), DAYS[d.getDay()], plan.working ? SHIFTS[plan.shift].label : "쉬는 날", plan.fromCal ? "캘린더" : "요일별"];
    const home = dayMeals(d, settings, overrides).filter((m) => !m.work); // 집 끼니, 일과표 식사 칸 순서대로
    const work = workMeal(d, settings);
    let n = 0;
    return plan.blocks.flatMap((x, i) => {
      const menu = x.kind === "meal" ? dishById(home[n++]?.dish)?.short ?? "" : "";
      const row = [...head, x.start, endOf(plan.blocks, i), x.name, "", menu];
      return x.kind === "work" && work ? [row, [...head, "", "", `알바 중 ${work.label}`, "", work.dish.short]] : [row];
    });
  });
}

// 시트로 보낼 두 탭. data = { settings, overrides }
export const scheduleSnapshot = (data, now) => ({
  plan: settingRows(data.settings, now),
  next7: weekRows(data.settings, data.overrides ?? {}, now),
});
