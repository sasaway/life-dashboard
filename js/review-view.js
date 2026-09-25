// 회고 화면: 메인 카드, 오늘 회고 쓰기, 주간 회고, 지난 회고.
import { store } from "./store.js";
import { openSheet } from "./sheet.js";
import {
  QUESTIONS, reviewDay, answeredCount, statusLabel, pastDays, mondayKey,
  weekDays, shiftWeek, dayLabel, weekLabel, withAnswer,
} from "./review.js";
import { $, esc } from "./dom.js";

let reviews = store.load("reviews", {}); // { "2026-09-25": { answers: [4개] } }
let weekly = store.load("weekly", {});   // { "2026-09-21": "이번 주 메모" }

// ---------- 메인 카드 ----------
export function renderReviewCard() {
  const day = reviewDay(new Date());
  const n = answeredCount(reviews[day]);
  $("reviewStatus").textContent = statusLabel(reviews[day]);
  $("reviewBar").style.width = `${(n / QUESTIONS.length) * 100}%`;
  $("reviewHint").innerHTML = `${esc(dayLabel(day))} · <span class="mono">${n} / ${QUESTIONS.length}</span>`;
  $("openReview").textContent = n ? "고치기" : "쓰기";
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

// ---------- 주간 회고 ----------
let week = "";

function renderWeek() {
  const thisWeek = mondayKey(reviewDay(new Date()));
  $("weekLabel").textContent = weekLabel(week);
  $("nextWeek").disabled = week >= thisWeek;
  const days = weekDays(week).filter((d) => answeredCount(reviews[d]) > 0);
  $("weekDays").innerHTML = days.length
    ? days.map((d) => `
      <li><button class="day-entry" data-day="${d}">
        <b>${esc(dayLabel(d))}</b>
        ${QUESTIONS.map((q, i) => reviews[d].answers[i]?.trim()
          ? `<span class="qa-line"><span class="q">${esc(q)}</span> ${esc(reviews[d].answers[i])}</span>` : "").join("")}
      </button></li>`).join("")
    : `<li><p class="empty">이 주에 쓴 회고가 없어.</p></li>`;
  $("weekNote").value = weekly[week] ?? "";
}

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
  $("openReview").addEventListener("click", () => openReview(reviewDay(new Date())));
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
  $("weekNote").addEventListener("input", (e) => {
    weekly = { ...weekly };
    if (e.target.value.trim()) weekly[week] = e.target.value;
    else delete weekly[week];
    $("weekSaved").textContent = store.save("weekly", weekly) ? "저장했어." : "저장이 안 됐어. 저장 공간을 확인해 줘.";
  });

  // 주간·지난 회고에서 날짜를 누르면 그 날 회고를 연다
  for (const id of ["weekDays", "pastList"]) {
    $(id).addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-day]");
      if (btn) openReview(btn.dataset.day);
    });
  }
}
