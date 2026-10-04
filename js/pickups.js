// 픽업 일정 자동 채우기 (v2.7, 은월 요청 2026-10-03). 계산만 — 받기는 hobby-sync-view.js, 화면은 gacha-view.js.
// 시트 '라이프 기록' 의 '픽업 일정' 탭은 Claude 가 적는다. 앱은 읽기만 하고, 가챠 픽업 계획의 공명자와 날짜만 채운다.
// 체인 · 전무 · 스택은 은월 몫이라 건드리지 않고, 은월이 직접 고친 공명자·날짜는 절대 덮어쓰지 않는다.
// 저장 칸 wuwaPickups: { at: 받은 시각(ms), updated: 탭 1줄 '마지막 갱신: …', rows: [[칸 10개 글자], …] } — 받은 그대로 둔다
// 줄의 칸: 버전 · 페이즈 · 시작 · 끝 · 5성 공명자 · 전용 무기 · 복각 · 상태 · 출처 · 확인한 날. 시작·끝은 'YYYY-MM-DD HH:mm' (한국 시간 = 폰 시계)
import { ymd } from "./schedule.js";
import { squash } from "./wuwa.js";

export const FETCH_EVERY = 6 * 3600e3; // 마지막으로 받은 지 6시간이 넘었을 때만 다시 받는다
export const COLS = 10;
const MAX_ROWS = 100;

export const emptyPickups = () => ({ at: 0, updated: "", rows: [] });
export const shouldFetch = (saved, now) => now - (saved?.at ?? 0) >= FETCH_EVERY;

// 심부름꾼 답 → 저장할 모양. 답이 이상하면(옛 심부름꾼은 rows 가 없다) null
export function readPickupReply(json, now) {
  if (json?.ok !== true || !Array.isArray(json.rows)) return null;
  const rows = json.rows.filter(Array.isArray).slice(0, MAX_ROWS)
    .map((r) => Array.from({ length: COLS }, (_, i) => String(r[i] ?? "").trim().slice(0, 200)));
  return { at: now, updated: String(json.updated ?? "").slice(0, 200), rows };
}

// 'YYYY-MM-DD HH:mm' → 날짜 (시각이 없으면 00:00). 못 읽으면 null
export function parseWhen(text) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(String(text ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

// 저장된 줄 → 픽업 목록 (시작 순). 공명자 이름이 없거나 날짜를 못 읽는 줄은 뺀다
export function pickupsOf(saved) {
  return (saved?.rows ?? []).map(([version, phase, start, end, char, weapon, rerun, status, source, checked]) => ({
    version, phase, start, end, char, weapon, rerun, status, source, checked, from: parseWhen(start), to: parseWhen(end),
  })).filter((p) => squash(p.char) && p.from && p.to && p.to > p.from).sort((a, b) => a.from - b.from || a.to - b.to);
}

// 픽업 일정에 나온 공명자 이름들 (encore.moe 목록에 없는 이름은 임시 공명자로 넣는다 — wuwa.js withUpcoming)
export const pickupNames = (saved) => [...new Set(pickupsOf(saved).map((p) => p.char))];

export const isTentative = (p) => p.status.includes("예정");
export const isRerun = (p) => p.rerun.trim() === "예";
export const isOngoing = (p, now) => p.from <= now && now < p.to;
// 아직 안 끝난 픽업
export const livePickups = (list, now) => list.filter((p) => p.to > now);
// 한 줄을 가리키는 이름 (공명자 이름은 띄어쓰기·가운뎃점 무시)
export const rowKey = (p) => `${p.version}|${p.phase}|${squash(p.char)}`;

// '다음 픽업': 진행 중인 페이즈가 있으면 그것(먼저 끝나는 것), 없으면 가장 먼저 시작하는 페이즈. 없으면 null
// 한 페이즈 = 버전과 페이즈가 같은 줄들 (공명자가 여럿일 수 있다)
export function nextPhase(list, now) {
  const groups = new Map();
  for (const p of livePickups(list, now)) {
    const key = `${p.version}|${p.phase}`;
    const g = groups.get(key) ?? { key, version: p.version, phase: p.phase, from: p.from, to: p.to, rows: [] };
    g.rows.push(p);
    if (p.from < g.from) g.from = p.from;
    if (p.to > g.to) g.to = p.to;
    groups.set(key, g);
  }
  const all = [...groups.values()];
  const ongoing = all.filter((g) => g.from <= now).sort((a, b) => a.to - b.to);
  const coming = all.filter((g) => g.from > now).sort((a, b) => a.from - b.from);
  return ongoing[0] ?? coming[0] ?? null;
}

// 과금 상품의 '픽업 날까지 최대 n개' 힌트용 (v2.8): 지금부터 픽업 날(date)까지 걸치는 페이즈 · 버전 수. 일정이 없으면 null.
// 지금은 늘 어떤 페이즈 안이니, 시트에 진행 중인 페이즈가 안 적혀 있으면 하나를 더 센다
export function phasesUntil(list, now, date) {
  const end = parseWhen(`${date} 23:59`);
  if (!list.length || !end) return null;
  const live = livePickups(list, now).filter((p) => p.from <= end);
  const ongoing = live.some((p) => p.from <= now);
  return {
    phases: new Set(live.map((p) => `${p.version}|${p.phase}`)).size + (ongoing ? 0 : 1),
    versions: Math.max(1, new Set(live.map((p) => p.version)).size),
  };
}

// 계획에 넣을 날짜: 이미 진행 중인 픽업이면 끝나는 날, 아직 안 시작했으면 시작하는 날
export const planDate = (p, now) => ymd(isOngoing(p, now) ? p.to : p.from);

// 일정이 바뀌었는지 알아보는 글자 (그 페이즈의 공명자·시작·끝)
export const signature = (group) => (group
  ? `${group.key}|${group.rows.map((p) => `${squash(p.char)}@${p.start}~${p.end}`).sort().join(",")}`
  : "");

const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
export const rangeLabel = (p) => `${md(p.from)}~${md(p.to)}`;
// '3.7 · 2페이즈 · 쇄명 · 10/21~11/11'
export const phaseLabel = (g) => [g.version, g.phase, g.rows.map((p) => p.char).join(", "), rangeLabel(g)].filter(Boolean).join(" · ");

const BY_HAND = "manual";
export const byHand = (plan) => plan.charBy === BY_HAND || plan.dateBy === BY_HAND;

// 픽업 한 줄을 계획에 넣는다 (공명자와 날짜만). resolve(이름) → { id, name } (공명자 목록과 맞춘 것).
// 바뀐 게 없으면 받은 plan 을 그대로 돌려준다
export function applyPickup(plan, row, now, resolve) {
  const c = resolve(row.char);
  const next = { ...plan, char: c.id, charName: c.name, date: planDate(row, now), charBy: "auto", dateBy: "auto", autoKey: rowKey(row) };
  return JSON.stringify(next) === JSON.stringify(plan) ? plan : next;
}

// 자동 채우기. 은월이 공명자나 날짜를 직접 고쳤으면 아무것도 안 한다.
//  - 전에 채운(또는 은월이 고른) 픽업이 아직 안 끝났으면 그 줄로 날짜만 새로 맞춘다 (시작하면 끝나는 날로)
//  - 아니면 '다음 픽업' 페이즈에 공명자가 한 명일 때만 채운다. 여럿이면 고르지 않는다
export function autoFill(plan, list, now, resolve) {
  if (byHand(plan)) return plan;
  const kept = plan.autoKey ? livePickups(list, now).find((p) => rowKey(p) === plan.autoKey) : null;
  const next = nextPhase(list, now);
  const row = kept ?? (next?.rows.length === 1 ? next.rows[0] : null);
  return row ? applyPickup(plan, row, now, resolve) : plan;
}

// 은월이 직접 고친 값을 표시한다 (what = "char" | "date"). 그때의 일정을 '본 것' 으로 적어 둬서, 일정이 바뀔 때만 안내가 뜬다
export function markByHand(plan, what, list, now) {
  return { ...plan, [`${what}By`]: BY_HAND, autoKey: "", seenKey: signature(nextPhase(list, now)) };
}

// 정하는 법을 고른다 (핫픽스 v2.8.1): '직접 고르기' = 공명자·날짜 둘 다 직접 (값은 그대로, 일정이 바뀌어도 안 바뀐다),
// '픽업 일정대로' = 직접 표시를 풀어서 다음 그릴 때 autoFill 이 채우게 한다
export const toManual = (plan, list, now) => ({ ...plan, charBy: BY_HAND, dateBy: BY_HAND, autoKey: "", seenKey: signature(nextPhase(list, now)) });
export const toAuto = (plan) => ({ ...plan, charBy: "", dateBy: "", autoKey: "" });

// '새 픽업 일정이 있어 · 바꾸기' 안내를 띄울까: 직접 고친 계획이고, 그 뒤에 '다음 픽업' 이 달라졌고, 지금 계획과도 다를 때
export function hasNewPickup(plan, list, now, resolve) {
  const next = nextPhase(list, now);
  if (!next || !byHand(plan) || signature(next) === plan.seenKey) return false;
  return !next.rows.some((p) => resolve(p.char).id === plan.char && planDate(p, now) === plan.date);
}
