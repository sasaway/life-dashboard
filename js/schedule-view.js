// 일과표 화면: 메인의 '지금' 카드와 오늘 일정, 설정 창의 일과표 편집.
import { store } from "./store.js";
import {
  DEFAULT_SETTINGS, SHIFTS, SHIFT_IDS, OFF, dayPlan, nowInfo, leftLabel, withDayShifts, setDayShift,
  checkTemplate, sortBlocks, toMin, upgradeTemplates, alignCloseOnce, CLOSE_RESET,
} from "./schedule.js";
import { $, esc } from "./dom.js";

const KEY = "schedule";
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월요일부터 보여 준다

function loadSettings() {
  const saved = store.load(KEY, null);
  if (!saved) return withDayShifts({ ...DEFAULT_SETTINGS, closeReset: CLOSE_RESET }, new Date()); // 처음 쓰는 폰은 이미 기본값
  // 옛 기본 일과표가 그대로 저장돼 있으면 새 기본값으로 (직접 고친 건 그대로)
  const templates = upgradeTemplates({ ...DEFAULT_SETTINGS.templates, ...saved.templates }); // 빠진 반이 있으면 기본값으로
  // 핫픽스 v2.5.1: 마감반을 한 번 기본값으로 (예전 것은 oldClose 에 보관)
  // 핫픽스 v2.8.1: '한 주씩 번갈아' · '알바 하는 요일' 을 요일별 알바로 옮긴다 (지금 주의 반 그대로, 꺼 둔 요일은 쉬는 날)
  const next = withDayShifts(alignCloseOnce({ ...DEFAULT_SETTINGS, ...saved, templates }, new Date()), new Date());
  if (JSON.stringify(next) !== JSON.stringify({ ...DEFAULT_SETTINGS, ...saved })) store.save(KEY, next);
  return next;
}
let settings = loadSettings();
export const getScheduleSettings = () => settings;
// 캘린더 알바 연결에서 받은 것 저장 (null 이면 연결 끊기)
export function setCalendar(cal) {
  const next = { ...settings };
  if (cal) next.cal = cal;
  else delete next.cal;
  saveSettings(next);
}
function saveSettings(next) {
  settings = next;
  store.save(KEY, settings);
  renderToday();
  document.dispatchEvent(new CustomEvent("schedule-change")); // 식단이 끼니 칸을 다시 계산한다
}

// ---------- 메인: 지금 카드 + 오늘 일정 ----------
export function renderToday() {
  const d = new Date();
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const plan = dayPlan(d, settings);
  const info = nowInfo(plan.blocks, nowMin);

  $("nowTitle").textContent = info.block.name;
  $("nowMeta").textContent = `${info.start} – ${info.end} · 다음: ${info.next.name}`;
  $("nowBar").style.width = `${info.pct}%`;
  $("nowPct").textContent = `${info.pct}%`;
  $("nowLeft").textContent = leftLabel(info.leftMin);

  const label = plan.working ? SHIFTS[plan.shift].label : "쉬는 날";
  $("shiftTag").textContent = plan.fromCal ? `${label} · 캘린더` : label;
  const beforeDay = nowMin < toMin(plan.blocks[0].start); // 새벽: 오늘 칸은 아직 시작 전
  $("sched").innerHTML = plan.blocks.map((x, i) => {
    const cls = i === info.index ? "cur" : i < info.index && !beforeDay ? "past" : "";
    return `<li class="${cls}"${i === info.index ? ' aria-current="true"' : ""}>
      <span class="t mono">${esc(x.start)}</span><span class="dot"></span>
      <span><span class="n">${esc(x.name)}</span>${i === info.index ? '<span class="pill">진행 중</span>' : ""}
      ${x.note ? `<span class="p">${esc(x.note)}</span>` : ""}</span></li>`;
  }).join("");
}

// ---------- 설정: 요일별 알바 (월~일마다 오픈반 · 중간반 · 마감반 · 쉬는 날, 매주 같게) ----------
const DAY_CHOICES = [...SHIFT_IDS.map((id) => [id, SHIFTS[id].label.replace("반", "")]), [OFF, "쉼"]];
const choiceLabel = (v) => (v === OFF ? "쉬는 날" : SHIFTS[v].label);
function renderDayShifts() {
  $("dayShifts").innerHTML = WEEK_ORDER.map((day) => `<li class="day-shift">
    <span class="day-name">${DAY_NAMES[day]}</span>
    <div class="seg four" role="group" aria-label="${DAY_NAMES[day]}요일 알바">${DAY_CHOICES.map(([v, text]) =>
      `<button data-day="${day}" data-shift="${v}" aria-pressed="${settings.dayShifts[day] === v}" aria-label="${DAY_NAMES[day]}요일 ${choiceLabel(v)}">${text}</button>`).join("")}</div>
  </li>`).join("");
}

// ---------- 설정: 일과표 편집 ----------
let editing = "open";
let draft = [];

function startEdit(shift) {
  editing = shift;
  draft = settings.templates[shift].map((x) => ({ ...x }));
  document.querySelectorAll("#editPick button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.shift === shift));
  });
  $("editMsg").textContent = "";
  renderRows();
}

function renderRows() {
  $("editRows").innerHTML = draft.map((x, i) => `
    <li class="edit-row">
      <input type="time" class="field mono" data-i="${i}" data-f="start" value="${esc(x.start)}" aria-label="시작 시각" required>
      <input type="text" class="field" data-i="${i}" data-f="name" value="${esc(x.name)}" aria-label="칸 이름" maxlength="20">
      <button class="icon-btn del" data-del="${i}" aria-label="${esc(x.name)} 칸 지우기">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </li>`).join("");
}

function saveEdit() {
  const msg = checkTemplate(draft);
  if (msg) { $("editMsg").textContent = msg; return; }
  const sorted = sortBlocks(draft);
  saveSettings({ ...settings, templates: { ...settings.templates, [editing]: sorted } });
  draft = sorted.map((x) => ({ ...x }));
  renderRows();
  $("editMsg").textContent = "저장했어.";
}

export function startSchedule() {
  renderToday();

  $("dayShifts").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-shift]");
    if (!btn) return;
    saveSettings(setDayShift(settings, btn.dataset.day, btn.dataset.shift));
    renderDayShifts();
  });

  $("editPick").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-shift]");
    if (btn) startEdit(btn.dataset.shift);
  });
  $("editRows").addEventListener("input", (e) => {
    const { i, f } = e.target.dataset;
    if (i !== undefined) draft[i][f] = e.target.value;
  });
  $("editRows").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-del]");
    if (!btn) return;
    draft.splice(Number(btn.dataset.del), 1);
    renderRows();
  });
  $("addRow").addEventListener("click", () => {
    draft.push({ start: "", kind: "custom", name: "", note: "" });
    renderRows();
    $("editRows").querySelector("li:last-child input").focus();
  });
  $("saveRows").addEventListener("click", saveEdit);
  $("resetRows").addEventListener("click", () => {
    draft = DEFAULT_SETTINGS.templates[editing].map((x) => ({ ...x }));
    renderRows();
    $("editMsg").textContent = "기본값을 불러왔어. 저장을 눌러야 바뀌어.";
  });
}

// 설정 창을 열 때마다 최신 값으로 그린다
export function openScheduleSettings() {
  renderDayShifts();
  startEdit(dayPlan(new Date(), settings).shift);
}
