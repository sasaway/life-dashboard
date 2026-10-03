// 설정 창의 '기록 시트 연결' (v1.8 취미 시트 → v2.6 라이프 기록까지).
// 기록을 저장하면 몇 초 모았다가 심부름꾼에게 통째로 보낸다. 앱을 열 때 날짜가 바뀌어 있으면 한 번 보낸다.
// 못 보내면 '보낼 것 있음' 만 기억해 두고, 앱을 다시 열거나 인터넷이 돌아오면 다시 보낸다.
import { store } from "./store.js";
import { isHelperUrl } from "./calendar.js";
import { payload, replyError, SENT_TABS } from "./hobby-sync.js";
import { DEFAULT_GEAR, migrateGear } from "./warframe.js";
import { withUpcoming } from "./wuwa.js";
import { pad } from "./schedule.js";
import { reviewDay } from "./review.js";
import { getScheduleSettings } from "./schedule-view.js";
import { $ } from "./dom.js";

const KEY = "hobbySync"; // { url, token, dirty, sentAt, sentDay, error } — 주소·암호 글자는 폰에만 (코드·GitHub 에는 없음)
const WAIT = 3000;       // 저장이 이어지면 3초 모았다가 한 번
const OFF = { url: "", token: "", dirty: false, sentAt: 0, sentDay: "", error: "" };
let conf = { ...OFF, ...store.load(KEY, {}) };
let timer = 0;
let busy = false;
let changes = 0; // 보내는 사이에 또 저장했는지 알려고 센다

const save = () => store.save(KEY, conf);
export const hobbySyncOn = () => Boolean(conf.url && conf.token);

const timeLabel = (ms) => {
  const d = new Date(ms);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === new Date().toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};

// 설정 목록 줄 오른쪽의 짧은 상태: '안 됨' / '연결됨' / '보냄 22:10'
export const hobbySyncState = () => (!hobbySyncOn() ? "안 됨" : conf.sentAt ? `보냄 ${timeLabel(conf.sentAt)}` : "연결됨");

// msg = 연결 카드에 띄울 말 (주소가 다를 때 등). 보낸 결과는 'Claude 가 읽는 기록' 카드에
function render(msg = "") {
  const on = hobbySyncOn();
  $("hsStatus").textContent = on ? "연결됨" : "연결 안 됨";
  $("hsOff").hidden = !on;
  $("hsSave").textContent = on ? "바꾸고 보내기" : "연결하고 보내기";
  $("hsMsg").textContent = msg;

  $("hsSentAt").textContent = !on ? "" : conf.sentAt ? `마지막으로 보냄 ${timeLabel(conf.sentAt)}` : "아직 보낸 적 없어";
  $("hsTabs").textContent = SENT_TABS.join(" · ");
  $("hsSync").hidden = !on;
  $("hsSendMsg").textContent = !on ? "연결하면 기록을 저장할 때마다 보내."
    : busy ? "보내는 중…"
    : conf.error ? `못 보냄 — ${conf.error}`
    : conf.dirty ? (navigator.onLine ? "보낼 게 있어. 곧 보낼게." : "못 보냄 — 인터넷이 없어. 연결되면 보낼게.")
    : "";
}

// 보낼 때마다 폰에 저장된 걸 새로 읽는다 (화면 코드와 얽히지 않게)
function readAll() {
  const chars = store.load("wuwaChars", { list: [] }).list ?? [];
  return {
    gear: migrateGear(store.load("wfGear", DEFAULT_GEAR)),
    parties: store.load("wuwaParties", []),
    builds: store.load("wuwaBuilds", {}),
    chars: withUpcoming(chars),
    settings: getScheduleSettings(),
    workoutLog: store.load("workoutLog", {}),
    mealLog: store.load("mealLog", {}),
    reviews: store.load("reviews", {}),
    weekReviews: store.load("weekReviews", {}),
    hobbyLog: store.load("hobbyLog", {}),
    todos: store.load("wfTodos", []),
  };
}

async function send() {
  clearTimeout(timer);
  const now = new Date();
  const body = payload(conf, readAll(), now);
  if (!body || busy || !conf.dirty) return;
  if (!navigator.onLine) return render();
  busy = true;
  render();
  const at = changes;
  try {
    // text/plain 이면 브라우저가 사전 확인(preflight) 없이 바로 보낸다 (Apps Script 는 사전 확인에 답을 못 한다)
    const res = await fetch(conf.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    conf.error = replyError(await res.json());
    if (!conf.error) {
      conf.sentAt = Date.now();
      conf.sentDay = reviewDay(now);
      if (changes === at) conf.dirty = false;
    }
  } catch {
    conf.error = "인터넷이 안 되거나 심부름꾼이 답을 안 했어. 앱을 다시 열 때 또 보낼게."; // dirty 는 그대로 두고 다음에 다시
  } finally {
    busy = false;
    save();
    render();
    if (conf.dirty && changes !== at) later();
  }
}

function later() {
  clearTimeout(timer);
  timer = setTimeout(send, WAIT);
}

// 기록(장비 목록·파티표·운동 세트·식단 칸·회고·명조/워프레임 체크·할 일)을 저장한 뒤 부른다. 연결 안 했으면 아무것도 안 한다
export function markSyncDirty() {
  if (!hobbySyncOn()) return;
  changes += 1;
  conf.dirty = true;
  save();
  later();
}

// 앱을 열 때 · 앱으로 돌아올 때 · 인터넷이 돌아올 때: 날짜가 바뀌었으면 한 번 보내고, 전에 못 보낸 게 있으면 다시 보낸다
function wake() {
  if (!hobbySyncOn()) return;
  if (conf.sentDay !== reviewDay(new Date())) conf.dirty = true;
  send();
}

// 입력칸은 설정을 열 때만 저장된 값으로 채운다 (잘못 붙여 넣었을 때 지우지 않게)
function fill() {
  $("hsUrl").value = conf.url;
  $("hsToken").value = conf.token;
}

export function openHobbySyncSettings() {
  fill();
  render();
}

export function startHobbySync() {
  $("hsSave").addEventListener("click", () => {
    const url = $("hsUrl").value.trim();
    const token = $("hsToken").value.trim();
    if (!isHelperUrl(url)) return render("주소가 달라. 배포할 때 나온 '웹 앱 URL'(…/exec 로 끝남)을 붙여 넣어 줘.");
    if (!token) return render("암호 글자를 붙여 넣어 줘. setup 을 돌리면 실행 기록에 나와.");
    conf = { ...conf, url, token, dirty: true, error: "" };
    save();
    send();
  });
  $("hsSync").addEventListener("click", () => {
    conf.dirty = true;
    conf.error = "";
    send();
  });
  $("hsOff").addEventListener("click", () => {
    conf = { ...OFF };
    save();
    fill();
    render("연결을 끊었어. 시트는 그대로 남아 있어.");
  });
  wake();
  addEventListener("online", wake);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });
}
