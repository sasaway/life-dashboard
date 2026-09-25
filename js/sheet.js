// 아래에서 올라오는 창. 한 번에 하나만 연다.
// 닫기: [data-close] 버튼, 바깥 어두운 곳 누르기, Esc
let current = null;
let returnFocus = null;
const guards = {}; // 창 id → 닫기 전에 부르는 함수. false 를 돌려주면 안 닫는다

// 쓰다 만 글이 있는 창처럼, 닫기 전에 물어봐야 할 때
export const guardSheet = (id, fn) => { guards[id] = fn; };

export function openSheet(id) {
  if (current && !closeSheet(false)) return;
  returnFocus = document.activeElement;
  current = document.getElementById(id);
  current.hidden = false;
  current.querySelector(".sheet").scrollTop = 0;
  document.body.classList.add("sheet-open");
  current.querySelector("[data-close]")?.focus();
}

// 닫았으면 true
export function closeSheet(restoreFocus = true) {
  if (!current) return true;
  if (guards[current.id]?.() === false) return false;
  const closed = current;
  closed.hidden = true;
  current = null;
  document.body.classList.remove("sheet-open");
  if (restoreFocus) returnFocus?.focus?.();
  document.dispatchEvent(new CustomEvent("sheet-close", { detail: closed.id }));
  return true;
}

export function startSheets() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]") || e.target.classList.contains("sheet-wrap")) closeSheet();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });
}
