// 캘린더 알바 연결: 심부름꾼(구글 Apps Script)이 준 답을 확인해서 앱이 쓰는 모양으로 바꾼다.
// 앱에 남는 것: { from, until, shifts: { "2026-11-19": "close" }, at }
//  - from ~ until(캘린더에 적힌 마지막 알바 날) 안에서 알바가 없는 날 = 쉬는 날
//  - 그 밖의 날은 예전처럼 격주 규칙

// 심부름꾼 주소 모양: https://script.google.com/macros/s/(긴 글자)/exec
export const isHelperUrl = (u) => /^https:\/\/script\.google\.com\/macros\/(u\/\d+\/)?s\/[\w-]+\/exec$/.test(String(u).trim());

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readReply(json, now = Date.now()) {
  if (!json || json.ok !== true) {
    return { error: json?.error === "no-calendar" ? "'개인 일정' 캘린더를 못 찾았어." : "심부름꾼 답이 이상해. 주소를 다시 확인해 줘." };
  }
  if (!DAY.test(json.from ?? "") || typeof json.shifts !== "object" || json.shifts === null) {
    return { error: "심부름꾼 답이 이상해. 코드를 다시 붙여 넣어 줘." };
  }
  const shifts = {};
  for (const [day, shift] of Object.entries(json.shifts)) {
    if (DAY.test(day) && (shift === "open" || shift === "close")) shifts[day] = shift;
  }
  const days = Object.keys(shifts).sort();
  return { cal: { from: json.from, until: days.at(-1) ?? null, shifts, at: now } };
}

// 받은 알바 날 수 (설정 창에 보여 줄 것)
export const shiftCount = (cal) => Object.keys(cal?.shifts ?? {}).length;
