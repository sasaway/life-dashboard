// 아래에서 올라오는 창. 한 번에 하나만 연다.
// 닫기: [data-close] 버튼, 바깥 어두운 곳 누르기, Esc
let current = null;
let returnFocus = null;

export function openSheet(id) {
  if (current) closeSheet(false);
  returnFocus = document.activeElement;
  current = document.getElementById(id);
  current.hidden = false;
  current.querySelector(".sheet").scrollTop = 0;
  document.body.classList.add("sheet-open");
  current.querySelector("[data-close]")?.focus();
}

export function closeSheet(restoreFocus = true) {
  if (!current) return;
  current.hidden = true;
  current = null;
  document.body.classList.remove("sheet-open");
  if (restoreFocus) returnFocus?.focus?.();
}

export function startSheets() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]") || e.target.classList.contains("sheet-wrap")) closeSheet();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });
}
