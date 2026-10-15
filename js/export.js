// 기록 내보내기 (v3.5): 지난 회고 · 일정표 · 운동 기록만 JSON 파일 하나로.
// 백업(js/backup.js)은 '세이브 파일 통째로' 이고, 이건 '보고 싶은 기록만 골라 담은 상자' 다. 되살리기에는 못 쓴다.
// 여기에는 계산만 둔다 (화면과 떨어져 있어 테스트가 쓴다).
import { QUESTIONS, WEEK_QUESTIONS } from "./review.js";
import { versionTag } from "./backup.js";

export const KIND = "life-dashboard-export";
export const FORMAT = 1;
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

// 내보내기 한 벌
export function makeExport({ storage, appVersion, at = new Date() }) {
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
    },
    // 회고: 날짜(주간은 그 주 월요일)마다 answers 네 칸. 몇 번째 칸이 어떤 질문인지 같이 적는다
    reviews: { questions: QUESTIONS, weekQuestions: WEEK_QUESTIONS, daily, weekly },
    // 일정표: 앱이 쓰는 일과표 설정 그대로 (반마다 칸 · 요일별 알바 · 캘린더에서 받은 알바 날). 아직 안 고쳤으면 null = 기본값
    schedule,
    // 운동: 날짜마다 체크한 세트, 유산소 달린 분. 앱은 최근 60일만 들고 있다
    workout: { log, cardioMin },
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
