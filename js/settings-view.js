// 설정 창: 항목 목록 → 눌러서 그 항목 화면으로 (v1.9).
// 항목 화면 안의 입력칸·버튼은 원래 파일(schedule-view · calendar-view 등)이 그대로 맡고, 여기서는 목록과 오가는 것만 한다.
import { ICON } from "./icons.js";
import { SHIFTS, dayPlan } from "./schedule.js";
import { getScheduleSettings, openScheduleSettings } from "./schedule-view.js";
import { calendarOn, openCalendarSettings } from "./calendar-view.js";
import { hobbySyncState, openHobbySyncSettings } from "./hobby-sync-view.js";
import { libraryCount } from "./library-view.js";
import { backupState } from "./backup-view.js";
import { openSheet } from "./sheet.js";
import { $, esc } from "./dom.js";

// 묶음과 항목. id 는 index.html 의 항목 화면(set-<id>), state 는 줄 오른쪽의 짧은 상태
const GROUPS = [
  { title: "기록", items: [
    { id: "lib", label: "라이브러리", icon: "bookOpen", state: () => `${libraryCount()}개` },
  ] },
  { title: "알바", items: [
    { id: "shift", label: "요일별 알바", icon: "calendarDays", state: todayShift },
    { id: "rows", label: "일과표 고치기", icon: "listOrdered", state: () => "" },
  ] },
  { title: "연결", items: [
    { id: "cal", label: "캘린더 알바 연결", icon: "calendarSync", state: () => (calendarOn() ? "연결됨" : "안 됨") },
    { id: "hs", label: "기록 시트 연결", icon: "sheet", state: hobbySyncState },
  ] },
  { title: "보관", items: [
    { id: "backup", label: "데이터 백업", icon: "archive", state: backupState },
  ] },
];
const ITEMS = GROUPS.flatMap((g) => g.items);
// 설정 목록 줄의 짧은 상태: '오늘 오픈반' / '오늘 쉬는 날' (캘린더에 알바가 적힌 날은 캘린더대로)
function todayShift() {
  const plan = dayPlan(new Date(), getScheduleSettings());
  return `오늘 ${plan.working ? SHIFTS[plan.shift].label : "쉬는 날"}`;
}

let page = null;    // 보고 있는 항목 (null = 목록)
let listScroll = 0; // 항목에 들어가기 전 목록을 어디까지 내렸는지
const sheet = () => $("settings").querySelector(".sheet");

function renderList() {
  $("setGroups").innerHTML = GROUPS.map((g) => `<section class="set-group" aria-label="${g.title}">
    <h3>${g.title}</h3>
    <div class="set-rows">${g.items.map((it) => `<button class="set-row" data-set="${it.id}">
      <span class="set-ic">${ICON[it.icon]}</span><span class="set-name">${it.label}</span>
      <span class="set-state">${esc(it.state())}</span>${ICON.chevronRight}</button>`).join("")}</div>
  </section>`).join("");
}

function show(id) {
  const it = ITEMS.find((x) => x.id === id);
  page = it ? it.id : null;
  $("setList").hidden = Boolean(page);
  $("settingsTitle").hidden = Boolean(page);
  $("setBack").hidden = !page;
  $("setTitle").hidden = !page;
  $("setTitle").textContent = it?.label ?? "";
  for (const x of ITEMS) $(`set-${x.id}`).hidden = x.id !== page;
}

function goTo(id) {
  listScroll = sheet().scrollTop;
  $("setList").classList.remove("back");
  show(id);
  sheet().scrollTop = 0;
  $("setBack").focus();
  document.dispatchEvent(new CustomEvent("settings-page", { detail: id })); // 그 화면이 최신 값으로 다시 그린다
}

function goBack() {
  const from = page;
  renderList(); // 항목 화면에서 바꾼 상태(연결됨 등)를 목록에 바로
  $("setList").classList.add("back");
  show(null);
  sheet().scrollTop = listScroll;
  $("setGroups").querySelector(`[data-set="${from}"]`)?.focus();
}

// 톱니를 누를 때마다: 항목 화면들을 최신 값으로 채우고, 늘 목록부터 (to 를 주면 그 항목 화면으로 바로)
export function openSettings(to) {
  openScheduleSettings();
  openCalendarSettings();
  openHobbySyncSettings();
  renderList();
  $("setList").classList.remove("back");
  show(null);
  openSheet("settings");
  if (to) goTo(to);
}

export function startSettings() {
  $("appVersion").textContent = `앱 버전 ${self.APP_VERSION}`;
  $("setBack").innerHTML = `${ICON.chevronLeft}<span>설정</span>`;
  $("openSettings").addEventListener("click", () => openSettings());
  document.addEventListener("open-settings", (e) => openSettings(e.detail)); // 메인의 백업 안내 등
  $("setGroups").addEventListener("click", (e) => {
    const b = e.target.closest("[data-set]");
    if (b) goTo(b.dataset.set);
  });
  $("setBack").addEventListener("click", goBack);
}
