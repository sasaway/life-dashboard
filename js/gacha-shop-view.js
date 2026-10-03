// 명조 재화 › '과금으로 받을 것' 카드 (v2.8): 상품 줄 목록 · 개수 − / + · 가격 칸 · 상품 직접 추가 / 고치기 창.
// 계산은 gacha-shop.js. 저장은 gacha-view.js 가 맡는다 (api.change). 앱에서는 결제하지 않고 계산만 한다.
import {
  SHOP, shopDef, TOPUP_TIERS, SUB_DAYS, CYCLE_LABEL, CUSTOM_CYCLES, defaultItem, cleanCustom, addCustom, updateCustom, removeCustom, stepCount,
  contentLabel, topupCount, topupLunite, topupWon, tierLunite, passCharDate, passCharCounts, MAX_ITEM_COUNT,
} from "./gacha-shop.js";
import { count, pullsOf } from "./gacha.js";
import { openSheet, closeSheet, askConfirm } from "./sheet.js";
import { newId } from "./shopping.js";
import { ymd } from "./schedule.js";
import { $, esc } from "./dom.js";

let api;            // { paid(): 지금 과금 값, planDate(): 픽업 날짜, change(paid): 저장하고 다시 그린다 }
let open = false;   // '상품 더 보기' 를 펼쳤나 (앱을 다시 열면 접힌다)
let editing = null; // 고치기 창: { kind: "new" | "custom" | "base", id, tiers(루나이트 충전 단계 초안) }

const num = (n) => n.toLocaleString("ko-KR");
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
const mark = (text) => `<span class="mark">${text}</span>`;
const bundle = (x) => `별소 ${num(x.astrite)} · 캐릭뽑 ${num(x.char)} · 무기뽑 ${num(x.weap)}`;
const countOf = (id, item) => (id === "topup" ? topupCount(item) : item.count);

const stepper = (attr, n, name, max = MAX_ITEM_COUNT) => `<div class="gc-step" ${attr}>
  <button type="button" data-step="-1" aria-label="${esc(name)} 하나 빼기"${n <= 0 ? " disabled" : ""}>−</button>
  <span class="mono" aria-label="${n}개">${n}</span>
  <button type="button" data-step="1" aria-label="${esc(name)} 하나 더"${n >= max ? " disabled" : ""}>+</button></div>`;

// 패스 줄 아래 한 줄: 캐릭뽑이 픽업 전에 오는지
function passNote(item, has) {
  const day = passCharDate(item);
  if (!day) return "이름을 눌러 산 날을 적어 줘";
  if (!has) return `캐릭뽑은 ${md(day)}부터`;
  return passCharCounts(item, api.planDate()) ? `캐릭뽑은 ${md(day)}부터 · 픽업 전이라 넣어` : `캐릭뽑은 ${md(day)}부터 · 픽업 뒤라 빼`;
}

function rowHtml({ id, def, item, custom }, line, has, days) {
  const n = countOf(id, item);
  const marks = [CYCLE_LABEL[def.cycle], custom ? "직접" : "", def.unsure ? "확인 필요" : ""].filter(Boolean).map(mark).join("");
  const subDays = Math.min(days, SUB_DAYS * n);
  const notes = [
    id === "sub" && n && has ? `하루 별소 × ${subDays}일 = ${num(item.perDay * subDays)}` : "",
    line.max != null && has && id !== "pass" ? `최대 ${line.max}개` : "",
    line.cap && n > line.n ? `${line.n}개만 계산` : "",
    id === "pass" && n ? passNote(item, has) : "",
  ].filter(Boolean);
  const control = id === "topup"
    ? `<button type="button" class="btn btn-ghost gc-item-pick" data-item-edit="${esc(id)}">${n ? `${n}개 · 고치기` : "단계 고르기"}</button>`
    : stepper(`data-item="${esc(id)}"`, n, item.name, id === "pass" ? 1 : MAX_ITEM_COUNT);
  const price = id === "topup"
    ? `<span class="gc-item-won num">${n ? `${num(topupWon(item))}원` : ""}</span>`
    : `<label class="gc-item-price"><input class="field mono won" inputmode="numeric" pattern="[0-9]*" maxlength="7" autocomplete="off" data-item-price="${esc(id)}"
        value="${item.price || ""}" placeholder="가격" aria-label="${esc(item.name)} 한 개 가격, 원"><span>원</span></label>`;
  return `<li class="gc-item">
    <button type="button" class="gc-item-name" data-item-edit="${esc(id)}" aria-label="${esc(item.name)} 고치기"><b>${esc(item.name)}</b><span class="gc-item-marks">${marks}</span></button>
    ${control}
    <span class="gc-item-sub">${esc(contentLabel(def, item))}${notes.map((t) => `<span class="gc-item-hint">${esc(t)}</span>`).join("")}</span>
    ${price}</li>`;
}

// r = income() 결과, has = 픽업 날짜가 있고 안 지났나, days = 남은 날
export function renderShop(r, has, days) {
  const paid = api.paid();
  const base = SHOP.map((def) => ({ id: def.id, def, item: paid.items[def.id], custom: false }));
  const folded = base.filter((x) => !countOf(x.id, x.item)).length;
  const rows = [...base.filter((x) => open || countOf(x.id, x.item)), ...paid.custom.map((c) => ({ id: c.id, def: c, item: c, custom: true }))];
  $("gcShopMore").hidden = !folded;
  $("gcShopMore").textContent = open ? "안 사는 상품 접기" : `상품 더 보기 (${folded})`;
  $("gcShopMore").setAttribute("aria-expanded", String(open));
  // 가격을 치는 도중에는 목록을 다시 그리지 않는다 (칸이 다시 그려지면 글자가 끊긴다) — 합계만 새로
  if (!document.activeElement?.matches?.("#gcShop [data-item-price]")) {
    $("gcShop").innerHTML = rows.map((x) => rowHtml(x, r.shop.lines[x.id], has, has ? days : 0)).join("");
    $("gcShopEmpty").hidden = rows.length > 0;
  }
  const { total, won, priced, unpriced } = r.shop;
  const pulls = pullsOf(priced);
  const per = pulls ? `1연에 약 ${num(Math.round(won / pulls))}원` : "1연이 안 되는 양이야";
  $("gcPaidSum").innerHTML = `<li><span class="name"><b>과금으로 받는 것</b><span class="sub num">${esc(bundle(total))}</span></span>
      <span class="gc-pulls"><span class="mono">${num(pullsOf(total))}</span>연</span></li>${won ? `
    <li><span class="name"><b>과금 합계</b><span class="sub num">${per}${unpriced ? ` · 가격을 안 적은 상품 ${unpriced}개는 뺐어` : ""}</span></span>
      <span class="gc-pulls"><span class="mono">${num(won)}</span>원</span></li>` : unpriced ? `
    <li><span class="name"><span class="sub">가격을 적으면 과금 합계와 1연에 약 몇 원인지 보여 줘.</span></span></li>` : ""}`;
}

// ---------- 고치기 창 · 상품 직접 추가 ----------
const FIELDS = ["Lunite", "Astrite", "PerDay", "Char", "Weap", "Cycle", "Date", "Price"];
const SHOW = {
  custom: ["Lunite", "Astrite", "Char", "Weap", "Cycle", "Price"],
  sub: ["Lunite", "PerDay", "Price"],
  pass: ["Astrite", "Char", "Date", "Price"],
  pack: ["Astrite", "Char", "Weap", "Price"],
  topup: [],
};
const kindOf = (e) => (e.kind !== "base" ? "custom" : ["sub", "pass", "topup"].includes(e.id) ? e.id : "pack");
const setNum = (id, v) => { $(id).value = v ? String(v) : ""; };

function renderTiers() {
  $("giTiers").innerHTML = TOPUP_TIERS.map((t, i) => {
    const st = editing.tiers[i];
    const got = tierLunite(t, st);
    return `<li class="gc-tier">
      <span class="name"><b class="mono">${num(t.base)}</b><span class="sub num">${t.bonus ? `+${num(t.bonus)} · ` : ""}${num(t.price)}원</span></span>
      ${stepper(`data-tier="${i}"`, st.count, `루나이트 ${t.base} 단계`)}
      <span class="gc-item-sub num">${got ? `루나이트 ${num(got)}` : ""}</span>
      <button type="button" class="pin" data-tier-first="${i}" aria-pressed="${st.first}" aria-label="루나이트 ${t.base} 단계 첫충전 2배 남음">${st.first ? "2배 남음" : "2배 없음"}</button></li>`;
  }).join("");
  const draft = { tiers: editing.tiers };
  $("giTierSum").textContent = topupCount(draft) ? `루나이트 ${num(topupLunite(draft))} · ${num(topupWon(draft))}원` : "";
}

function openEdit(id) {
  const paid = api.paid();
  const custom = paid.custom.find((c) => c.id === id);
  const def = shopDef(id);
  const item = custom ?? (def ? paid.items[id] : null);
  editing = !item ? { kind: "new", id: "" } : custom ? { kind: "custom", id } : { kind: "base", id };
  const kind = kindOf(editing);
  for (const f of FIELDS) $(`gi${f}Row`).hidden = !SHOW[kind].includes(f);
  $("giTierBox").hidden = kind !== "topup";
  $("gcItemTitle").textContent = editing.kind === "new" ? "상품 직접 추가" : editing.kind === "custom" ? "상품 고치기" : def.name;
  $("gcItemNote").textContent = editing.kind === "base"
    ? (def.unsure ?? (kind === "pass" ? "캐릭뽑은 산 뒤 3주에 받는다고 쳐." : kind === "topup" ? "단계마다 첫 구매 한 번은 2배야. 남아 있는 단계만 '2배 남음' 으로 켜 줘." : "게임 안 값이 다르면 고쳐 줘."))
    : "이름과 내용물을 적어 줘. 루나이트는 별소와 1:1 로 계산해.";
  $("giName").value = item?.name ?? "";
  setNum("giLunite", item?.lunite);
  setNum("giAstrite", item?.astrite);
  setNum("giPerDay", item?.perDay);
  setNum("giChar", item?.charPulls);
  setNum("giWeap", item?.weaponPulls);
  setNum("giPrice", item?.price);
  $("giCycle").value = custom?.cycle ?? "once";
  $("giDate").value = item?.date ?? "";
  $("giMsg").textContent = "";
  $("giDelete").hidden = editing.kind !== "custom";
  $("giReset").hidden = editing.kind !== "base";
  if (kind === "topup") {
    editing.tiers = item.tiers.map((t) => ({ ...t }));
    renderTiers();
  }
  openSheet("gcItemSheet");
  if (editing.kind === "new") $("giName").focus();
}

function saveEdit() {
  const paid = api.paid();
  const v = (id) => count($(id).value);
  const name = $("giName").value.trim();
  if (editing.kind !== "base") {
    const c = { id: editing.id || `c-${newId()}`, name, lunite: v("giLunite"), astrite: v("giAstrite"), charPulls: v("giChar"), weaponPulls: v("giWeap"),
      cycle: $("giCycle").value, price: v("giPrice"), count: paid.custom.find((x) => x.id === editing.id)?.count ?? 1 };
    if (!name) return void ($("giMsg").textContent = "이름을 적어 줘.");
    if (!cleanCustom(c)) return void ($("giMsg").textContent = "루나이트 · 별소 · 캐릭뽑 · 무기뽑 중 하나는 0보다 커야 해.");
    closeSheet();
    return api.change(editing.kind === "new" ? addCustom(paid, c) : updateCustom(paid, editing.id, c));
  }
  const def = shopDef(editing.id);
  const kind = kindOf(editing);
  let item = { ...paid.items[editing.id], name: name || def.name };
  if (kind === "topup") item.tiers = editing.tiers;
  else {
    item.price = v("giPrice");
    if (kind === "sub") item = { ...item, lunite: v("giLunite"), perDay: v("giPerDay") };
    else if (kind === "pass") item = { ...item, astrite: v("giAstrite"), charPulls: v("giChar"), date: $("giDate").value };
    else item = { ...item, astrite: v("giAstrite"), charPulls: v("giChar"), weaponPulls: v("giWeap") };
  }
  closeSheet();
  api.change({ ...paid, items: { ...paid.items, [editing.id]: item } });
}

export function startShop(hooks) {
  api = hooks;
  $("giCycle").innerHTML = CUSTOM_CYCLES.map((c) => `<option value="${c}">${CYCLE_LABEL[c]}</option>`).join("");

  $("gcShop").addEventListener("click", (e) => {
    const step = e.target.closest("[data-step]");
    const edit = e.target.closest("[data-item-edit]");
    if (step) api.change(stepCount(api.paid(), step.closest("[data-item]").dataset.item, Number(step.dataset.step), ymd(new Date())));
    else if (edit) openEdit(edit.dataset.itemEdit);
  });
  // 가격 칸: 숫자만, 치는 대로 저장 (목록은 칸에서 나올 때 다시 그린다)
  $("gcShop").addEventListener("input", (e) => {
    const el = e.target.closest("[data-item-price]");
    if (!el) return;
    const digits = el.value.replace(/\D/g, "");
    if (digits !== el.value) el.value = digits;
    const paid = api.paid();
    const id = el.dataset.itemPrice;
    const price = count(digits);
    api.change(paid.custom.some((c) => c.id === id)
      ? updateCustom(paid, id, { price })
      : { ...paid, items: { ...paid.items, [id]: { ...paid.items[id], price } } });
  });
  $("gcShop").addEventListener("focusout", (e) => {
    if (e.target.closest("[data-item-price]")) setTimeout(() => api.change(api.paid()), 0);
  });
  $("gcShopMore").addEventListener("click", () => { open = !open; api.change(api.paid()); });
  $("gcShopAdd").addEventListener("click", () => openEdit(""));

  // 고치기 창
  $("gcItemForm").addEventListener("submit", (e) => { e.preventDefault(); saveEdit(); });
  $("gcItemForm").addEventListener("input", (e) => {
    if (!e.target.matches("[inputmode='numeric']")) return;
    const digits = e.target.value.replace(/\D/g, ""); // 음수 기호·글자는 칸에 남지 않는다
    if (digits !== e.target.value) e.target.value = digits;
  });
  $("giTiers").addEventListener("click", (e) => {
    const step = e.target.closest("[data-step]");
    const first = e.target.closest("[data-tier-first]");
    if (step) {
      const t = editing.tiers[Number(step.closest("[data-tier]").dataset.tier)];
      t.count = Math.max(0, Math.min(MAX_ITEM_COUNT, t.count + Number(step.dataset.step)));
    } else if (first) {
      const t = editing.tiers[Number(first.dataset.tierFirst)];
      t.first = !t.first;
    } else return;
    renderTiers();
  });
  // 기본값으로: 이름과 내용물·가격을 처음 값으로 (개수와 산 날은 그대로). 저장을 눌러야 바뀐다
  $("giReset").addEventListener("click", () => {
    const base = defaultItem(shopDef(editing.id));
    $("giName").value = base.name;
    setNum("giLunite", base.lunite);
    setNum("giAstrite", base.astrite);
    setNum("giPerDay", base.perDay);
    setNum("giChar", base.charPulls);
    setNum("giWeap", base.weaponPulls);
    setNum("giPrice", base.price);
    $("giMsg").textContent = "기본값을 넣었어. '저장' 을 누르면 바뀌어.";
  });
  $("giDelete").addEventListener("click", async () => {
    const c = api.paid().custom.find((x) => x.id === editing.id);
    if (!c || !(await askConfirm(`'${c.name}' 상품을 지울까?`, "지우기"))) return;
    closeSheet();
    api.change(removeCustom(api.paid(), editing.id));
  });
}
