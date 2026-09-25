// 사야 할 것 화면: 메인 카드(별표만)와 돈 탭 목록.
import { store } from "./store.js";
import { addItem, toggleStar, bring, starred, mainEmptyText } from "./shopping.js";
import { ymd } from "./schedule.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

let list = store.load("shopping", []);  // [{ id, name, star }]
let bought = store.load("bought", []);  // [{ name, day }] 식단 추천용

function save() {
  const ok = store.save("shopping", list) && store.save("bought", bought);
  if (!ok) $("buyMsg").textContent = "저장이 안 됐어. 저장 공간을 확인해 줘.";
}

const bringBtn = (x) =>
  `<button class="btn btn-ghost" data-bring="${esc(x.id)}" aria-label="${esc(x.name)} 가져옴">가져옴</button>`;

function render() {
  // 메인: 별표만
  const top = starred(list);
  $("buyMain").innerHTML = top.map((x) => `
    <li><span class="star" aria-hidden="true">★</span><span class="name">${esc(x.name)}</span>${bringBtn(x)}</li>`).join("");
  $("buyMainEmpty").textContent = mainEmptyText(list);
  $("buyMainEmpty").hidden = top.length > 0;

  // 돈 탭: 전부
  $("buyAll").innerHTML = list.map((x) => `
    <li>
      <button class="star-btn" data-star="${esc(x.id)}" aria-pressed="${x.star}" aria-label="${esc(x.name)} 별표">${x.star ? "★" : "☆"}</button>
      <span class="name">${esc(x.name)}</span>${bringBtn(x)}
    </li>`).join("");
  $("buyAllEmpty").hidden = list.length > 0;
  $("buyCount").textContent = list.length ? `${list.length}개 · 별표 ${top.length}개` : "";
}

// 항목이 부드럽게 사라진 뒤 목록에서 뺀다 (시안 .gone)
function bringItem(btn) {
  const li = btn.closest("li");
  document.querySelectorAll(`[data-bring="${CSS.escape(btn.dataset.bring)}"]`).forEach((b) => { b.disabled = true; });
  li.classList.add("gone");
  setTimeout(() => {
    ({ list, bought } = bring(list, bought, btn.dataset.bring, ymd(new Date())));
    save();
    render();
    document.dispatchEvent(new CustomEvent("bought-change")); // 식단 추천이 새 재료를 본다
  }, 260);
}

export function startShopping() {
  render();

  $("buyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = addItem(list, $("buyInput").value);
    $("buyMsg").textContent = r.error;
    if (r.error) return;
    list = r.list;
    save();
    render();
    $("buyInput").value = "";
    $("buyInput").focus();
  });

  for (const id of ["buyMain", "buyAll"]) {
    $(id).addEventListener("click", (e) => {
      const bringB = e.target.closest("button[data-bring]");
      if (bringB) return bringItem(bringB);
      const starB = e.target.closest("button[data-star]");
      if (starB) {
        const sid = starB.dataset.star;
        list = toggleStar(list, sid);
        save();
        render();
        $("buyAll").querySelector(`[data-star="${CSS.escape(sid)}"]`)?.focus();
      }
    });
  }
}
