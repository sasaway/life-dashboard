// 설정 › 보관 › 기록 내보내기 화면 (v3.5). 지난 회고 · 일정표 · 운동 기록만 JSON 파일 하나로 저장한다.
// 파일 저장 방법은 데이터 백업과 같다: 아이폰은 공유 창 → '파일에 저장', 안 되면 내려받기.
import { makeExport, exportFileName, exportSummary } from "./export.js";
import { blobToBase64 } from "./backup.js";
import { EXERCISES } from "./workout.js";
import { $ } from "./dom.js";

let file = null; // 저장할 파일 (화면을 열 때 미리 만든다 — 공유 창은 누른 순간에 바로 열어야 해서)

// 운동 사진(영상 장면)을 글자(base64)로. 사진은 앱에 들어 있는 파일이라 한 번만 읽어 둔다. 못 읽은 사진은 빼고
let images = null;
async function loadImages() {
  if (images) return images;
  const out = {};
  for (const img of new Set(Object.values(EXERCISES).map((ex) => ex.img))) {
    try {
      const res = await fetch(`images/exercise/${img}.jpg`);
      if (!res.ok) continue;
      const blob = await res.blob();
      out[img] = { type: blob.type || "image/jpeg", data: await blobToBase64(blob) };
    } catch {
      // 못 읽으면 그 사진만 빈칸
    }
  }
  images = out;
  return out;
}

async function prepare() {
  file = null;
  $("exMsg").textContent = "";
  $("exSave").disabled = true;
  $("exSave").textContent = "파일 준비 중…";
  try {
    const e = makeExport({ storage: localStorage, appVersion: self.APP_VERSION, images: await loadImages() });
    file = new File([JSON.stringify(e, null, 2)], exportFileName(e), { type: "application/json" });
    $("exSum").textContent = `${exportSummary(e)} · 사진\u00a0${e.counts.images}장`;
  } catch {
    $("exSum").textContent = "";
    $("exMsg").textContent = "파일을 만들지 못했어. 다시 열어 줘.";
  }
  $("exSave").disabled = !file;
  $("exSave").textContent = "내보내기";
}

function download(f) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(f);
  a.download = f.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
  $("exMsg").textContent = `${f.name} 을(를) 내려받았어.`;
}

async function save() {
  if (!file) return;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      $("exMsg").textContent = "공유 창에서 '파일에 저장' 을 골랐으면 끝이야.";
      return;
    } catch (e) {
      if (e?.name === "AbortError") return; // 그냥 닫음
    }
  }
  download(file);
}

export function startExport() {
  // 설정에서 이 화면에 들어올 때마다 지금 기록으로
  document.addEventListener("settings-page", (e) => {
    if (e.detail === "export") prepare();
  });
  $("exSave").addEventListener("click", save);
}
