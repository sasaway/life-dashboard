// 명조 가챠 기댓값 계산기 화면: 명조 위 전환 [오늘 · 파티표 · 재화 · 픽업] 의 '재화'(v2.4) · '픽업'(v2.5).
// '과금으로 받을 것' 카드의 상품 목록은 gacha-shop-view.js (v2.8).
// 입력 칸은 index.html 에 한 번만 있고, 숫자가 바뀌면 계산 글자만 다시 쓴다 (치는 도중에 칸이 다시 그려지지 않게).
// 공명자 고르기는 파티표의 고르기 창을 5성만으로 연다 (wuwa-view.js openGachaPicker).
import { store } from "./store.js";
import {
  normalizeGacha, count, pullsOf, daysUntil, dLabel, income, FREE_HINT,
  CHAINS, chainLabel, expectation, astriteNeeded, verdict,
} from "./gacha.js";
import { startShop, renderShop } from "./gacha-shop-view.js";
import { openGachaPicker, findChar, charByName, face, elTag } from "./wuwa-view.js";
import {
  pickupsOf, nextPhase, livePickups, autoFill, applyPickup, markByHand, hasNewPickup, byHand, toManual, toAuto, rowKey, rangeLabel,
  isTentative, isRerun, isOngoing, phasesUntil,
} from "./pickups.js";
import { openSheet, closeSheet } from "./sheet.js";
import { ICON } from "./icons.js";
import { ymd, parseDate } from "./schedule.js";
import { DAYS } from "./time.js";
import { $, esc } from "./dom.js";

let g = normalizeGacha(store.load("wuwaGacha", null));
// Claude 가 시트에 적은 픽업 일정 (v2.7). 받기는 hobby-sync-view.js — 여기서는 저장된 걸 읽기만 한다
let pickups = pickupsOf(store.load("wuwaPickups", null));

const save = () => {
  const ok = store.save("wuwaGacha", g);
  document.querySelectorAll(".gc-msg").forEach((p) => { p.textContent = ok ? "" : "저장이 안 됐어. 저장 공간을 확인해 줘."; });
};
const num = (n) => n.toLocaleString("ko-KR");
// "have.astrite" → g.have.astrite
const getAt = (path) => path.split(".").reduce((o, k) => o[k], g);
function setAt(path, value) {
  const [group, key] = path.split(".");
  g = { ...g, [group]: { ...g[group], [key]: value } };
}

// 저장된 값을 입력 칸에 넣는다 (시작할 때 한 번). 0 은 빈칸으로 보여 준다
function fillInputs() {
  document.querySelectorAll(".gc [data-g]").forEach((el) => {
    const v = getAt(el.dataset.g);
    el.value = el.type === "date" || el.tagName === "SELECT" ? String(v) : (v ? String(v) : "");
  });
  document.querySelectorAll(".gc [data-gt]").forEach(paintToggle);
}
function paintToggle(b) {
  const on = Boolean(getAt(b.dataset.gt));
  b.setAttribute("aria-pressed", String(on));
  b.textContent = on ? "켬" : "끔";
}

const bundle = (x) => `별소 ${num(x.astrite)} · 캐릭뽑 ${num(x.char)} · 무기뽑 ${num(x.weap)}`;

// 픽업 일정으로 공명자·날짜를 채운다 (직접 고친 계획은 그대로). 바뀌었으면 저장하고 날짜 칸도 맞춘다
function setPlan(plan) {
  if (plan === g.plan) return;
  g = { ...g, plan };
  save();
  $("gcDate").value = plan.date;
}

// 계산 글자만 다시 쓴다 (분마다 · 입력할 때마다)
export function renderGacha() {
  const now = new Date();
  setPlan(autoFill(g.plan, pickups, now, charByName));
  // 임시 번호로 고른 공명자가 encore.moe 에 올라왔으면 진짜 번호로 옮긴다 (직접 고른 것도)
  const real = g.plan.char ? findChar(g.plan.char, g.plan.charName) : null;
  if (real && real.id !== g.plan.char) setPlan({ ...g.plan, char: real.id, charName: real.name });
  const days = daysUntil(g.plan.date, now);
  const has = days !== null && days >= 0;
  const r = income(g, days, has ? (phasesUntil(pickups, now, g.plan.date) ?? {}) : {});
  const left = has ? dLabel(days) : "";

  $("gcHavePulls").textContent = `${num(pullsOf(g.have))}연`;
  $("gcFreeDays").textContent = has ? `남은 ${days}일` : "";
  $("gcDailyCalc").textContent = `하루 별소${has ? ` × ${days}일 = ${num(g.free.daily * days)}` : ""}`;
  $("gcFreeHint").textContent = FREE_HINT;
  renderShop(r, has, days); // 과금 상품 줄 · 과금 합계 (v2.8)

  $("gcSumD").textContent = left;
  $("gcNoDate").hidden = has;
  $("gcNoDateMsg").textContent = days !== null && days < 0
    ? "픽업 날이 지났어. 픽업 페이지에서 새 날짜를 정해 줘."
    : "픽업 페이지에서 날짜를 정하면 계산돼.";
  $("gcSum").hidden = !has;
  $("gcSum").innerHTML = has ? [["무과금만", r.freeOnly], ["과금 포함", r.withPaid]].map(([label, x]) => `
    <li><span class="name"><b>${label}</b><span class="sub num">${esc(bundle(x))}</span></span>
      <span class="gc-pulls"><span class="mono">${num(pullsOf(x))}</span>연</span></li>`).join("") : "";

  $("gcPlanD").textContent = left;
  renderPlan(r, days);
  $("gcDateSub").textContent = days === null ? "아직 안 정했어"
    : days < 0 ? "지난 날이야. 새로 정해 줘"
    : days === 0 ? "오늘이야" : `남은 ${days}일`;
  $("gcDate").min = ymd(new Date());
}

// ---------- 픽업 일정 (v2.7): 정하는 법 고르기 · '새 픽업 일정이 있어' 안내 · 고르는 창 ----------
// ('다음 픽업' 한 줄은 핫픽스 v2.8.2 에서 없앴다 — 일정대로일 때는 공명자 줄을 누르면 고르는 창이 열린다)
const mark = (text) => `<span class="mark">${text}</span>`;
// "2026-10-21" → "10월 21일 (수)". 아직 없으면 (공명자를 안 골랐을 때) 안내
const dateText = (date) => {
  if (!date) return "공명자를 고르면 정해져";
  const d = parseDate(date);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
};
function renderNext() {
  const now = new Date();
  $("gcNew").hidden = !hasNewPickup(g.plan, pickups, now, charByName);
  // 정하는 법 고르기 (핫픽스 v2.8.1): 픽업 일정을 받아 쓰는 폰에서만 보인다. '픽업 일정대로' 면 날짜 칸은 잠근다
  const manual = byHand(g.plan);
  $("gcMode").hidden = !pickups.length;
  $("gcMode").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.mode === "manual") === manual)));
  // 일정대로면 날짜는 고칠 수 없으니 입력칸 대신 글자로 보여 준다 (v2.9)
  const locked = pickups.length > 0 && !manual;
  $("gcDate").disabled = locked;
  $("gcDate").hidden = locked;
  $("gcDateText").hidden = !locked;
  $("gcDateText").textContent = locked ? dateText(g.plan.date) : "";
  $("gcModeHint").textContent = !pickups.length ? "날짜는 폰 시계(한국 시간)로 세. 자정이 지나면 하루 줄어."
    : manual ? "달력에서 날짜를, 목록에서 공명자를 골라. 픽업 일정이 바뀌어도 그대로 둬."
    : "받은 일정대로 채워 (진행 중이면 끝나는 날, 시작 전이면 시작하는 날). 다른 픽업은 공명자 줄을 눌러.";
  // 따라가는 픽업이 아직 '예정' 이면 날짜 옆에 작게 알린다
  const mine = manual ? null : livePickups(pickups, now).find((p) => rowKey(p) === g.plan.autoKey);
  $("gcDateSoon").hidden = !(mine && isTentative(mine));
}

// 고르는 창: 아직 안 끝난 픽업을 한 줄씩. 누르면 그 공명자와 날짜를 계획에 넣는다
function openPickupSheet() {
  const now = new Date();
  $("pkList").innerHTML = livePickups(pickups, now).map((p) => {
    const c = charByName(p.char);
    const on = !byHand(g.plan) && rowKey(p) === g.plan.autoKey;
    const sub = [p.version, p.phase, rangeLabel(p), isOngoing(p, now) ? "진행 중" : "", isRerun(p) ? "복각" : ""].filter(Boolean).join(" · ");
    return `<li><button class="pick pk-row" data-pk="${esc(rowKey(p))}" aria-pressed="${on}">
      ${face(c, 40)}<span class="who"><b>${esc(c.name)}</b><span class="sub">${esc(sub)}${isTentative(p) ? mark("예정") : ""}</span></span></button></li>`;
  }).join("");
  openSheet("pkSheet");
}

function usePickup(row) {
  setPlan(applyPickup(g.plan, row, new Date(), charByName));
  renderGacha();
}

// ---------- 픽업 (v2.5) ----------
function renderPlan(r, days) {
  renderNext();
  const p = g.plan;
  const c = p.char ? findChar(p.char, p.charName) : null;
  const name = c?.name ?? p.charName;
  $("gcChar").innerHTML = p.char
    ? `${c ? face(c, 40) : `<span class="face noimg" style="width:40px;height:40px"></span>`}
       <span class="who"><b>${esc(name)}</b><span class="sub">${c ? elTag(c.element) : ""}</span></span><span class="gc-char-go">바꾸기</span>`
    : pickups.length && !byHand(p)
      ? `<span class="gc-plus">${ICON.plus}</span><span class="who"><b>픽업 고르기</b><span class="sub">받은 일정에서 골라</span></span>`
      : `<span class="gc-plus">${ICON.plus}</span><span class="who"><b>공명자 고르기</b><span class="sub">5성만 보여</span></span>`;
  $("gcChains").innerHTML = CHAINS.map((n) =>
    `<button class="fchip" data-gc-chain="${n}" aria-pressed="${p.chain === n}" aria-label="목표 ${chainLabel(n)}"><span>${n === 0 ? "명함" : n}</span></button>`).join("");

  const e = expectation(p);
  $("gcCopies").textContent = e.copies ? `5성 캐릭 ${e.copies}장 필요` : "이미 목표 체인이야";
  $("gcExpD").textContent = days !== null && days >= 0 ? dLabel(days) : "";
  $("gcExpNote").textContent = days === null ? "픽업 날짜가 없어서 지금 가진 것과 직접 적은 것만으로 판정했어."
    : days < 0 ? "픽업 날이 지나서 지금 가진 것과 직접 적은 것만으로 판정했어." : "";
  if (!e.copies && !p.weapon) {
    $("gcExp").innerHTML = `<p class="empty">뽑을 게 없어. 목표 체인을 올리거나 전무를 켜 봐.</p>`;
    return;
  }
  const col = (title, side) => {
    const need = (kind) => num(astriteNeeded(side, kind, r.freeOnly));
    const what = [side.fives ? `5성 ${side.fives}번` : "캐릭은 이미 목표", p.weapon ? "전무" : ""].filter(Boolean).join(" + ");
    return `<div class="gc-col">
      <h3>${title}</h3>
      <p class="gc-k">${what}</p>
      <p class="gc-v"><span>평균 (대략)</span><b>약 <span class="mono">${num(side.avg)}</span>연</b><span class="num">별소 약 ${need("avg")}</span></p>
      <p class="gc-v"><span>최악 (천장)</span><b><span class="mono">${num(side.worst)}</span>연</b><span class="num">별소 ${need("worst")}</span></p>
      <p class="gc-j"><span>무과금만</span><b>${verdict(side, r.freeOnly).text}</b></p>
      <p class="gc-j"><span>과금 포함</span><b>${verdict(side, r.withPaid).text}</b></p>
    </div>`;
  };
  $("gcExp").innerHTML = col("픽뚫 안 당함", e.win) + col("픽뚫 당함", e.lose);
}

// 은월이 공명자·날짜를 직접 고쳤다 → 픽업 일정이 덮어쓰지 않게 표시한다
function byMe(what) {
  g = { ...g, plan: markByHand(g.plan, what, pickups, new Date()) };
}

// 정하는 법을 바꾼다. '픽업 일정대로' 인데 다음 픽업에 공명자가 여럿이라 못 채웠으면 고르는 창을 연다
function setMode(mode) {
  const now = new Date();
  if (mode === "manual") { setPlan(toManual(g.plan, pickups, now)); return renderGacha(); }
  setPlan(toAuto(g.plan));
  renderGacha(); // 여기서 일정대로 채운다
  if (!livePickups(pickups, now).some((p) => rowKey(p) === g.plan.autoKey)) openPickupSheet();
}

function pickChar() {
  // '픽업 일정대로' 면 공명자도 일정에서 고른다
  if (pickups.length && !byHand(g.plan)) return openPickupSheet();
  openGachaPicker({
    current: g.plan.char,
    currentName: g.plan.charName,
    onPick: (id, name) => { setAt("plan.char", id); setAt("plan.charName", name); byMe("char"); save(); renderGacha(); },
    onClear: () => { setAt("plan.char", ""); setAt("plan.charName", ""); byMe("char"); save(); renderGacha(); },
  });
}

export function startGacha() {
  // 패스를 넣어 뒀는데 산 날이 없는 폰 (v2.4 에 켠 것): 오늘로
  const pass = g.paid.items.pass;
  if (pass.count && !pass.date) { g = { ...g, paid: { ...g.paid, items: { ...g.paid.items, pass: { ...pass, date: ymd(new Date()) } } } }; save(); }
  startShop({
    paid: () => g.paid,
    planDate: () => g.plan.date,
    change: (paid) => { g = { ...g, paid }; save(); renderGacha(); },
  });
  fillInputs();
  renderGacha();

  for (const id of ["ww-page-cash", "ww-page-pickup"]) {
    const page = $(id);
    page.addEventListener("input", (e) => {
      const el = e.target.closest("[data-g]");
      if (!el) return;
      if (el.type === "date") {
        setAt(el.dataset.g, el.value);
        if (el.dataset.g === "plan.date") byMe("date");
      } else if (el.tagName === "SELECT") {
        setAt(el.dataset.g, Number(el.value));
      } else {
        let digits = el.value.replace(/\D/g, ""); // 음수 기호·글자는 칸에 남지 않는다
        const max = Number(el.dataset.max ?? Infinity); // 스택은 79까지
        if (count(digits) > max) digits = String(max);
        if (digits !== el.value) el.value = digits;
        setAt(el.dataset.g, count(digits));
      }
      save();
      renderGacha();
    });
    page.addEventListener("click", (e) => {
      const t = e.target.closest("[data-gt]");
      const go = e.target.closest("[data-ww-go]");
      const chain = e.target.closest("[data-gc-chain]");
      const mode = e.target.closest("#gcMode [data-mode]");
      if (mode) {
        setMode(mode.dataset.mode);
      } else if (e.target.closest("#gcNewGo")) {
        // 다음 픽업에 공명자가 한 명이면 바로 바꾸고, 여럿이면 고르는 창
        const next = nextPhase(pickups, new Date());
        if (next?.rows.length === 1) usePickup(next.rows[0]);
        else openPickupSheet();
      } else if (e.target.closest("#gcChar")) {
        pickChar();
      } else if (chain) {
        setAt("plan.chain", Number(chain.dataset.gcChain));
        save();
        renderGacha();
      } else if (t) {
        setAt(t.dataset.gt, !getAt(t.dataset.gt));
        paintToggle(t);
        save();
        renderGacha();
      } else if (go) {
        $("wwPick").querySelector(`[data-page="${go.dataset.wwGo}"]`)?.click();
        window.scrollTo(0, 0);
      }
    });
  }
  // 재화 · 픽업으로 넘어올 때 남은 날을 새로 센다
  $("wwPick").addEventListener("click", () => renderGacha());
  // 캐릭터 목록이나 픽업 일정을 새로 받으면 (wuwa-view 가 알린다) 일정을 다시 읽고 얼굴도 새로
  document.addEventListener("ww-chars", () => {
    pickups = pickupsOf(store.load("wuwaPickups", null));
    renderGacha();
  });
  $("pkList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pk]");
    const row = b && pickups.find((p) => rowKey(p) === b.dataset.pk);
    if (!row) return;
    closeSheet();
    usePickup(row);
  });
}
