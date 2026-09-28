// 설정 창의 '취미 시트 연결'. 장비 목록·파티표를 저장하면 몇 초 모았다가 심부름꾼에게 통째로 보낸다.
// 못 보내면 '보낼 것 있음' 만 기억해 두고, 앱을 다시 열거나 인터넷이 돌아오면 다시 보낸다.
import { store } from "./store.js";
import { isHelperUrl } from "./calendar.js";
import { payload, replyError } from "./hobby-sync.js";
import { DEFAULT_GEAR, migrateGear } from "./warframe.js";
import { withUpcoming } from "./wuwa.js";
import { pad } from "./schedule.js";
import { $ } from "./dom.js";

const KEY = "hobbySync"; // { url, token, dirty, sentAt, error } — 주소·암호 글자는 폰에만 (코드·GitHub 에는 없음)
const WAIT = 3000;       // 저장이 이어지면 3초 모았다가 한 번
let conf = store.load(KEY, { url: "", token: "", dirty: false, sentAt: 0, error: "" });
let timer = 0;
let busy = false;
let changes = 0; // 보내는 사이에 또 저장했는지 알려고 센다

const save = () => store.save(KEY, conf);
export const hobbySyncOn = () => Boolean(conf.url && conf.token); // 설정 목록의 '연결됨 / 안 됨'

const timeLabel = (ms) => {
  const d = new Date(ms);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === new Date().toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};

function render(msg) {
  const on = hobbySyncOn();
  $("hsStatus").textContent = on ? "연결됨" : "연결 안 됨";
  $("hsSync").hidden = !on;
  $("hsOff").hidden = !on;
  $("hsSave").textContent = on ? "바꾸고 보내기" : "연결하고 보내기";
  $("hsMsg").textContent = msg ?? (!on ? ""
    : conf.error ? conf.error
    : conf.dirty ? (conf.sentAt ? `못 보냄 — 다음에 다시 시도 (마지막으로 보냄 ${timeLabel(conf.sentAt)})` : "못 보냄 — 다음에 다시 시도")
    : conf.sentAt ? `마지막으로 보냄 ${timeLabel(conf.sentAt)}` : "");
}

// 보낼 때마다 폰에 저장된 걸 새로 읽는다 (화면 코드와 얽히지 않게)
function readHobby() {
  const chars = store.load("wuwaChars", { list: [] }).list ?? [];
  return {
    gear: migrateGear(store.load("wfGear", DEFAULT_GEAR)),
    parties: store.load("wuwaParties", []),
    builds: store.load("wuwaBuilds", {}),
    chars: withUpcoming(chars),
  };
}

async function send() {
  clearTimeout(timer);
  const body = payload(conf, readHobby());
  if (!body || busy || !conf.dirty) return;
  if (!navigator.onLine) return render();
  busy = true;
  const at = changes;
  try {
    // text/plain 이면 브라우저가 사전 확인(preflight) 없이 바로 보낸다 (Apps Script 는 사전 확인에 답을 못 한다)
    const res = await fetch(conf.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    conf.error = replyError(await res.json());
    if (!conf.error) {
      conf.sentAt = Date.now();
      if (changes === at) conf.dirty = false;
    }
  } catch {
    conf.error = ""; // 인터넷·서버 문제: dirty 는 그대로 두고 다음에 다시
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

// 장비 목록·파티표를 저장한 뒤 부른다. 연결 안 했으면 아무것도 안 한다
export function markHobbyDirty() {
  if (!conf.url || !conf.token) return;
  changes += 1;
  conf.dirty = true;
  save();
  later();
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
    render("보내는 중…");
    send();
  });
  $("hsSync").addEventListener("click", () => {
    conf.dirty = true;
    render("보내는 중…");
    send();
  });
  $("hsOff").addEventListener("click", () => {
    conf = { url: "", token: "", dirty: false, sentAt: 0, error: "" };
    save();
    fill();
    render("연결을 끊었어. 시트는 그대로 남아 있어.");
  });
  send(); // 전에 못 보낸 게 있으면
  addEventListener("online", send);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) send();
  });
}
