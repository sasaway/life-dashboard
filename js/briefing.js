// 아침 브리핑 (Notion '루틴화'): 오늘 하루를 몇 줄로 모으고, 메일·캘린더를 봤는지 기억한다.
// 1단계: 메일·캘린더는 앱을 여는 버튼만. 내용 가져오기(개인 일정 먼저, 대학시간표는 요청할 때)는 2단계.
import { ymd, blockRange } from "./schedule.js";

// 인사말 '좋은 아침' 과 같은 시간(05~12시)에만 보인다
export const MORNING = { from: 5, to: 12 };
export const isMorning = (now) => now.getHours() >= MORNING.from && now.getHours() < MORNING.to;

// app: 폰에 앱이 있으면 앱으로, 없으면 web 으로
export const LINKS = [
  { id: "mail", label: "지메일 확인", app: "googlegmail://", web: "https://mail.google.com/" },
  { id: "cal", label: "캘린더 확인", app: "googlecalendar://", web: "https://calendar.google.com/" },
];

// 오늘 것만 쓴다. 날이 바뀌면 새로 (봤는지 표시·접힘 모두 처음으로)
export function todayState(saved, now) {
  const day = ymd(now);
  return saved?.day === day ? saved : { day, seen: {}, folded: false };
}
export const markSeen = (state, id) => ({ ...state, seen: { ...state.seen, [id]: true } });
export const setFolded = (state, folded) => ({ ...state, folded });
export const seenCount = (state) => LINKS.filter((l) => state.seen[l.id]).length;

// 카드에 보일 네 줄: [{ label, time, text }]
// plan: dayPlan(), meals: 오늘 식단({ meals, work }), gym: planFor(), ww·wf: 오늘 체크 { done, total }
export function briefLines({ plan, meals, gym, ww, wf }) {
  const b = plan.blocks;
  const job = b.find((x) => x.kind === "work");
  const dishes = meals.meals.map((m) => `${m.label} ${m.dish.short}`);
  if (meals.work) dishes.push(`${meals.work}은 알바 식대`);
  return [
    { label: "알바", time: plan.working && job ? blockRange(b, "work") : "", text: plan.working && job ? job.name.replace("알바 · ", "") : "쉬는 날" },
    { label: "식단", time: "", text: dishes.join(" · ") || "정해진 끼니 없음" },
    { label: "운동", time: gym.key ? blockRange(b, "exercise") ?? "" : "", text: gym.key ? gym.label : "쉬는 날" },
    { label: "취미", time: blockRange(b, "hobby") ?? "", text: `명조 ${ww.done}/${ww.total} · 워프레임 ${wf.done}/${wf.total}` },
  ];
}
