// 운동 화면: 오늘 요약·운동 카드(사진·설명·세트 칸·유튜브 검색)·요일별 메뉴, 메인 운동 카드.
import { store } from "./store.js";
import { getScheduleSettings } from "./schedule-view.js";
import { dayPlan, ymd, toMin, toHHMM } from "./schedule.js";
import {
  EXERCISES, ROUTINES, WEEK, VIDEO_URL, REST_BETWEEN_SETS, planFor, doneSets, tapSet, progressOf, pruneLog, searchUrl,
} from "./workout.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

let log = pruneLog(store.load("workoutLog", {}), new Date());

// 일과표의 오늘 운동 칸 (없으면 null)
function exerciseTime(date) {
  const blocks = dayPlan(date, getScheduleSettings()).blocks;
  const i = blocks.findIndex((b) => b.kind === "exercise");
  if (i < 0) return null;
  const end = blocks[i + 1] ? blocks[i + 1].start : toHHMM(toMin(blocks[i].start) + 120);
  return `${blocks[i].start}–${end}`;
}

function setButtons(id, day) {
  const ex = EXERCISES[id];
  const done = doneSets(log, day, id);
  if (ex.maxSets === 1) {
    return `<button class="set single" data-set="${id}" data-n="1" aria-pressed="${done >= 1}">${done >= 1 ? "했어" : "하면 눌러"}</button>`;
  }
  return Array.from({ length: ex.maxSets }, (_, k) => {
    const n = k + 1;
    const extra = n > ex.sets ? " extra" : "";
    return `<button class="set${extra}" data-set="${id}" data-n="${n}" aria-pressed="${done >= n}" aria-label="${esc(ex.name)} ${n}세트${extra ? " (더 하고 싶을 때)" : ""}">${n}</button>`;
  }).join("");
}

function exerciseCard(id, day) {
  const ex = EXERCISES[id];
  return `<article class="card ex" aria-label="${esc(ex.name)}">
    <img src="images/exercise/${ex.img}.jpg" alt="${esc(ex.name)} 하는 모습 (영상 장면)" width="480" height="270" loading="lazy">
    <div class="card-h"><h2>${esc(ex.name)}</h2><span class="tag">${esc(ex.part)}</span></div>
    <p class="mini amount">${esc(ex.amount)}</p>
    <ul class="ex-tips">${ex.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="sets">${setButtons(id, day)}</div>
    <a class="btn btn-text yt" href="${searchUrl(id)}" target="_blank" rel="noopener">유튜브에서 찾아보기</a>
  </article>`;
}

// ---------- 운동 탭 ----------
function renderGym() {
  const now = new Date();
  const day = ymd(now);
  const plan = planFor(now);
  const p = progressOf(log, day, plan);
  const time = exerciseTime(now);

  $("gymTitle").textContent = plan.key ? `오늘 · ${plan.label}` : "오늘은 쉬는 날";
  $("gymTime").textContent = time ? `${time} (이동 포함)` : "";
  $("gymProgress").innerHTML = plan.key ? `${p.done}<span> / ${p.total} 세트</span>` : "";
  $("gymBar").style.width = `${p.pct}%`;
  $("gymBar").parentElement.hidden = !plan.key;
  $("gymHint").textContent = plan.key ? `칸을 누르면 한 세트 · ${REST_BETWEEN_SETS}` : "일요일은 운동을 쉬어. 푹 쉬고 월요일에 보자.";

  $("gymGroups").innerHTML = plan.groups.map((g) => `
    <h3 class="group-title">${esc(g.title)}</h3>
    ${g.ids.map((id) => exerciseCard(id, day)).join("")}`).join("");

  $("gymWeek").innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const key = WEEK[d];
    const cur = d === now.getDay() ? ' class="cur" aria-current="date"' : "";
    return `<li${cur}><b>${DAYS[d]}</b><span>${key ? `${key} · ${ROUTINES[key].label}` : "쉬는 날"}</span></li>`;
  }).join("");
}

// ---------- 메인 카드 ----------
export function renderGymMain() {
  const now = new Date();
  const plan = planFor(now);
  const p = progressOf(log, ymd(now), plan);
  const time = exerciseTime(now);
  $("gymMainLabel").textContent = plan.key ? plan.label : "쉬는 날";
  $("gymMainTime").textContent = time ?? "";
  $("gymMainBar").style.width = `${p.pct}%`;
  $("gymMainBar").parentElement.hidden = !plan.key;
  $("gymMainNote").innerHTML = plan.key ? `<span class="mono">${p.done} / ${p.total}</span> 세트` : "일요일은 운동을 쉬어.";
}

export function renderWorkout() {
  renderGym();
  renderGymMain();
}

export function startWorkout() {
  renderWorkout();
  $("gymGroups").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-set]");
    if (!b) return;
    const id = b.dataset.set;
    log = tapSet(log, ymd(new Date()), id, Number(b.dataset.n));
    store.save("workoutLog", log);
    // 누른 카드의 칸만 바꾸고(스크롤이 튀지 않게), 요약을 다시 그린다
    b.closest(".sets").innerHTML = setButtons(id, ymd(new Date()));
    const day = ymd(new Date());
    const p = progressOf(log, day, planFor(new Date()));
    $("gymProgress").innerHTML = `${p.done}<span> / ${p.total} 세트</span>`;
    $("gymBar").style.width = `${p.pct}%`;
    renderGymMain();
    document.querySelector(`[data-set="${CSS.escape(id)}"][data-n="${b.dataset.n}"]`)?.focus();
  });
  document.addEventListener("schedule-change", renderWorkout);
  $("gymCredit").innerHTML = `사진·운동 순서: 보통트레이너 「헬스장 처음? 초보자 '기구 사용법' 완벽가이드 루틴」 <a href="${VIDEO_URL}" target="_blank" rel="noopener">영상 보기</a>`;
}
