// ──────────────────────────────────────────────
// 블로그 글 ↔ 공정별 물량 계산기 연결
//
// [왜 만들었나]
// 도배 관련 글마다 본문 markdown에 계산기 링크를 손으로 박으면, 글이 140편이 넘고
// 앞으로 자동 발행되는 글까지 매번 빠뜨리기 쉽다. 그래서 글의 제목·태그를 보고
// "이 글은 도배 글이다"를 자동으로 판정하고, 글 페이지가 계산기 안내 카드를 그린다.
//
// [규칙]
// - 프런트매터에 `calculator: wallpaper` 라고 적으면 무조건 켜지고,
//   `calculator: none` 이라고 적으면 무조건 꺼진다. (사람이 최종 결정권)
// - 아무것도 안 적혀 있으면 제목+태그에 신호 단어(도배·벽지·실크·합지·디아망)가 있는지로 판정한다.
// - 비교는 blog-categories.ts와 같은 normalizeKo 로 띄어쓰기를 지우고 한다.
//
// 작성일: 2026년 09월 09일 (형아 지시: 도배 관련 글 전부에 도배 물량 계산기 붙이기)
// ──────────────────────────────────────────────

/** 지금 열려 있는 계산기 종류 (새 공정 계산기가 생기면 여기에 한 줄 추가) */
export type CalculatorKey = "wallpaper";

/** 계산기 하나의 화면 문구·주소 */
export interface CalculatorInfo {
  key: CalculatorKey;
  /** 버튼·배너에 쓰는 짧은 이름 */
  label: string;
  /** 계산기 주소 */
  href: string;
  /** 본문 끝 카드의 큰 글씨 */
  headline: string;
  /** 본문 끝 카드의 설명 한 줄 */
  sub: string;
  /** 목차 아래 작은 배너 한 줄 */
  mini: string;
  /** 이 계산기를 붙일 글을 고르는 신호 단어 (제목+태그, 띄어쓰기 무시) */
  keywords: string[];
}

export const CALCULATORS: Record<CalculatorKey, CalculatorInfo> = {
  wallpaper: {
    key: "wallpaper",
    label: "도배 물량 계산기",
    href: "/v1/calc/wallpaper",
    headline: "우리 집 도배, 벽지 몇 롤에 얼마일까?",
    sub: "평형만 고르면 벽지 롤수·부자재·시공비까지 바로 나옵니다. 방 치수를 넣으면 더 정확해져요. 로그인·개인정보 없음.",
    mini: "평형만 고르면 벽지 롤수·비용이 바로 나와요",
    keywords: ["도배", "벽지", "실크", "합지", "디아망"],
  },
};

/**
 * 글에 붙일 계산기를 정한다.
 * @param title 글 제목
 * @param tags 글 태그
 * @param override 프런트매터 `calculator` 값 (없으면 undefined)
 */
export function detectCalculator(
  title: string,
  tags: string[],
  override?: unknown,
): CalculatorKey | null {
  // 1) 사람이 적어 둔 값이 최우선
  if (typeof override === "string") {
    if (override === "none") return null;
    if (override in CALCULATORS) return override as CalculatorKey;
  }
  // 2) 제목+태그 신호 단어로 자동 판정
  //    ⚠️ 여기서는 띄어쓰기를 지우지 않는다. 지우면 "수도 배관"이 "수도배관"이 되어 "도배"로 잘못 잡힌다
  //       (2026-09-09 배관 교체 글이 도배 글로 분류된 사고). 대신 "수도배관"처럼 붙여 쓴 경우만 미리 걸러낸다.
  const hay = [title, ...tags]
    .join(" ")
    .toLowerCase()
    .replace(/수도\s*배관/g, " ");
  for (const info of Object.values(CALCULATORS)) {
    if (info.keywords.some((k) => hay.includes(k.toLowerCase()))) return info.key;
  }
  return null;
}
