// 기록 시트 연결: 워프레임 장비 목록 · 명조 파티표 (v1.8), 라이프 기록 (v2.6), 일정 설정 · 앞으로 7일 (v2.9) 을 구글 시트 '라이프 기록' 으로 보낼 모양으로 바꾼다.
// 앱 → 시트 한 방향 (Claude 가 시트를 읽는다). Notion '취미' 2026-09-27 19:57 수정본 + 은월 요청 2026-10-03.
// 시트 탭과 칸 이름은 apps-script/hobby-sync.gs 의 TABS 에 있다. 여기서는 칸 순서대로 값만 만든다.
import { BUILD } from "./wuwa.js";
import { gearItems } from "./warframe.js";
import { lifeSnapshot } from "./life-sync.js";
import { scheduleSnapshot } from "./schedule-sync.js";

export const EMPTY_SLOT = "(비어 있음)";
// 앱이 적는 탭 이름 (설정 화면에 보여 준다). apps-script/hobby-sync.gs 의 TABS 와 같아야 한다 — 테스트가 맞춰 본다
// 설정 화면에는 묶음으로 보여 준다 (v2.9)
export const TAB_GROUPS = [
  { name: "취미", tabs: ["워프레임 장비", "그 외 무기", "명조 파티", "워프레임 육성"] },
  { name: "기록", tabs: ["오늘 요약", "최근 14일", "식단 기록", "운동 기록", "취미 체크", "회고 기록"] },
  { name: "일정", tabs: ["일정 설정", "앞으로 7일"] },
];
export const SENT_TABS = TAB_GROUPS.flatMap((g) => g.tabs);
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

// 워프레임 육성 (v3.3): 장비마다 한 줄 — 워프레임 | 자리 | 장비 이름 | 리액터/카탈리스트 | 목표 모딩 | 모딩 완료 | 포르마 | 진행도.
// 줄 순서는 '워프레임 장비' 탭과 같고 (위시리스트 맨 아래), 그 외 무기는 워프레임 칸이 빈칸 · 자리 '그 외 무기'. 위 두 탭은 그대로 둔다
export const buildRows = (gear) => gearItems(gear).map((x) => [
  x.frame, x.label, x.name, yes(x.build.cat), x.build.goal, yes(x.build.done), String(x.build.forma), `${x.pct}%`,
]);

// 취미 탭 네 개 (워프레임 육성은 v3.3) + 라이프 기록 탭 여섯 개 (v2.6, js/life-sync.js) + 일정 탭 두 개 (v2.9, js/schedule-sync.js)
export const snapshot = (data, now) => ({
  warframe: gearRows(data.gear),
  others: otherRows(data.gear),
  wuwa: partyRows(data.parties, data.builds, data.chars),
  wfBuild: buildRows(data.gear),
  ...lifeSnapshot(data, now),
  ...scheduleSnapshot(data, now),
});

// 보낼 글. 주소나 암호 글자가 없으면 null (아무것도 안 보낸다)
export function payload(conf, data, now) {
  if (!conf.url || !conf.token) return null;
  return JSON.stringify({ token: conf.token, ...snapshot(data, now) });
}

// 심부름꾼 답 → 화면에 띄울 말 ("" = 잘 보냄)
export function replyError(json) {
  if (json?.ok === true) return "";
  if (json?.error === "token") return "암호 글자가 달라. 실행 기록에 나온 걸 다시 붙여 넣어 줘.";
  if (json?.error === "no-setup") return "심부름꾼에서 setup 을 아직 안 돌렸어. 설치 설명 3번을 해 줘.";
  return "심부름꾼 답이 이상해. 주소를 다시 확인해 줘.";
}
