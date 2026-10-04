// 설정 창의 '기록 시트 연결' (v1.8 취미 시트 → v2.6 라이프 기록 → v2.7 픽업 일정 받기 → v2.9 일정 설정 · 앞으로 7일).
// 기록을 저장하면 몇 초 모았다가 심부름꾼에게 통째로 보낸다. 앱을 열 때 날짜가 바뀌어 있으면 한 번 보낸다.
// 일과표 · 요일별 알바를 고치거나 캘린더 알바가 바뀌어 일정 탭에 적을 줄이 달라졌을 때도 보낸다 (v2.9).
// 못 보내면 '보낼 것 있음' 만 기억해 두고, 앱을 다시 열거나 인터넷이 돌아오면 다시 보낸다.
// 받는 건 '픽업 일정' 탭 하나 (Claude 가 적는 탭): 앱을 열 때 · 돌아올 때, 마지막으로 받은 지 6시간이 넘었을 때만. 못 받으면 저장해 둔 걸 쓴다.
import { store } from "./store.js";
import { isHelperUrl } from "./calendar.js";
import { payload, replyError, TAB_GROUPS } from "./hobby-sync.js";
import { scheduleSnapshot } from "./schedule-sync.js";
import { DEFAULT_GEAR, migrateGear } from "./warframe.js";
import { withUpcoming } from "./wuwa.js";
import { pad } from "./schedule.js";
import { reviewDay } from "./review.js";
import { getScheduleSettings } from "./schedule-view.js";
import { emptyPickups, shouldFetch, readPickupReply, pickupsOf, pickupNames, isTentative, isRerun } from "./pickups.js";
import { $, esc } from "./dom.js";

const KEY = "hobbySync"; // { url, token, dirty, sentAt, sentDay, error } — 주소·암호 글자는 폰에만 (코드·GitHub 에는 없음)
const WAIT = 3000;       // 저장이 이어지면 3초 모았다가 한 번
const OFF = { url: "", token: "", dirty: false, sentAt: 0, sentDay: "", error: "" };
let conf = { ...OFF, ...store.load(KEY, {}) };
let timer = 0;
let busy = false;
let changes = 0; // 보내는 사이에 또 저장했는지 알려고 센다
let pk = { ...emptyPickups(), ...store.load("wuwaPickups", {}) }; // 받은 픽업 일정 (v2.7)
let pkBusy = false;
let pkError = "";
let editing = false; // 연결된 뒤 '주소·암호 바꾸기' 를 눌러 칸을 펼쳤는지
let schedSig = ""; // 마지막으로 본 일정 탭 줄 (일정 설정 · 앞으로 7일) — 달라졌는지 견주려고
const schedNow = () => JSON.stringify(scheduleSnapshot({ settings: getScheduleSettings(), overrides: store.load("mealOverrides", {}) }, new Date()));

const save = () => store.save(KEY, conf);
export const hobbySyncOn = () => Boolean(conf.url && conf.token);

const timeLabel = (ms) => {
  const d = new Date(ms);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === new Date().toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};

const mdOf = (ms) => `${new Date(ms).getMonth() + 1}/${new Date(ms).getDate()}`;
// 설정 목록 줄 오른쪽의 짧은 상태: '안 됨' / '연결됨' / '보냄 22:10 · 픽업 10/1' (픽업 = 마지막으로 받은 날)
export const hobbySyncState = () => (!hobbySyncOn() ? "안 됨"
  : [conf.sentAt ? `보냄 ${timeLabel(conf.sentAt)}` : "연결됨", pk.at ? `픽업 ${mdOf(pk.at)}` : ""].filter(Boolean).join(" · "));

// msg = 연결 카드에 띄울 말 (주소가 다를 때 등). 보낸 결과는 'Claude 가 읽는 기록' 카드에
function render(msg = "") {
  const on = hobbySyncOn();
  const form = !on || editing; // 연결된 뒤에는 주소·암호 칸을 접어 둔다 (v2.9)
  $("hsStatus").textContent = on ? "연결됨" : "연결 안 됨";
  $("hsForm").hidden = !form;
  $("hsSave").hidden = !form;
  $("hsEdit").hidden = form;
  $("hsOff").hidden = !on;
  $("hsSave").textContent = on ? "바꾸고 보내기" : "연결하고 보내기";
  $("hsMsg").textContent = msg;

  $("hsSentAt").textContent = !on ? "" : conf.sentAt ? `마지막으로 보냄 ${timeLabel(conf.sentAt)}` : "아직 보낸 적 없어";
  $("hsTabs").innerHTML = TAB_GROUPS.map((g) => `<li><b>${g.name}</b><span>${g.tabs.join(" · ")}</span></li>`).join("");
  $("hsSync").hidden = !on;
  $("hsSendMsg").textContent = !on ? "연결하면 기록을 저장할 때마다 보내."
    : busy ? "보내는 중…"
    : conf.error ? `못 보냄 — ${conf.error}`
    : conf.dirty ? (navigator.onLine ? "보낼 게 있어. 곧 보낼게." : "못 보냄 — 인터넷이 없어. 연결되면 보낼게.")
    : "";
  renderPickups();
}

// 'Claude 가 채우는 픽업 일정' 카드: 받은 줄 목록 (읽기 전용). 연결을 끊어도 받아 둔 건 남아 있다
function renderPickups() {
  const on = hobbySyncOn();
  const now = new Date();
  const list = pickupsOf(pk);
  $("hsPkAt").textContent = pk.at ? `마지막으로 받음 ${timeLabel(pk.at)}` : on ? "아직 받은 적 없어" : "";
  $("hsPkGet").hidden = !on;
  const tag = (t) => `<span class="mark">${t}</span>`;
  $("hsPkList").innerHTML = list.map((p) => `<li${p.to <= now ? ' class="past"' : ""}>
    ${esc([p.version, p.phase, p.char].filter(Boolean).join(" · "))}${isTentative(p) ? tag("예정") : ""}${isRerun(p) ? tag("복각") : ""}${p.to <= now ? tag("끝남") : ""}
    <span class="sub">${esc(`${p.start} ~ ${p.end}`)}${p.weapon ? esc(` · 전무 ${p.weapon}`) : ""}</span></li>`).join("");
  const skipped = pk.rows.length - list.length;
  $("hsPkMsg").textContent = pkBusy ? "받는 중…"
    : pkError ? `${pkError}${pk.at ? " 저장해 둔 걸 쓰고 있어." : ""}`
    : !pk.at ? (on ? "" : "연결하면 받아 와.")
    : !list.length ? "시트에 픽업 일정이 아직 없어. 픽업 페이지에는 직접 적으면 돼."
    : skipped ? `${skipped}줄은 공명자 이름이나 날짜를 못 읽어서 뺐어.` : "";
}

// '픽업 일정' 탭 받기. force = '지금 받기' 버튼 (6시간이 안 지났어도)
async function fetchPickups(force = false) {
  if (!hobbySyncOn() || pkBusy) return;
  if (!force && !shouldFetch(pk, Date.now())) return;
  if (!navigator.onLine) { pkError = "인터넷이 없어서 못 받았어."; return render(); }
  pkBusy = true;
  render();
  try {
    // 암호 글자는 주소가 아니라 보내는 글 안에 (주소에 드러나지 않게). text/plain 이라 사전 확인 없이 간다
    const res = await fetch(conf.url, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ token: conf.token, action: "pickups" }),
    });
    const json = await res.json();
    const got = readPickupReply(json, Date.now());
    if (got) {
      pk = got;
      pkError = "";
      store.save("wuwaPickups", pk);
      document.dispatchEvent(new Event("ww-pickups")); // 명조 화면이 새 공명자·다음 픽업을 다시 그린다
    } else if (json?.ok === true) {
      // 옛 심부름꾼은 이 요청을 '빈 기록 보내기' 로 알고 탭을 비운다 → 바로 다시 보내서 채워 둔다
      pkError = "심부름꾼이 옛 코드야. 새 코드로 바꿔 붙이고 '새 버전' 으로 배포해 줘.";
      markSyncDirty();
    } else {
      pkError = replyError(json);
    }
  } catch {
    pkError = "인터넷이 안 되거나 심부름꾼이 답을 안 해서 못 받았어.";
  } finally {
    pkBusy = false;
    render();
  }
}

// 보낼 때마다 폰에 저장된 걸 새로 읽는다 (화면 코드와 얽히지 않게)
function readAll() {
  const chars = store.load("wuwaChars", { list: [] }).list ?? [];
  return {
    gear: migrateGear(store.load("wfGear", DEFAULT_GEAR)),
    parties: store.load("wuwaParties", []),
    builds: store.load("wuwaBuilds", {}),
    chars: withUpcoming(chars, pickupNames(pk)),
    settings: getScheduleSettings(),
    overrides: store.load("mealOverrides", {}),
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
  schedSig = schedNow(); // 이번에 보내는 일정 줄 (식단 칸을 바꿔 보낸 뒤 캘린더를 다시 받아도 또 보내지 않게)
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

// 기록(장비 목록·파티표·운동 세트·식단 칸·회고·명조/워프레임 체크·할 일·일정 설정)을 저장한 뒤 부른다. 연결 안 했으면 아무것도 안 한다
export function markSyncDirty() {
  if (!hobbySyncOn()) return;
  changes += 1;
  conf.dirty = true;
  save();
  later();
}

// 일과표 고치기 · 요일별 알바 · 캘린더 알바가 저장됐을 때. 캘린더 알바는 30분마다 새로 받아 저장하니, 일정 탭에 적을 줄이 정말 달라졌을 때만 보낸다
function onScheduleChange() {
  const sig = schedNow();
  if (sig === schedSig) return;
  schedSig = sig;
  markSyncDirty();
}

// 앱을 열 때 · 앱으로 돌아올 때 · 인터넷이 돌아올 때: 날짜가 바뀌었으면 한 번 보내고, 전에 못 보낸 게 있으면 다시 보낸다
function wake() {
  if (!hobbySyncOn()) return;
  if (conf.sentDay !== reviewDay(new Date())) conf.dirty = true;
  send();
  fetchPickups();
}

// 입력칸은 설정을 열 때만 저장된 값으로 채운다 (잘못 붙여 넣었을 때 지우지 않게)
function fill() {
  $("hsUrl").value = conf.url;
  $("hsToken").value = conf.token;
}

export function openHobbySyncSettings() {
  editing = false;
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
    editing = false;
    save();
    send();
    fetchPickups(true);
  });
  $("hsEdit").addEventListener("click", () => {
    editing = true;
    render();
    $("hsUrl").focus();
  });
  // 이 화면에 들어올 때마다 칸을 다시 접고 저장된 값으로 (펼쳐 둔 채 나갔다 와도)
  document.addEventListener("settings-page", (e) => {
    if (e.detail === "hs") openHobbySyncSettings();
  });
  $("hsPkGet").addEventListener("click", () => fetchPickups(true));
  $("hsSync").addEventListener("click", () => {
    conf.dirty = true;
    conf.error = "";
    send();
  });
  $("hsOff").addEventListener("click", () => {
    conf = { ...OFF };
    editing = false;
    save();
    fill();
    render("연결을 끊었어. 시트는 그대로 남아 있어.");
  });
  schedSig = schedNow();
  document.addEventListener("schedule-change", onScheduleChange); // 일과표 고치기 · 요일별 알바 · 캘린더 알바
  wake();
  addEventListener("online", wake);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });
}
