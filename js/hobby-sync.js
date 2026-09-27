// 취미 시트 연결: 워프레임 장비 목록과 명조 파티표를 구글 시트 '라이프 취미' 로 보낼 모양으로 바꾼다.
// 앱 → 시트 한 방향 (Claude 가 시트를 읽는다). Notion '취미' 2026-09-27 19:57 수정본.
// 시트 탭과 칸 이름은 apps-script/hobby-sync.gs 의 TABS 에 있다. 여기서는 칸 순서대로 값만 만든다.
import { BUILD } from "./wuwa.js";

export const EMPTY_SLOT = "(비어 있음)";
const yes = (b) => (b ? "예" : "아니오");

// 워프레임 장비: 워프레임 | 플레이스타일(쉼표) | 주무기 | Sortie 분류 | 보조무기 | 근접무기 | 동반자 | 위시리스트
// 화면처럼 위시리스트(구매할 예정)는 맨 아래
export function gearRows(gear) {
  const frames = [...gear.frames.filter((f) => !f.wish), ...gear.frames.filter((f) => f.wish)];
  return frames.map((f) => [
    f.frame, f.styles.join(", "), f.primary, f.sortie, f.secondary, f.melee, f.companion, yes(f.wish),
  ]);
}

// 그 외 무기: 이름 한 칸
export const otherRows = (gear) => gear.others.map((n) => [n]);

// 명조 파티: 파티 이름 | 칸 번호 | 공명자 이름 | 육성 체크 5개 (O / 빈칸).
// 공명자는 번호가 아니라 이름으로. 코스트 2 가 두 파티에 있으면 두 줄 다 적는다
export function partyRows(parties, builds, chars) {
  const nameOf = (id) => chars.find((c) => c.id === id)?.name ?? `알 수 없는 공명자 (${id})`;
  return parties.flatMap((p) => p.slots.map((id, i) => [
    p.name, String(i + 1), id ? nameOf(id) : EMPTY_SLOT,
    ...BUILD.map((b) => (id && builds[id]?.[b.id] ? "O" : "")),
  ]));
}

export const snapshot = ({ gear, parties, builds, chars }) => ({
  warframe: gearRows(gear),
  others: otherRows(gear),
  wuwa: partyRows(parties, builds, chars),
});

// 보낼 글. 주소나 암호 글자가 없으면 null (아무것도 안 보낸다)
export function payload(conf, data) {
  if (!conf.url || !conf.token) return null;
  return JSON.stringify({ token: conf.token, ...snapshot(data) });
}

// 심부름꾼 답 → 화면에 띄울 말 ("" = 잘 보냄)
export function replyError(json) {
  if (json?.ok === true) return "";
  if (json?.error === "token") return "암호 글자가 달라. 실행 기록에 나온 걸 다시 붙여 넣어 줘.";
  if (json?.error === "no-setup") return "심부름꾼에서 setup 을 아직 안 돌렸어. 설치 설명 3번을 해 줘.";
  return "심부름꾼 답이 이상해. 주소를 다시 확인해 줘.";
}
