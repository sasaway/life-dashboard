// 워프레임 › 오늘 › 숙제 리스트 화면 (v3.4): 필수(＊)는 매일 / 이번 주 두 묶음으로 펼치고, 선택은 접어 둔다. [목록 고치기] 창에서 지우기 · 더하기 · 되돌리기.
// 숙제는 이 카드 안에서만 센다 — 취미 첫 화면의 '오늘 n / 2' 와 기록 시트에는 넣지 않는다 (은월 선택).
import { store } from "./store.js";
import { openSheet, askConfirm } from "./sheet.js";
import { CHECK_SVG } from "./wuwa-view.js";
import { ICON } from "./icons.js";
import {
  TAGS, TAG_NAMES, PERIODS, normalizeChores, choreList, choreSections, toggleChore, addChore, removeChore, resetChores, hiddenCount,
} from "./wf-chores.js";
import { $, esc } from "./dom.js";

const KEY = "wfChores";
let chores = normalizeChores(store.load(KEY, null));
let showOptional = false; // 선택 숙제를 펼쳤는지 (앱을 다시 열면 접힌다)
let newTag = "star";
let newPeriod = "day";

const save = () => store.save(KEY, chores);
const tagPill = (c) => (c.tag && c.tag !== "star" ? `<span class="tag">${TAGS[c.tag]}</span>` : "");
// 줄 아래 작은 글: 위치 · 세부 구분 (+ 원래 기간이 '일/주간' · '격주 주말' 이면 그 글자, 선택 줄은 매일 / 매주)
const subOf = (c, withPeriod) => [c.custom ? "직접 더함" : `${c.place} · ${c.group}`, c.note || (withPeriod ? PERIODS[c.period] : "")].filter(Boolean).join(" · ");

const row = (c, withPeriod = false) => `<li><button class="chk chore" data-chore="${esc(c.id)}" aria-pressed="${c.done}">
    <span class="box">${CHECK_SVG}</span>
    <span class="lbl">${esc(c.name)}<span class="sub">${esc(subOf(c, withPeriod))}</span></span>${tagPill(c)}
  </button></li>`;
const group = (title, rows, count) => (rows.length ? `<div class="chore-h"><b>${title}</b><span class="mono">${count.done} / ${count.total}</span></div>
  <ul class="chores">${rows.map((c) => row(c)).join("")}</ul>` : "");

export function renderChores() {
  const s = choreSections(chores, new Date());
  const { must, optional } = s.counts;
  $("wfChoreCount").textContent = must.total ? `필수 ${must.done} / ${must.total}` : "";
  $("wfChoreBar").style.width = `${must.total ? (must.done / must.total) * 100 : 0}%`;
  $("wfChoreBar").parentElement.hidden = !must.total;
  $("wfChores").innerHTML = group("매일", s.day, s.counts.day) + group("이번 주", s.week, s.counts.week)
    + (optional.total ? `<button class="chore-more" id="wfChoreMore" aria-expanded="${showOptional}">
        <span>선택 숙제 ${optional.total}개 ${showOptional ? "접기" : "보기"}${optional.done ? ` · ${optional.done}개 함` : ""}</span><span class="chev">${ICON.chevronDown}</span></button>
      ${showOptional ? `<ul class="chores">${s.optional.map((c) => row(c, true)).join("")}</ul>` : ""}` : "")
    + (must.total || optional.total ? "" : '<p class="empty">숙제가 없어. 목록 고치기에서 더하거나 되돌려 줘.</p>');
}

// ---------- 목록 고치기 창 ----------
function renderEdit() {
  const list = choreList(chores);
  $("choreEditList").innerHTML = list.map((c) => `<li>
    <span class="name">${esc(c.name)}<span class="sub">${esc([TAG_NAMES[c.tag], PERIODS[c.period], c.custom ? "직접 더함" : c.place].join(" · "))}</span></span>
    <button class="icon-btn del" data-chore-del="${esc(c.id)}" aria-label="${esc(c.name)} 지우기">${ICON.trash}</button></li>`).join("");
  const hidden = hiddenCount(chores);
  $("choreReset").textContent = hidden ? `되돌리기 (지운 기본 숙제 ${hidden}개)` : "되돌리기";
  $("choreReset").disabled = !hidden;
  for (const b of $("choreTags").children) b.setAttribute("aria-pressed", String(b.dataset.tag === newTag));
  for (const b of $("chorePeriods").children) b.setAttribute("aria-pressed", String(b.dataset.period === newPeriod));
}
function apply(next) {
  chores = next;
  save();
  renderEdit();
  renderChores();
}

export function startChores() {
  renderChores();
  $("wfChoreCard").addEventListener("click", (e) => {
    const b = e.target.closest("[data-chore]");
    if (b) {
      chores = toggleChore(chores, b.dataset.chore, new Date());
      save();
      renderChores();
      return document.querySelector(`[data-chore="${CSS.escape(b.dataset.chore)}"]`)?.focus();
    }
    if (e.target.closest("#wfChoreMore")) {
      showOptional = !showOptional;
      renderChores();
      $("wfChoreMore").focus();
    } else if (e.target.closest("#wfChoreEdit")) {
      $("choreMsg").textContent = "";
      renderEdit();
      openSheet("choreSheet");
    }
  });

  $("choreTags").innerHTML = Object.keys(TAGS).map((t) => `<button type="button" data-tag="${t}">${TAG_NAMES[t]}</button>`).join("");
  $("chorePeriods").innerHTML = Object.keys(PERIODS).map((p) => `<button type="button" data-period="${p}">${PERIODS[p]}</button>`).join("");
  $("choreForm").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tag]");
    const p = e.target.closest("[data-period]");
    if (t) newTag = t.dataset.tag;
    else if (p) newPeriod = p.dataset.period;
    else return;
    renderEdit();
  });
  $("choreForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const r = addChore(chores, $("choreName").value, newTag, newPeriod);
    $("choreMsg").textContent = r.error || `'${r.chores.custom.at(-1).name}' 을(를) 더했어.`;
    if (r.error) return;
    $("choreName").value = "";
    apply(r.chores);
  });
  $("choreEditList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-chore-del]");
    if (!b) return;
    const item = choreList(chores).find((c) => c.id === b.dataset.choreDel);
    if (!item) return;
    // 기본 줄은 '되돌리기' 로 돌아오니 바로, 직접 더한 줄은 못 되살리니 묻는다
    if (item.custom && !(await askConfirm(`'${item.name}' 을(를) 지울까? 직접 더한 숙제는 되돌리기로 안 돌아와.`, "지우기"))) return;
    $("choreMsg").textContent = "";
    apply(removeChore(chores, item.id));
  });
  $("choreReset").addEventListener("click", async () => {
    if (!(await askConfirm("지운 기본 숙제를 전부 되돌릴까? 직접 더한 숙제와 체크는 그대로야.", "되돌리기"))) return;
    $("choreMsg").textContent = "";
    apply(resetChores(chores));
  });
}
