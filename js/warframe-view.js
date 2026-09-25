// 워프레임 화면: 오늘 체크(출격·포르마), 오늘 할 일, 실시간 현황, 장비 목록, 메인 취미 카드의 워프레임 줄.
import { store } from "./store.js";
import { openSheet, closeSheet } from "./sheet.js";
import { chip } from "./wuwa-view.js";
import {
  DAILY, GEAR_FIELDS, DEFAULT_GEAR, dailyDone, toggleDaily, dailyCount, addTodo, toggleTodo, removeTodo, pruneTodos,
  leftTodos, isWish, addRow, updateRow, removeRow, addOther, removeOther, sortieView, invasionView, alertView, timeLeft,
} from "./warframe.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const LIVE_URL = "https://api.warframestat.us/pc/"; // 공식 worldState 는 브라우저에서 못 읽어서(CORS) 이걸 쓴다
const LIVE_MAX_AGE = 10 * 60e3; // 워프레임 쪽을 보고 있으면 10분마다 새로 받는다
const X_SVG = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';

let checks = store.load("wfChecks", {});
let todos = store.load("wfTodos", []);
let gear = store.load("wfGear", DEFAULT_GEAR);
let live = store.load("wfLive", { at: 0, sortie: null, invasions: [], alerts: [] });
let loading = false;
let liveFailed = false;
let editing = null; // 고치고 있는 장비 줄 id

const pct = (c) => `${(c.done / c.total) * 100}%`;
const wfOpen = () => !$("screen-hobby").hidden && !$("hobby-wf").hidden;

// ---------- 오늘 체크 (메인 카드와 워프레임 쪽이 같이 쓴다) ----------
function renderChecks() {
  const now = new Date();
  const done = dailyDone(checks, now);
  const c = dailyCount(checks, now);
  const html = DAILY.map((d) => chip(`data-wf-daily="${d.id}"`, d.label, done[d.id])).join("");
  for (const [count, list] of [["wfMainCount", "wfMainDaily"], ["wfDailyCount", "wfDaily"]]) {
    $(count).textContent = `${c.done} / ${c.total}`;
    $(list).innerHTML = html;
  }
  $("wfDailyBar").style.width = pct(c);
  renderHub();
}

// 취미 탭 첫 화면의 워프레임 카드
function renderHub() {
  const c = dailyCount(checks, new Date());
  const left = leftTodos(todos);
  $("hubWfSub").textContent = `오늘 ${c.done} / ${c.total}${left ? ` · 할 일 ${left}개 남음` : ""}`;
  $("hubWfBar").style.width = pct(c);
}

function onCheckClick(e) {
  const b = e.target.closest("[data-wf-daily]");
  if (!b) return;
  checks = toggleDaily(checks, new Date(), b.dataset.wfDaily);
  store.save("wfChecks", checks);
  renderChecks();
}

// ---------- 오늘 할 일 ----------
function renderTodos() {
  const kept = pruneTodos(todos, new Date()); // 새벽 1시가 지나면 체크한 것만 사라진다
  if (kept.length !== todos.length) store.save("wfTodos", (todos = kept));
  $("wfTodos").innerHTML = todos.map((t) => `<li>
    ${chip(`data-todo="${t.id}"`, t.text, t.done)}
    <button class="icon-btn del" data-del-todo="${t.id}" aria-label="${esc(t.text)} 지우기">${X_SVG}</button>
  </li>`).join("");
  $("wfTodoLeft").textContent = todos.length ? `남은 일 ${leftTodos(todos)}` : "";
  renderHub();
}

// ---------- 실시간 현황 ----------
function ago(at) {
  const m = Math.floor((Date.now() - at) / 60e3);
  if (m < 1) return "방금";
  return m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 전`;
}

function renderLive() {
  const now = new Date();
  $("wfLiveMsg").textContent = loading ? "받는 중…"
    : liveFailed ? (live.at ? `새로 못 받았어. ${ago(live.at)} 정보야.` : "현황을 못 받았어. 인터넷이 되면 '새로 받기' 를 눌러 줘.")
    : live.at ? `${ago(live.at)} 받음` : "";
  if (!live.at) { $("wfLive").innerHTML = ""; return; }

  const s = sortieView(live.sortie, now);
  const sortie = s
    ? `<section><h3><span>출격 · ${esc(s.boss)}${s.faction ? ` (${esc(s.faction)})` : ""}</span><span class="mono">${timeLeft(s.left)} 남음</span></h3>
        <ol>${s.missions.map((m, i) => `<li><b>${i + 1}. ${esc(m.type)}</b><span class="sub">${esc(m.node)}</span>${m.modifier ? `<span class="sub">${esc(m.modifier)}</span>` : ""}</li>`).join("")}</ol></section>`
    : '<section><h3><span>출격</span></h3><p class="empty">새 출격을 기다리는 중이야.</p></section>';

  const hits = [
    ...alertView(live.alerts, now).map((a) => `<li><b>${esc(a.reward)}</b>
      <span class="sub">얼럿 · ${esc(a.type)} · ${esc(a.node)}${a.faction ? ` · ${esc(a.faction)}` : ""} · ${timeLeft(a.left)} 남음</span></li>`),
    ...invasionView(live.invasions).map((v) => `<li><b>${esc(v.reward)}</b>
      <span class="sub">침공 · ${esc(v.node)} · ${esc(v.side)} 편을 도우면</span></li>`),
  ];
  const reward = `<section><h3><span>오로킨 리액터 · 카탈리스트</span></h3>${hits.length
    ? `<ul>${hits.join("")}</ul>` : '<p class="empty">지금 주는 침공·얼럿이 없어.</p>'}</section>`;

  $("wfLive").innerHTML = sortie + reward;
}

async function loadLive(force = false) {
  if (loading || (!force && Date.now() - live.at < LIVE_MAX_AGE)) return;
  loading = true;
  renderLive();
  const get = (part) => fetch(`${LIVE_URL}${part}`).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
  try {
    const [sortie, invasions, alerts] = await Promise.all([get("sortie"), get("invasions"), get("alerts")]);
    live = { at: Date.now(), sortie, invasions, alerts };
    store.save("wfLive", live);
    liveFailed = false;
  } catch {
    liveFailed = true;
  } finally {
    loading = false;
    renderLive();
  }
}

// ---------- 장비 목록 ----------
const SLOTS = GEAR_FIELDS.slice(2); // 주무기 · 보조무기 · 근접무기 · 동반자

function renderGear() {
  $("wfGear").innerHTML = gear.rows.map((r) => {
    const filled = GEAR_FIELDS.some(([k]) => r[k]);
    const slots = SLOTS.filter(([k]) => r[k]).map(([k, label]) => `<span class="k">${label}</span><span>${esc(r[k])}</span>`).join("");
    return `<li><button class="gear-row${isWish(r) ? " wish" : ""}" data-gear="${esc(r.id)}">
      <span class="gear-top"><span class="style">${esc(r.style || "이름 없는 줄")}</span>${r.frame ? `<b>${esc(r.frame)}</b>` : ""}${r.sortie ? `<span class="tag">${esc(r.sortie)}</span>` : ""}</span>
      ${filled ? (slots ? `<span class="gear-slots">${slots}</span>` : "") : '<span class="empty">비어 있어. 눌러서 채워 봐.</span>'}
    </button></li>`;
  }).join("");
  $("wfOthers").innerHTML = gear.others.map((n, i) =>
    `<li><span>${esc(n)}</span><button data-del-other="${i}" aria-label="${esc(n)} 지우기">${X_SVG}</button></li>`).join("");
}

const saveGear = () => store.save("wfGear", gear);

function openGear(id) {
  const r = gear.rows.find((x) => x.id === id);
  if (!r) return;
  editing = id;
  $("gearTitle").textContent = r.style || "새 줄";
  $("gearForm").innerHTML = [["style", "플레이스타일"], ...GEAR_FIELDS].map(([k, label]) =>
    `<label><span>${label}</span><input class="field" name="${k}" value="${esc(r[k])}" maxlength="30"></label>`).join("");
  openSheet("gearSheet");
}

// ---------- 시작 ----------
export function renderWarframe() {
  renderChecks();
  renderTodos();
  if (wfOpen()) {
    renderLive(); // 출격 남은 시간·'n분 전' 을 분마다 맞춘다
    const s = live.sortie;
    const sortieOver = s && new Date(s.expiry) <= new Date() && Date.now() - live.at > 60e3;
    loadLive(sortieOver); // 10분이 지났거나 출격이 바뀌었으면 새로 받는다
  }
}

export function startWarframe() {
  renderChecks();
  renderTodos();
  renderGear();
  for (const id of ["wwMainCard", "wfTodayCard"]) $(id).addEventListener("click", onCheckClick);

  document.addEventListener("hobby-open", (e) => {
    if (e.detail !== "wf") return;
    renderLive();
    loadLive();
  });
  $("wfRefresh").addEventListener("click", () => loadLive(true));

  $("wfTodoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    todos = addTodo(todos, $("wfTodoInput").value);
    store.save("wfTodos", todos);
    $("wfTodoInput").value = "";
    renderTodos();
  });
  $("wfTodos").addEventListener("click", (e) => {
    const t = e.target.closest("[data-todo]");
    const del = e.target.closest("[data-del-todo]");
    if (t) todos = toggleTodo(todos, new Date(), t.dataset.todo);
    else if (del) todos = removeTodo(todos, del.dataset.delTodo);
    else return;
    store.save("wfTodos", todos);
    renderTodos();
  });

  $("wfGear").addEventListener("click", (e) => {
    const b = e.target.closest("[data-gear]");
    if (b) openGear(b.dataset.gear);
  });
  $("wfAddRow").addEventListener("click", () => {
    gear = addRow(gear);
    saveGear();
    renderGear();
    openGear(gear.rows.at(-1).id);
  });
  $("gearForm").addEventListener("input", (e) => {
    gear = updateRow(gear, editing, { [e.target.name]: e.target.value });
    saveGear();
    renderGear();
    if (e.target.name === "style") $("gearTitle").textContent = e.target.value.trim() || "새 줄";
  });
  $("gearForm").addEventListener("submit", (e) => e.preventDefault());
  $("gearRemove").addEventListener("click", () => {
    const r = gear.rows.find((x) => x.id === editing);
    if (!r || !confirm(`'${r.style || "이 줄"}' 줄을 지울까?`)) return;
    gear = removeRow(gear, editing);
    saveGear();
    closeSheet();
    renderGear();
  });

  $("wfOtherForm").addEventListener("submit", (e) => {
    e.preventDefault();
    gear = addOther(gear, $("wfOtherInput").value);
    saveGear();
    $("wfOtherInput").value = "";
    renderGear();
  });
  $("wfOthers").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del-other]");
    if (!b) return;
    gear = removeOther(gear, Number(b.dataset.delOther));
    saveGear();
    renderGear();
  });
}
