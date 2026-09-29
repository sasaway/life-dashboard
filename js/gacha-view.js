// 명조 가챠 기댓값 계산기 화면: 명조 위 전환 [오늘 · 파티표 · 재화 · 픽업] 의 '재화' · '픽업' (v2.4).
// 입력 칸은 index.html 에 한 번만 있고, 숫자가 바뀌면 계산 글자만 다시 쓴다 (치는 도중에 칸이 다시 그려지지 않게).
import { store } from "./store.js";
import { normalizeGacha, count, pullsOf, daysUntil, dLabel, income, passCharDay, passCharIn, FREE_HINT, MONTHLY_MAX_DAYS } from "./gacha.js";
import { ymd } from "./schedule.js";
import { $, esc } from "./dom.js";

let g = normalizeGacha(store.load("wuwaGacha", null));

const save = () => {
  const ok = store.save("wuwaGacha", g);
  document.querySelectorAll(".gc-msg").forEach((p) => { p.textContent = ok ? "" : "저장이 안 됐어. 저장 공간을 확인해 줘."; });
};
const num = (n) => n.toLocaleString("ko-KR");
// "have.astrite" → g.have.astrite
const getAt = (path) => path.split(".").reduce((o, k) => o[k], g);
function setAt(path, value) {
  const [group, key] = path.split(".");
  g = { ...g, [group]: { ...g[group], [key]: value } };
}

// 저장된 값을 입력 칸에 넣는다 (시작할 때 한 번). 0 은 빈칸으로 보여 준다
function fillInputs() {
  document.querySelectorAll(".gc [data-g]").forEach((el) => {
    const v = getAt(el.dataset.g);
    el.value = el.type === "date" ? v : (v ? String(v) : "");
  });
  document.querySelectorAll(".gc [data-gt]").forEach(paintToggle);
}
function paintToggle(b) {
  const on = Boolean(getAt(b.dataset.gt));
  b.setAttribute("aria-pressed", String(on));
  b.textContent = on ? "켬" : "끔";
}

const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
const bundle = (x) => `별소 ${num(x.astrite)} · 캐릭뽑 ${num(x.char)} · 무기뽑 ${num(x.weap)}`;

// 계산 글자만 다시 쓴다 (분마다 · 입력할 때마다)
export function renderGacha() {
  const days = daysUntil(g.plan.date, new Date());
  const has = days !== null && days >= 0;
  const r = income(g, days);
  const left = has ? dLabel(days) : "";

  $("gcHavePulls").textContent = `${num(pullsOf(g.have))}연`;
  $("gcFreeDays").textContent = has ? `남은 ${days}일` : "";
  $("gcDailyCalc").textContent = `하루 별소${has ? ` × ${days}일 = ${num(g.free.daily * days)}` : ""}`;
  $("gcMonthlyCalc").textContent = `하루 별소${has
    ? ` × ${r.monthlyDays}일${days > MONTHLY_MAX_DAYS ? ` (최대 ${MONTHLY_MAX_DAYS}일)` : ""} = ${num(g.paid.monthlyDay * r.monthlyDays)}`
    : ""}`;
  $("gcFreeHint").textContent = FREE_HINT;
  // 유료 패스: 켜면 산 날 칸이 보이고, 캐릭뽑이 픽업 전에 오는지 알려 준다
  document.querySelectorAll(".gc-pass").forEach((el) => { el.hidden = !g.paid.pass; });
  const charDay = passCharDay(g);
  $("gcPassCalc").textContent = !charDay ? "산 날을 적으면 캐릭뽑이 언제 오는지 계산돼"
    : !has ? `캐릭뽑은 ${md(charDay)}부터 · 픽업 날짜를 정하면 합계에 넣을지 정해져`
    : passCharIn(g) ? `캐릭뽑은 ${md(charDay)}부터 · 픽업 전이라 합계에 넣어`
    : `캐릭뽑은 ${md(charDay)}부터 · 픽업 뒤라 합계에서 빼`;

  $("gcSumD").textContent = left;
  $("gcNoDate").hidden = has;
  $("gcNoDateMsg").textContent = days !== null && days < 0
    ? "픽업 날이 지났어. 픽업 페이지에서 새 날짜를 정해 줘."
    : "픽업 페이지에서 날짜를 정하면 계산돼.";
  $("gcSum").hidden = !has;
  $("gcSum").innerHTML = has ? [["무과금만", r.freeOnly], ["과금 포함", r.withPaid]].map(([label, x]) => `
    <li><span class="name"><b>${label}</b><span class="sub num">${esc(bundle(x))}</span></span>
      <span class="gc-pulls"><span class="mono">${num(pullsOf(x))}</span>연</span></li>`).join("") : "";

  $("gcPlanD").textContent = left;
  $("gcDateSub").textContent = days === null ? "아직 안 정했어"
    : days < 0 ? "지난 날이야. 새로 정해 줘"
    : days === 0 ? "오늘이야" : `남은 ${days}일`;
  $("gcDate").min = ymd(new Date());
}

export function startGacha() {
  // v2.4 에 유료 패스를 켜 둔 폰: 산 날이 없으니 오늘로 (v2.4.1)
  if (g.paid.pass && !g.paid.passDate) { setAt("paid.passDate", ymd(new Date())); save(); }
  fillInputs();
  renderGacha();

  for (const id of ["ww-page-cash", "ww-page-pickup"]) {
    const page = $(id);
    page.addEventListener("input", (e) => {
      const el = e.target.closest("[data-g]");
      if (!el) return;
      if (el.type === "date") {
        setAt(el.dataset.g, el.value);
      } else {
        const digits = el.value.replace(/\D/g, ""); // 음수 기호·글자는 칸에 남지 않는다
        if (digits !== el.value) el.value = digits;
        setAt(el.dataset.g, count(digits));
      }
      save();
      renderGacha();
    });
    page.addEventListener("click", (e) => {
      const t = e.target.closest("[data-gt]");
      const go = e.target.closest("[data-ww-go]");
      if (t) {
        setAt(t.dataset.gt, !getAt(t.dataset.gt));
        // 유료 패스를 켜면 산 날 = 오늘 (고칠 수 있음), 끄면 비운다
        if (t.dataset.gt === "paid.pass") {
          setAt("paid.passDate", g.paid.pass ? ymd(new Date()) : "");
          $("gcPassDate").value = g.paid.passDate;
        }
        paintToggle(t);
        save();
        renderGacha();
      } else if (go) {
        $("wwPick").querySelector(`[data-page="${go.dataset.wwGo}"]`)?.click();
        window.scrollTo(0, 0);
      }
    });
  }
  // 재화 · 픽업으로 넘어올 때 남은 날을 새로 센다
  $("wwPick").addEventListener("click", () => renderGacha());
}
