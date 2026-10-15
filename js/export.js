// 기록 내보내기 (v3.5): 지난 회고 · 일정표 · 운동 기록만 JSON 파일 하나로.
// 백업(js/backup.js)은 '세이브 파일 통째로' 이고, 이건 '보고 싶은 기록만 골라 담은 상자' 다. 되살리기에는 못 쓴다.
// 여기에는 계산만 둔다 (화면과 떨어져 있어 테스트가 쓴다).
import { QUESTIONS, WEEK_QUESTIONS } from "./review.js";
import { versionTag } from "./backup.js";
import { EXERCISES, ROUTINES, WEEK, VIDEO_URL, REST_BETWEEN_SETS, CARDIO_MINUTES, planFor, planIds, doneSets, searchUrl } from "./workout.js";
import { parseDate } from "./schedule.js";
import { DAYS } from "./time.js";

export const KIND = "life-dashboard-export";
export const FORMAT = 2; // 2: 운동에 루틴 · 설명 · 사진 · 날마다 풀어 쓴 기록
// 담는 칸. 새 칸을 더하면 여기에도 적는다 (백업과 달리 골라 담으니까)
export const KEYS = ["reviews", "weekReviews", "schedule", "workoutLog", "cardioMin"];

// "ld:" 칸 하나를 꺼낸다. 없거나 깨졌으면 기본값
function read(storage, key, fallback) {
  try {
    const raw = storage.getItem(`ld:${key}`);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const byDate = (obj) => Object.fromEntries(Object.entries(obj ?? {}).sort(([a], [b]) => a.localeCompare(b)));

// 운동 루틴: 요일마다 A/B (일요일은 쉼), 루틴마다 준비 · 근력 · 마무리 순서
export function routineOf() {
  const groupsOf = (key) => planFor(new Date(2026, 8, 20 + WEEK.indexOf(key))).groups; // 2026-09-20 은 일요일. 그 루틴을 하는 첫 요일로
  return {
    video: VIDEO_URL,
    restBetweenSets: REST_BETWEEN_SETS,
    week: WEEK.map((key, i) => ({ day: DAYS[i], routine: key, label: key ? ROUTINES[key].label : "쉬는 날" })),
    routines: Object.fromEntries(Object.entries(ROUTINES).map(([key, r]) => [key, {
      label: r.label,
      groups: groupsOf(key).map((g) => ({ title: g.title, exercises: g.ids })),
    }])),
    cardioMinuteChoices: CARDIO_MINUTES,
  };
}

// 운동마다 설명. images: { 사진 이름: { type, data(base64) } } — 화면에서 사진 파일을 읽어 넘겨 준다. 못 읽은 사진은 null
export function exercisesOf(images = {}) {
  return Object.fromEntries(Object.entries(EXERCISES).map(([id, ex]) => [id, {
    name: ex.name,
    part: ex.part,
    amount: ex.amount,
    sets: ex.sets,
    maxSets: ex.maxSets,
    tips: ex.tips,
    youtube: searchUrl(id),
    image: { file: `images/exercise/${ex.img}.jpg`, ...(images[ex.img] ? { type: images[ex.img].type, data: images[ex.img].data } : { type: null, data: null }) },
  }]));
}

// 날마다 풀어 쓴 기록: 그 날 루틴 · 운동마다 한 세트 / 기본 세트 · 유산소 분
export function daysOf(log, cardioMin) {
  const days = [...new Set([...Object.keys(log), ...Object.keys(cardioMin)])].sort();
  return days.map((day) => {
    const plan = planFor(parseDate(day));
    const ids = [...new Set([...planIds(plan), ...Object.keys(log[day] ?? {}).filter((id) => EXERCISES[id])])];
    return {
      date: day,
      weekday: DAYS[parseDate(day).getDay()],
      routine: plan.key,
      label: plan.label,
      exercises: ids.map((id) => ({ id, name: EXERCISES[id].name, done: doneSets(log, day, id), sets: EXERCISES[id].sets })),
      cardioMin: cardioMin[day] ?? null,
    };
  });
}

// 내보내기 한 벌
export function makeExport({ storage, appVersion, images = {}, at = new Date() }) {
  const daily = byDate(read(storage, "reviews", {}));
  const weekly = byDate(read(storage, "weekReviews", {}));
  const log = byDate(read(storage, "workoutLog", {}));
  const cardioMin = byDate(read(storage, "cardioMin", {}));
  const schedule = read(storage, "schedule", null);
  return {
    kind: KIND, format: FORMAT, version: String(appVersion ?? ""), at: at.toISOString(),
    counts: {
      reviews: Object.keys(daily).length,
      weekReviews: Object.keys(weekly).length,
      workoutDays: Object.keys(log).length,
      cardioDays: Object.keys(cardioMin).length,
      images: Object.values(images).filter((x) => x?.data).length,
    },
    // 회고: 날짜(주간은 그 주 월요일)마다 answers 네 칸. 몇 번째 칸이 어떤 질문인지 같이 적는다
    reviews: { questions: QUESTIONS, weekQuestions: WEEK_QUESTIONS, daily, weekly },
    // 일정표: 앱이 쓰는 일과표 설정 그대로 (반마다 칸 · 요일별 알바 · 캘린더에서 받은 알바 날). 아직 안 고쳤으면 null = 기본값
    schedule,
    // 운동: 루틴 · 운동 설명(사진 포함) · 날마다 기록. log · cardioMin 은 앱이 저장한 모양 그대로. 앱은 최근 60일만 들고 있다
    workout: {
      routine: routineOf(),
      exercises: exercisesOf(images),
      days: daysOf(log, cardioMin),
      log,
      cardioMin,
    },
  };
}

// life-dashboard-export-v3.5-20261015.json (날짜는 내보낸 날, 폰 시간)
export function exportFileName(e) {
  const d = new Date(e.at);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `life-dashboard-export-${versionTag(e.version)}-${ymd}.json`;
}

// 설정 화면의 한 줄 요약: "회고 12일 · 주간회고 2주 · 운동 8일"
export const exportSummary = (e) => `회고 ${e.counts.reviews}일 · 주간회고 ${e.counts.weekReviews}주 · 운동 ${e.counts.workoutDays}일`;
