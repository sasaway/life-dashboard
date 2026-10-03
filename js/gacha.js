// 명조 가챠 기댓값 계산기 (v2.4 재화 · v2.5 픽업). Notion '가챠 기댓값 계산기' (2026-09-29 23:00). 계산만 — 화면은 gacha-view.js.
// 재화 이름은 줄여 부른다: 별의소리 = 별소 / 금빛 파도의 무늬 = 캐릭뽑 / 울린 조수의 무늬 = 무기뽑
import { parseDate, ymd } from "./schedule.js";

// ---------- 가챠 규칙 (여기 한 곳에만 둔다) ----------
// 공식 수치: 게임 안 '획득 확률 안내' (1연 160 별소, 5성 기본 0.8%, 80연째 5성 확정, 캐릭 픽업 50%·놓치면 다음 5성 확정,
//            무기 픽업은 5성이면 늘 픽업 무기, 스택·확정 상태는 다음 같은 종류 픽업으로 이어진다)
export const PULL_COST = 160;
export const BASE_RATE = 0.008;
export const HARD_PITY = 80;
// 커뮤니티 통계 (종합 확률 약 1.8%): 5성 한 번에 평균 약 56연. 공식 수치가 아니라 화면에는 '대략' 으로 쓴다.
// 66연쯤부터 오른다는 '소프트 천장' 은 공식 수치가 없어서 확률 곡선은 만들지 않는다 (사용자 결정: % 대신 판정만)
export const AVG_PER_FIVE = 56;

// 받는 재화 기본값 (모두 화면에서 고칠 수 있다)
export const DAILY_ASTRITE = 60;       // 일일 의뢰 하루 별소
export const MONTHLY_PER_DAY = 90;     // 월정액 하루 별소 (대략)
export const MONTHLY_MAX_DAYS = 30;    // 월정액 한 번에 30일
export const PASS_ASTRITE = 680;       // 유료 패스 별소 (대략)
export const PASS_CHAR = 2;            // 유료 패스 캐릭뽑 (대략)
export const PASS_CHAR_DELAY = 21;     // 유료 패스 캐릭뽑은 산 뒤 3주에 받는다고 친다 (사용자 결정 v2.4.1)
// 무과금 '그 밖에 받을 것' 칸 아래 참고 글 (커뮤니티 추정)
export const FREE_HINT = "3.7 한 버전(43일) 추정: 주간 약 960 · 이벤트 약 3,680 · 탐사·퀘스트 약 4,192 · 로그인·상점 약 925 (커뮤니티 추정)";

const MAX_COUNT = 9_999_999;

// ---------- 저장 칸 wuwaGacha ----------
// { have: { astrite, char, weap },                       ← 지금 가진 것
//   free: { daily, astrite, char },                      ← 무과금: 일일 의뢰 하루 값, 그 밖에 받을 것
//   paid: { monthly, monthlyDay, pass, passAstrite, passChar, passDate, topup },  ← 과금: 켬/끔과 값, passDate = 패스 산 날
//   plan: { date,                                        ← 픽업 날짜 "2026-10-14" (없으면 "")
//           char, charName, chain, owned, weapon,        ← v2.5 공명자(번호 · 이름), 목표 체인 0~6, 가진 체인(-1 = 없음), 전무 켬/끔
//           stack, guaranteed, wStack,                   ← 캐릭 픽업 스택 0~79 · 확정 켬/끔, 무기 픽업 스택
//           charBy, dateBy, autoKey, seenKey } }         ← v2.7 픽업 일정: 공명자·날짜를 누가 넣었나 ("" · "auto" Claude 일정 · "manual" 직접),
//                                                           채운 픽업 줄, 직접 고칠 때 본 일정 (js/pickups.js)
export const defaultGacha = () => ({
  have: { astrite: 0, char: 0, weap: 0 },
  free: { daily: DAILY_ASTRITE, astrite: 0, char: 0 },
  paid: { monthly: false, monthlyDay: MONTHLY_PER_DAY, pass: false, passAstrite: PASS_ASTRITE, passChar: PASS_CHAR, passDate: "", topup: 0 },
  plan: { date: "", char: "", charName: "", chain: 0, owned: -1, weapon: false, stack: 0, guaranteed: false, wStack: 0,
    charBy: "", dateBy: "", autoKey: "", seenKey: "" },
});

// 저장된 값에 빠진 칸이 있으면 기본값으로 채운다 (나중에 칸이 늘어도 옛 저장이 그대로 열린다)
export function normalizeGacha(saved) {
  const base = defaultGacha();
  if (!saved || typeof saved !== "object") return base;
  const out = {};
  for (const [group, fields] of Object.entries(base)) out[group] = { ...fields, ...(saved[group] ?? {}) };
  // v2.6 까지 적어 둔 공명자·날짜는 은월이 직접 넣은 것 → 픽업 일정(v2.7)이 덮어쓰지 않게 '직접' 으로 옮긴다
  if (saved.plan && !("charBy" in saved.plan)) {
    if (out.plan.char) out.plan.charBy = "manual";
    if (out.plan.date) out.plan.dateBy = "manual";
  }
  return out;
}

// 숫자 칸 글자 → 개수. 빈칸은 0, 음수·글자가 섞이면 0. 쉼표·띄어쓰기는 무시한다
export function count(text) {
  const digits = String(text ?? "").replace(/[,\s]/g, "");
  if (!/^\d+$/.test(digits)) return 0;
  return Math.min(Number(digits), MAX_COUNT);
}

// ---------- 연차 ↔ 별소 ----------
export const astriteOf = (pulls) => Math.max(0, pulls) * PULL_COST;
// 모두 합쳐 n연 = 별소 ÷ 160 (버림) + 캐릭뽑 + 무기뽑
export const pullsOf = ({ astrite = 0, char = 0, weap = 0 }) => Math.floor(astrite / PULL_COST) + char + weap;

// ---------- 픽업까지 남은 날 ----------
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? "");
// 오늘(폰 날짜 = 한국 시간) 자정부터 픽업 날 자정까지 며칠. 날짜가 없으면 null, 지났으면 음수
export function daysUntil(date, now) {
  if (!isDate(date)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseDate(date) - today) / 864e5);
}

// 유료 패스 캐릭뽑: 산 날 + 3주. 그 날이 픽업 날(당일 포함) 전이면 합계에 넣는다
export function passCharDay(g) {
  if (!isDate(g.paid.passDate)) return null;
  const d = parseDate(g.paid.passDate);
  return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + PASS_CHAR_DELAY));
}
export const passCharIn = (g) => Boolean(g.paid.pass && isDate(g.plan.date) && passCharDay(g) && passCharDay(g) <= g.plan.date);
export const dLabel = (days) => (days > 0 ? `D-${days}` : days === 0 ? "D-day" : "지났어");

// ---------- 픽업 날까지 모이는 재화 ----------
// days = 남은 날. 날짜가 없거나 지났으면(null · 음수) 앞으로 받을 것은 계산하지 않는다
export function income(g, days) {
  const d = days > 0 ? days : 0;
  const free = { astrite: g.free.daily * d + g.free.astrite, char: g.free.char, weap: 0 };
  const monthlyDays = Math.min(d, MONTHLY_MAX_DAYS);
  const paid = {
    astrite: (g.paid.monthly ? g.paid.monthlyDay * monthlyDays : 0) + (g.paid.pass ? g.paid.passAstrite : 0) + g.paid.topup,
    char: passCharIn(g) ? g.paid.passChar : 0,
    weap: 0,
  };
  const add = (a, b) => ({ astrite: a.astrite + b.astrite, char: a.char + b.char, weap: a.weap + b.weap });
  const freeOnly = add(g.have, free);
  return { free, paid, monthlyDays, freeOnly, withPaid: add(freeOnly, paid) };
}

// ---------- v2.5 픽업 계산 ----------
export const CHAINS = [0, 1, 2, 3, 4, 5, 6];
export const chainLabel = (n) => (n < 0 ? "없음" : n === 0 ? "명함" : `${n}체인`);
export const MAX_STACK = HARD_PITY - 1; // 79연째까지 5성이 없을 수 있다

// 데려올 5성 캐릭 수: 목표 체인 + 1 (가진 게 없을 때), 가진 체인이 있으면 그만큼 뺀다
export const copiesNeeded = (chain, owned) => (owned < 0 ? chain + 1 : Math.max(chain - owned, 0));

// 5성이 몇 번 나와야 하나: 픽뚫 안 당함 = n번, 픽뚫 당함 = 2n번. 확정 상태면 첫 장은 두 경우 모두 5성 1번
export function fiveStars(n, guaranteed) {
  if (n <= 0) return { win: 0, lose: 0 };
  return { win: n, lose: guaranteed ? 2 * n - 1 : 2 * n };
}

// 5성 k번에 드는 연차. 첫 5성만 지금 스택을 반영한다
//   평균(대략): max(56 − 스택, 1) + 56 × (k − 1)   최악(천장, 정확): (80 − 스택) + 80 × (k − 1)
export function pullsFor(k, stack) {
  if (k <= 0) return { avg: 0, worst: 0 };
  const s = Math.min(Math.max(stack, 0), MAX_STACK);
  return {
    avg: Math.max(AVG_PER_FIVE - s, 1) + AVG_PER_FIVE * (k - 1),
    worst: HARD_PITY - s + HARD_PITY * (k - 1),
  };
}

// 두 경우('픽뚫 안 당함' win / '픽뚫 당함' lose). 전무를 켜면 무기 픽업 연차를 따로 더한다 (무기는 늘 픽업 무기라 한 번)
export function expectation(plan) {
  const copies = copiesNeeded(plan.chain, plan.owned);
  const k = fiveStars(copies, plan.guaranteed);
  const weapon = plan.weapon ? pullsFor(1, plan.wStack) : { avg: 0, worst: 0 };
  const side = (fives) => {
    const char = pullsFor(fives, plan.stack);
    return { fives, char, weapon, avg: char.avg + weapon.avg, worst: char.worst + weapon.worst };
  };
  return { copies, win: side(k.win), lose: side(k.lose) };
}

// 필요 별소 = (필요 연차 − 해당 뽑권) × 160, 0보다 작으면 0. 캐릭뽑은 캐릭 쪽에만, 무기뽑은 무기 쪽에만
export function astriteNeeded(side, kind, funds) {
  return astriteOf(side.char[kind] - funds.char) + astriteOf(side.weapon[kind] - funds.weap);
}

// 판정 한 줄: 최악(천장)이어도 되면 '최악이어도 확정', 평균이면 되면 '평균이면 가능', 아니면 평균까지 몇 연 모자란지
export function verdict(side, funds) {
  if (astriteNeeded(side, "worst", funds) <= funds.astrite) return { key: "sure", text: "최악이어도 확정" };
  const avg = astriteNeeded(side, "avg", funds);
  if (avg <= funds.astrite) return { key: "avg", text: "평균이면 가능" };
  const short = Math.ceil((avg - funds.astrite) / PULL_COST);
  return { key: "short", short, text: `${short}연 부족` };
}
