// 주간리뷰 보고서 계산 (v2.3). Notion '주간리뷰' (2026-09-29 13:36).
// 기록(식단 mealLog · 운동 workoutLog · 회고 reviews)을 읽기만 하고 저장하지 않는다. AI 없이 폰 안에서 센다.
// 취미 카드는 핫픽스 v3.0.3 에서 뺐다 (Notion 주간리뷰가 식단 · 운동 · 일일 회고만 확인). 취미 기록(hobbyLog)은 그대로 쌓인다.
import { parseDate } from "./schedule.js";
import { dishById, proteinSummary } from "./meals.js";
import { planFor, progressOf } from "./workout.js";
import { QUESTIONS } from "./review.js";

// ---------- 식단: 많이 먹은 것 · 단백질 ----------
// 남은 짜글이는 짜글이로 센다. '안 먹음 · 외식' 은 따로.
export function mealReport(log, days) {
  const counts = new Map();
  let skip = 0;
  for (const m of days.flatMap((d) => log[d] ?? [])) {
    if (m.dish === "skip") { skip++; continue; }
    const id = m.dish === "jja-left" ? "jja" : m.dish;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: dishById(id)?.short ?? id, n }));
  return { top, skip, protein: proteinSummary(log, days), recorded: days.filter((d) => log[d]).length };
}

// ---------- 운동: 운동한 날 · 하루 평균 세트 · 기본 세트 달성률 ----------
export function workoutReport(log, days) {
  const planned = days.filter((d) => planFor(parseDate(d)).key); // 일요일은 쉬는 날
  const setsOf = (d) => Object.values(log[d] ?? {}).reduce((a, n) => a + n, 0);
  const worked = days.filter((d) => setsOf(d) > 0);
  let done = 0;
  let total = 0;
  for (const d of planned) {
    const p = progressOf(log, d, planFor(parseDate(d)));
    done += p.done;
    total += p.total;
  }
  return {
    planned: planned.length,
    worked: worked.length,
    avgSets: worked.length ? Math.round(worked.reduce((a, d) => a + setsOf(d), 0) / worked.length) : 0,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}

// ---------- 회고: 질문별로 한 주 답 모으기 + 자주 나온 낱말 ----------
// 낱말 끝의 조사를 떼고(두 글자 이상 남을 때만), 뜻이 적은 낱말은 뺀다. 같은 날 여러 번 나와도 한 번으로 센다.
const JOSA = /(에서|으로|까지|부터|이랑|하고|한테|은|는|이|가|을|를|에|로|와|과|도|만|의|랑)$/;
const STOP = new Set(["오늘", "내일", "어제", "이번", "그냥", "너무", "조금", "그리고", "그래서", "하지만", "했다", "했음", "했어",
  "하기", "하는", "해서", "많이", "다시", "정말", "진짜", "없음", "없다", "있다", "있음", "것", "거", "더", "안", "잘", "못", "좀"]);
export function words(text) {
  const out = new Set();
  for (const raw of text.split(/[^0-9A-Za-z가-힣]+/)) {
    let w = raw;
    const cut = w.replace(JOSA, "");
    if (cut.length >= 2) w = cut;
    if (w.length >= 2 && !STOP.has(w)) out.add(w);
  }
  return out;
}

export function reviewReport(reviews, days, top = 3) {
  const written = days.filter((d) => (reviews[d]?.answers ?? []).some((a) => a?.trim()));
  const byQuestion = QUESTIONS.map((q, i) => {
    const answers = written.map((day) => ({ day, text: reviews[day].answers[i]?.trim() ?? "" })).filter((a) => a.text);
    const counts = new Map();
    for (const a of answers) for (const w of words(a.text)) counts.set(w, (counts.get(w) ?? 0) + 1);
    const frequent = [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, top).map(([w, n]) => ({ word: w, n }));
    return { question: q, answers, frequent };
  });
  return { written: written.length, byQuestion };
}
