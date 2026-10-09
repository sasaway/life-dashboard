// 라이프 기록 동기화 (v2.6): 폰의 기록을 구글 시트 '라이프 기록' 의 탭 모양으로 바꾼다. 계산만 — 보내기는 hobby-sync-view.js.
// 앱 → 시트 한 방향 (Claude 가 시트를 읽는다). 은월 요청 2026-10-03 — 회고 글도 늘 같이 보낸다, 가챠는 안 보낸다.
// 탭과 칸 이름은 apps-script/hobby-sync.gs 의 TABS 에 있다. 여기서는 칸 순서대로 값만 만든다.
// 몸무게·키는 앱에 없고, 여기서도 만들지 않는다.
// 숫자는 이미 있는 계산을 그대로 쓴다 (progressOf · proteinSummary · answeredCount · hobbyLog · leftTodos).
import { ymd, parseDate, dayPlan, SHIFTS } from "./schedule.js";
import { DAYS } from "./time.js";
import { planFor, progressOf, EXERCISES } from "./workout.js";
import { dishById, proteinSummary, mealProtein } from "./meals.js";
import { reviewDay, answeredCount, mondayKey, QUESTIONS, WEEK_QUESTIONS } from "./review.js";
import { leftTodos } from "./warframe.js";

export const SYNC_DAYS = 14;

// 보낼 날들: 오늘부터 13일 전까지, 최근 날이 먼저. 하루는 회고처럼 06:00 에 바뀐다 (새벽 2시는 아직 어제)
export function recentDays(now, n = SYNC_DAYS) {
  const t = parseDate(reviewDay(now));
  return Array.from({ length: n }, (_, i) => ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() - i)));
}

const frac = (pair) => (pair ? `${pair[0]}/${pair[1]}` : "");

// 운동 부위 · 근력 세트(한 것/기본) · 준비·마무리(한 것/3). 일요일은 쉬는 날
function workoutCells(log, day) {
  const plan = planFor(parseDate(day));
  if (!plan.key) return [plan.label, "", ""];
  const part = (pick) => {
    const p = progressOf(log, day, { groups: plan.groups.filter(pick) });
    return `${p.done}/${p.total}`;
  };
  return [plan.label, part((g) => g.title === "근력"), part((g) => g.title !== "근력")];
}

const mealName = (m) => `${m.label} ${dishById(m.dish)?.short ?? m.dish}`;

// 집 끼니 메뉴 · 알바 끼니 · 단백질 합(g) · 22g 넘긴 끼니/먹은 끼니. 기록이 없는 날은 빈칸
function mealCells(mealLog, day) {
  const list = mealLog[day];
  if (!list) return ["", "", "", ""];
  const p = proteinSummary(mealLog, [day]);
  return [
    list.filter((m) => !m.work).map(mealName).join(" · "),
    list.filter((m) => m.work).map(mealName).join(" · "),
    String(p.grams),
    `${p.hit}/${p.meals}`,
  ];
}

// 하루 한 줄 (오늘 요약 · 최근 14일이 같은 칸):
// 날짜 | 요일 | 반 | 운동 부위 | 운동 세트 | 준비·마무리 | 집 끼니 | 알바 끼니 | 단백질 합(g) | 22g 넘긴 끼니/먹은 끼니
// | 회고 | 명조 일일 | 명조 주간 | 워프레임 | 워프레임 남은 할 일
// 남은 할 일은 '지금' 만 있어서 오늘 줄에만 적는다 (todos 를 줄 때만)
export function dayRow(day, { settings, workoutLog, mealLog, reviews, hobbyLog, todos }) {
  const d = parseDate(day);
  const plan = dayPlan(d, settings);
  const h = hobbyLog.days?.[day] ?? {};
  return [
    day,
    DAYS[d.getDay()],
    plan.working ? SHIFTS[plan.shift].label : "쉬는 날",
    ...workoutCells(workoutLog, day),
    ...mealCells(mealLog, day),
    `${answeredCount(reviews[day])}/${QUESTIONS.length}`,
    frac(h.ww),
    frac(h.wwWeek),
    frac(h.wf),
    todos ? String(leftTodos(todos)) : "",
  ];
}

// 식단 기록: 날짜 | 끼니 | 메뉴 | 단백질(g). 알바 중 끼니는 '점심 (알바)', '안 먹음 · 외식' 은 단백질 빈칸
export const mealRows = (mealLog, days) => days.flatMap((day) => (mealLog[day] ?? []).map((m) => [
  day, m.work ? `${m.label} (알바)` : m.label, dishById(m.dish)?.short ?? m.dish, String(mealProtein(m) ?? ""),
]));

// 운동 기록: 날짜 | 부위 | 운동 이름 | 한 세트/기본 세트. 한 세트라도 한 운동만, 최근 날이 먼저 (workoutLog 에 남은 만큼)
export const workoutRows = (log) => Object.keys(log).sort().reverse().flatMap((day) =>
  Object.keys(EXERCISES).filter((id) => log[day][id] > 0).map((id) => [
    day, EXERCISES[id].part, EXERCISES[id].name, `${log[day][id]}/${EXERCISES[id].sets}`,
  ]));

// 취미 체크: 날짜 | 명조 일일 | 명조 주간 | 워프레임 (기록이 있는 날만)
export const hobbyRows = (hobbyLog, days) => days.filter((d) => hobbyLog.days?.[d]).map((d) => {
  const h = hobbyLog.days[d];
  return [d, frac(h.ww), frac(h.wwWeek), frac(h.wf)];
});

// 회고 기록: 날짜 | 구분 | 질문 | 답. 하루 회고는 그 날, 주간회고는 그 주 월요일 날짜로. 답을 쓴 질문만
export function reviewRows(reviews, weekReviews, days) {
  const rows = (store, keys, kind, questions) => keys.flatMap((key) =>
    (store[key]?.answers ?? []).map((a, i) => [key, kind, questions[i], (a ?? "").trim()]).filter((r) => r[3]));
  const weeks = [...new Set(days.map(mondayKey))];
  return [...rows(reviews, days, "하루 회고", QUESTIONS), ...rows(weekReviews, weeks, "주간회고", WEEK_QUESTIONS)];
}

// 시트로 보낼 한 벌. data = { settings, workoutLog, mealLog, reviews, weekReviews, hobbyLog, todos }
export function lifeSnapshot(data, now) {
  const days = recentDays(now);
  return {
    today: [dayRow(days[0], data)],
    recent: days.map((day, i) => dayRow(day, { ...data, todos: i === 0 ? data.todos : null })),
    meals: mealRows(data.mealLog, days),
    workouts: workoutRows(data.workoutLog),
    hobby: hobbyRows(data.hobbyLog, days),
    reviews: reviewRows(data.reviews, data.weekReviews, days),
  };
}
