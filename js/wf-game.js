// 워프레임 게임 데이터: warframestat.us 의 영어·한국어 목록을 줄여서 모딩에 쓴다.
// 목록은 폰에 한 번 받아 두고(wf-tools-view.js) 여기 함수들은 그 목록을 정리하고 찾기만 한다.

// 모딩할 장비 분류 → 장비 종류. 찾을 때도 이 순서로 보여 준다 (모드는 맨 뒤)
const KIND_OF = { Warframes: "warframe", Primary: "primary", Secondary: "secondary", Melee: "melee", Pets: "companion" };
const CAT_ORDER = [...Object.keys(KIND_OF), "Mods"];

// ---------- 글자 맞추기 ----------
// 한글은 자모로 풀고, 자주 헷갈리는 모음(ㅐ/ㅔ, ㅒ/ㅖ, ㅙ/ㅚ/ㅞ)은 같은 것으로 본다. 띄어쓰기·기호는 무시
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];
const SAME_VOWEL = { "ㅐ": "ㅔ", "ㅒ": "ㅖ", "ㅙ": "ㅞ", "ㅚ": "ㅞ" };

export function normalize(text) {
  let out = "";
  for (const ch of String(text).toLowerCase()) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c >= 0 && c < 11172) {
      const v = JUNG[Math.floor(c / 28) % 21];
      out += CHO[Math.floor(c / 588)] + (SAME_VOWEL[v] ?? v) + JONG[c % 28];
    } else if (/[0-9a-zㄱ-ㆎ]/.test(ch)) {
      out += SAME_VOWEL[ch] ?? ch;
    }
  }
  return out;
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// 딱 맞음 → 앞부분이 맞음 → 어딘가 들어 있음 → 자모 몇 개 틀림(6개에 1개꼴까지) 순으로 점수.
// 짧은 이름(두 글자 등)은 틀린 글자를 봐주지 않는다 — '나린' 이 '느린 …' 에 걸리지 않게
function score(q, key) {
  if (!key) return null;
  if (key === q) return 0;
  if (key.startsWith(q)) return 1;
  if (key.includes(q)) return 2;
  const allow = Math.floor(q.length / 6);
  if (allow && Math.min(distance(q, key), distance(q, key.slice(0, q.length))) <= allow) return 3;
  return null;
}

function search(list, text, keysOf, catOf, limit) {
  const q = normalize(text);
  if (!q) return [];
  const hits = [];
  for (const row of list) {
    const scores = keysOf(row).map((k) => score(q, k)).filter((s) => s !== null);
    if (scores.length) hits.push({ row, s: Math.min(...scores) });
  }
  hits.sort((a, b) => a.s - b.s || CAT_ORDER.indexOf(catOf(a.row)) - CAT_ORDER.indexOf(catOf(b.row))
    || keysOf(a.row)[0].length - keysOf(b.row)[0].length);
  return hits.slice(0, limit).map((h) => h.row);
}

// ---------- 받은 목록 정리 ----------
const cleanName = (s) => String(s ?? "").replace(/<[^>]*>/g, "").trim();
// 결함 있는(Beginner)·콘클레이브(PvP)·리벤은 뺀다
const skipMod = (x) => /\/(Beginner|PvPMods)\//.test(x.uniqueName) || /Riven/.test(x.type ?? "");
const first = (p) => (Array.isArray(p) ? p[0] : p) ?? null;

export function prepareGameData(enList, koList) {
  const ko = new Map(koList.map((x) => [x.uniqueName, cleanName(x.name)]));
  const items = [];
  const mods = new Map(); // 영어 이름 → 모드 (같은 이름이면 기본 모드 하나)

  for (const x of enList) {
    const cat = x.category;
    if (!CAT_ORDER.includes(cat) || (cat === "Mods" && skipMod(x))) continue;
    const en = cleanName(x.name);
    const k = ko.get(x.uniqueName);
    if (!en || !k) continue;

    const kind = KIND_OF[cat];
    if (kind && (kind !== "companion" || x.type === "Pets")) {
      items.push({
        u: x.uniqueName, ko: k, en, kind, type: x.type ?? "",
        aura: first(x.aura), exilus: x.exilusPolarity ?? null, stance: x.stancePolarity ?? null, pols: x.polarities ?? [],
      });
    }
    if (cat === "Mods" && x.baseDrain != null && x.polarity) {
      const old = mods.get(en);
      if (!old || x.uniqueName.length < old.u.length) {
        mods.set(en, { u: x.uniqueName, ko: k, en, type: x.type, compat: x.compatName ?? "", pol: x.polarity, drain: x.baseDrain, max: x.fusionLimit ?? 0 });
      }
    }
  }
  return { items, mods: [...mods.values()] };
}

// ---------- 찾기 (모딩 장비·모드 고르기) ----------
const KIND_CAT = { warframe: "Warframes", primary: "Primary", secondary: "Secondary", melee: "Melee", companion: "Pets" };
export const searchItems = (items, text, limit = 30) =>
  search(items, text, (i) => [normalize(i.ko), normalize(i.en)], (i) => KIND_CAT[i.kind], limit);
export const searchMods = (mods, text, limit = 60) =>
  search(mods, text, (m) => [normalize(m.ko), normalize(m.en)], () => "Mods", limit);
