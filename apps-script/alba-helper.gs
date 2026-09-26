// 라이프대시보드 '알바 심부름꾼' (구글 Apps Script, 무료)
// 은월 구글 계정 안에서 돈다. 앱이 물어보면 '개인 일정' 캘린더의 알바 날짜와 반(오픈반/마감반)만 알려 준다.
// 다른 일정 제목·메일 등은 절대 내보내지 않는다.
//
// 설치: script.google.com → 새 프로젝트 → 이 코드를 통째로 붙여 넣기 → 저장
//       → 배포 → 새 배포 → 유형 '웹 앱' → 실행: 나 / 액세스: 모든 사용자 → 배포 → 권한 허용
//       → 나온 '웹 앱 URL'(…/exec)을 라이프 앱 설정 '캘린더 알바 연결'에 붙여 넣기
// 코드를 고치면: 배포 → 배포 관리 → 연필 → 버전 '새 버전' → 배포 (주소는 그대로)

const CALENDAR_NAME = "개인 일정";
// 알바 일정 제목에 늘 붙는 낱말(가게 이름 등)이 있으면 붙여 넣은 뒤 여기에 적는다 → 다른 일정과 안 헷갈린다.
// 비워 두면 제목에 '오픈반'·'마감반' 이 있는 일정을 다 알바로 본다. (이 파일은 공개 저장소에 있으니 여기엔 적지 않는다)
const KEYWORD = "";
const DAYS_BACK = 7;    // 지난 7일
const DAYS_AHEAD = 35;  // 앞으로 5주

function doGet() {
  const tz = "Asia/Seoul";
  const day = (d) => Utilities.formatDate(d, tz, "yyyy-MM-dd");
  const cal = CalendarApp.getCalendarsByName(CALENDAR_NAME)[0];
  if (!cal) return reply({ ok: false, error: "no-calendar" });

  const now = new Date();
  const from = new Date(now.getTime() - DAYS_BACK * 864e5);
  const to = new Date(now.getTime() + DAYS_AHEAD * 864e5);
  const shifts = {};
  cal.getEvents(from, to).forEach((ev) => {
    const title = ev.getTitle();
    if (KEYWORD && title.indexOf(KEYWORD) < 0) return;
    const shift = title.indexOf("오픈반") >= 0 ? "open" : title.indexOf("마감반") >= 0 ? "close" : null;
    if (shift) shifts[day(ev.getStartTime())] = shift;
  });
  return reply({ ok: true, from: day(from), to: day(to), shifts: shifts });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
