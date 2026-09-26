// 설정 창의 '캘린더 알바 연결'. 앱을 열 때와 앱으로 돌아올 때(30분마다) 심부름꾼에게 알바 일정을 받아 온다.
import { store } from "./store.js";
import { getScheduleSettings, setCalendar } from "./schedule-view.js";
import { isHelperUrl, readReply, shiftCount } from "./calendar.js";
import { pad } from "./schedule.js";
import { $ } from "./dom.js";

const URL_KEY = "calUrl"; // 심부름꾼 주소는 폰에만 둔다 (코드·GitHub 에는 없음)
const EVERY = 30 * 60e3;
let url = store.load(URL_KEY, "");
let busy = false;

const timeLabel = (ms) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function renderCalendar(msg) {
  const cal = getScheduleSettings().cal;
  const on = Boolean(url);
  $("calStatus").textContent = !on ? "연결 안 됨" : cal ? `알바 ${shiftCount(cal)}일 · ${timeLabel(cal.at)} 받음` : "아직 못 받음";
  $("calUrl").value = url;
  $("calSync").hidden = !on;
  $("calOff").hidden = !on;
  $("calSave").textContent = on ? "주소 바꾸기" : "연결하고 받기";
  if (msg !== undefined) $("calMsg").textContent = msg;
}

// 심부름꾼에게 받아 오기. 못 받으면 마지막으로 받은 걸 그대로 쓴다.
export async function syncCalendar(force = false) {
  const cal = getScheduleSettings().cal;
  if (!url || busy || (!force && cal && Date.now() - cal.at < EVERY)) return;
  busy = true;
  if (force) renderCalendar("받아 오는 중…");
  try {
    const res = await fetch(url, { cache: "no-store" });
    const out = readReply(await res.json());
    if (out.error) {
      renderCalendar(out.error);
      return;
    }
    setCalendar(out.cal);
    renderCalendar(force ? `받았어. 알바 ${shiftCount(out.cal)}일.` : undefined);
  } catch {
    renderCalendar(cal ? `못 받았어. 마지막으로 받은 걸 쓸게 (${timeLabel(cal.at)}).` : "못 받았어. 인터넷과 주소를 확인해 줘.");
  } finally {
    busy = false;
  }
}

export function openCalendarSettings() {
  renderCalendar("");
}

export function startCalendar() {
  $("calSave").addEventListener("click", () => {
    const next = $("calUrl").value.trim();
    if (!isHelperUrl(next)) {
      renderCalendar("주소가 달라. 배포할 때 나온 '웹 앱 URL'(…/exec 로 끝남)을 붙여 넣어 줘.");
      return;
    }
    url = next;
    store.save(URL_KEY, url);
    syncCalendar(true);
  });
  $("calSync").addEventListener("click", () => syncCalendar(true));
  $("calOff").addEventListener("click", () => {
    url = "";
    store.save(URL_KEY, "");
    setCalendar(null);
    renderCalendar("연결을 끊었어. 이제 격주 규칙으로 돌아가.");
  });
  syncCalendar();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncCalendar();
  });
}
