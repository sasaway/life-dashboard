// 회고: 저녁 4가지 질문, 하루·주간 회고. 규칙은 Notion '루틴화'.
import { ymd, mondayOf, parseDate, weekDates } from "./schedule.js";
import { DAYS } from "./time.js";

export const QUESTIONS = [
  "오늘 잘 되었던 일은?",
  "오늘 안 되었던 일은?",
  "오늘 배운 것은?",
  "내일 처음으로 할 일은?",
];

// 주간리뷰의 주간회고 (v2.3): 일일 회고와 같은 네 질문을 한 주 기준으로 (사용자 '추천대로')
export const WEEK_QUESTIONS = [
  "이번 주 잘 되었던 일은?",
  "이번 주 안 되었던 일은?",
  "이번 주 배운 것은?",
  "다음 주 처음으로 할 일은?",
];

// 하루는 06:00 에 바뀐다 (취침 23:00~06:00). 새벽 1시에 쓰면 어제 회고다.
const DAY_START_HOUR = 6;
const WEEKLY_START_HOUR = 18; // 일요일 저녁 ('좋은 저녁' 과 같은 시각)

export function reviewDay(now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return ymd(d);
}

// 주간리뷰 시간: 일요일 18시 ~ 월요일 새벽 6시 전 (새벽은 어제 회고라는 규칙 그대로 → 월요일 새벽도 일요일 주간리뷰)
export function isWeeklyTime(now) {
  const h = now.getHours();
  return parseDate(reviewDay(now)).getDay() === 0 && (h >= WEEKLY_START_HOUR || h < DAY_START_HOUR);
}

export function answeredCount(entry) {
  return (entry?.answers ?? []).filter((a) => a && a.trim()).length;
}

export function statusLabel(entry) {
  const n = answeredCount(entry);
  if (n === 0) return "아직 안 썼어";
  if (n === QUESTIONS.length) return "다 썼어";
  return "쓰는 중";
}

// 쓴 내용이 있는 날만, 최근 날부터
export function pastDays(reviews) {
  return Object.keys(reviews)
    .filter((day) => answeredCount(reviews[day]) > 0)
    .sort()
    .reverse();
}

// 그 날이 속한 주의 월요일
export const mondayKey = (day) => ymd(mondayOf(parseDate(day)));

export const weekDays = (monday) => weekDates(parseDate(monday)).map(ymd);

export function shiftWeek(monday, n) {
  const d = parseDate(monday);
  d.setDate(d.getDate() + n * 7);
  return ymd(d);
}

// "9월 25일 (금)"
export function dayLabel(day) {
  const d = parseDate(day);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
}
// "9월 21일 – 27일"
export function weekLabel(monday) {
  const [a, b] = [weekDays(monday)[0], weekDays(monday)[6]].map(parseDate);
  const end = a.getMonth() === b.getMonth() ? `${b.getDate()}일` : `${b.getMonth() + 1}월 ${b.getDate()}일`;
  return `${a.getMonth() + 1}월 ${a.getDate()}일 – ${end}`;
}

// 답을 고친 새 기록. 네 칸이 다 비면 그 날 기록을 지운다. (주간회고도 같은 모양: key 가 그 주 월요일)
export function withAnswer(reviews, day, index, text) {
  const answers = [...(reviews[day]?.answers ?? ["", "", "", ""])];
  answers[index] = text;
  const next = { ...reviews };
  if (answers.every((a) => !a.trim())) delete next[day];
  else next[day] = { answers };
  return next;
}
