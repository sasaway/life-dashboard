// 주간리뷰 보고서 계산 (v2.3). Notion '주간리뷰' (2026-09-29 13:36).
// 기록(식단 mealLog · 운동 workoutLog · 회고 reviews · 취미 hobbyLog)을 읽기만 하고 저장하지 않는다. AI 없이 폰 안에서 센다.
import { parseDate } from "./schedule.js";
import { dishById, proteinSummary } from "./meals.js";
import { planFor, progressOf } from "./workout.js";
import { QUESTIONS } from "./review.js";
import { BUILD } from "./wuwa.js";

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

// ---------- 취미: 체크한 날 · 주 처음과 지금 비교 ----------
// start = 그 주를 처음 열 때 저장한 한 벌, end = 지금(또는 다음 주 처음) 모습. charName(id) → 공명자 이름
export function hobbyReport(hobbyLog, days, start, end, charName) {
  const rows = days.map((d) => hobbyLog.days?.[d]).filter(Boolean);
  const full = (key) => rows.filter((r) => r[key] && r[key][0] >= r[key][1]).length;
  const weekly = rows.map((r) => r.wwWeek).filter(Boolean).at(-1) ?? null;
  return {
    recorded: rows.length,
    wwFullDays: full("ww"),
    wwWeekly: weekly,
    wfFullDays: full("wf"),
    changes: start ? hobbyChanges(start, end, charName) : null, // null = 그 주 처음 모습이 없다 (v2.2.2 전)
  };
}

export function hobbyChanges(start, end, charName) {
  const out = { wuwa: [], warframe: [] };
  // 명조 파티표: 파티 추가·삭제, 칸에 넣은·뺀 공명자
  const before = new Map(start.parties.map((p) => [p.id, p]));
  for (const p of end.parties) {
    const old = before.get(p.id);
    if (!old) { out.wuwa.push(`파티 추가: ${p.name}`); continue; }
    const was = new Set(old.slots.filter(Boolean));
    const now = new Set(p.slots.filter(Boolean));
    const inn = [...now].filter((id) => !was.has(id)).map(charName);
    const gone = [...was].filter((id) => !now.has(id)).map(charName);
    if (inn.length) out.wuwa.push(`${p.name}: ${inn.join(", ")} 넣음`);
    if (gone.length) out.wuwa.push(`${p.name}: ${gone.join(", ")} 뺌`);
  }
  for (const p of start.parties) if (!end.parties.some((x) => x.id === p.id)) out.wuwa.push(`파티 삭제: ${p.name}`);
  // 육성 체크: 새로 한 것
  for (const [id, b] of Object.entries(end.builds)) {
    const newly = BUILD.filter((x) => b?.[x.id] && !start.builds[id]?.[x.id]).map((x) => x.label);
    if (newly.length) out.wuwa.push(`${charName(id)}: ${newly.join(" · ")} 완료`);
  }
  // 워프레임 장비: 워프레임 추가·삭제·고침, 그 외 무기 추가·삭제
  const frames = new Map(start.gear.frames.map((f) => [f.id, f]));
  for (const f of end.gear.frames) {
    const old = frames.get(f.id);
    if (!old) out.warframe.push(`워프레임 추가: ${f.frame || "이름 없음"}`);
    else if (JSON.stringify(old) !== JSON.stringify(f)) out.warframe.push(`${f.frame || "이름 없음"} 장비 고침`);
  }
  for (const f of start.gear.frames) if (!end.gear.frames.some((x) => x.id === f.id)) out.warframe.push(`워프레임 삭제: ${f.frame || "이름 없음"}`);
  const addW = end.gear.others.filter((n) => !start.gear.others.includes(n));
  const delW = start.gear.others.filter((n) => !end.gear.others.includes(n));
  if (addW.length) out.warframe.push(`그 외 무기 추가: ${addW.join(", ")}`);
  if (delW.length) out.warframe.push(`그 외 무기 삭제: ${delW.join(", ")}`);
  return out;
}
