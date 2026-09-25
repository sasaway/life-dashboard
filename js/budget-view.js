// 돈 탭: [예산 · 지난달 결산 · 사야 할 것] 전환, 예산 편집, 결산과 통계.
import { store } from "./store.js";
import {
  CATEGORIES, parseWon, formatWon, addBudgetItem, setBudgetAmount, removeBudgetItem, sumBy,
  monthKey, shiftMonth, monthLabel, settlementRows, setActual, settlementStats,
} from "./budget.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const num = (n) => n.toLocaleString("ko-KR");

let items = store.load("budget", []);           // [{ id, cat, name, amount }]
let settlements = store.load("settlements", {}); // { "2026-08": { snapshot, actual } }

const lastMonth = () => shiftMonth(monthKey(new Date()), -1);
let month = lastMonth();

function saveAll(msgId) {
  const ok = store.save("budget", items) && store.save("settlements", settlements);
  if (!ok) $(msgId).textContent = "저장이 안 됐어. 저장 공간을 확인해 줘.";
}

const amountInput = (id, value, label, attr) =>
  `<input class="field mono won" inputmode="numeric" ${attr}="${esc(id)}" value="${value ? num(value) : ""}" placeholder="0" aria-label="${esc(label)}">`;

// ---------- 예산 ----------
function renderBudget() {
  $("budgetCats").innerHTML = CATEGORIES.map((c) => {
    const rows = items.filter((x) => x.cat === c.key);
    return `<section class="card" aria-label="${c.label}">
      <div class="card-h"><h2>${c.label}</h2><small class="num" data-cat-total="${c.key}">${formatWon(sumBy(rows, "amount"))}</small></div>
      <ul class="money-rows">${rows.map((x) => `
        <li><span class="name">${esc(x.name)}</span>
          ${amountInput(x.id, x.amount, `${x.name} 예산`, "data-budget")}
          <button class="icon-btn del" data-remove="${esc(x.id)}" aria-label="${esc(x.name)} 지우기"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </li>`).join("")}</ul>
      ${rows.length ? "" : `<p class="empty">아직 항목이 없어.</p>`}
      <form class="add-money" data-add="${c.key}" autocomplete="off">
        <input class="field" name="itemName" maxlength="20" placeholder="항목 이름" aria-label="${c.label} 새 항목 이름">
        <input class="field mono won" name="itemAmount" inputmode="numeric" placeholder="금액" aria-label="${c.label} 새 항목 금액">
        <button class="btn btn-primary" type="submit">추가</button>
      </form>
    </section>`;
  }).join("");
  updateBudgetTotals();
}

function updateBudgetTotals() {
  $("budgetTotal").textContent = num(sumBy(items, "amount"));
  for (const c of CATEGORIES) {
    const el = document.querySelector(`[data-cat-total="${c.key}"]`);
    if (el) el.textContent = formatWon(sumBy(items.filter((x) => x.cat === c.key), "amount"));
  }
}

// ---------- 지난달 결산 ----------
function renderSettle() {
  $("monthLabel").textContent = monthLabel(month);
  $("nextMonth").disabled = month >= lastMonth();
  const rows = settlementRows(items, settlements[month]);
  $("settleEmpty").hidden = rows.length > 0;
  $("settleCats").innerHTML = CATEGORIES.map((c) => {
    const catRows = rows.filter((x) => x.cat === c.key);
    if (!catRows.length) return "";
    return `<section class="card" aria-label="${c.label} 결산">
      <div class="card-h"><h2>${c.label}</h2><small>실제로 쓴 돈</small></div>
      <ul class="money-rows">${catRows.map((x) => `
        <li><span class="name">${esc(x.name)}<span class="sub num">예산 ${formatWon(x.budget)}</span></span>
          ${amountInput(x.id, x.actual, `${x.name} 실제로 쓴 돈`, "data-actual")}
        </li>`).join("")}</ul>
    </section>`;
  }).join("");
  renderStats();
}

const meter = (pct, status) =>
  `<div class="meter st-${status.key}"><i style="width:${Math.min(100, pct)}%"></i></div>`;
const chip = (status) => (status.label ? `<span class="st-chip st-${status.key}">${status.label}</span>` : "");

function renderStats() {
  const rows = settlementRows(items, settlements[month]);
  const { total, byCat } = settlementStats(rows);
  $("statTotal").innerHTML = `
    <div class="card-h"><h2>한 달 합계</h2>${chip(total.status)}</div>
    <div class="stat mono">${num(total.actual)}<span> / ${formatWon(total.budget)}</span></div>
    <p class="mini">예산의 <span class="mono">${total.pct}%</span> 를 썼어.</p>
    ${meter(total.pct, total.status)}`;
  $("statCats").innerHTML = byCat.map((c) => `
    <li><div class="row-h"><b>${c.label}</b><span>${chip(c.status)} <span class="mono">${c.pct}%</span></span></div>
      <span class="sub num">${formatWon(c.actual)} / ${formatWon(c.budget)}</span>
      ${meter(c.pct, c.status)}</li>`).join("");
}

// ---------- 전환 ----------
function showPage(page) {
  document.querySelectorAll("#moneyPick button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.page === page)));
  for (const p of ["budget", "settle", "buy"]) $(`page-${p}`).hidden = p !== page;
  if (page === "budget") renderBudget();
  if (page === "settle") renderSettle();
}

export function startBudget() {
  showPage("budget");
  $("moneyPick").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]");
    if (b) showPage(b.dataset.page);
  });

  // 예산: 추가
  $("budgetCats").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const f = form.elements;
    const r = addBudgetItem(items, form.dataset.add, f.namedItem("itemName").value, f.namedItem("itemAmount").value);
    $("budgetMsg").textContent = r.error;
    if (r.error) return;
    items = r.items;
    saveAll("budgetMsg");
    renderBudget();
    document.querySelector(`[data-add="${form.dataset.add}"] [name="itemName"]`).focus();
  });
  // 예산: 금액 고치기 (쓰는 대로 저장, 칸을 벗어나면 쉼표로 정리)
  $("budgetCats").addEventListener("input", (e) => {
    const id = e.target.dataset.budget;
    if (!id) return;
    const r = setBudgetAmount(items, id, e.target.value);
    $("budgetMsg").textContent = r.error;
    if (r.error) return;
    items = r.items;
    saveAll("budgetMsg");
    updateBudgetTotals();
  });
  // 예산: 지우기
  $("budgetCats").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-remove]");
    if (!b) return;
    items = removeBudgetItem(items, b.dataset.remove);
    saveAll("budgetMsg");
    renderBudget();
  });

  // 결산: 실제로 쓴 돈
  $("settleCats").addEventListener("input", (e) => {
    const id = e.target.dataset.actual;
    if (!id) return;
    const r = setActual(settlements, month, items, id, e.target.value);
    $("settleMsg").textContent = r.error;
    if (r.error) return;
    settlements = r.settlements;
    saveAll("settleMsg");
    renderStats();
  });
  $("prevMonth").addEventListener("click", () => { month = shiftMonth(month, -1); renderSettle(); });
  $("nextMonth").addEventListener("click", () => { month = shiftMonth(month, 1); renderSettle(); });

  // 금액 칸을 벗어나면 1234567 → 1,234,567
  $("screen-money").addEventListener("focusout", (e) => {
    if (!e.target.classList.contains("won")) return;
    const n = parseWon(e.target.value);
    if (!Number.isNaN(n)) e.target.value = n ? num(n) : "";
  });
}
