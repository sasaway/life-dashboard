// 설정 › 데이터 백업 화면과 메인의 '백업을 만들었어' 안내 (v1.9).
// 백업은 게임 세이브를 따로 복사해 두는 것: 앱 안 백업은 같은 폰 안의 두 번째 슬롯, 파일 저장은 USB 에 옮겨 두기.
import { makeBackup, readBackupText, restoreItems, photosOf, fileName, sizeLabel, versionTag } from "./backup.js";
import { backupNow, listBackups, backupError, getMeta, setMeta } from "./backup-db.js";
import { allPhotos, replacePhotos } from "./photos.js";
import { askConfirm } from "./sheet.js";
import { pad } from "./schedule.js";
import { $, esc, X_SVG } from "./dom.js";

const REASON = { auto: "자동", manual: "직접", before: "되살리기 전" };
let recs = [];      // 앱 안 백업 (최근 것부터)
let err = null;     // 마지막 실패 { at, space }
let file = null;    // 저장할 백업 파일 (화면을 열 때 미리 만든다 — 공유 창은 누른 순간에 바로 열어야 해서)
let picked = null;  // 되살리려고 고른 백업
let busy = false;

const when = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const failLabel = (e) => (e.space ? "백업 실패 · 공간 부족" : "백업 실패");

// 설정 목록 줄의 짧은 상태
export function backupState() {
  if (err) return err.space ? "실패 · 공간 부족" : "실패";
  if (!recs.length) return "없음";
  const d = new Date(recs[0].backup.at);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function render() {
  const last = recs[0]?.backup;
  $("bkWhen").textContent = last ? when(last.at) : "아직 없음";
  $("bkSum").textContent = last
    ? `크기 ${sizeLabel(last.size)} · 사진 ${last.counts.photos}장 · 기록 칸 ${last.counts.items}개`
    : "'지금 백업하기' 를 누르면 앱 안에 하나 만들어.";
  $("bkErr").hidden = !err;
  $("bkErr").textContent = err ? `${failLabel(err)} (${when(err.at)})` : "";
  $("bkList").innerHTML = recs.map((r) => `<li><button class="bk-item" data-bk="${esc(r.id)}">
    <span class="row-h"><b>${esc(when(r.backup.at))}</b><span class="mono">${esc(sizeLabel(r.backup.size))}</span></span>
    <span class="qa-line">${esc(REASON[r.reason] ?? r.reason)} · ${esc(versionTag(r.backup.version))} · 사진 ${r.backup.counts.photos}장</span>
  </button></li>`).join("") || `<li class="empty">앱 안 백업이 아직 없어.</li>`;
}

async function refresh() {
  [recs, err] = await Promise.all([listBackups().catch(() => []), backupError()]);
  render();
}

// 지금 기록으로 파일을 미리 만든다
async function prepareFile() {
  file = null;
  $("bkSave").disabled = true;
  $("bkSave").textContent = "파일 준비 중…";
  try {
    const b = await makeBackup({ storage: localStorage, photos: await allPhotos(), appVersion: self.APP_VERSION });
    file = new File([JSON.stringify(b)], fileName(b), { type: "application/json" });
  } catch {
    $("bkMsg").textContent = "파일을 만들지 못했어. 다시 열어 줘.";
  }
  $("bkSave").disabled = !file;
  $("bkSave").textContent = "백업 파일 저장";
}

function download(f) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(f);
  a.download = f.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
  $("bkMsg").textContent = `${f.name} 을(를) 내려받았어.`;
}

// 아이폰: 공유 창 → '파일에 저장' (파일 앱 · iCloud). 공유 창이 안 되면 내려받기
async function saveFile() {
  if (!file) return;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      $("bkMsg").textContent = "공유 창에서 '파일에 저장' 을 골랐으면 끝이야.";
      return;
    } catch (e) {
      if (e?.name === "AbortError") return; // 그냥 닫음
    }
  }
  download(file);
}

async function makeNow() {
  if (busy) return;
  busy = true;
  $("bkMsg").textContent = "백업하는 중…";
  try {
    await backupNow("manual");
    $("bkMsg").textContent = "앱 안에 백업을 만들었어.";
  } catch {
    $("bkMsg").textContent = "";
  }
  busy = false;
  await refresh();
  prepareFile();
}

function showPreview(b, from) {
  picked = b;
  $("bkPreviewList").innerHTML = [
    ["어디서", from], ["백업한 때", when(b.at)], ["앱 버전", versionTag(b.version)],
    ["기록 칸", `${b.counts.items}개`], ["사진", `${b.counts.photos}장`], ["크기", sizeLabel(b.size)],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
  $("bkPreview").hidden = false;
  $("bkRestoreMsg").textContent = "";
  $("bkPreview").scrollIntoView({ block: "nearest" });
}

function hidePreview() {
  picked = null;
  $("bkPreview").hidden = true;
}

async function restore() {
  if (!picked || busy) return;
  const b = picked;
  const yes = await askConfirm(`지금 기록이 ${when(b.at)} 백업으로 바뀌어. 바로 전에 지금 상태를 앱 안에 한 번 백업해 둘게. 되살릴까?`, "되살리기");
  if (!yes) return;
  busy = true;
  $("bkRestoreMsg").textContent = "지금 상태를 먼저 백업하는 중…";
  try {
    await backupNow("before");
  } catch {
    busy = false;
    await refresh();
    $("bkRestoreMsg").textContent = "지금 상태를 백업하지 못해서 되살리기를 멈췄어. 아무것도 안 바뀌었어.";
    return;
  }
  $("bkRestoreMsg").textContent = "되살리는 중…";
  try {
    await replacePhotos(photosOf(b));
    restoreItems(localStorage, b.items);
  } catch {
    busy = false;
    $("bkRestoreMsg").textContent = "되살리다 실패했어. 목록의 '되살리기 전' 백업으로 다시 되살려 줘.";
    await refresh();
    return;
  }
  $("bkRestoreMsg").textContent = "되살렸어. 앱을 새로 여는 중…";
  location.reload();
}

// ---------- 메인 안내 ----------
async function showNote() {
  const x9 = await getMeta("notice").catch(() => null);
  if (!x9) return;
  $("bkNoteText").textContent = `${x9} 백업을 만들었어 · `;
  $("bkNote").hidden = false;
}
function closeNote() {
  $("bkNote").hidden = true;
  setMeta("notice", null).catch(() => {});
}

export function startBackup() {
  $("bkNoteX").innerHTML = X_SVG;
  $("bkNoteGo").addEventListener("click", () => {
    closeNote();
    document.dispatchEvent(new CustomEvent("open-settings", { detail: "backup" }));
  });
  $("bkNoteX").addEventListener("click", closeNote);

  // 설정에서 '데이터 백업' 화면에 들어올 때마다 최신으로
  document.addEventListener("settings-page", (e) => {
    if (e.detail !== "backup") return;
    hidePreview();
    $("bkMsg").textContent = "";
    $("bkRestoreMsg").textContent = "";
    refresh();
    prepareFile();
  });
  $("bkNow").addEventListener("click", makeNow);
  $("bkSave").addEventListener("click", saveFile);
  $("bkList").addEventListener("click", (e) => {
    const r = recs.find((x) => x.id === e.target.closest("[data-bk]")?.dataset.bk);
    if (r) showPreview(r.backup, `앱 안 (${REASON[r.reason] ?? r.reason})`);
  });
  $("bkFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    hidePreview();
    const out = readBackupText(await f.text());
    if (out.error) $("bkRestoreMsg").textContent = out.error;
    else showPreview(out.backup, `파일 (${f.name})`);
  });
  $("bkRestore").addEventListener("click", restore);
  $("bkCancel").addEventListener("click", hidePreview);

  refresh(); // 설정 목록 줄의 상태
  showNote();
}
