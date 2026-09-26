// 아이콘: Lucide (무료, ISC 라이선스 — icons/LICENSE-lucide.txt). 쓰는 것만 옮겨 왔다.
// 모양은 CSS 가 칠한다 (stroke: currentColor).
const svg = (body) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const ICON = {
  plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  trash: svg('<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  chevronDown: svg('<path d="m6 9 6 6 6-6"/>'),
  search: svg('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>'),
  userPlus: svg('<path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/>'),
};
