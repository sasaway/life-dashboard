// 설정 › 식단 메뉴 (핫픽스 v3.0.6): 메뉴마다 자동 배정에 쓰는 끼니 · 자동 배정 넣기/빼기 · 이름만 있는 메뉴 추가.
// 계산은 meals.js (toggleAllowed 등), 여기서는 저장 칸 mealMenu 를 읽고 쓰고 화면만 그린다.
import { store } from "./store.js";
import { MEALS, DISHES, setMealMenu, toggleAllowed, toggleAuto, addCustom, renameCustom, removeCustom, resetMenu } from "./meals.js";
import { askConfirm } from "./sheet.js";
import { ICON } from "./icons.js";
import { $, esc } from "./dom.js";

const KEY = "mealMenu";
let menu = store.load(KEY, {}); // 기본값에서 바뀐 것만 (모양은 meals.js)
setMealMenu(menu);              // 식단 · 시트가 계산하기 전에 지금 메뉴로

export const menuState = () => `메뉴 ${DISHES.length}개`;

const BLOCKED = "이 끼니에 쓸 메뉴가 하나는 있어야 해.";
// 고친 값 저장. 막힌 변경(받은 값이 그대로 돌아옴)이면 안내만 한다
function apply(next, blocked = BLOCKED) {
  if (next === menu) { $("menuMsg").textContent = blocked; return false; }
  menu = next;
  store.save(KEY, menu);
  setMealMenu(menu);
  render();
  document.dispatchEvent(new CustomEvent("schedule-change")); // 식단을 다시 계산하고, 일정 탭 줄이 달라졌으면 시트에도 보낸다
  return true;
}

// 고칠 수 없는 특징은 읽기 전용 알약으로만
const marks = (d) => [
  d.custom && "직접", d.makesTwo && "2끼분", d.afterOpen && "오픈반 저녁 먼저", d.weekMax && `주 ${d.weekMax}번까지`, d.work && "알바 중만",
].filter(Boolean).map((t) => `<span class="mark">${t}</span>`).join("");

function render() {
  $("menuMsg").textContent = "";
  $("menuRows").innerHTML = DISHES.map((d) => `<li class="menu-row">
    <div class="menu-name">${d.custom
      ? `<input class="field" data-name="${esc(d.id)}" value="${esc(d.name)}" maxlength="20" aria-label="메뉴 이름">
         <button class="icon-btn del" data-del="${esc(d.id)}" aria-label="${esc(d.name)} 메뉴 지우기">${ICON.trash}</button>`
      : `<b>${esc(d.name)}</b>`}</div>
    <div class="menu-marks">${marks(d)}</div>
    ${d.work ? "" : `<div class="menu-chips" role="group" aria-label="${esc(d.name)} 자동 배정">
      ${MEALS.map((m) => `<button class="pin" data-id="${esc(d.id)}" data-meal="${m}" aria-pressed="${d.allowed.includes(m)}" aria-label="${esc(d.name)} ${m}">${m}</button>`).join("")}
      <button class="pin menu-auto" data-auto="${esc(d.id)}" aria-pressed="${!d.off}" aria-label="${esc(d.name)} 자동 배정">${d.off ? "뺌" : "자동"}</button>
    </div>`}
  </li>`).join("");
}

export function startMealMenu() {
  document.addEventListener("settings-page", (e) => { if (e.detail === "menu") render(); });
  $("menuRows").addEventListener("click", async (e) => {
    const chip = e.target.closest("button[data-meal]");
    if (chip) return apply(toggleAllowed(menu, chip.dataset.id, chip.dataset.meal));
    const auto = e.target.closest("button[data-auto]");
    if (auto) return apply(toggleAuto(menu, auto.dataset.auto));
    const del = e.target.closest("button[data-del]");
    if (!del) return;
    const name = DISHES.find((d) => d.id === del.dataset.del)?.name ?? "";
    if (await askConfirm(`'${name}' 메뉴를 지울까? 지난 기록의 이름은 남아.`, "지우기")) apply(removeCustom(menu, del.dataset.del));
  });
  // 직접 추가한 메뉴의 이름: 칸에서 나갈 때 저장 (비우면 원래 이름으로)
  $("menuRows").addEventListener("change", (e) => {
    const id = e.target.dataset.name;
    if (id && !apply(renameCustom(menu, id, e.target.value), "")) render();
  });
  $("menuAdd").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!apply(addCustom(menu, $("menuNew").value, `x-${Date.now()}`), "메뉴 이름을 적어 줘.")) return;
    $("menuNew").value = "";
    $("menuMsg").textContent = "추가했어. 점심 · 저녁에 놓여.";
  });
  $("menuReset").addEventListener("click", async () => {
    if (!menu.allowed && !menu.off) { $("menuMsg").textContent = "이미 기본값이야."; return; }
    if (await askConfirm("끼니 칩과 자동 배정을 처음대로 돌릴까? 직접 추가한 메뉴는 그대로 둬.", "되돌리기")) apply(resetMenu(menu));
  });
}
