// 명조 화면: 취미 탭 [오늘 · 육성 · 파티] (워프레임 [오늘 · 모딩] 처럼), 메인 취미 카드, 캐릭터 고르기 창.
import { store } from "./store.js";
import { openSheet, closeSheet } from "./sheet.js";
import {
  DAILY, WEEKLY, BUILD, PARTY_SIZE, dailyDone, weeklyDone, toggleDaily, tapWeekly, dailyCount, weeklyCount,
  cleanCharacters, ELEMENTS, elementKey, filterCharacters, addParty, renameParty, removeParty, placeCharacter,
  clearSlot, whereIs, partyMembers, filledCount, toggleBuild, buildCount,
} from "./wuwa.js";
import { $, esc } from "./dom.js";
import { ICON } from "./icons.js";

const CHARS_URL = "https://api.encore.moe/ko/character";
const CHARS_MAX_AGE = 7 * 864e5; // 일주일마다 새 캐릭터를 확인한다

let checks = store.load("wuwaChecks", {});
let parties = store.load("wuwaParties", []);
let builds = store.load("wuwaBuilds", {});
let chars = store.load("wuwaChars", { at: 0, list: [] });

const saveChecks = () => store.save("wuwaChecks", checks);
const saveParties = () => store.save("wuwaParties", parties) && store.save("wuwaBuilds", builds);
const charById = (id) => chars.list.find((c) => c.id === id);

const CHECK_SVG = '<svg viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3 4.7-5"/></svg>';
// 체크 칩 (시안 .chk) — 워프레임 화면도 같이 쓴다
export const chip = (attr, label, on, small = false) =>
  `<button class="chk${small ? " small" : ""}" ${attr} aria-pressed="${Boolean(on)}"><span class="box">${CHECK_SVG}</span><span class="lbl">${esc(label)}</span></button>`;
const bossBoxes = (n) => [1, 2, 3].map((i) =>
  `<button data-weekly="boss" data-n="${i}" aria-pressed="${n >= i}" aria-label="주간보스 ${i}회"></button>`).join("");

// ---------- 체크리스트 (메인 카드와 취미 탭이 같이 쓴다) ----------
function renderChecks() {
  const now = new Date();
  const dd = dailyDone(checks, now);
  const wd = weeklyDone(checks, now);
  const dc = dailyCount(checks, now);
  const wc = weeklyCount(checks, now);
  const dailyHtml = DAILY.map((d) => chip(`data-daily="${d.id}"`, d.label, dd[d.id])).join("");

  for (const [count, bar, list] of [["wwMainCount", "wwMainBar", "wwMainDaily"], ["wwDailyCount", "wwDailyBar", "wwDaily"]]) {
    $(count).textContent = `${dc.done} / ${dc.total}`;
    $(bar).style.width = `${(dc.done / dc.total) * 100}%`;
    $(list).innerHTML = dailyHtml;
  }
  $("wwMainBoss").innerHTML = `주간보스 ${bossBoxes(wd.boss ?? 0)}`;

  // 취미 탭 첫 화면의 명조 카드
  $("hubWwSub").textContent = `오늘 ${dc.done} / ${dc.total} · 이번 주 ${wc.done} / ${wc.total}`;
  $("hubWwBar").style.width = `${(dc.done / dc.total) * 100}%`;

  $("wwWeeklyCount").textContent = `${wc.done} / ${wc.total}`;
  $("wwWeeklyBar").style.width = `${(wc.done / wc.total) * 100}%`;
  $("wwWeekly").innerHTML = WEEKLY.map((w) => (w.max > 1
    ? `<div class="boss">${esc(w.label)} ${bossBoxes(wd[w.id] ?? 0)}</div>`
    : chip(`data-weekly="${w.id}" data-n="1"`, w.label, wd[w.id]))).join("");
}

function onCheckClick(e) {
  const now = new Date();
  const d = e.target.closest("[data-daily]");
  const w = e.target.closest("[data-weekly]");
  if (d) checks = toggleDaily(checks, now, d.dataset.daily);
  else if (w) checks = tapWeekly(checks, now, w.dataset.weekly, Number(w.dataset.n));
  else return;
  saveChecks();
  renderChecks();
}

// ---------- 공통: 얼굴 · 속성 ----------
const unknown = { name: "알 수 없는 캐릭터", element: "", stars: 0, icon: "" };
const face = (c, size) => (c.icon
  ? `<img class="face" src="${esc(c.icon)}" alt="" width="${size}" height="${size}" loading="lazy">`
  : `<span class="face noimg" style="width:${size}px;height:${size}px"></span>`);
// 속성: 색 점 + 글자 (색만으로 구분하지 않는다)
const elTag = (name) => (name
  ? `<span class="el"><i class="el-dot" data-el="${elementKey(name)}"></i>${esc(name)}</span>`
  : "");

// ---------- 파티 페이지 ----------
function slotHtml(p, i) {
  const id = p.slots[i];
  const no = `<span class="pt-no mono">${i + 1}</span>`;
  if (!id) {
    return `<li><button class="pt-slot empty" data-pick="${p.id}" data-idx="${i}" aria-label="${esc(p.name)} ${i + 1}번 칸에 캐릭터 넣기">
      ${no}<span class="pt-plus">${ICON.plus}</span><span class="pt-name">넣기</span></button></li>`;
  }
  const c = charById(id) ?? unknown;
  return `<li><button class="pt-slot" data-pick="${p.id}" data-idx="${i}" aria-label="${esc(p.name)} ${i + 1}번 칸 ${esc(c.name)}, 바꾸거나 빼기">
    ${no}${face(c, 52)}<span class="pt-name">${esc(c.name)}</span>${elTag(c.element)}</button></li>`;
}

function renderParties() {
  $("wwParties").innerHTML = parties.map((p) => `
    <section class="card party" aria-label="${esc(p.name)}">
      <div class="party-h">
        <input class="field party-name" data-rename="${p.id}" value="${esc(p.name)}" maxlength="20" aria-label="파티 이름">
        <span class="mono party-cnt" aria-label="${filledCount(p)}명 들어 있음">${filledCount(p)} / ${PARTY_SIZE}</span>
        <button class="icon-btn" data-remove-party="${p.id}" aria-label="${esc(p.name)} 지우기">${ICON.trash}</button>
      </div>
      <ol class="pt-slots">${Array.from({ length: PARTY_SIZE }, (_, i) => slotHtml(p, i)).join("")}</ol>
    </section>`).join("");
  $("wwPartiesEmpty").hidden = parties.length > 0;
  renderGrow();
}

// ---------- 육성 페이지: 파티에 넣은 캐릭터, 한 번에 한 명만 펼친다 ----------
let openGrow = null; // 펼친 캐릭터 id

function renderGrow() {
  const members = partyMembers(parties);
  if (openGrow && !members.some((m) => m.id === openGrow)) openGrow = null;
  const full = members.filter((m) => buildCount(builds, m.id) === BUILD.length).length;
  $("wwGrowCount").textContent = members.length ? `다 한 캐릭터 ${full} / ${members.length}` : "";
  $("wwGrow").innerHTML = members.map((m) => {
    const c = charById(m.id) ?? unknown;
    const n = buildCount(builds, m.id);
    const open = openGrow === m.id;
    return `<li class="grow-item${open ? " open" : ""}">
      <button class="grow-h" data-grow="${esc(m.id)}" aria-expanded="${open}">
        ${face(c, 40)}
        <span class="who"><b>${esc(c.name)}</b><span class="sub">${esc(m.partyName)} · ${m.idx + 1}번 ${elTag(c.element)}</span></span>
        <span class="mono grow-cnt${n === BUILD.length ? " done" : ""}">${n} / ${BUILD.length}</span>
        <span class="chev">${ICON.chevronDown}</span>
      </button>
      ${open ? `<div class="grow-body">
        <div class="meter"><i style="width:${(n / BUILD.length) * 100}%"></i></div>
        <div class="build">${BUILD.map((b) => chip(`data-build="${esc(m.id)}" data-key="${b.id}"`, b.label, builds[m.id]?.[b.id], true)).join("")}</div>
      </div>` : ""}
    </li>`;
  }).join("");
  $("wwGrowEmpty").hidden = members.length > 0;
}

// ---------- 캐릭터 고르기 ----------
let target = null; // { pid, idx }
let elFilter = ""; // "" = 전체

function renderFilters() {
  const btn = (name, label) =>
    `<button class="el-chip" data-el-filter="${esc(name)}" aria-pressed="${elFilter === name}">${name ? `<i class="el-dot" data-el="${elementKey(name)}"></i>` : ""}${esc(label)}</button>`;
  $("charFilters").innerHTML = btn("", "전체") + ELEMENTS.map((e) => btn(e.name, e.name)).join("");
}

function renderPicker() {
  const list = filterCharacters(chars.list, $("charSearch").value, elFilter);
  $("charCount").textContent = chars.list.length ? `${list.length}명` : "";
  $("charGrid").innerHTML = list.map((c) => {
    const at = whereIs(parties, c.id);
    const here = at && at.pid === target.pid && at.idx === target.idx;
    const away = at && !here;
    return `<li><button class="char${away ? " away" : ""}" data-char="${esc(c.id)}" aria-pressed="${Boolean(here)}">
      ${here ? `<span class="char-badge">${ICON.check}</span>` : ""}
      ${face(c, 56)}
      <span class="nm">${esc(c.name)}</span>
      <span class="sub">${away ? `${esc(at.name)} · ${at.idx + 1}번` : elTag(c.element)}</span>
    </button></li>`;
  }).join("");
  $("charEmpty").hidden = list.length > 0 || !chars.list.length;
}

function openPicker(pid, idx) {
  target = { pid, idx };
  const p = parties.find((x) => x.id === pid);
  const cur = p.slots[idx] ? (charById(p.slots[idx]) ?? unknown) : null;
  $("charTitle").textContent = `${p.name} · ${idx + 1}번 칸`;
  $("charNow").hidden = !cur;
  $("charNow").innerHTML = cur
    ? `${face(cur, 40)}<span class="who"><span class="sub">지금 이 칸</span><b>${esc(cur.name)}</b></span>
       <button class="btn btn-ghost" id="charClear"><span class="ic-wrap">${ICON.x}</span>빼기</button>`
    : "";
  $("charSearch").value = "";
  elFilter = "";
  renderFilters();
  renderPicker();
  openSheet("charSheet");
}

// 명조 쪽 위 [오늘 · 육성 · 파티] 전환 (워프레임 [오늘 · 모딩] 과 같게)
function showWwPage(page) {
  for (const p of ["today", "build", "party"]) $(`ww-page-${p}`).hidden = p !== page;
  $("wwPick").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.page === page)));
  if (page !== "today") loadCharacters();
}

// 캐릭터 목록: 저장된 게 일주일 넘었거나 없으면 encore.moe 에서 새로 받는다
async function loadCharacters() {
  if (chars.list.length && Date.now() - chars.at < CHARS_MAX_AGE) return;
  try {
    const res = await fetch(CHARS_URL);
    if (!res.ok) throw new Error(res.status);
    chars = { at: Date.now(), list: cleanCharacters((await res.json()).roleList ?? []) };
    store.save("wuwaChars", chars);
    $("wwCharsMsg").textContent = "";
    renderParties();
  } catch {
    $("wwCharsMsg").textContent = chars.list.length
      ? ""
      : "캐릭터 목록을 못 받았어. 인터넷이 되면 다시 받아 올게.";
  }
}

// ---------- 시작 ----------
export function renderWuwa() {
  renderChecks();
}

export function startWuwa() {
  renderChecks();
  renderParties();
  loadCharacters();
  for (const id of ["wwMainCard", "wwTodayCard", "wwWeekCard"]) $(id).addEventListener("click", onCheckClick);

  $("wwPick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (b) showWwPage(b.dataset.page);
  });

  $("wwAddParty").addEventListener("click", () => {
    parties = addParty(parties);
    saveParties();
    renderParties();
    loadCharacters();
  });
  $("wwParties").addEventListener("click", (e) => {
    const pick = e.target.closest("[data-pick]");
    const rm = e.target.closest("[data-remove-party]");
    if (pick) {
      if (!chars.list.length) { loadCharacters(); $("wwCharsMsg").textContent ||= "캐릭터 목록을 받는 중이야."; }
      openPicker(pick.dataset.pick, Number(pick.dataset.idx));
    } else if (rm) {
      const p = parties.find((x) => x.id === rm.dataset.removeParty);
      if (!confirm(`'${p.name}' 을(를) 지울까? 안에 있는 캐릭터 육성 체크는 남아.`)) return;
      parties = removeParty(parties, p.id);
      saveParties();
      renderParties();
    }
  });
  $("wwParties").addEventListener("change", (e) => {
    const pid = e.target.dataset.rename;
    if (!pid) return;
    parties = renameParty(parties, pid, e.target.value);
    saveParties();
    renderParties();
  });

  $("wwGrow").addEventListener("click", (e) => {
    const g = e.target.closest("[data-grow]");
    const bld = e.target.closest("[data-build]");
    if (bld) {
      builds = toggleBuild(builds, bld.dataset.build, bld.dataset.key);
      saveParties();
    } else if (g) {
      openGrow = openGrow === g.dataset.grow ? null : g.dataset.grow;
    } else return;
    renderGrow();
  });

  $("charSearch").addEventListener("input", renderPicker);
  $("charFilters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-el-filter]");
    if (!b) return;
    elFilter = b.dataset.elFilter;
    renderFilters();
    renderPicker();
  });
  $("charGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-char]");
    if (!b || !target) return;
    parties = placeCharacter(parties, target.pid, target.idx, b.dataset.char);
    saveParties();
    closeSheet();
    renderParties();
  });
  $("charNow").addEventListener("click", (e) => {
    if (!e.target.closest("#charClear")) return;
    parties = clearSlot(parties, target.pid, target.idx);
    saveParties();
    closeSheet();
    renderParties();
  });
}
