// 날짜·시간 글자 만들기. 화면과 테스트가 같이 쓴다.

export const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

// DESIGN.md 5번: 사용자 이름 대신 시간대 인사말
export function greeting(hour) {
  if (hour < 5) return "편안한 밤";
  if (hour < 12) return "좋은 아침";
  if (hour < 18) return "좋은 오후";
  return "좋은 저녁";
}

// "금요일, 9월 25일"
export function dateLabel(d) {
  return `${DAYS[d.getDay()]}요일, ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
