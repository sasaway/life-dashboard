// 사진자료 저장: 폰 사진을 줄여서(긴 변 1280px, JPEG) 브라우저 안 데이터베이스(IndexedDB)에 둔다.
// localStorage 는 5MB 라 사진을 담기엔 작아서 따로 둔다. 기록에는 사진 id 만 적는다.
const DB = "ld-photos";
const STORE = "photos";
let opening = null;

function db() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

async function run(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const putPhoto = (id, blob) => run("readwrite", (s) => s.put(blob, id));
export const getPhoto = (id) => run("readonly", (s) => s.get(id));
export function deletePhotos(ids) {
  if (!ids.length) return Promise.resolve();
  return run("readwrite", (s) => { ids.forEach((id) => s.delete(id)); }).catch(() => {});
}

// 백업용: 사진 전부 [{ id, blob }]
export async function allPhotos() {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, "readonly");
    const keys = tx.objectStore(STORE).getAllKeys();
    const blobs = tx.objectStore(STORE).getAll();
    tx.oncomplete = () => resolve(keys.result.map((id, i) => ({ id, blob: blobs.result[i] })));
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

// 되살리기용: 사진 창고를 비우고 이 사진들로 (한 번에 — 중간에 실패하면 원래대로)
export async function replacePhotos(list) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite");
    const s = tx.objectStore(STORE);
    s.clear();
    for (const p of list) s.put(p.blob, p.id);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

// 긴 변을 1280px 로 줄인 JPEG (한 장 약 150~300KB)
export async function shrink(file, max = 1280) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("사진을 줄이지 못했다"))), "image/jpeg", 0.82);
  });
}
