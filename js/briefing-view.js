// 메인의 아침 브리핑 카드. '지금' 카드 바로 아래, 아침(05~12시)에만 보인다.
import { store } from "./store.js";
import { getScheduleSettings } from "./schedule-view.js";
import { dayPlan } from "./schedule.js";
import { planFor } from "./workout.js";
import { dailyCount as wwCount } from "./wuwa.js";
import { dailyCount as wfCount } from "./warframe.js";
import { todayMeals } from "./meals-view.js";
import { chip } from "./wuwa-view.js";
import { isMorning, todayState, markSeen, setFolded, seenCount, briefLines, LINKS } from "./briefing.js";
import { $, esc } from "./dom.js";

const KEY = "briefing";
let state = todayState(store.load(KEY, null), new Date());
const save = (next) => {
  state = next;
  store.save(KEY, state);
  renderBriefing();
};

export function renderBriefing() {
  const now = new Date();
  const card = $("briefCard");
  card.hidden = !isMorning(now);
  if (card.hidden) return;
  state = todayState(state, now); // 날이 바뀌었으면 처음으로

  const lines = briefLines({
    plan: dayPlan(now, getScheduleSettings()),
    meals: todayMeals(),
    gym: planFor(now),
    ww: wwCount(store.load("wuwaChecks", {}), now),
    wf: wfCount(store.load("wfChecks", {}), now),
  });
  $("briefList").innerHTML = lines.map((l) =>
    `<li><span class="k">${esc(l.label)}</span><span class="v">${l.time ? `<span class="mono">${esc(l.time)}</span> · ` : ""}${esc(l.text)}</span></li>`).join("");
  $("briefLinks").innerHTML = LINKS.map((l) => chip(`data-open="${l.id}"`, l.label, state.seen[l.id])).join("");

  const n = seenCount(state);
  $("briefStatus").innerHTML = `메일·일정 <span class="mono">${n} / ${LINKS.length}</span>`;
  $("briefStatus").hidden = state.folded;
  $("briefBody").hidden = state.folded;
  card.classList.toggle("folded", state.folded);
  $("briefUnfold").hidden = !state.folded;
}

// 앱(지메일·구글 캘린더)으로 연다. 잠시 뒤에도 이 화면에 그대로 있으면 앱이 없는 것 → 웹으로
function openApp(link) {
  let left = false;
  const bye = () => { left = true; };
  window.addEventListener("pagehide", bye, { once: true });
  window.addEventListener("blur", bye, { once: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) left = true; }, { once: true });
  location.href = link.app;
  setTimeout(() => {
    if (!left && !document.hidden) window.open(link.web, "_blank", "noopener");
  }, 1500);
}

export function startBriefing() {
  renderBriefing();
  $("briefLinks").addEventListener("click", (e) => {
    const id = e.target.closest("[data-open]")?.dataset.open;
    const link = LINKS.find((l) => l.id === id);
    if (!link) return;
    save(markSeen(state, id)); // 누르는 순간 '봤어' 로 표시
    openApp(link);
  });
  $("briefDone").addEventListener("click", () => save(setFolded(state, true)));
  $("briefUnfold").addEventListener("click", () => save(setFolded(state, false)));
  // 메인에서 체크하거나 식단을 바꾸면 브리핑 숫자도 바로 맞춘다
  document.addEventListener("click", () => requestAnimationFrame(renderBriefing));
}
