// 폰 기록 백업 (v1.9): localStorage 의 "ld:" 칸 전부 + 사진 창고 전부를 JSON 하나로.
// 칸 이름을 하나씩 적지 않고 통째로 훑는다 — 나중에 새 칸이 생겨도 저절로 들어간다.
// 여기에는 계산만 둔다 (화면·데이터베이스와 떨어져 있어 테스트가 쓴다).

export const APP = "life-dashboard";
export const FORMAT = 1;
export const PREFIX = "ld:";

// "v1.9 설정 정리 · 9월 28일" → "1.9". x.9 버전(1.9, 1.9.1, 2.9 …)이 아니면 null
export function x9Of(appVersion) {
  const m = /^v(\d+)\.9(?:\.\d+)?(?:\s|$)/.exec(appVersion ?? "");
  return m ? `${m[1]}.9` : null;
}
// 버전 글자의 앞부분 ("v1.9 설정 정리 · …" → "v1.9")
export const versionTag = (appVersion) => String(appVersion ?? "").split(" ")[0] || "v?";

const ldKeys = (storage) => {
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  return keys.sort();
};

// "ld:" 칸 전부, 저장된 글자 그대로
export function readItems(storage) {
  return Object.fromEntries(ldKeys(storage).map((k) => [k, storage.getItem(k)]));
}

// 사진(Blob) ↔ 글자(base64)
export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function base64ToBlob(data, type) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export const byteSize = (text) => new TextEncoder().encode(text).length;

// 백업 한 벌. photos: 사진 창고 전부 [{ id, blob }]
export async function makeBackup({ storage, photos, appVersion, at = new Date() }) {
  const items = readItems(storage);
  const pics = [];
  for (const p of photos) {
    if (p.blob instanceof Blob) pics.push({ id: String(p.id), type: p.blob.type || "image/jpeg", data: await blobToBase64(p.blob) });
  }
  const backup = {
    app: APP, format: FORMAT, version: String(appVersion ?? ""), at: at.toISOString(),
    counts: { items: Object.keys(items).length, photos: pics.length }, size: 0,
    items, photos: pics,
  };
  backup.size = byteSize(JSON.stringify(backup)); // 파일 크기 (이 숫자 자리 몇 글자만큼 차이)
  return backup;
}

const isObj = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

// 되살려도 되는 백업인지. 괜찮으면 "", 아니면 이유
export function checkBackup(b) {
  if (!isObj(b)) return "백업 파일이 아니야.";
  if (b.app !== APP) return "라이프대시보드 백업 파일이 아니야.";
  if (b.format !== FORMAT) return "읽을 수 없는 백업 형식이야.";
  if (typeof b.at !== "string" || Number.isNaN(Date.parse(b.at))) return "백업 날짜가 깨졌어.";
  if (!isObj(b.items) || !Array.isArray(b.photos) || !isObj(b.counts)) return "백업 내용이 깨졌어.";
  for (const [k, v] of Object.entries(b.items)) {
    if (!k.startsWith(PREFIX) || typeof v !== "string") return "기록이 깨졌어.";
  }
  for (const p of b.photos) {
    if (!isObj(p) || typeof p.id !== "string" || typeof p.type !== "string" || typeof p.data !== "string"
      || p.data.length % 4 !== 0 || !BASE64.test(p.data)) return "사진이 깨졌어.";
  }
  if (b.counts.items !== Object.keys(b.items).length || b.counts.photos !== b.photos.length) return "백업 내용이 깨졌어 (개수가 안 맞아).";
  return "";
}

// 파일 글자 → { backup } 또는 { error }
export function readBackupText(text) {
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    return { error: "파일이 깨졌어. 백업 파일(JSON)이 아니야." };
  }
  const error = checkBackup(b);
  return error ? { error } : { backup: b };
}

// 되살리기 (기록 쪽): 지금 "ld:" 칸을 모두 지우고 백업 것으로. "ld:" 가 아닌 칸은 건드리지 않는다
export function restoreItems(storage, items) {
  for (const k of ldKeys(storage)) storage.removeItem(k);
  for (const [k, v] of Object.entries(items)) storage.setItem(k, v);
}
// 되살리기 (사진 쪽): 사진 창고에 넣을 [{ id, blob }]
export const photosOf = (b) => b.photos.map((p) => ({ id: p.id, blob: base64ToBlob(p.data, p.type) }));

// life-dashboard-backup-v1.9-20260928.json (날짜는 백업한 날, 폰 시간)
export function fileName(b) {
  const d = new Date(b.at);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `life-dashboard-backup-${versionTag(b.version)}-${ymd}.json`;
}

// 812KB · 2.3MB
export function sizeLabel(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
