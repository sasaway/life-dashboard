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
  // 설정 목록 (v1.9)
  chevronLeft: svg('<path d="m15 18-6-6 6-6"/>'),
  chevronRight: svg('<path d="m9 18 6-6-6-6"/>'),
  bookOpen: svg('<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4-2z"/>'),
  calendarDays: svg('<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>'),
  listOrdered: svg('<path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/>'),
  calendarSync: svg('<path d="M11 10v4h4"/><path d="m11 14 1.535-1.605a5 5 0 0 1 8 1.5"/><path d="M16 2v3"/><path d="m21 18-1.535 1.605a5 5 0 0 1-8-1.5"/><path d="M21 22v-4h-4"/><path d="M21 8.517V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.517"/><path d="M3 9h4"/><path d="M8 2v3"/>'),
  sheet: svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 9v12"/><path d="M15 9v12"/>'),
  archive: svg('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'),
};
