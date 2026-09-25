// 화면 도우미: 여러 화면 파일이 같이 쓴다.
export const $ = (id) => document.getElementById(id);
// 사용자가 적은 글을 화면에 넣기 전에 < & " 같은 글자가 그대로 보이게 바꾼다
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const X_SVG = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';
