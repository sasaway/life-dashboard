// 라이프대시보드 '취미 심부름꾼' (구글 Apps Script, 무료)
// 은월 구글 계정 안에서 돈다. 스프레드시트 '라이프 기록' (옛 이름 '라이프 취미') 과 앱 사이를 잇는다.
//
// 탭은 두 가지다.
//  - 앱이 적는 탭 (TABS 열한 개): 앱이 보낸 기록을 통째로 새로 적는다. Claude 는 읽기만 한다.
//      워프레임 장비 · 그 외 무기 · 명조 파티 · 오늘 요약 · 최근 14일 · 식단 기록 · 운동 기록 · 취미 체크 · 회고 기록
//      일정 설정 (요일별 알바 · 반마다 일과표 · 규칙) · 앞으로 7일 (날마다 실제 일과와 끼니 메뉴) — v2.9
//  - Claude 가 적는 탭 ('픽업 일정' 하나): 심부름꾼과 앱은 절대 지우거나 덮어쓰지 않고, 읽어서 앱에 돌려주기만 한다.
// 탭마다 1줄은 '마지막 동기화' (Claude 탭은 '마지막 갱신'), 2줄은 칸 이름, 3줄부터 값.
// 받는 탭과 칸 수는 여기서 정해 둔다. 그 밖의 값은 받지도 적지도 않는다. 몸무게·키는 어느 탭에도 없다.
// 시트에서 고친 건 앱으로 가지 않는다 ('픽업 일정' 만 앱이 읽는다).
//
// 설치 (알바 심부름꾼과 따로 하나 더 만든다):
//  1. script.google.com → 새 프로젝트 → 이름을 '취미 심부름꾼' 으로 → 이 코드를 통째로 붙여 넣기 → 저장
//  2. 위쪽 함수 고르는 칸에서 'setup' 을 고르고 ▶ 실행 → 권한 허용 (구글 시트 만들기·고치기)
//  3. 아래 '실행 기록' 에 나온 두 줄을 확인한다
//       - 암호 글자: 앱에 붙여 넣을 글자 (다른 사람에게 보여 주지 않는다)
//       - 시트 주소: 드라이브의 '라이프 기록' 스프레드시트
//  4. 배포 → 새 배포 → 유형 '웹 앱' → 실행: 나 / 액세스: 모든 사용자 → 배포
//  5. 나온 '웹 앱 URL'(…/exec)과 3번의 암호 글자를 라이프 앱 설정 '기록 시트 연결' 에 붙여 넣고 '연결하고 보내기'
// 암호 글자를 잊으면: 다시 setup ▶ 실행 → 실행 기록에 같은 글자가 또 나온다 (새로 만들려면 newToken ▶ 실행)
// 코드를 고치면: setup ▶ 한 번 (새 탭 만들기) → 배포 → 배포 관리 → 연필 → 버전 '새 버전' → 배포 (주소는 그대로)

const FILE_NAME = "라이프 기록";
const TZ = "Asia/Seoul";
const DAY = ["날짜", "요일", "반", "운동 부위", "운동 세트", "준비·마무리", "집 끼니", "알바 끼니", "단백질 합(g)", "22g 넘긴 끼니/먹은 끼니",
  "회고", "명조 일일", "명조 주간", "워프레임", "워프레임 남은 할 일"];
// 앱이 적는 탭: 이름 · 칸 이름. 앱(js/hobby-sync.js · js/life-sync.js · js/schedule-sync.js)이 이 순서대로 값을 보낸다. max = 한 칸 글자 수 (기본 100)
const TABS = [
  { key: "warframe", name: "워프레임 장비", header: ["워프레임", "플레이스타일", "주무기", "Sortie 분류", "보조무기", "근접무기", "동반자", "위시리스트"] },
  { key: "others", name: "그 외 무기", header: ["무기"] },
  { key: "wuwa", name: "명조 파티", header: ["파티 이름", "칸 번호", "공명자 이름", "레벨 돌파", "무기 돌파", "스킬작", "에코작 대충", "에코작 준종결"] },
  { key: "today", name: "오늘 요약", header: DAY },
  { key: "recent", name: "최근 14일", header: DAY },
  { key: "meals", name: "식단 기록", header: ["날짜", "끼니", "메뉴", "단백질(g)"] },
  { key: "workouts", name: "운동 기록", header: ["날짜", "부위", "운동 이름", "한 세트/기본 세트"] },
  { key: "hobby", name: "취미 체크", header: ["날짜", "명조 일일", "명조 주간", "워프레임"] },
  { key: "reviews", name: "회고 기록", header: ["날짜", "구분", "질문", "답"], max: 2000 },
  { key: "plan", name: "일정 설정", header: ["구분", "반/요일", "시작", "끝", "칸 이름", "설명"] },
  { key: "next7", name: "앞으로 7일", header: ["날짜", "요일", "반", "반 출처", "시작", "끝", "칸 이름", "설명", "끼니 메뉴"] },
];
// Claude 가 적는 탭. 한 줄 = 한 공명자 픽업. 시작·끝은 'YYYY-MM-DD HH:mm' (한국 시간)
const PICKUP = {
  name: "픽업 일정",
  note: "마지막 갱신: (아직 없음) · Claude 가 적는 탭이야. 앱과 심부름꾼은 읽기만 해.",
  header: ["버전", "페이즈", "시작", "끝", "5성 공명자", "전용 무기", "복각", "상태", "출처", "확인한 날"],
};
const MAX_ROWS = 500;
const MAX_TEXT = 100;
const MAX_PICKUPS = 100;

// 처음 한 번 · 코드를 고친 뒤 한 번: 시트와 빠진 탭을 만들고 암호 글자를 정한다. 이미 있는 건 그대로 두고 다시 보여 준다
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("TOKEN")) props.setProperty("TOKEN", Utilities.getUuid().replace(/-/g, ""));
  const ss = sheetFile();
  if (ss.getName() !== FILE_NAME) ss.rename(FILE_NAME); // '라이프 취미' → '라이프 기록' (같은 파일, 주소 그대로)
  TABS.forEach((t) => {
    if (!ss.getSheetByName(t.name)) writeTab(ss, t, [], "마지막 동기화: (아직 없음)");
  });
  if (!ss.getSheetByName(PICKUP.name)) {
    const sh = ss.insertSheet(PICKUP.name);
    sh.getRange(1, 1).setValue(PICKUP.note);
    sh.getRange(2, 1, 1, PICKUP.header.length).setValues([PICKUP.header]).setFontWeight("bold");
  }
  Logger.log("암호 글자: " + props.getProperty("TOKEN"));
  Logger.log("시트 주소: " + ss.getUrl());
}

// 암호 글자를 새로 만든다 (앱에도 새 글자를 다시 붙여 넣어야 한다)
function newToken() {
  PropertiesService.getScriptProperties().deleteProperty("TOKEN");
  setup();
}

// 앱이 부르는 곳. 암호 글자는 주소가 아니라 보내는 글 안에 있다 (주소에 드러나지 않게 — 받기도 POST 로 한다)
//  - { token, action: "pickups" }  → '픽업 일정' 탭을 읽어서 돌려준다 (아무것도 적지 않는다)
//  - { token, warframe, … }        → 앱이 적는 탭을 통째로 새로 적는다
function doPost(e) {
  const token = PropertiesService.getScriptProperties().getProperty("TOKEN");
  if (!token) return reply({ ok: false, error: "no-setup" });
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "bad" });
  }
  if (!data || data.token !== token) return reply({ ok: false, error: "token" });
  if (data.action === "pickups") return reply(readPickups(sheetFile()));

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = sheetFile();
    const stamp = "마지막 동기화: " + Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
    TABS.forEach((t) => writeTab(ss, t, cleanRows(data[t.key], t.header.length, t.max || MAX_TEXT), stamp));
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

// 스프레드시트를 찾는다. 없으면(처음이거나 지웠으면) 드라이브에 새로 만들고 ID 를 기억한다
function sheetFile() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SHEET_ID");
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      // 지웠으면 새로 만든다
    }
  }
  const ss = SpreadsheetApp.create(FILE_NAME);
  ss.getSheets()[0].setName(TABS[0].name);
  props.setProperty("SHEET_ID", ss.getId());
  return ss;
}

// 받은 값은 글자로만, 칸 수를 맞추고, 너무 길거나 많으면 자른다.
// = + - @ 로 시작하면 시트가 수식으로 읽으니 앞에 ' 를 붙여 글자로 둔다
function cleanRows(rows, width, maxText) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, MAX_ROWS).map((row) => {
    const cells = Array.isArray(row) ? row : [];
    const out = [];
    for (let i = 0; i < width; i++) {
      const v = String(cells[i] == null ? "" : cells[i]).slice(0, maxText);
      out.push(/^[=+\-@]/.test(v) ? "'" + v : v);
    }
    return out;
  });
}

// 앱이 적는 탭을 통째로 새로 적는다: 1줄 마지막 동기화 · 2줄 칸 이름 · 3줄부터 목록.
// 값은 전부 글자로 둔다 ('3/4' 가 날짜로, '2026-10-03' 이 날짜 값으로 바뀌지 않게)
function writeTab(ss, tab, rows, stamp) {
  const sh = ss.getSheetByName(tab.name) || ss.insertSheet(tab.name);
  sh.clearContents();
  sh.getRange(1, 1).setValue(stamp);
  sh.getRange(2, 1, 1, tab.header.length).setValues([tab.header]).setFontWeight("bold");
  if (rows.length) sh.getRange(3, 1, rows.length, tab.header.length).setNumberFormat("@").setValues(rows);
}

// '픽업 일정' 탭을 읽기만 한다. 날짜 칸이 시트에서 날짜 값으로 바뀌어 있어도 'yyyy-MM-dd HH:mm' 글자로 돌려준다
function readPickups(ss) {
  const sh = ss.getSheetByName(PICKUP.name);
  if (!sh) return { ok: true, updated: "", rows: [] };
  const text = (v) => (v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd HH:mm") : String(v == null ? "" : v).trim().slice(0, 200));
  const last = Math.min(sh.getLastRow(), MAX_PICKUPS + 2);
  const rows = last < 3 ? [] : sh.getRange(3, 1, last - 2, PICKUP.header.length).getValues()
    .map((row) => row.map(text))
    .filter((row) => row.some((v) => v));
  return { ok: true, updated: text(sh.getRange(1, 1).getValue()), rows: rows };
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
