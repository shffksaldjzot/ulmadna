// ──────────────────────────────────────────────
// 블로그 검색 — 한국어 편의 매칭 규칙
//
// [왜 필요한가]
// 사람들은 검색창에 띄어쓰기를 잘 안 씁니다. "샷시비용"이라고 치는데
// 글 제목은 "샷시 교체 비용"이라 그냥 문자 비교로는 절대 안 걸립니다.
// 그래서 아래 두 단계로 찾아줍니다.
//   1단계: 띄어쓰기·기호를 다 지우고 통째로 들어있는지 본다 ("욕실비용" → "욕실비용")
//   2단계: 1단계가 실패하면, 검색어를 여러 조각으로 쪼개서
//          그 조각들이 "순서대로" 글 안에 들어있는지 본다
//          ("샷시비용" → "샷시" + "비용" 이 순서대로 있으면 통과)
//
// 조각은 최소 2글자로 제한합니다. 1글자까지 허용하면
// 아무 글이나 다 걸려버려서 검색이 쓸모없어지기 때문입니다.
// ──────────────────────────────────────────────

import { normalizeKo } from "./blog-categories";

export { normalizeKo };

/** 조각의 최소 길이 — 1글자 조각은 오탐이 너무 많아 금지 */
const MIN_PIECE = 2;
/** 이 길이 이상인 검색어만 조각내기를 시도 (짧은 말은 그냥 통째로 찾음) */
const MIN_SPLIT_LEN = 4;

/**
 * 검색어 한 덩어리(token)를 조각내서 순서대로 찾을 수 있는지 검사.
 * 재귀로 "앞에서부터 긴 조각 우선" 시도 — 긴 덩어리가 먼저 맞을수록 오탐이 적음.
 *
 * @param token 이미 정규화된 검색어 조각
 * @param hay   이미 정규화된 글 내용(제목+설명+태그+소제목)
 */
function canSplitMatch(token: string, hay: string): boolean {
  // 이미 검사해본 (검색어 위치, 글 위치) 조합은 다시 안 봄 (속도)
  const seen = new Set<number>();

  const walk = (ti: number, hi: number): boolean => {
    if (ti >= token.length) return true; // 검색어를 끝까지 다 소화함 = 성공
    const key = ti * 100000 + hi;
    if (seen.has(key)) return false;
    seen.add(key);

    // 남은 검색어를 긴 조각부터 짧은 조각(최소 2글자)까지 잘라가며 시도
    for (let len = token.length - ti; len >= MIN_PIECE; len--) {
      const piece = token.slice(ti, ti + len);
      const found = hay.indexOf(piece, hi);
      if (found < 0) continue;
      if (walk(ti + len, found + piece.length)) return true;
    }
    return false;
  };

  return walk(0, 0);
}

/**
 * 글 하나가 검색어에 걸리는지 판정.
 * 검색어를 공백으로 나눠 여러 낱말이면 "전부 다" 들어있어야 통과(AND).
 *
 * @param query 사용자가 입력한 원본 검색어
 * @param hay   미리 정규화해둔 글 내용
 */
export function matchesQuery(query: string, hay: string): boolean {
  const tokens = query
    .split(/\s+/)
    .map((t) => normalizeKo(t))
    .filter(Boolean);
  if (tokens.length === 0) return true; // 검색어가 없으면 전부 통과

  return tokens.every((tok) => {
    if (hay.includes(tok)) return true; // 1단계 — 통째로 있으면 끝
    if (tok.length < MIN_SPLIT_LEN) return false; // 짧은 말은 여기서 종료
    return canSplitMatch(tok, hay); // 2단계 — 쪼개서 순서대로 찾기
  });
}
