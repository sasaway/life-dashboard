// 워프레임 화면: 위 [오늘 · 장비] 전환. 오늘 = 오늘 체크(출격·포르마)·할 일·실시간 현황, 장비 = 장비 목록. 메인 취미 카드의 워프레임 줄.
import { store } from "./store.js";
import { noteHobby } from "./hobby-log-view.js";
import { openSheet, closeSheet } from "./sheet.js";
import { chip } from "./wuwa-view.js";
import {
  DAILY, PLAYSTYLES, SORTIE_TYPES, GEAR_FIELDS, DEFAULT_GEAR, dailyDone, toggleDaily, dailyCount, addTodo, toggleTodo,
  removeTodo, moveTodo, pruneTodos, leftTodos, migrateGear, addFrame, updateFrame, toggleStyle, setSortie, toggleWish, removeFrame, isBlankFrame,
  addOther, removeOther, sortieView, invasionView, alertView, timeLeft,
  gearItems, buildOf, setBuild, MAX_FORMA,
  liveDue, liveAtLabel,
} from "./warframe.js";
import { $, esc, X_SVG } from "./dom.js";
import { ICON } from "./icons.js";
import { markSyncDirty } from "./hobby-sync-view.js";

const LIVE_URL = "https://api.warframestat.us/pc/"; // 공식 worldState 는 브라우저에서 못 읽어서(CORS) 이걸 쓴다

let checks = store.load("wfChecks", {});
let todos = store.load("wfTodos", []);
const savedGear = store.load("wfGear", DEFAULT_GEAR);
let gear = migrateGear(savedGear); // v16 의 플레이스타일 줄 형식이면 워프레임 기준으로 옮긴다
if (gear !== savedGear) store.save("wfGear", gear); // 옮긴 건 한 번 저장해 둔다
let live = store.load("wfLive", { at: 0, sortie: null, invasions: [], alerts: [] });
// 모딩 페이지는 v1.4 에서 없앴다. 폰에 남은 모딩 기록은 지운다 (은월 결정, 2026-09-26)
store.remove("wfMods");
store.remove("wfModSel");
let loading = false;
let liveFailed = false;
let editing = null; // 고치고 있는 워프레임 id

const pct = (c) => `${(c.done / c.total) * 100}%`;
// 실시간 현황은 워프레임 쪽 '오늘' 을 보고 있을 때만 새로 받는다
const wfOpen = () => !$("screen-hobby").hidden && !$("hobby-wf").hidden && !$("wf-page-today").hidden;

// ---------- 오늘 체크 (워프레임 쪽 '오늘') ----------
function renderChecks() {
  const now = new Date();
  const done = dailyDone(checks, now);
  const c = dailyCount(checks, now);
  $("wfDailyCount").textContent = `${c.done} / ${c.total}`;
  $("wfDaily").innerHTML = DAILY.map((d) => chip(`data-wf-daily="${d.id}"`, d.label, done[d.id])).join("");
  $("wfDailyBar").style.width = pct(c);
  renderHub();
  noteHobby(now); // 주간리뷰용 취미 기록 (v2.2.2)
}

// 취미 탭 첫 화면의 워프레임 카드: 오늘 진행도 + '오늘' · '장비' 버튼
function renderHub() {
  const c = dailyCount(checks, new Date());
  const left = leftTodos(todos);
  $("hubWfCount").textContent = `오늘 ${c.done} / ${c.total}`;
  $("hubWfBar").style.width = pct(c);
  $("hubWfToday").textContent = left ? `체크 ${c.done}/${c.total} · 할 일 ${left}개` : `체크 ${c.done}/${c.total} · 실시간 현황`;
  const frames = gear.frames.filter((f) => !f.wish).length;
  $("hubWfGear").textContent = `워프레임 ${frames} · 그 외 무기 ${gear.others.length}`;
}

function onCheckClick(e) {
  const b = e.target.closest("[data-wf-daily]");
  if (!b) return;
  checks = toggleDaily(checks, new Date(), b.dataset.wfDaily);
  store.save("wfChecks", checks);
  renderChecks();
  markSyncDirty(); // 기록 시트에도 (renderChecks 가 취미 기록을 적은 뒤에)
}

// ---------- 오늘 할 일 ----------
function renderTodos() {
  if (drag) return; // 끄는 중에는 줄을 다시 그리지 않는다 (분마다 도는 갱신이 끌던 줄을 놓치게 하지 않게)
  const kept = pruneTodos(todos, new Date()); // 새벽 1시가 지나면 체크한 것만 사라진다
  if (kept.length !== todos.length) store.save("wfTodos", (todos = kept));
  $("wfTodos").innerHTML = todos.map((t) => `<li data-row="${t.id}">
    <button class="todo-grip" data-grip="${t.id}" aria-label="${esc(t.text)} 순서 바꾸기. 누른 채 끌거나 위아래 화살표 키">${ICON.grip}</button>
    ${chip(`data-todo="${t.id}"`, t.text, t.done)}
    <button class="icon-btn del" data-del-todo="${t.id}" aria-label="${esc(t.text)} 지우기">${X_SVG}</button>
  </li>`).join("");
  $("wfTodoLeft").textContent = todos.length ? `남은 일 ${leftTodos(todos)}` : "";
  renderHub();
}

// 순위 바꾸기 (v3.3): 손잡이를 누른 채 위아래로 끈다. 끄는 동안 줄이 따라 움직이고, 놓은 자리로 저장한다.
// 포인터는 목록(ul)이 잡는다 — 줄을 옮겨 붙여도 놓치지 않게. 손잡이는 touch-action: none 이라 화면이 같이 밀리지 않는다
let drag = null; // { id, li, pointer }
function saveTodos() {
  store.save("wfTodos", todos);
  markSyncDirty();
  renderTodos();
}
function endDrag(keep) {
  if (!drag) return;
  const { id, li, pointer } = drag;
  const index = [...$("wfTodos").children].indexOf(li);
  li.classList.remove("dragging");
  if ($("wfTodos").hasPointerCapture?.(pointer)) $("wfTodos").releasePointerCapture(pointer);
  drag = null;
  if (keep) todos = moveTodo(todos, id, index);
  saveTodos();
}
function startTodoDrag() {
  const list = $("wfTodos");
  list.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest("[data-grip]");
    if (!grip || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    drag = { id: grip.dataset.grip, li: grip.closest("li"), pointer: e.pointerId };
    drag.li.classList.add("dragging");
    list.setPointerCapture(e.pointerId);
  });
  list.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    // 손가락보다 아래에 있는 첫 줄 앞으로 (없으면 맨 아래)
    const before = [...list.children].find((x) => {
      if (x === drag.li) return false;
      const r = x.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (before) { if (drag.li.nextElementSibling !== before) list.insertBefore(drag.li, before); }
    else if (list.lastElementChild !== drag.li) list.appendChild(drag.li);
  });
  list.addEventListener("pointerup", (e) => { if (drag && e.pointerId === drag.pointer) endDrag(true); });
  list.addEventListener("pointercancel", (e) => { if (drag && e.pointerId === drag.pointer) endDrag(false); });
  // 키보드: 손잡이에서 ↑ ↓ 로 한 칸씩
  list.addEventListener("keydown", (e) => {
    const grip = e.target.closest("[data-grip]");
    const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!grip || !step) return;
    e.preventDefault();
    const id = grip.dataset.grip;
    todos = moveTodo(todos, id, todos.findIndex((t) => t.id === id) + step);
    saveTodos();
    list.querySelector(`[data-grip="${CSS.escape(id)}"]`)?.focus();
  });
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
    : live.at ? `${ago(live.at)} 받음 · 매일 ${liveAtLabel} 에 새로 받아` : "";
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
  if (loading || (!force && !liveDue(live.at, new Date()))) return; // 하루 한 번, 아침 브리핑 시각에 (그 사이엔 '새로 받기')
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

// ---------- 장비 목록 (워프레임 기준) ----------
// v3.3: 카드마다 장비 줄(워프레임 · 주무기 · 보조 · 근접 · 동반자 중 이름이 적힌 것) — 줄을 누르면 그 장비의 육성 칸이 펼쳐진다 (한 번에 하나, 명조 육성 줄과 같은 부품).
// 이름 · 플레이스타일을 고치는 창은 카드 머리의 [고치기] 로 연다
let openBuild = null; // 펼친 장비 줄의 열쇠 ("워프레임id:자리" · "o:그 외 무기 이름")

function buildRow(x) {
  const open = openBuild === x.key;
  const b = x.build;
  const sub = `${esc(x.label)}${x.sortie ? ` · <span class="tag">${esc(x.sortie)}</span>` : ""}${b.forma ? ` · 포르마 ${b.forma}` : ""}`;
  return `<li class="grow-item${open ? " open" : ""}">
    <button class="grow-h gear-h" data-build-open="${esc(x.key)}" aria-expanded="${open}">
      <span class="who"><b>${esc(x.name)}</b><span class="sub">${sub}</span></span>
      <span class="mono grow-cnt${x.pct === 100 ? " done" : ""}" aria-label="육성 ${x.pct}%">${x.pct}%</span>
      <span class="chev">${ICON.chevronDown}</span>
    </button>
    ${open ? `<div class="grow-body">
      <div class="meter"><i style="width:${x.pct}%"></i></div>
      <div class="build">
        ${chip(`data-build-flag="cat" data-key="${esc(x.key)}"`, `${x.cat} 장착`, b.cat, true)}
        ${chip(`data-build-flag="done" data-key="${esc(x.key)}"`, "모딩 완료", b.done, true)}
      </div>
      <label class="gear-goal"><span>목표 모딩</span>
        <input class="field" data-build-goal="${esc(x.key)}" value="${esc(b.goal)}" maxlength="40" placeholder="예: 부식 세팅" autocomplete="off"></label>
      <div class="gear-forma"><span>쓴 포르마</span>
        <div class="gc-step" role="group" aria-label="${esc(x.name)} 포르마 수">
          <button data-forma="-1" data-key="${esc(x.key)}" aria-label="포르마 하나 빼기"${b.forma <= 0 ? " disabled" : ""}>−</button>
          <span class="mono">${b.forma}</span>
          <button data-forma="1" data-key="${esc(x.key)}" aria-label="포르마 하나 더하기"${b.forma >= MAX_FORMA ? " disabled" : ""}>+</button>
        </div></div>
      ${x.slot === "other" ? `<button class="btn btn-text gear-del" data-del-other="${x.index}">'${esc(x.name)}' 목록에서 지우기</button>` : ""}
    </div>` : ""}
  </li>`;
}

function renderGear() {
  const items = gearItems(gear);
  if (openBuild && !items.some((x) => x.key === openBuild)) openBuild = null;
  // 위시리스트(구매할 예정)는 맨 아래로
  const list = [...gear.frames.filter((f) => !f.wish), ...gear.frames.filter((f) => f.wish)];
  $("wfGear").innerHTML = list.map((f) => {
    const rows = items.filter((x) => x.frameId === f.id);
    const styles = f.styles.map((st) => `<span class="tag">${esc(st)}</span>`).join("");
    return `<li class="gear-row${f.wish ? " wish" : ""}">
      <div class="gear-top"><b>${esc(f.frame || "이름 없는 워프레임")}</b>${f.wish ? '<span class="sub">위시리스트 · 구매 예정</span>' : ""}
        <button class="btn btn-text gear-edit" data-gear="${esc(f.id)}" aria-label="${esc(f.frame || "이름 없는 워프레임")} 고치기">고치기</button></div>
      ${styles ? `<div class="gear-styles">${styles}</div>` : ""}
      ${rows.length ? `<ul class="grow">${rows.map(buildRow).join("")}</ul>` : '<p class="empty">비어 있어. 고치기를 눌러 채워 봐.</p>'}
    </li>`;
  }).join("");
  $("wfOthers").innerHTML = items.filter((x) => x.slot === "other").map(buildRow).join("");
  renderHub();
}

// 장비 줄 누르기: 펼치기 · 체크 두 칸 · 포르마 − / + · (그 외 무기) 지우기
function onBuildClick(e) {
  const open = e.target.closest("[data-build-open]");
  const flag = e.target.closest("[data-build-flag]");
  const forma = e.target.closest("[data-forma]");
  const del = e.target.closest("[data-del-other]");
  if (open) {
    openBuild = openBuild === open.dataset.buildOpen ? null : open.dataset.buildOpen;
    renderGear();
    return document.querySelector(`[data-build-open="${CSS.escape(open.dataset.buildOpen)}"]`)?.focus();
  }
  let focus = "";
  if (flag) {
    const { key, buildFlag } = flag.dataset;
    gear = setBuild(gear, key, { [buildFlag]: !buildOf(gear, key)[buildFlag] });
    focus = `[data-build-flag="${buildFlag}"][data-key="${CSS.escape(key)}"]`;
  } else if (forma) {
    const { key } = forma.dataset;
    gear = setBuild(gear, key, { forma: buildOf(gear, key).forma + Number(forma.dataset.forma) });
    focus = `[data-forma="${forma.dataset.forma}"][data-key="${CSS.escape(key)}"]`;
  } else if (del) {
    gear = removeOther(gear, Number(del.dataset.delOther));
  } else return;
  saveGear();
  renderGear();
  if (focus) document.querySelector(focus)?.focus();
}
// 목표 모딩 글: 쓰는 대로 저장하고 줄은 다시 그리지 않는다 (쓰던 자리가 안 튀게)
function onBuildInput(e) {
  const key = e.target.dataset.buildGoal;
  if (!key) return;
  gear = setBuild(gear, key, { goal: e.target.value });
  saveGear();
}

// 저장할 때마다 기록 시트에도 (연결했으면)
const saveGear = () => { store.save("wfGear", gear); markSyncDirty(); };
const editingFrame = () => gear.frames.find((x) => x.id === editing);
const field = (k, label, f) =>
  `<label><span>${label}</span><input class="field" name="${k}" value="${esc(f[k])}" maxlength="30"></label>`;

// 고르는 칸(체크 칩)만 다시 그린다 — 글자 칸은 그대로 두어 쓰던 자리가 안 튄다
function renderGearChips() {
  const f = editingFrame();
  $("gearStyles").innerHTML = PLAYSTYLES.map((st) => chip(`type="button" data-style="${st}"`, st, f.styles.includes(st), true)).join("");
  $("gearSortie").innerHTML = SORTIE_TYPES.map((t) => chip(`type="button" data-sortie="${t}"`, t, f.sortie === t, true)).join("");
  $("gearWish").innerHTML = chip('type="button" data-wish', "위시리스트 (구매할 예정)", f.wish, true);
}

function openGear(id) {
  const f = gear.frames.find((x) => x.id === id);
  if (!f) return;
  editing = id;
  $("gearTitle").textContent = f.frame || "새 워프레임";
  $("gearForm").innerHTML = `
    ${field("frame", "워프레임", f)}
    <div class="gear-pick"><span>플레이스타일 <small>여러 개 가능</small></span><div class="checks" id="gearStyles"></div></div>
    ${field("primary", "주무기", f)}
    <div class="gear-pick"><span>Sortie 분류 <small>하나만</small></span><div class="checks" id="gearSortie"></div></div>
    ${GEAR_FIELDS.slice(1).map(([k, label]) => field(k, label, f)).join("")}
    <div class="checks" id="gearWish"></div>`;
  renderGearChips();
  openSheet("gearSheet");
}

// 워프레임 쪽 위 [오늘 · 장비] 전환 (명조 [오늘 · 파티표] 와 같게)
function showWfPage(page) {
  for (const p of ["today", "gear"]) $(`wf-page-${p}`).hidden = p !== page;
  $("wfPick").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.page === page)));
  if (page === "today") {
    renderLive();
    loadLive();
  }
}

// ---------- 시작 ----------
export function renderWarframe() {
  renderChecks();
  renderTodos();
  if (wfOpen()) {
    renderLive(); // 출격 남은 시간·'n분 전' 을 분마다 맞춘다
    loadLive();   // 아침 브리핑 시각이 지났으면 새로 받는다
  }
}

export function startWarframe() {
  renderChecks();
  renderTodos();
  renderGear();
  $("wfTodayCard").addEventListener("click", onCheckClick);

  document.addEventListener("hobby-open", (e) => {
    if (e.detail !== "wf" || !wfOpen()) return;
    renderLive();
    loadLive();
  });
  $("wfPick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (b) showWfPage(b.dataset.page);
  });
  $("wfRefresh").addEventListener("click", () => loadLive(true));

  $("wfTodoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    todos = addTodo(todos, $("wfTodoInput").value);
    store.save("wfTodos", todos);
    markSyncDirty();
    $("wfTodoInput").value = "";
    renderTodos();
  });
  $("wfTodos").addEventListener("click", (e) => {
    const t = e.target.closest("[data-todo]");
    const del = e.target.closest("[data-del-todo]");
    if (t) todos = toggleTodo(todos, new Date(), t.dataset.todo);
    else if (del) todos = removeTodo(todos, del.dataset.delTodo);
    else return;
    saveTodos();
  });
  startTodoDrag();

  $("wfGear").addEventListener("click", (e) => {
    const b = e.target.closest("[data-gear]");
    if (b) openGear(b.dataset.gear);
    else onBuildClick(e);
  });
  $("wfGear").addEventListener("input", onBuildInput);
  $("wfOthers").addEventListener("click", onBuildClick);
  $("wfOthers").addEventListener("input", onBuildInput);
  $("wfAddRow").addEventListener("click", () => {
    gear = addFrame(gear);
    saveGear();
    renderGear();
    openGear(gear.frames.at(-1).id);
  });
  $("gearForm").addEventListener("input", (e) => {
    gear = updateFrame(gear, editing, { [e.target.name]: e.target.value });
    saveGear();
    renderGear();
    if (e.target.name === "frame") $("gearTitle").textContent = e.target.value.trim() || "새 워프레임";
  });
  $("gearForm").addEventListener("click", (e) => {
    const st = e.target.closest("[data-style]");
    const so = e.target.closest("[data-sortie]");
    if (st) gear = toggleStyle(gear, editing, st.dataset.style);
    else if (so) gear = setSortie(gear, editing, so.dataset.sortie);
    else if (e.target.closest("[data-wish]")) gear = toggleWish(gear, editing);
    else return;
    saveGear();
    renderGear();
    renderGearChips();
  });
  $("gearForm").addEventListener("submit", (e) => e.preventDefault());
  $("gearRemove").addEventListener("click", () => {
    const f = editingFrame();
    if (!f || !confirm(`'${f.frame || "이 워프레임"}' 을(를) 목록에서 지울까?`)) return;
    gear = removeFrame(gear, editing);
    saveGear();
    closeSheet();
    renderGear();
  });

  // '워프레임 추가' 후 아무것도 안 적고 닫으면 빈 카드를 남기지 않는다
  document.addEventListener("sheet-close", (e) => {
    const f = editingFrame();
    if (e.detail !== "gearSheet" || !f || !isBlankFrame(f)) return;
    gear = removeFrame(gear, editing);
    saveGear();
    renderGear();
  });

  $("wfOtherForm").addEventListener("submit", (e) => {
    e.preventDefault();
    gear = addOther(gear, $("wfOtherInput").value);
    saveGear();
    $("wfOtherInput").value = "";
    renderGear();
  });
}
