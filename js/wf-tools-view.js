// 워프레임 쪽 '모딩': 게임 자료 받기(폰에 한 번 저장), A/B/C 모딩 시뮬레이터.
import { store } from "./store.js";
import { openSheet, closeSheet } from "./sheet.js";
import { chip } from "./wuwa-view.js";
import { prepareGameData, searchItems, searchMods } from "./wf-game.js";
import {
  KINDS, SLOT_KO, POLARITIES, polSym, BUILD_NAMES, modCost, capacity, formaCount, setPol, placeMod, clearMod, setRank,
  toggleBoost, rebase, modsFor, canPlace, addEquip, removeEquip, buildOf, setBuild,
} from "./modding.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- 게임 자료 (warframestat.us, 무료) ----------
// 영어 목록(극성·모드 비용 포함)과 한국어 이름을 받아 줄인 뒤 폰의 사본 창고(Cache)에 둔다. 일주일마다 새로.
// localStorage 는 5MB 한도라 다른 기록과 나눠 쓰지 않으려고 따로 둔다
const DATA_CACHE = "wf-data";
const DATA_KEY = "game-data.json";
const DATA_MAX_AGE = 7 * 864e5;
const FIELDS = "uniqueName,name,category,type,polarity,baseDrain,fusionLimit,compatName,polarities,aura,exilusPolarity,stancePolarity";
const EN_URL = `https://api.warframestat.us/items?only=${FIELDS}`;
const KO_URL = "https://api.warframestat.us/items?language=ko&only=uniqueName,name";

let data = null; // { at, items, mods }
let modIndex = new Map();
let equipNames = [];
let loading = null;
let failed = false;

function useData(d) {
  data = d;
  modIndex = new Map(d.mods.map((m) => [m.u, m]));
  equipNames = d.items.map((i) => i.en);
}

async function readSaved() {
  try {
    const res = await (await caches.open(DATA_CACHE)).match(DATA_KEY);
    return res ? await res.json() : null;
  } catch {
    return null;
  }
}
async function save(d) {
  try {
    await (await caches.open(DATA_CACHE)).put(DATA_KEY, new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json" } }));
  } catch {
    // 저장이 안 되는 곳이면 이번에 연 동안만 쓴다
  }
}
const getJson = (url) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(r.status);
  return r.json();
});

function loadData() {
  loading ??= (async () => {
    if (!data) {
      const saved = await readSaved();
      if (saved) useData(saved);
    }
    if (data && Date.now() - data.at < DATA_MAX_AGE) return;
    renderDataMsg(true);
    try {
      const [en, ko] = await Promise.all([getJson(EN_URL), getJson(KO_URL)]);
      useData({ at: Date.now(), ...prepareGameData(en, ko) });
      await save(data);
      failed = false;
    } catch {
      failed = true;
    }
  })().finally(() => {
    loading = null;
    renderDataMsg(false);
    renderMod();
  });
  return loading;
}

function renderDataMsg(busy) {
  const days = data ? Math.floor((Date.now() - data.at) / 864e5) : 0;
  const text = busy ? "게임 자료 받는 중… (처음 한 번, 약 600KB)"
    : failed && !data ? "게임 자료를 못 받았어. 인터넷이 되면 다시 받아 올게."
    : failed ? `새로 못 받아서 ${days}일 전 자료로 보여 줘.`
    : data ? `게임 자료: warframestat.us · ${days ? `${days}일 전` : "오늘"} 받음` : "";
  document.querySelectorAll(".wf-data-msg").forEach((el) => { el.textContent = text; });
}

// ---------- 모딩 ----------
let equips = store.load("wfMods", []);
let sel = store.load("wfModSel", { id: null, build: "A" });
let slotIdx = null; // 고치고 있는 칸

const saveEquips = () => store.save("wfMods", equips);
const saveSel = () => store.save("wfModSel", sel);
const current = () => equips.find((e) => e.id === sel.id) ?? equips[0];
const modOf = (u) => modIndex.get(u);
const slotName = (b, i) => (b.slots[i] === "general" ? `${i - b.slots.indexOf("general") + 1}번` : SLOT_KO[b.slots[i]]);
const polLabel = (id) => (id ? `${polSym(id)} ${POLARITIES.find((p) => p.id === id).name}` : "없음");
const costText = (c) => (c < 0 ? `+${-c}` : String(c));

function renderEquips() {
  const cur = current();
  $("modEquips").innerHTML = equips.map((e) => `<li><button class="pick equip" data-equip="${esc(e.id)}" aria-pressed="${e === cur}">
    <b>${esc(e.ko)}</b><span class="sub">${esc(e.en)} · ${KINDS[e.kind].label}</span></button></li>`).join("");
  $("modEquipsEmpty").hidden = equips.length > 0;
}

function slotTile(b, i) {
  const m = b.mods[i];
  const mod = m && modOf(m.u);
  const changed = b.pols[i] !== b.base[i];
  const cost = mod ? costText(modCost(mod, m.rank, b.pols[i], b.slots[i])) : "";
  return `<li><button class="mod-slot${mod ? "" : " empty"}" data-slot="${i}" aria-label="${slotName(b, i)} 칸${mod ? ` ${esc(mod.ko)}` : " 비어 있음"}">
    <span class="ms-top"><span class="pol" aria-hidden="true">${polSym(b.pols[i]) || "·"}</span>
      <span class="ms-kind">${slotName(b, i)}${changed ? " · 포르마" : ""}</span><span class="mono cost">${cost}</span></span>
    <span class="ms-name">${mod ? esc(mod.ko) : m ? "자료 받는 중" : "비어 있음"}</span>
    ${mod ? `<span class="ms-rank mono">랭크 ${m.rank}/${mod.max}</span>` : ""}
  </button></li>`;
}

function renderMod() {
  renderEquips();
  const e = current();
  $("modBuildCard").hidden = !e;
  if (!e) return;
  const b = buildOf(e, sel.build);
  $("modName").textContent = e.ko;
  $("modSub").textContent = `${e.en} · ${KINDS[e.kind].label}`;
  $("modPickBuild").querySelectorAll("button").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.build === sel.build)));

  const cap = capacity(b, modOf);
  $("modCap").innerHTML = `${cap.used}<span> / ${cap.max}</span>`;
  $("modBar").style.width = `${Math.min(100, (cap.used / cap.max) * 100)}%`;
  $("modLeft").textContent = cap.left < 0 ? `${-cap.left} 넘음 — 랭크를 낮추거나 극성을 맞춰 봐` : `${cap.left} 남음`;
  const f = formaCount(b);
  $("modForma").textContent = `포르마 ${f.forma}개${f.aura ? ` · 오라 포르마 ${f.aura}개` : ""}${f.stance ? ` · 스탠스 포르마 ${f.stance}개` : ""}`;
  $("modBoost").innerHTML = chip('type="button" data-boost', `${KINDS[e.kind].boost} (용량 두 배)`, b.boost, true);

  const idx = b.slots.map((_, i) => i);
  $("modSpecial").innerHTML = idx.filter((i) => b.slots[i] !== "general").map((i) => slotTile(b, i)).join("");
  $("modSpecial").hidden = !b.slots.some((s) => s !== "general");
  $("modSlots").innerHTML = idx.filter((i) => b.slots[i] === "general").map((i) => slotTile(b, i)).join("");
  const base = b.base.filter(Boolean).map(polSym);
  $("modBase").textContent = `원래 극성: ${base.length ? base.join(" ") : "없음"} (게임 자료). 게임과 다르면 칸 극성을 게임처럼 맞추고 '포르마 개수 초기화' 를 눌러.`;
  if (slotIdx !== null && !$("slotSheet").hidden) renderSlot();
}

function updateBuild(fn) {
  const e = current();
  equips = setBuild(equips, e.id, sel.build, fn(buildOf(e, sel.build)));
  saveEquips();
  renderMod();
}

// 칸 창: 극성 고르기 · 지금 모드(랭크) · 넣을 모드 찾기
function renderSlot() {
  const e = current();
  const b = buildOf(e, sel.build);
  const i = slotIdx;
  const slot = b.slots[i];
  $("slotTitle").textContent = `${slotName(b, i)} 칸`;
  $("slotBase").textContent = `원래 극성: ${polLabel(b.base[i])}${b.pols[i] !== b.base[i] ? " → 바꾸려면 포르마 하나" : ""}`;
  $("slotPols").innerHTML = [null, ...POLARITIES.map((p) => p.id)]
    .map((id) => chip(`type="button" data-pol="${id ?? ""}"`, polLabel(id), b.pols[i] === id, true)).join("");

  const m = b.mods[i];
  const mod = m && modOf(m.u);
  $("slotCur").hidden = !mod;
  if (mod) {
    $("slotCur").innerHTML = `<div class="card-h"><h2>${esc(mod.ko)}</h2><small>${esc(mod.en)}</small></div>
      <div class="stepper">
        <button class="icon-btn" data-rank="-1" aria-label="랭크 내리기">−</button>
        <span class="mono">랭크 ${m.rank} / ${mod.max}</span>
        <button class="icon-btn" data-rank="1" aria-label="랭크 올리기">+</button>
        <span class="mini">이 칸 비용 ${costText(modCost(mod, m.rank, b.pols[i], slot))}</span>
      </div>
      <button class="btn btn-ghost" data-clear>모드 빼기</button>`;
  }

  const list = data ? modsFor(data.mods, e, equipNames).filter((x) => canPlace(x, slot)) : [];
  const q = $("modSearch").value;
  const hits = q.trim() ? searchMods(list, q) : [...list].sort((a, b2) => a.ko.localeCompare(b2.ko, "ko"));
  $("modHits").innerHTML = hits.map((x) => {
    const where = b.mods.findIndex((y) => y?.u === x.u);
    const note = where >= 0 && where !== i ? ` · ${slotName(b, where)} 칸에 있음` : "";
    return `<li><button class="mod-pick" data-mod="${esc(x.u)}" aria-pressed="${where === i}">
      <span class="nm"><b>${esc(x.ko)}</b><span class="sub">${esc(x.en)}${note}</span></span>
      <span class="mono">${polSym(x.pol)} ${costText(modCost(x, x.max, b.pols[i], slot))}</span></button></li>`;
  }).join("");
  $("modHitsEmpty").hidden = !data || hits.length > 0;
}

function openSlot(i) {
  slotIdx = i;
  $("modSearch").value = "";
  renderSlot();
  openSheet("slotSheet");
}

function renderEquipHits() {
  const q = $("equipSearch").value;
  const list = data ? (q.trim() ? searchItems(data.items, q) : []) : [];
  $("equipHits").innerHTML = list.map((it) => `<li><button class="pick equip" data-add="${esc(it.u)}">
    <b>${esc(it.ko)}</b><span class="sub">${esc(it.en)} · ${KINDS[it.kind].label}</span></button></li>`).join("");
  $("equipEmpty").hidden = !data || !q.trim() || list.length > 0;
}

// ---------- 시작 ----------
// 워프레임 쪽 위 전환에서 '모딩' 을 열 때 부른다
export function openTools() {
  loadData();
  renderMod();
}

export function startWfTools() {
  $("modAddEquip").addEventListener("click", () => {
    $("equipSearch").value = "";
    renderEquipHits();
    openSheet("equipSheet");
    loadData();
  });
  $("equipSearch").addEventListener("input", renderEquipHits);
  $("equipHits").addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    const item = b && data.items.find((it) => it.u === b.dataset.add);
    if (!item) return;
    equips = addEquip(equips, item);
    sel = { id: equips.find((x) => x.u === item.u).id, build: "A" };
    saveEquips();
    saveSel();
    closeSheet();
    renderMod();
  });

  $("modEquips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-equip]");
    if (!b) return;
    sel = { ...sel, id: b.dataset.equip };
    saveSel();
    renderMod();
  });
  $("modPickBuild").addEventListener("click", (e) => {
    const b = e.target.closest("[data-build]");
    if (!b || !BUILD_NAMES.includes(b.dataset.build)) return;
    sel = { ...sel, build: b.dataset.build };
    saveSel();
    renderMod();
  });
  $("modBoost").addEventListener("click", (e) => {
    if (e.target.closest("[data-boost]")) updateBuild(toggleBoost);
  });
  $("modBuildCard").addEventListener("click", (e) => {
    const b = e.target.closest("[data-slot]");
    if (b) openSlot(Number(b.dataset.slot));
  });
  $("modRebase").addEventListener("click", () => {
    if (confirm("포르마 개수를 0 으로 되돌릴까? 지금 칸 극성이 원래 극성이 돼.")) updateBuild(rebase);
  });
  $("modRemove").addEventListener("click", () => {
    const e = current();
    if (!e || !confirm(`'${e.ko}' 모딩을 제거할까? A/B/C 빌드도 같이 지워져.`)) return;
    equips = removeEquip(equips, e.id);
    sel = { id: equips[0]?.id ?? null, build: "A" };
    saveEquips();
    saveSel();
    renderMod();
  });

  $("slotSheet").addEventListener("click", (e) => {
    const pol = e.target.closest("[data-pol]");
    const rank = e.target.closest("[data-rank]");
    const pick = e.target.closest("[data-mod]");
    const i = slotIdx;
    if (pol) updateBuild((b) => setPol(b, i, pol.dataset.pol || null));
    else if (rank) updateBuild((b) => setRank(b, i, (b.mods[i]?.rank ?? 0) + Number(rank.dataset.rank), modOf));
    else if (e.target.closest("[data-clear]")) updateBuild((b) => clearMod(b, i));
    else if (pick) {
      updateBuild((b) => placeMod(b, i, modOf(pick.dataset.mod)));
      closeSheet();
    }
  });
  $("modSearch").addEventListener("input", renderSlot);

  renderDataMsg(false);
}
