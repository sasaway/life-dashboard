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

// 앱 안 확인 창 (브라우저 기본 confirm 대신). 열린 창 위에 뜬다. 고르면 true / false
export function askConfirm(text, okLabel) {
  const box = document.getElementById("confirmBox");
  document.getElementById("confirmText").textContent = text;
  document.getElementById("confirmOk").textContent = okLabel;
  box.hidden = false;
  document.getElementById("confirmNo").focus();
  return new Promise((resolve) => {
    const done = (yes) => {
      box.hidden = true;
      box.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey, true);
      resolve(yes);
    };
    const onClick = (e) => {
      if (e.target.closest("#confirmOk")) done(true);
      else if (e.target.closest("#confirmNo") || e.target === box) done(false);
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // 밑에 열린 창까지 닫히지 않게
      done(false);
    };
    box.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey, true);
  });
}
