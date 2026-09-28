// 앱 안 백업 보관함 (IndexedDB 'ld-backups'). 사진 창고('ld-photos')와 따로 둔다 —
// 되살리기가 사진 창고를 비워도 백업은 남고, "ld:" 칸을 되살려도 '자동 백업 했음' 표시는 그대로다.
import { makeBackup, x9Of } from "./backup.js";
import { allPhotos } from "./photos.js";

const DB = "ld-backups";
const KEEP = 2; // 사진 때문에 커질 수 있어서 최근 2개만
let opening = null;
let lastError = null; // 보관함에 실패 기록조차 못 적을 때 (공간이 꽉 참)

function db() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("backups", { keyPath: "id" }); // { id, reason, backup }
      req.result.createObjectStore("meta"); // auto:1.9 · notice · error
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

async function run(name, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(name, mode);
    const req = fn(tx.objectStore(name));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export const getMeta = (key) => run("meta", "readonly", (s) => s.get(key));
export const setMeta = (key, value) => run("meta", "readwrite", (s) => (value == null ? s.delete(key) : s.put(value, key)));

// 최근 것부터
export async function listBackups() {
  const all = (await run("backups", "readonly", (s) => s.getAll())) ?? [];
  return all.sort((a, b) => b.backup.at.localeCompare(a.backup.at));
}

// 실패: { at, space } — space 면 '공간 부족'
export async function backupError() {
  return (await getMeta("error").catch(() => null)) ?? lastError;
}

const isSpace = (err) => err?.name === "QuotaExceededError" || /quota/i.test(String(err?.message ?? ""));

// 지금 기록으로 백업 하나를 만들어 보관함에 넣는다. reason: auto · manual · before(되살리기 전)
export async function backupNow(reason) {
  try {
    const backup = await makeBackup({ storage: localStorage, photos: await allPhotos(), appVersion: self.APP_VERSION });
    const rec = { id: `${backup.at} ${reason}`, reason, backup };
    await run("backups", "readwrite", (s) => s.put(rec));
    for (const old of (await listBackups()).slice(KEEP)) await run("backups", "readwrite", (s) => s.delete(old.id));
    lastError = null;
    await setMeta("error", null);
    return rec;
  } catch (err) {
    lastError = { at: new Date().toISOString(), space: isSpace(err) };
    await setMeta("error", lastError).catch(() => {});
    throw err;
  }
}

// x.9 버전으로 처음 켜질 때 한 번 (boot.js 가 다른 코드보다 먼저 부른다). 실패하면 다음에 켤 때 다시
export async function autoBackup() {
  const x9 = x9Of(self.APP_VERSION);
  if (!x9 || (await getMeta(`auto:${x9}`))) return;
  await backupNow("auto");
  await setMeta(`auto:${x9}`, new Date().toISOString());
  await setMeta("notice", x9); // 메인에 안내 한 번
}
