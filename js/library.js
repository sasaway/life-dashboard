// 라이브러리: 네 분류의 기록. 분류·작성 구조·어체는 Notion '프로젝트: 라이브러리' 그대로.
// 기록은 앱에서 직접 적고 폰에 저장한다 (사용자 결정). 이력서는 형식이 정해지면 따로 만든다.
import { newId } from "./shopping.js";

export const CATS = [
  { id: "index", label: "인덱스", what: "책 · 정보 유튜브 영상 요약", tone: "간결하고 핵심적인 정보만 요약", fields: ["title", "body", "source"] },
  {
    id: "portfolio", label: "포트폴리오", what: "만든 프로젝트 · 앱 · 협업 결과물", tone: "배운 점과 시장 가치를 평가",
    kinds: ["프로젝트", "협업"], fields: ["title", "kind", "body", "ref", "photos"],
  },
  { id: "profile", label: "프로필", what: "수료한 교육 커리큘럼 · 자격증", tone: "출처의 인지도와 명성을 언급", fields: ["title", "source", "body"] },
  {
    id: "curator", label: "큐레이터", what: "감명 깊었던 애니메이션 · 게임스토리 · 소설 · 음악 · 시 분석", tone: "에세이 · 수필처럼",
    kinds: ["철학적 고찰", "예술적 고찰"], kindHints: { "철학적 고찰": "애니메이션 · 게임스토리", "예술적 고찰": "소설 · 음악 · 시" },
    fields: ["title", "kind", "body"],
  },
];
export const FIELD_KO = { title: "제목", kind: "분류", body: "내용", source: "출처", ref: "레퍼런스", photos: "사진자료" };
export const catOf = (id) => CATS.find((c) => c.id === id);

// { id, cat, title, kind, body, source, ref, photos: [사진 id], at: 처음 적은 때, updated }
export function blankEntry(cat, id = newId(), now = new Date()) {
  const t = now.toISOString();
  return { id, cat, title: "", kind: catOf(cat).kinds?.[0] ?? "", body: "", source: "", ref: "", photos: [], at: t, updated: t };
}

export const entryProblem = (e) => (e.title.trim() ? null : "제목을 적어 줘.");

// 그 분류에 있는 칸만 남기고 저장한다. 처음 적은 날(at)은 그대로, updated 는 지금
export function saveEntry(list, e, now = new Date()) {
  if (entryProblem(e)) return list;
  const c = catOf(e.cat);
  const has = (f) => c.fields.includes(f);
  const clean = {
    id: e.id, cat: e.cat,
    title: e.title.trim(),
    kind: has("kind") ? (c.kinds.includes(e.kind) ? e.kind : c.kinds[0]) : "",
    body: has("body") ? e.body.trim() : "",
    source: has("source") ? e.source.trim() : "",
    ref: has("ref") ? e.ref.trim() : "",
    photos: has("photos") ? [...e.photos] : [],
    at: e.at, updated: now.toISOString(),
  };
  return list.some((x) => x.id === e.id) ? list.map((x) => (x.id === e.id ? clean : x)) : [...list, clean];
}

export const removeEntry = (list, id) => list.filter((e) => e.id !== id);
export const entriesOf = (list, cat) => list.filter((e) => e.cat === cat).sort((a, b) => b.at.localeCompare(a.at));
export const countsBy = (list) => Object.fromEntries(CATS.map((c) => [c.id, list.filter((e) => e.cat === c.id).length]));
