// 사야 할 것. 규칙은 Notion '돈'.
// 가져온 물건은 목록에서 사라지지만, 식단 추천이 쓸 수 있게 '산 재료'로 남긴다.

const MAX_BOUGHT = 100; // 산 재료는 최근 것만 남긴다

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// 새 물건 추가. 문제가 있으면 error 에 이유.
export function addItem(list, name, id = newId()) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { list, error: "뭘 사야 하는지 적어 줘." };
  if (list.some((x) => same(x.name, clean))) return { list, error: `'${clean}' 은(는) 이미 목록에 있어.` };
  return { list: [...list, { id, name: clean, star: false }], error: "" };
}

export function toggleStar(list, id) {
  return list.map((x) => (x.id === id ? { ...x, star: !x.star } : x));
}

// 가져옴: 목록에서 빼고 산 재료에 넣는다
export function bring(list, bought, id, day) {
  const item = list.find((x) => x.id === id);
  if (!item) return { list, bought };
  return {
    list: list.filter((x) => x.id !== id),
    bought: [{ name: item.name, day }, ...bought].slice(0, MAX_BOUGHT),
  };
}

// 잘못 넣은 것 지우기: 산 재료로 남기지 않는다 (가져옴과 다른 점)
export const removeItem = (list, id) => list.filter((x) => x.id !== id);

export const starred = (list) => list.filter((x) => x.star);

// 메인 카드의 빈 목록 문구
export function mainEmptyText(list) {
  return list.length ? "별표 붙인 게 없어. 돈 탭에서 붙일 수 있어." : "다 샀어. 목록이 비었어.";
}
