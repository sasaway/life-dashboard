// 라이브러리 · 메모: 메인 맨 아래 위젯 두 개, 라이브러리 목록 창, 기록 쓰기 창.
import { store } from "./store.js";
import { openSheet, guardSheet } from "./sheet.js";
import { newId } from "./shopping.js";
import { pad } from "./schedule.js";
import { chip } from "./wuwa-view.js";
import { CATS, FIELD_KO, catOf, blankEntry, entryProblem, saveEntry, removeEntry, entriesOf, countsBy } from "./library.js";
import { putPhoto, getPhoto, deletePhotos, shrink } from "./photos.js";
import { $, esc, X_SVG } from "./dom.js";

const SOURCE_HINT = { index: "책 이름, 영상 주소 등", profile: "교육 기관 · 발급처" };

let list = store.load("library", []);
let cat = "index";
let draft = null; // 쓰고 있는 기록
let original = ""; // 창을 연 때(또는 저장한 때)의 기록 — 달라졌으면 저장 안 한 게 있다
let added = []; // 이번에 새로 넣은 사진 (저장 안 하고 나가면 지운다)
let removed = []; // 이번에 뺀 원래 사진 (저장할 때 지운다)

// ---------- 사진 ----------
const urls = new Map();
async function photoUrl(id) {
  if (!urls.has(id)) {
    const blob = await getPhoto(id).catch(() => null);
    urls.set(id, blob ? URL.createObjectURL(blob) : "");
  }
  return urls.get(id);
}
function fillPhotos(root) {
  root.querySelectorAll("img[data-photo]").forEach(async (img) => {
    const u = await photoUrl(img.dataset.photo);
    if (u) img.src = u;
  });
}

// ---------- 메인 위젯 ----------
function renderMain() {
  const n = countsBy(list);
  $("libMain").innerHTML = CATS.map((c) => `<button class="lib-tile" data-lib="${c.id}">
    <span class="lib-tile-h"><b>${c.label}</b><span class="mono">${n[c.id]}</span></span>
    <span class="sub">${c.what}</span></button>`).join("");
  $("libTotal").textContent = list.length ? `${list.length}개` : "";
}

// ---------- 목록 창 ----------
const dateLabel = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

function renderList() {
  const c = catOf(cat);
  $("libPick").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
  $("libWhat").textContent = `${c.what} · 어체: ${c.tone}`;
  const items = entriesOf(list, cat);
  $("libList").innerHTML = items.map((e) => {
    const sub = [e.kind, e.source].filter(Boolean).join(" · ");
    return `<li><button class="day-entry lib-entry" data-entry="${esc(e.id)}">
      <span class="row-h"><b>${esc(e.title)}</b><span class="mono">${dateLabel(e.at)}</span></span>
      ${sub ? `<span class="qa-line">${esc(sub)}</span>` : ""}
      ${e.body ? `<span class="preview">${esc(e.body)}</span>` : ""}
      ${e.photos.length ? `<span class="lib-thumbs">${e.photos.slice(0, 3).map((id) => `<img data-photo="${esc(id)}" alt="">`).join("")}${e.photos.length > 3 ? `<span class="mono">+${e.photos.length - 3}</span>` : ""}</span>` : ""}
    </button></li>`;
  }).join("");
  $("libEmpty").textContent = items.length ? "" : `아직 ${c.label} 기록이 없어. '기록 추가' 를 눌러 봐.`;
  fillPhotos($("libList"));
}

function openList(c = cat) {
  cat = c;
  renderList();
  openSheet("libSheet");
}

// ---------- 기록 쓰기 창 ----------
function kindChips() {
  const c = catOf(draft.cat);
  return c.kinds.map((k) => chip(`type="button" data-kind="${esc(k)}"`, c.kindHints ? `${k} · ${c.kindHints[k]}` : k, draft.kind === k, true)).join("");
}

function renderPhotos() {
  $("libPhotos").innerHTML = draft.photos.map((id) => `<li><img data-photo="${esc(id)}" alt="사진자료">
    <button type="button" class="icon-btn del" data-del-photo="${esc(id)}" aria-label="사진 빼기">${X_SVG}</button></li>`).join("");
  fillPhotos($("libPhotos"));
}

function fieldHtml(f, c) {
  if (f === "title") return `<label class="qa"><span class="q">${FIELD_KO.title}</span><input class="field" name="title" maxlength="80" value="${esc(draft.title)}"></label>`;
  if (f === "kind") return `<div class="qa"><span class="q">${FIELD_KO.kind}</span><div class="checks" id="libKinds">${kindChips()}</div></div>`;
  if (f === "body") return `<label class="qa"><span class="q">${FIELD_KO.body}</span><textarea class="field" name="body" rows="8" placeholder="어체: ${esc(c.tone)}">${esc(draft.body)}</textarea></label>`;
  if (f === "source") return `<label class="qa"><span class="q">${FIELD_KO.source}</span><input class="field" name="source" maxlength="120" placeholder="${SOURCE_HINT[c.id] ?? ""}" value="${esc(draft.source)}"></label>`;
  if (f === "ref") return `<label class="qa"><span class="q">${FIELD_KO.ref}</span><textarea class="field" name="ref" rows="2" placeholder="참고한 자료 · 주소">${esc(draft.ref)}</textarea></label>`;
  return `<div class="qa"><span class="q">${FIELD_KO.photos}</span><ul class="lib-photos" id="libPhotos"></ul>
    <label class="btn btn-ghost photo-add">사진 추가<input type="file" id="libPhotoInput" accept="image/*" multiple></label></div>`;
}

function openEntry(entry, fresh) {
  if (added.length) deletePhotos(added); // 지난번에 저장 안 하고 나간 사진 정리
  draft = { ...entry, photos: [...entry.photos] };
  original = JSON.stringify(draft);
  added = [];
  removed = [];
  const c = catOf(draft.cat);
  $("libEntryTitle").textContent = fresh ? "새 기록" : "기록 고치기";
  $("libEntryCat").textContent = `${c.label} · ${c.what}`;
  $("libForm").innerHTML = c.fields.map((f) => fieldHtml(f, c)).join("");
  if (c.fields.includes("photos")) renderPhotos();
  $("libDelete").hidden = fresh;
  $("libMsg").textContent = "";
  openSheet("libEntrySheet");
}

async function addPhotos(files) {
  $("libMsg").textContent = "사진 줄이는 중…";
  try {
    for (const file of files) {
      const id = `ph-${newId()}`;
      await putPhoto(id, await shrink(file));
      added.push(id);
      draft.photos.push(id);
      renderPhotos();
    }
    $("libMsg").textContent = "";
  } catch {
    $("libMsg").textContent = "사진을 못 넣었어. 다른 사진으로 해 봐.";
  }
}

function save() {
  const problem = entryProblem(draft);
  if (problem) {
    $("libMsg").textContent = problem;
    return;
  }
  const next = saveEntry(list, draft);
  if (!store.save("library", next)) {
    $("libMsg").textContent = "저장 공간이 꽉 찼어. 안 쓰는 기록을 지워 줘.";
    return;
  }
  list = next;
  deletePhotos(removed);
  added = [];
  markSaved();
  renderMain();
  openList(draft.cat);
}

// 저장 안 하고 나가려 하면 한 번 묻는다 (바깥 누르기 · Esc · 목록으로)
const unsaved = () => draft && JSON.stringify(draft) !== original;
const okToLeave = () => !unsaved() || confirm("저장 안 하고 나갈까? 쓴 내용이 사라져.");
const markSaved = () => { original = JSON.stringify(draft); };

// ---------- 메모 (한 장, 쓰는 대로 저장) ----------
let memo = store.load("memo", { text: "", at: null });
function memoSavedLabel() {
  if (!memo.at) return "";
  const d = new Date(memo.at);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())} 저장`;
}

// ---------- 시작 ----------
export function startLibrary() {
  renderMain();
  $("libMain").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lib]");
    if (b) openList(b.dataset.lib);
  });
  $("libPick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    cat = b.dataset.cat;
    renderList();
  });
  $("libAdd").addEventListener("click", () => openEntry(blankEntry(cat), true));
  $("libList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-entry]");
    const entry = b && list.find((x) => x.id === b.dataset.entry);
    if (entry) openEntry(entry, false);
  });

  $("libForm").addEventListener("input", (e) => {
    if (e.target.name) draft[e.target.name] = e.target.value;
  });
  $("libForm").addEventListener("submit", (e) => e.preventDefault());
  $("libForm").addEventListener("click", (e) => {
    const k = e.target.closest("[data-kind]");
    const del = e.target.closest("[data-del-photo]");
    if (k) {
      draft.kind = k.dataset.kind;
      $("libKinds").innerHTML = kindChips();
    } else if (del) {
      const id = del.dataset.delPhoto;
      draft.photos = draft.photos.filter((p) => p !== id);
      if (added.includes(id)) {
        added = added.filter((p) => p !== id);
        deletePhotos([id]);
      } else {
        removed.push(id);
      }
      renderPhotos();
    }
  });
  $("libForm").addEventListener("change", (e) => {
    if (e.target.id !== "libPhotoInput") return;
    addPhotos([...e.target.files]);
    e.target.value = "";
  });
  $("libSave").addEventListener("click", save);
  guardSheet("libEntrySheet", okToLeave);
  $("libBack").addEventListener("click", () => {
    if (!okToLeave()) return;
    markSaved(); // 방금 물어봤으니 목록을 열 때 또 묻지 않는다
    deletePhotos(added);
    added = [];
    openList(draft.cat);
  });
  $("libDelete").addEventListener("click", () => {
    if (!confirm(`'${draft.title || "이 기록"}' 을(를) 지울까? 사진도 같이 지워져.`)) return;
    const saved = list.find((x) => x.id === draft.id);
    list = removeEntry(list, draft.id);
    store.save("library", list);
    deletePhotos([...(saved?.photos ?? []), ...added]);
    added = [];
    markSaved();
    renderMain();
    openList(draft.cat);
  });

  $("memo").value = memo.text;
  $("memoSaved").textContent = memoSavedLabel();
  $("memo").addEventListener("input", (e) => {
    memo = { text: e.target.value, at: new Date().toISOString() };
    store.save("memo", memo);
    $("memoSaved").textContent = memoSavedLabel();
  });
}
