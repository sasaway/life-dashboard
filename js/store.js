// 폰 안에 저장하기. 앱을 껐다 켜도 남는다.
// localStorage 는 브라우저가 앱마다 따로 주는 작은 서랍이다.

const PREFIX = "ld:";

export function createStore(storage) {
  return {
    load(key, fallback) {
      try {
        const raw = storage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback; // 서랍을 못 열거나 내용이 깨졌으면 기본값
      }
    },
    save(key, value) {
      try {
        storage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        return false; // 저장 공간이 꽉 찼거나 막혀 있음
      }
    },
  };
}

function safeLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// 브라우저에서는 localStorage, 못 쓰면 이번 실행 동안만 기억한다
const memory = new Map();
const fallbackStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
};

export const store = createStore(safeLocalStorage() ?? fallbackStorage);

// 아이폰이 오래 안 쓴 앱의 저장 내용을 지우지 않도록 부탁한다
export async function askToKeepData() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // 지원하지 않는 브라우저면 넘어간다
  }
}
