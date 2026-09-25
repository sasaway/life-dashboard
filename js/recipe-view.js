// 레시피 화면: 재료·단계·불 세기, 불 쓰는 단계의 타이머, 지금 하는 단계 표시.
import { openSheet } from "./sheet.js";
import { RECIPES, HEATS, recipeById, recipesForDish, hasTimer, totalMinutes, mmss } from "./recipes.js";
import { newTimer, start, pause, reset, remaining, isRunning, progress } from "./timer.js";
import { $, esc } from "./dom.js";

let recipe = null;     // 지금 연 레시피
let variants = [];     // 같은 요리의 다른 레시피 (라면: 안성탕면 / 짜파게티)
let current = 0;       // 지금 하는 단계
const timers = new Map(); // "레시피id:단계" → 타이머 (창을 닫아도 계속 간다)
const key = (i) => `${recipe.id}:${i}`;

// 불 세기: 막대 개수 + 글자 (색만으로 구분하지 않는다)
function heatBadge(heatKey) {
  const h = HEATS[heatKey];
  const bars = h.fire
    ? `<svg viewBox="0 0 14 12" aria-hidden="true">${[0, 1, 2].map((i) =>
      `<rect x="${i * 5}" y="${8 - i * 4}" width="3.5" height="${4 + i * 4}" rx="1" class="${i < h.bars ? "on" : ""}"/>`).join("")}</svg>`
    : "";
  return `<span class="heat heat-${heatKey}">${bars}${h.label}</span>`;
}

function timerBlock(i, st) {
  const t = timers.get(key(i)) ?? newTimer(st.sec);
  const now = Date.now();
  const left = remaining(t, now);
  const done = left <= 0;
  return `<div class="timer" data-timer="${i}">
    <div class="timer-row">
      <span class="clock mono" data-clock="${i}">${mmss(left)}</span>
      <button class="btn ${isRunning(t) ? "btn-ghost" : "btn-primary"}" data-toggle="${i}" ${done ? "hidden" : ""}>${isRunning(t) ? "일시정지" : left < st.sec ? "이어서" : "시작"}</button>
      <button class="btn btn-text" data-reset="${i}">처음부터</button>
    </div>
    <div class="meter"><i data-bar="${i}" style="width:${progress(t, now)}%"></i></div>
    <p class="done-msg" data-done="${i}" role="status" ${done ? "" : "hidden"}>다 됐어. 다음 단계로 넘어가.</p>
  </div>`;
}

function render() {
  $("recipeTitle").textContent = recipe.name;
  $("recipeMeta").textContent = `${recipe.serves} · 약 ${totalMinutes(recipe)}분`;
  $("recipeVariants").hidden = variants.length < 2;
  $("recipeVariants").innerHTML = variants.map((r) =>
    `<button data-variant="${r.id}" aria-pressed="${r.id === recipe.id}">${esc(r.name.split(" + ")[0])}</button>`).join("");
  $("recipeWhy").hidden = !recipe.why;
  $("recipeWhy").textContent = recipe.why ?? "";
  $("recipeSource").textContent = `참고: ${recipe.source}`;
  $("recipeIngredients").innerHTML = recipe.ingredients.map(([n, a]) =>
    `<li><span>${esc(n)}</span><span class="amt">${esc(a)}</span></li>`).join("");
  $("recipeSteps").innerHTML = recipe.steps.map((st, i) => `
    <li class="${i === current ? "cur" : i < current ? "past" : ""}"${i === current ? ' aria-current="step"' : ""}>
      <div class="step-h"><span class="no mono">${i + 1}</span>${heatBadge(st.heat)}</div>
      <p class="step-text">${esc(st.text)}</p>
      ${st.note ? `<p class="step-note">${esc(st.note)}</p>` : ""}
      ${hasTimer(st) ? timerBlock(i, st) : ""}
      ${i === current && i < recipe.steps.length - 1 ? '<button class="btn btn-ghost next-step" data-next>다음 단계</button>' : ""}
      ${i === current && i === recipe.steps.length - 1 ? '<p class="step-note">마지막 단계야. 맛있게 먹어.</p>' : ""}
    </li>`).join("");
}

export function openRecipe(id, list = [recipeById(id)]) {
  const r = recipeById(id);
  if (!r) return;
  if (!recipe || recipe.id !== r.id) current = 0;
  recipe = r;
  variants = list;
  render();
  openSheet("recipeSheet");
}

export function openRecipeForDish(dishId) {
  const list = recipesForDish(dishId);
  if (list.length) openRecipe(list[0].id, list);
}

// ---------- 소리 · 화면 켜 두기 ----------
// 부엌에서도 들리게: 높은 두 음을 번갈아 4번, 소리를 키우되 찢어지지 않게 눌러 준다(compressor).
export const ALARM = { repeats: 4, tones: [1320, 1760], toneSec: 0.14, gapSec: 0.06, restSec: 0.35, gain: 0.9 };

let audio = null;
function unlockAudio() {
  // 아이폰은 사용자가 누를 때만 소리를 켤 수 있어서, 시작 버튼을 누를 때 준비해 둔다.
  // audioSession 'playback': 무음 스위치를 켜 둬도 들리게 한다 (iOS 17 이상, 없으면 넘어간다)
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
    audio = audio ?? new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  } catch { audio = null; }
}
function beep() {
  if (!audio) return;
  const out = audio.createDynamicsCompressor();
  out.connect(audio.destination);
  const { repeats, tones, toneSec, gapSec, restSec, gain } = ALARM;
  let t = audio.currentTime + 0.05;
  for (let r = 0; r < repeats; r++) {
    for (const freq of tones) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = "square"; // 사인파보다 또렷하게 들린다
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.setValueAtTime(gain, t + toneSec - 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + toneSec);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + toneSec + 0.02);
      t += toneSec + gapSec;
    }
    t += restSec;
  }
}

let wakeLock = null;
async function keepScreenOn(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
    }
  } catch { /* 지원하지 않으면 넘어간다 */ }
}

// ---------- 타이머가 도는 동안 0.25초마다 ----------
let loop = null;
function tick() {
  const now = Date.now();
  let anyRunning = false;
  for (const [k, t] of timers) {
    if (!isRunning(t)) continue;
    if (remaining(t, now) <= 0) {
      timers.set(k, { ...t, left: 0, endsAt: null });
      beep();
      if (recipe && k.startsWith(`${recipe.id}:`)) render();
    } else {
      anyRunning = true;
      if (recipe && k.startsWith(`${recipe.id}:`)) {
        const i = k.split(":")[1];
        const clock = document.querySelector(`[data-clock="${i}"]`);
        const bar = document.querySelector(`[data-bar="${i}"]`);
        if (clock) clock.textContent = mmss(remaining(t, now));
        if (bar) bar.style.width = `${progress(t, now)}%`;
      }
    }
  }
  if (!anyRunning) {
    clearInterval(loop);
    loop = null;
    keepScreenOn(false);
  }
}
function ensureLoop() {
  if (!loop) loop = setInterval(tick, 250);
  keepScreenOn(true);
}

export function startRecipes() {
  $("recipeList").innerHTML = RECIPES.map((r) => `
    <li><button class="recipe-link" data-recipe="${r.id}"><b>${esc(r.name)}</b><span class="sub">${esc(r.serves)} · 약 ${totalMinutes(r)}분</span></button></li>`).join("");
  $("recipeList").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-recipe]");
    if (!b) return;
    const r = recipeById(b.dataset.recipe);
    const siblings = RECIPES.filter((x) => x.id.split("-")[0] === r.id.split("-")[0]);
    openRecipe(r.id, siblings);
  });

  $("recipeVariants").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-variant]");
    if (b) openRecipe(b.dataset.variant, variants);
  });

  $("recipeSteps").addEventListener("click", (e) => {
    const now = Date.now();
    const tg = e.target.closest("button[data-toggle]");
    const rs = e.target.closest("button[data-reset]");
    const nx = e.target.closest("button[data-next]");
    if (tg) {
      const i = Number(tg.dataset.toggle);
      const t = timers.get(key(i)) ?? newTimer(recipe.steps[i].sec);
      unlockAudio();
      timers.set(key(i), isRunning(t) ? pause(t, now) : start(t, now));
      current = i;
      ensureLoop();
      render();
    } else if (rs) {
      const i = Number(rs.dataset.reset);
      timers.set(key(i), reset(timers.get(key(i)) ?? newTimer(recipe.steps[i].sec)));
      render();
    } else if (nx) {
      current = Math.min(current + 1, recipe.steps.length - 1);
      render();
      document.querySelector("#recipeSteps li.cur")?.scrollIntoView({ block: "center", behavior: "smooth" });
    } else {
      // 단계를 누르면 그 단계를 '지금 하는 단계' 로
      const li = e.target.closest("#recipeSteps > li");
      if (!li) return;
      current = [...li.parentElement.children].indexOf(li);
      render();
    }
  });

  // 다른 앱에 갔다 오면 바로 맞춘다 (끝났으면 소리)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && timers.size) tick();
  });
}
