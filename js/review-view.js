// 회고 화면: 메인 카드, 오늘 회고 쓰기, 주간리뷰(보고서 + 주간회고), 지난 회고.
import { store } from "./store.js";
import { openSheet } from "./sheet.js";
import {
  QUESTIONS, WEEK_QUESTIONS, reviewDay, isWeeklyTime, answeredCount, statusLabel, pastDays, mondayKey,
  weekDays, shiftWeek, dayLabel, weekLabel, withAnswer,
} from "./review.js";
import { mealReport, workoutReport, reviewReport, hobbyReport } from "./weekly-report.js";
import { parseDate } from "./schedule.js";
import { DAYS } from "./time.js";
import { withUpcoming } from "./wuwa.js";
import { migrateGear, DEFAULT_GEAR } from "./warframe.js";
import { $, esc } from "./dom.js";

let reviews = store.load("reviews", {});         // { "2026-09-25": { answers: [4개] } }
let weekly = store.load("weekly", {});           // { "2026-09-21": "이번 주 메모" } — v2.3 전의 주간 회고 (그대로 보여 준다)
let weekReviews = store.load("weekReviews", {}); // { "2026-09-28": { answers: [4개] } } — 주간회고 (v2.3)

// ---------- 메인 카드 ----------
// 일요일 18시 ~ 월요일 새벽 6시 전에는 일일 회고 대신 주간리뷰 (Notion '주간리뷰')
export function renderReviewCard() {
  const now = new Date();
  const weeklyTime = isWeeklyTime(now);
  const day = reviewDay(now);
  const monday = mondayKey(day);
  const entry = weeklyTime ? weekReviews[monday] : reviews[day];
  const n = answeredCount(entry);
  $("reviewCardTitle").textContent = weeklyTime ? "주간리뷰" : "회고";
  $("reviewStatus").textContent = statusLabel(entry);
  $("reviewBar").style.width = `${(n / QUESTIONS.length) * 100}%`;
  $("reviewHint").innerHTML = `${esc(weeklyTime ? weekLabel(monday) : dayLabel(day))} · <span class="mono">${n} / ${QUESTIONS.length}</span>`;
  $("openReview").textContent = weeklyTime ? (n ? "주간리뷰 고치기" : "주간리뷰 쓰기") : (n ? "고치기" : "쓰기");
  $("openWeekly").hidden = weeklyTime; // 위 버튼이 주간리뷰라 겹치지 않게
}

// ---------- 회고 쓰기 (오늘 또는 지난 날) ----------
let editingDay = "";

function openReview(day) {
  editingDay = day;
  const answers = reviews[day]?.answers ?? [];
  $("reviewTitle").textContent = day === reviewDay(new Date()) ? "오늘 회고" : "지난 회고";
  $("reviewDate").textContent = dayLabel(day);
  $("reviewForm").innerHTML = QUESTIONS.map((q, i) => `
    <label class="qa">
      <span class="q">${i + 1}. ${esc(q)}</span>
      <textarea class="field" rows="2" data-i="${i}">${esc(answers[i] ?? "")}</textarea>
    </label>`).join("");
  $("reviewSaved").textContent = "쓰는 대로 바로 저장돼.";
  openSheet("reviewSheet");
}

// ---------- 주간리뷰: 보고서 → 주간회고 → (예전) 이번 주 메모 ----------
let week = "";

const dayShort = (d) => DAYS[parseDate(d).getDay()];
const row = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
const card = (title, sub, body) =>
  `<section class="card rep"><div class="card-h"><h2>${esc(title)}</h2><small>${esc(sub)}</small></div>${body}</section>`;

// 보고서가 쓰는 기록은 창을 열 때마다 폰에 저장된 걸 새로 읽는다 (다른 화면 코드와 얽히지 않게)
function reportHtml(days) {
  const today = reviewDay(new Date());
  // 식단
  const meal = mealReport(store.load("mealLog", {}), days);
  const mealBody = meal.recorded ? `<dl class="rep-dl">
      ${row("많이 먹은 것", meal.top.slice(0, 3).map((x) => `${esc(x.name)} <span class="mono">${x.n}</span>`).join(" · ") || "없음")}
      ${row("단백질", `22g 넘긴 끼니 <span class="mono">${meal.protein.hit} / ${meal.protein.meals}</span> · 합계 약 <span class="mono">${meal.protein.grams}g</span>`)}
      ${meal.skip ? row("안 먹음 · 외식", `<span class="mono">${meal.skip}</span>끼`) : ""}
    </dl>` : `<p class="mini">이 주 식단 기록이 없어. (먹은 기록은 v2.2 부터 남아.)</p>`;
  // 운동
  const gym = workoutReport(store.load("workoutLog", {}), days);
  const gymBody = gym.planned ? `<dl class="rep-dl">
      ${row("운동한 날", `<span class="mono">${gym.worked} / ${gym.planned}</span>일`)}
      ${row("하루 평균", `<span class="mono">${gym.avgSets}</span>세트 (운동한 날)`)}
      ${row("기본 세트", `<span class="mono">${gym.pct}%</span> 했어`)}
    </dl><div class="meter"><i style="width:${gym.pct}%"></i></div>` : `<p class="mini">아직 운동하는 날이 없었어.</p>`;
  // 회고
  const rev = reviewReport(reviews, days);
  const revBody = rev.written ? rev.byQuestion.map((q, i) => `<div class="rep-q">
      <p class="q">${i + 1}. ${esc(q.question)}</p>
      ${q.frequent.length ? `<p class="mini">자주: ${q.frequent.map((f) => `${esc(f.word)} <span class="mono">${f.n}</span>`).join(" · ")}</p>` : ""}
      <ul class="rep-ans">${q.answers.map((a) => `<li><button data-day="${a.day}" aria-label="${esc(dayLabel(a.day))} 회고 열기"><span class="d">${esc(dayShort(a.day))}</span><span>${esc(a.text)}</span></button></li>`).join("") || `<li class="mini">답 없음</li>`}</ul>
    </div>`).join("") : `<p class="mini">이 주에 쓴 일일 회고가 없어.</p>`;
  // 취미: 이 주를 처음 열 때 한 벌 ↔ 다음 주 처음(지난 주면) 또는 지금
  const hobbyLog = { days: {}, weeks: {}, ...store.load("hobbyLog", {}) };
  const chars = withUpcoming(store.load("wuwaChars", { list: [] }).list);
  const charName = (id) => chars.find((c) => c.id === id)?.name ?? `알 수 없는 공명자 (${id})`;
  const now = { parties: store.load("wuwaParties", []), builds: store.load("wuwaBuilds", {}), gear: migrateGear(store.load("wfGear", DEFAULT_GEAR)) };
  const end = hobbyLog.weeks[shiftWeek(week, 1)] ?? now;
  const hobby = hobbyReport(hobbyLog, days, hobbyLog.weeks[week], end, charName);
  const list = (items) => items.length ? `<ul class="rep-list">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="mini">바뀐 것 없음</p>`;
  const hobbyBody = `<dl class="rep-dl">
      ${row("명조", hobby.recorded ? `일일 다 한 날 <span class="mono">${hobby.wwFullDays} / ${hobby.recorded}</span>일${hobby.wwWeekly ? ` · 주간 <span class="mono">${hobby.wwWeekly[0]} / ${hobby.wwWeekly[1]}</span>` : ""}` : "기록 없음")}
      ${row("워프레임", hobby.recorded ? `출격 · 포르마 다 한 날 <span class="mono">${hobby.wfFullDays} / ${hobby.recorded}</span>일` : "기록 없음")}
    </dl>
    ${hobby.changes ? `<p class="q">명조 파티표 · 육성</p>${list(hobby.changes.wuwa)}<p class="q">워프레임 장비</p>${list(hobby.changes.warframe)}`
      : `<p class="mini">이 주 처음 모습이 없어서 바뀐 것은 다음 주부터 보여. (취미 기록은 v2.2.2 부터 남아.)</p>`}`;
  const upto = days.length < 7 ? `${dayShort(today)}요일까지` : "한 주";
  return card("식단", `기록 ${meal.recorded}일`, mealBody)
    + card("운동", upto, gymBody)
    + card("회고", `${rev.written}일 씀`, revBody)
    + card("취미", upto, hobbyBody);
}

function renderWeek() {
  const today = reviewDay(new Date());
  const thisWeek = mondayKey(today);
  $("weekLabel").textContent = weekLabel(week);
  $("nextWeek").disabled = week >= thisWeek;
  $("weekReport").innerHTML = reportHtml(weekDays(week).filter((d) => d <= today)); // 이번 주면 오늘까지
  const answers = weekReviews[week]?.answers ?? [];
  $("weekForm").innerHTML = WEEK_QUESTIONS.map((q, i) => `
    <label class="qa">
      <span class="q">${i + 1}. ${esc(q)}</span>
      <textarea class="field" rows="2" data-i="${i}">${esc(answers[i] ?? "")}</textarea>
    </label>`).join("");
  $("weekFormStatus").textContent = statusLabel(weekReviews[week]);
  // 예전(v2.3 전) '이번 주는 어땠어?' 메모가 있는 주만 그대로 보여 주고 고칠 수 있게
  $("weekNoteCard").hidden = !weekly[week];
  $("weekNote").value = weekly[week] ?? "";
}

// 기본은 지금 회고하는 날의 주 (월요일 새벽이면 지난 주). ‹ › 로 다른 주
function openWeekly() {
  week = mondayKey(reviewDay(new Date()));
  renderWeek();
  $("weekSaved").textContent = "쓰는 대로 바로 저장돼.";
  openSheet("weeklySheet");
}

// ---------- 지난 회고 ----------
function openPast() {
  const days = pastDays(reviews);
  $("pastList").innerHTML = days.length
    ? days.map((d) => {
      const first = reviews[d].answers.find((a) => a.trim()) ?? "";
      return `<li><button class="day-entry" data-day="${d}">
        <span class="row-h"><b>${esc(dayLabel(d))}</b><span class="mono">${answeredCount(reviews[d])} / ${QUESTIONS.length}</span></span>
        <span class="preview">${esc(first)}</span></button></li>`;
    }).join("")
    : `<li><p class="empty">아직 쓴 회고가 없어.</p></li>`;
  openSheet("pastSheet");
}

export function startReview() {
  renderReviewCard();
  $("openReview").addEventListener("click", () => (isWeeklyTime(new Date()) ? openWeekly() : openReview(reviewDay(new Date()))));
  $("openWeekly").addEventListener("click", openWeekly);
  $("openPast").addEventListener("click", openPast);

  $("reviewForm").addEventListener("input", (e) => {
    const i = Number(e.target.dataset.i);
    reviews = withAnswer(reviews, editingDay, i, e.target.value);
    $("reviewSaved").textContent = store.save("reviews", reviews) ? "저장했어." : "저장이 안 됐어. 저장 공간을 확인해 줘.";
    renderReviewCard();
  });

  $("prevWeek").addEventListener("click", () => { week = shiftWeek(week, -1); renderWeek(); });
  $("nextWeek").addEventListener("click", () => { week = shiftWeek(week, 1); renderWeek(); });
  $("weekForm").addEventListener("input", (e) => {
    weekReviews = withAnswer(weekReviews, week, Number(e.target.dataset.i), e.target.value);
    $("weekSaved").textContent = store.save("weekReviews", weekReviews) ? "저장했어." : "저장이 안 됐어. 저장 공간을 확인해 줘.";
    $("weekFormStatus").textContent = statusLabel(weekReviews[week]);
    renderReviewCard();
  });
  $("weekNote").addEventListener("input", (e) => {
    weekly = { ...weekly };
    if (e.target.value.trim()) weekly[week] = e.target.value;
    else delete weekly[week];
    $("weekSaved").textContent = store.save("weekly", weekly) ? "저장했어." : "저장이 안 됐어. 저장 공간을 확인해 줘.";
  });

  // 주간리뷰의 회고 답 · 지난 회고에서 날짜를 누르면 그 날 회고를 연다
  for (const id of ["weekReport", "pastList"]) {
    $(id).addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-day]");
      if (btn) openReview(btn.dataset.day);
    });
  }
}
