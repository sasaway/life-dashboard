// 명조 화면: 취미 탭(오늘·이번 주 체크, 목표 육성 파티), 메인 취미 카드, 캐릭터 고르기 창.
import { store } from "./store.js";
import { openSheet, closeSheet } from "./sheet.js";
import {
  DAILY, WEEKLY, BUILD, PARTY_SIZE, dailyDone, weeklyDone, toggleDaily, tapWeekly, dailyCount, weeklyCount,
  cleanCharacters, searchCharacters, addParty, renameParty, removeParty, placeCharacter, clearSlot, whereIs,
  toggleBuild, buildCount,
} from "./wuwa.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
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

// ---------- 목표 육성 파티 ----------
function slotHtml(p, i) {
  const id = p.slots[i];
  if (!id) return `<li class="slot"><button class="slot-empty" data-pick="${p.id}" data-idx="${i}">캐릭터 넣기</button></li>`;
  const c = charById(id) ?? { name: "알 수 없는 캐릭터", element: "", stars: 0, icon: "" };
  return `<li class="slot">
    <button class="slot-char" data-pick="${p.id}" data-idx="${i}" aria-label="${esc(c.name)} 바꾸기">
      ${c.icon ? `<img src="${esc(c.icon)}" alt="" width="44" height="44" loading="lazy">` : '<span class="noimg"></span>'}
      <span class="who"><b>${esc(c.name)}</b><span class="sub">${esc(c.element)}${c.stars ? ` · ${c.stars}성` : ""}</span></span>
      <span class="mono cnt">${buildCount(builds, id)} / ${BUILD.length}</span>
    </button>
    <div class="build">${BUILD.map((b) => chip(`data-build="${esc(id)}" data-key="${b.id}"`, b.label, builds[id]?.[b.id], true)).join("")}</div>
  </li>`;
}

function renderParties() {
  $("wwParties").innerHTML = parties.map((p) => `
    <section class="party" aria-label="${esc(p.name)}">
      <div class="party-h">
        <input class="field party-name" data-rename="${p.id}" value="${esc(p.name)}" maxlength="20" aria-label="파티 이름">
        <button class="btn btn-text" data-remove-party="${p.id}">지우기</button>
      </div>
      <ol class="party-slots">${Array.from({ length: PARTY_SIZE }, (_, i) => slotHtml(p, i)).join("")}</ol>
    </section>`).join("");
  $("wwPartiesEmpty").hidden = parties.length > 0;
}

// ---------- 캐릭터 고르기 ----------
let target = null; // { pid, idx }

function renderPicker() {
  const list = searchCharacters(chars.list, $("charSearch").value);
  $("charGrid").innerHTML = list.map((c) => {
    const at = whereIs(parties, c.id);
    const here = at && at.pid === target.pid && at.idx === target.idx;
    return `<li><button class="char" data-char="${esc(c.id)}" aria-pressed="${Boolean(here)}">
      ${c.icon ? `<img src="${esc(c.icon)}" alt="" width="56" height="56" loading="lazy">` : '<span class="noimg"></span>'}
      <span class="nm">${esc(c.name)}</span>
      <span class="sub">${at && !here ? `${esc(at.name)}에 있음` : esc(c.element)}</span>
    </button></li>`;
  }).join("");
  $("charEmpty").hidden = list.length > 0 || !chars.list.length;
}

function openPicker(pid, idx) {
  target = { pid, idx };
  const p = parties.find((x) => x.id === pid);
  $("charTitle").textContent = `${p.name} · ${idx + 1}번 칸`;
  $("charClear").hidden = !p.slots[idx];
  $("charSearch").value = "";
  renderPicker();
  openSheet("charSheet");
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

  $("wwAddParty").addEventListener("click", () => {
    parties = addParty(parties);
    saveParties();
    renderParties();
    loadCharacters();
  });
  $("wwParties").addEventListener("click", (e) => {
    const pick = e.target.closest("[data-pick]");
    const bld = e.target.closest("[data-build]");
    const rm = e.target.closest("[data-remove-party]");
    if (pick) {
      if (!chars.list.length) { loadCharacters(); $("wwCharsMsg").textContent ||= "캐릭터 목록을 받는 중이야."; }
      openPicker(pick.dataset.pick, Number(pick.dataset.idx));
    } else if (bld) {
      builds = toggleBuild(builds, bld.dataset.build, bld.dataset.key);
      saveParties();
      renderParties();
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

  $("charSearch").addEventListener("input", renderPicker);
  $("charGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-char]");
    if (!b || !target) return;
    parties = placeCharacter(parties, target.pid, target.idx, b.dataset.char);
    saveParties();
    closeSheet();
    renderParties();
  });
  $("charClear").addEventListener("click", () => {
    parties = clearSlot(parties, target.pid, target.idx);
    saveParties();
    closeSheet();
    renderParties();
  });
}
