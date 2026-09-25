// 운동: 요일별 메뉴와 오늘 체크리스트. 규칙은 Notion '운동' (09:41 수정본).
// 운동과 세트·횟수는 레퍼런스 영상(보통트레이너 초보자 루틴) 화면 자막 그대로 — notes/운동-원본.md
import { ymd } from "./schedule.js";

export const VIDEO_URL = "https://www.youtube.com/watch?v=v3vNHGFlrjY";
const search = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

// sets: 기본 세트, maxSets: 영상에서 '3~5세트' 면 5 (4·5세트는 더 하고 싶을 때)
export const EXERCISES = {
  walk: { name: "걷기 웜업", part: "준비", img: "walk", amount: "5분 · 러닝머신 또는 사이클", sets: 1, maxSets: 1,
    tips: ["몸을 운동 모드로 바꾸는 시간", "속도 5 정도, 몸에 열을 더 올리려면 6~6.5"], q: "헬스장 러닝머신 걷기 웜업" },
  roll: { name: "폼롤러 마사지", part: "준비", img: "roll", amount: "부위마다 10~30번", sets: 1, maxSets: 1,
    tips: ["목·날개뼈 주변·허리·엉덩이·종아리·허벅지를 굴리며 풀기", "기분 좋을 정도로만, 너무 오래 하지 않기"], q: "운동 전 폼롤러 마사지 초보" },
  legpress: { name: "시티드 레그프레스", part: "하체", img: "legpress", amount: "15개 × 3~5세트", sets: 3, maxSets: 5,
    tips: ["발은 발판 가운데 살짝 앞, 골반보다 조금 넓게 11시·1시", "발을 민다 생각 말고 엉덩이 옆 공간을 닫았다 연다", "발바닥 전체를 붙이고, 무릎은 끝까지 펴지 않기"], q: "시티드 레그프레스 자세" },
  latpull: { name: "랫 풀 다운", part: "등", img: "latpull", amount: "15개 × 3~5세트", sets: 3, maxSets: 5,
    tips: ["팔을 올리면 귀와 어깨 사이가 좁아지고, 당기면 넓어진다", "손잡이는 입 앞으로, 너무 무겁게 하지 않기", "손은 어깨보다 살짝 넓게, 양쪽 같은 거리"], q: "랫풀다운 자세" },
  row: { name: "시티드 로우", part: "등", img: "row", amount: "15개 × 3~5세트", sets: 3, maxSets: 5,
    tips: ["몸 앞에 있는 팔꿈치를 몸 뒤로 보내는 운동", "손잡이 모양은 신경 쓰지 않아도 된다"], q: "시티드 로우 머신 자세" },
  chest: { name: "체스트 프레스", part: "가슴", img: "chest", amount: "15개 × 3~5세트", sets: 3, maxSets: 5,
    tips: ["의자 높이: 손잡이가 가슴 가운데 높이", "어깨는 등받이에 붙인 채, 팔은 90%만 펴기", "팔과 몸 사이에 주먹 하나 들어갈 세모 모양 유지"], q: "체스트 프레스 머신 자세" },
  shoulder: { name: "숄더 프레스", part: "어깨", img: "shoulder", amount: "15개 × 3~5세트", sets: 3, maxSets: 5,
    tips: ["손목~팔꿈치가 어느 쪽에서 봐도 바닥과 수직", "팔꿈치가 뒤로 빠지면 어깨를 다칠 수 있다", "어깨가 불편하면 손잡이를 좁게"], q: "숄더 프레스 머신 자세" },
  pecdeck: { name: "펙 덱 플라이", part: "가슴", img: "pecdeck", amount: "15개 × 3세트", sets: 3, maxSets: 3,
    tips: ["팔꿈치를 살짝 굽혀 팔 힘은 빼기", "모을 때가 아니라 벌어질 때 가슴이 늘어나는 느낌"], q: "펙덱 플라이 자세" },
  backext: { name: "백 익스텐션", part: "허리", img: "backext", amount: "10~15개 × 3세트", sets: 3, maxSets: 3,
    tips: ["일자가 끝, 더 뒤로 꺾지 않기", "내려갈 때 들이마시고 올라올 때 내쉬기"], q: "백 익스텐션 자세 초보" },
  crunch: { name: "크런치", part: "복근", img: "crunch", amount: "20개 이상 × 3세트", sets: 3, maxSets: 3,
    tips: ["수건 짧은 쪽을 잡고 머리 뒤로 넘기기", "날개뼈만 바닥에서 뗐다 대기, 머리는 바닥에 대지 않기", "배가 아프기 시작하면 두세 개만 더"], q: "수건 크런치 자세" },
  cardio: { name: "유산소", part: "마무리", img: "cardio", amount: "10~30분 · 러닝머신 4~7 또는 사이클", sets: 1, maxSets: 1,
    tips: ["짧은 대화는 되지만 숨이 조금 찰 정도", "사이클은 페달을 가볍게 하고 빠르게"], q: "헬스 마무리 유산소 러닝머신" },
};
export const searchUrl = (id) => search(EXERCISES[id].q);
export const REST_BETWEEN_SETS = "세트 사이 1분 쉬기";

// A/B 번갈아 (사용자 결정): 같은 근육이 하루 쉬도록. 준비·마무리는 매일.
export const ROUTINES = {
  A: { label: "하체 · 등 · 허리", main: ["legpress", "latpull", "row", "backext"] },
  B: { label: "가슴 · 어깨 · 복근", main: ["chest", "shoulder", "pecdeck", "crunch"] },
};
const WARMUP = ["walk", "roll"];
const FINISH = ["cardio"];
// 요일(일=0) → 루틴. 일요일은 쉰다 (Notion: 일요일 제외 6일)
export const WEEK = [null, "A", "B", "A", "B", "A", "B"];

export function planFor(date) {
  const key = WEEK[date.getDay()];
  if (!key) return { key: null, label: "쉬는 날", groups: [] };
  return {
    key,
    label: ROUTINES[key].label,
    groups: [
      { title: "준비", ids: WARMUP },
      { title: "근력", ids: ROUTINES[key].main },
      { title: "마무리", ids: FINISH },
    ],
  };
}

export const planIds = (plan) => plan.groups.flatMap((g) => g.ids);

// ---------- 체크리스트: { "2026-09-25": { legpress: 2, walk: 1 } } ----------
export const doneSets = (log, day, id) => log[day]?.[id] ?? 0;

// n번째 칸을 누르면 n세트까지 한 것으로. 이미 n세트면 한 칸 되돌린다.
export function tapSet(log, day, id, n) {
  const max = EXERCISES[id].maxSets;
  const cur = doneSets(log, day, id);
  const next = Math.max(0, Math.min(max, cur >= n ? n - 1 : n));
  return { ...log, [day]: { ...(log[day] ?? {}), [id]: next } };
}

// 오늘 얼마나 했는지: 기본 세트 기준 (더 한 세트는 넘치게 세지 않는다)
export function progressOf(log, day, plan) {
  let done = 0;
  let total = 0;
  for (const id of planIds(plan)) {
    total += EXERCISES[id].sets;
    done += Math.min(EXERCISES[id].sets, doneSets(log, day, id));
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// 오래된 기록은 정리한다 (60일)
export function pruneLog(log, today, keepDays = 60) {
  const from = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - keepDays));
  return Object.fromEntries(Object.entries(log).filter(([d]) => d >= from));
}
