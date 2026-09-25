// 새로 사 온 재료로 해 볼 만한 것. 돈 탭 '사야 할 것' 에서 '가져옴' 한 재료를 본다.
// 자취생 기준으로 싸고, 빠르고, 단백질·채소를 조금이라도 더하는 쪽을 고른다.
// 재료 이름에 아래 낱말이 들어 있으면 추천한다 (한 글자 낱말은 이름이 똑같을 때만: '파' ≠ '양파').
// 새 규칙은 여기에 한 줄 더한다.
export const TIPS = [
  { words: ["계란", "달걀"], tips: ["라면에 계란 2개 풀기 (단백질 약 12g 더)", "계란 볶음밥"] },
  { words: ["두부"], tips: ["짜글이에 두부 반 모", "라면에 두부 넣어 순하게"] },
  { words: ["닭가슴살"], tips: ["닭가슴살 + 햇반", "라면에 닭가슴살 찢어 넣기"] },
  { words: ["대패", "삼겹", "돼지"], tips: ["냉동 대패 짜글이 (두 끼 분량)"] },
  { words: ["대파", "쪽파", "파"], tips: ["계란 볶음밥 파기름", "라면에 파 송송"] },
  { words: ["양파"], tips: ["짜글이에 양파 반 개"] },
  { words: ["애호박", "호박"], tips: ["짜글이에 애호박"] },
  { words: ["감자"], tips: ["짜글이에 감자 (고기 볶은 뒤 넣기)"] },
  { words: ["버섯"], tips: ["짜글이에 버섯", "라면에 버섯"] },
  { words: ["콩나물"], tips: ["라면에 콩나물 한 줌"] },
  { words: ["김치"], tips: ["계란 볶음밥에 김치 (김치 볶음밥)", "라면에 김치"] },
  { words: ["참치"], tips: ["계란 볶음밥에 참치 (단백질 더)"] },
  { words: ["스팸", "햄"], tips: ["계란 볶음밥에 스팸 조금"] },
  { words: ["치즈"], tips: ["라면에 치즈 한 장"] },
  { words: ["만두"], tips: ["라면에 만두 3~4개"] },
  { words: ["우유"], tips: ["짜파게티 물을 조금 줄이고 우유 반 컵"] },
  { words: ["브로콜리", "양배추", "샐러드"], tips: ["닭가슴살 + 햇반에 곁들이기"] },
];

const DAY_MS = 864e5;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

const matches = (name, word) => (word.length === 1 ? name === word : name.includes(word));

// 최근 days 일 안에 가져온 재료 중 추천이 있는 것 (같은 재료는 가장 최근 것 하나만)
export function tipsFor(bought, today, days = 14) {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()) - (days - 1) * DAY_MS;
  const seen = new Set();
  const out = [];
  for (const b of bought) {
    const key = b.name.trim();
    if (seen.has(key) || parse(b.day) < from) continue;
    seen.add(key);
    const tips = TIPS.filter((t) => t.words.some((w) => matches(key, w))).flatMap((t) => t.tips);
    if (tips.length) out.push({ name: key, day: b.day, tips: [...new Set(tips)] });
  }
  return out;
}
