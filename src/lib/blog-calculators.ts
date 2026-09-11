// ──────────────────────────────────────────────
// 블로그 글 ↔ 공정별 물량 계산기 연결
//
// [왜 만들었나]
// 도배 관련 글마다 본문 markdown에 계산기 링크를 손으로 박으면, 글이 140편이 넘고
// 앞으로 자동 발행되는 글까지 매번 빠뜨리기 쉽다. 그래서 글의 제목·태그를 보고
// "이 글은 도배 글이다"를 자동으로 판정하고, 글 페이지가 계산기 안내 카드를 그린다.
//
// [규칙]
// - 프런트매터 `calculator:` 값이 있으면 무조건 그 값이 최종 결정이다 (사람이 최종 결정권).
//   · `calculator: wallpaper` 처럼 문자열 하나 → 그 계산기 하나만 강제로 켠다.
//   · `calculator: none` → 전부 끈다(자동 판정도 안 한다).
//   · `calculator: [wallpaper, flooring]` 처럼 배열 → 적힌 계산기들을 전부 켠다(복수 강제).
// - 프런트매터에 아무것도 안 적혀 있으면 제목+태그에 신호 단어가 있는지로 자동 판정한다.
// - 자동 판정은 "매치되는 계산기를 전부" 배열로 돌려준다. 도배 글이면서 바닥재 글이기도 하면
//   (예: 디아망 도배+바닥재 시공 후기) 둘 다 켜진다 — 예전처럼 하나만 고르지 않는다.
//   (2026-09-11: 첫 매치만 반환하던 것을 배열 반환으로 바꿈)
//
// 작성일: 2026년 09월 09일 (형아 지시: 도배 관련 글 전부에 도배 물량 계산기 붙이기)
// 2026년 09월 10일: 바닥재 계산기(U 지시서) 추가
// 2026년 09월 11일: 계산기 경로 /calc 이전 + 매치되는 계산기 전부 반환하도록 개편
// ──────────────────────────────────────────────

/** 지금 열려 있는 계산기 종류 (새 공정 계산기가 생기면 여기에 한 줄 추가) */
export type CalculatorKey = "wallpaper" | "flooring";

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
    href: "/calc/wallpaper",
    headline: "우리 집 도배, 벽지 몇 롤에 얼마일까?",
    // 2026-09-10 형아 지시: sub·mini 문구를 "제품만 고르면 …"으로 통일(간단 모드는 제품을 골라야
    // 금액이 나오는 규칙이 2026-09-09부터 적용됐다 — 안내 문구도 그에 맞춘다)
    sub: "제품만 고르면 벽지 롤수·부자재·시공비까지 바로 나옵니다. 방 치수를 넣으면 더 정확해져요. 로그인·개인정보 없음.",
    mini: "제품만 고르면 벽지 롤수·비용이 바로 나와요",
    keywords: ["도배", "벽지", "실크", "합지", "디아망"],
  },
  flooring: {
    key: "flooring",
    label: "바닥재 물량 계산기",
    href: "/calc/flooring",
    headline: "우리 집 바닥, 마루 몇 박스에 얼마일까?",
    sub: "제품만 고르면 박스 수·부자재·시공비까지 바로 나옵니다. 방 치수를 넣으면 더 정확해져요. 로그인·개인정보 없음.",
    mini: "제품만 고르면 박스 수·비용이 바로 나와요",
    // 2026-09-11: "LVT"(대소문자 무관)·"헤링본"·"원목마루" 추가.
    // ⚠️ "바닥" 단독은 절대 넣지 않는다 — 바닥 난방/누수/매트 글까지 전부 바닥재 계산기가
    //    붙어버리는 오탐이 생긴다(바닥재 관련 글이 아닌데도 걸림).
    keywords: ["바닥재", "마루", "강마루", "강화마루", "장판", "데코타일", "LVT", "헤링본", "원목마루"],
  },
};

/**
 * 글에 붙일 계산기를 정한다. 매치되는 계산기가 여럿이면 전부 배열로 돌려준다.
 * @param title 글 제목
 * @param tags 글 태그
 * @param override 프런트매터 `calculator` 값 (없으면 undefined) —
 *   문자열 하나("wallpaper" 등) · "none"(전부 끔) · 문자열 배열(복수 강제) 중 하나
 */
export function detectCalculator(
  title: string,
  tags: string[],
  override?: unknown,
): CalculatorKey[] {
  // 1) 사람이 적어 둔 값이 최우선 (자동 판정을 아예 건너뛴다)
  //    ⚠️ `k in CALCULATORS` 대신 hasOwnProperty로 검사한다. `in`은 "toString"·"constructor"처럼
  //    자바스크립트 객체가 원래 갖고 있는(프로토타입 체인의) 이름까지 있다고 착각할 수 있어서
  //    (2026-09-11 검사관 지적) 진짜 우리가 등록한 키인지만 정확히 확인하는 방식으로 바꿨다.
  if (typeof override === "string") {
    if (override === "none") return [];
    if (Object.prototype.hasOwnProperty.call(CALCULATORS, override)) return [override as CalculatorKey];
    // 문자열인데 "none"도 아니고 유효한 키도 아니면(오타 등) → 자동 판정으로 넘어간다
  } else if (Array.isArray(override)) {
    // 배열로 여러 계산기를 강제 지정한 경우 — 유효한 키만 걸러서 그대로 쓴다
    return override.filter(
      (k): k is CalculatorKey => typeof k === "string" && Object.prototype.hasOwnProperty.call(CALCULATORS, k),
    );
  }
  // 2) 제목+태그 신호 단어로 자동 판정 — 매치되는 계산기를 전부 모아서 돌려준다
  //    ⚠️ 여기서는 띄어쓰기를 지우지 않는다. 지우면 "수도 배관"이 "수도배관"이 되어 "도배"로 잘못 잡힌다
  //       (2026-09-09 배관 교체 글이 도배 글로 분류된 사고). 대신 "수도배관"처럼 붙여 쓴 경우만 미리 걸러낸다.
  const hay = [title, ...tags]
    .join(" ")
    .toLowerCase()
    .replace(/수도\s*배관/g, " ");
  const matched: CalculatorKey[] = [];
  for (const info of Object.values(CALCULATORS)) {
    if (info.keywords.some((k) => hay.includes(k.toLowerCase()))) matched.push(info.key);
  }
  return matched;
}
