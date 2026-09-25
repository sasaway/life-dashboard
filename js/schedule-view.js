// 일과표 화면: 메인의 '지금' 카드와 오늘 일정, 설정 창의 일과표 편집.
import { store } from "./store.js";
import {
  DEFAULT_SETTINGS, SHIFTS, dayPlan, nowInfo, leftLabel, setThisWeek,
  shiftFor, checkTemplate, sortBlocks, toMin, upgradeTemplates,
} from "./schedule.js";
import { $, esc } from "./dom.js";

const KEY = "schedule";
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 월요일부터 보여 준다

function loadSettings() {
  const saved = store.load(KEY, null);
  if (!saved) return DEFAULT_SETTINGS;
  // 옛 기본 일과표(취미 20:00 / 08:00)가 그대로 저장돼 있으면 새 기본값으로 (직접 고친 건 그대로)
  const templates = upgradeTemplates(saved.templates ?? DEFAULT_SETTINGS.templates);
  const next = { ...DEFAULT_SETTINGS, ...saved, templates };
  if (saved.templates && JSON.stringify(templates) !== JSON.stringify(saved.templates)) store.save(KEY, next);
  return next;
}
let settings = loadSettings();
export const getScheduleSettings = () => settings;
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

  $("shiftTag").textContent = plan.working ? `${SHIFTS[plan.shift].label} 주` : "쉬는 날";
  const beforeDay = nowMin < toMin(plan.blocks[0].start); // 새벽: 오늘 칸은 아직 시작 전
  $("sched").innerHTML = plan.blocks.map((x, i) => {
    const cls = i === info.index ? "cur" : i < info.index && !beforeDay ? "past" : "";
    return `<li class="${cls}"${i === info.index ? ' aria-current="true"' : ""}>
      <span class="t mono">${esc(x.start)}</span><span class="dot"></span>
      <span><span class="n">${esc(x.name)}</span>${i === info.index ? '<span class="pill">진행 중</span>' : ""}
      ${x.note ? `<span class="p">${esc(x.note)}</span>` : ""}</span></li>`;
  }).join("");
}

// ---------- 설정: 이번 주 알바 ----------
function renderShiftPicker() {
  const cur = shiftFor(new Date(), settings);
  document.querySelectorAll("#shiftPick button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.shift === cur));
  });
}

// ---------- 설정: 알바 하는 요일 ----------
function renderWorkdays() {
  $("workdays").innerHTML = WEEK_ORDER.map((day) =>
    `<button class="day" data-day="${day}" aria-pressed="${settings.workdays[day]}">${DAY_NAMES[day]}</button>`,
  ).join("");
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

  $("shiftPick").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-shift]");
    if (!btn) return;
    saveSettings(setThisWeek(settings, new Date(), btn.dataset.shift));
    renderShiftPicker();
  });

  $("workdays").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-day]");
    if (!btn) return;
    const workdays = [...settings.workdays];
    workdays[btn.dataset.day] = !workdays[btn.dataset.day];
    saveSettings({ ...settings, workdays });
    renderWorkdays();
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
  renderShiftPicker();
  renderWorkdays();
  startEdit(shiftFor(new Date(), settings));
}
