// ──────────────────────────────────────────────
// 직접 제작·시공 서비스 카탈로그
//
// [이 파일이 하는 일]
// /service 카탈로그 페이지, 블로그 글 하단 서비스 카드가 전부 이 배열 하나를 기준으로 삼는다.
// 이름·한 줄 설명·연결할 계산기·자동 매칭 키워드를 한 곳에서 관리해서, 서비스가 늘거나
// 문구가 바뀌어도 여기 한 곳만 고치면 화면 전체가 같이 바뀐다.
//
// [슬러그(slug) 규칙]
// 캠페인·CTA·추적 파라미터(service=)·블로그 프런트매터(cta:)에서 계속 쓰는 값이라
// 한 번 정하면 바꾸지 않는다.
//
// [키워드를 왜 이렇게 구체적으로 적었나 — blog-calculators.ts와 같은 이유]
// "싱크대"·"커튼"·"천장형"처럼 흔한 낱말을 그대로 쓰면, 이 서비스와 무관한 글의 태그 한 줄에
// 우연히 그 낱말이 섞여 있어도 서비스 카드가 붙어버린다(오탐). 그래서 실제 발행된 글 제목·태그를
// 대조해서 오탐이 안 나는 구체적인 phrase만 골랐다(2026-09-16 확인).
//   예) "싱크대" 대신 "싱크대 리폼"·"싱크대 상판" → 인테리어 필름 글들이 태그에 "싱크대 필름
//       비용"처럼 싱크대를 언급해도 안 걸린다.
//   예) "천장형" 대신 "천장형 제습기" → 시스템에어컨(천장형 냉난방기) 글이 안 걸린다.
//   예) "커튼" 대신 "암막커튼"·"커튼 가격"·"블라인드" 등 → 콘센트 증설 글의 태그
//       "커튼 박스 콘센트 증설 비용"처럼 커튼이 스치듯 언급된 글이 안 걸린다.
//
// 작성일: 2026년 09월 16일
// ──────────────────────────────────────────────

export interface ServiceInfo {
  /** 서비스 고유 값 — 카드 링크·블로그 프런트매터(cta:)·추적 파라미터(service=)에 그대로 쓰인다 */
  slug: string;
  /** 카드에 보이는 서비스 이름 */
  name: string;
  /** 카드 한 줄 설명 (설명글 최소화 원칙 — 카드당 딱 한 줄) */
  oneLiner: string;
  /** 이미 있는 계산기로 바로 연결할 주소. 없으면 "상담 후 견적"만 보여준다 */
  calcHref?: string;
  /** true면 전화 버튼만 보여준다 — 인테리어 컨설팅처럼 유선 상담만 받는 항목 */
  phoneOnly?: boolean;
  /**
   * 블로그 글에 이 서비스 카드를 자동으로 붙일 때 대조하는 신호 단어(제목+태그).
   * 빈 배열이면 자동 판정에 절대 안 걸리고, 프런트매터 `cta:` 직접 지정으로만 붙는다
   * (인테리어 컨설팅이 이 경우 — 상담 전용이라 자동으로 아무 글에나 붙으면 안 됨).
   */
  keywords: string[];
}

// 형아 확정 순서 그대로 — /service 카드 정렬에도 이 배열 순서를 그대로 쓴다.
// (현재 이 15개 중 연결할 계산기는 하나도 없다 — 전부 "상담 후 견적". 계산기가 생기면
// 해당 항목에 calcHref만 추가하면 카드에 자동으로 "바로 계산" 링크가 생긴다.)
export const SERVICES: ServiceInfo[] = [
  {
    slug: "fridge-cabinet",
    name: "냉장고장",
    oneLiner: "맞춤 제작·설치",
    keywords: ["냉장고장", "김치냉장고장"],
  },
  {
    slug: "builtin-closet",
    name: "붙박이장",
    oneLiner: "맞춤 제작·설치",
    keywords: ["붙박이장"],
  },
  {
    slug: "system-shelf",
    name: "시스템선반",
    oneLiner: "폭·단수 맞춤 제작",
    keywords: ["시스템선반", "시스템 선반"],
  },
  {
    slug: "sink-cabinet",
    name: "싱크대",
    oneLiner: "상판·수전까지 맞춤 시공",
    // ⚠️ 바닥재 계산기와 같은 이유로 "싱크대" 단독은 절대 안 쓴다 — 인테리어 필름 글들이
    // 태그에 "싱크대 필름 비용"·"싱크대 도어 재질"처럼 싱크대를 스치듯 언급해서 오탐이 난다.
    keywords: ["싱크대 리폼", "싱크대 상판", "싱크대 교체", "싱크대 문짝", "싱크볼 교체", "주방 후드 교체", "렌지후드 교체"],
  },
  {
    slug: "door-frame",
    name: "공틀도어",
    oneLiner: "문틀째 새로 하는 방문 교체",
    keywords: ["공틀도어", "문틀 교체", "방문 교체"],
  },
  {
    slug: "grout",
    name: "줄눈",
    oneLiner: "욕실·주방 줄눈 시공",
    keywords: ["줄눈"],
  },
  {
    slug: "elastic-coat",
    name: "탄성코트",
    oneLiner: "베란다 바닥 방수 코팅",
    keywords: ["탄성코트", "탄성코팅"],
  },
  {
    slug: "nano-coating",
    name: "나노코팅",
    oneLiner: "욕실·주방 발수 코팅",
    keywords: ["나노코팅", "나노 코팅"],
  },
  {
    slug: "insulation-film",
    name: "단열필름",
    oneLiner: "창문 단열 필름 시공",
    keywords: ["단열필름", "단열 필름"],
  },
  {
    slug: "curtain",
    name: "커튼·전동커튼",
    oneLiner: "커튼·전동커튼 제작·설치",
    // ⚠️ "커튼" 단독·"커튼박스" 단독은 안 쓴다 — 콘센트 증설 글이 태그에 "커튼 박스 콘센트
    // 증설 비용", 제목에 "…커튼박스 위치별 추천"처럼 커튼을 스치듯 언급해서 오탐이 난다.
    keywords: [
      "암막커튼", "쉬어커튼", "겹커튼", "이중커튼", "속커튼", "블라인드",
      "전동커튼", "전동 커튼", "커튼 가격", "커튼 비용", "커튼 설치", "커튼 교체", "커튼 세탁",
      "롤스크린", "로만쉐이드",
    ],
  },
  {
    slug: "food-waste-disposer",
    name: "음식물처리기",
    oneLiner: "싱크대 음식물처리기 설치",
    keywords: ["음식물처리기", "음식물 처리기"],
  },
  {
    slug: "louver-automation",
    name: "실외기실 루버 자동개폐기",
    oneLiner: "루버 자동개폐기 설치",
    keywords: ["루버 자동개폐기", "실외기실 루버", "루버 개폐기"],
  },
  {
    slug: "ceiling-dehumidifier",
    name: "천장형 공기청정 제습기",
    oneLiner: "천장형 공기청정 제습기 설치",
    // ⚠️ "천장형" 단독은 안 쓴다 — 시스템에어컨(천장형 냉난방기) 글이 여럿이라 오탐이 난다.
    keywords: ["천장형 제습기", "천장형 공기청정"],
  },
  {
    slug: "smart-mirror",
    name: "스마트미러",
    oneLiner: "거울형 디스플레이 설치",
    keywords: ["스마트미러", "스마트 미러"],
  },
  {
    slug: "consulting",
    name: "인테리어 컨설팅",
    oneLiner: "유선 상담",
    // 유선 문의만 받는 항목이라 전화 버튼만 보여준다
    phoneOnly: true,
    // 자동 판정에 걸리면 아무 글에나 "상담 신청" 카드가 붙어버려서 일부러 비워둔다.
    // (붙이고 싶으면 그 글 프런트매터에 cta: consulting 을 직접 적는다)
    keywords: [],
  },
];

/** slug → ServiceInfo 빠른 조회용 (등록된 15개 서비스 기준) */
const SERVICES_BY_SLUG = new Map(SERVICES.map((s) => [s.slug, s]));

/** 서비스 하나를 slug로 찾는다. 없으면 undefined */
export function getService(slug: string): ServiceInfo | undefined {
  return SERVICES_BY_SLUG.get(slug);
}

/**
 * 글에 붙일 서비스 카드를 정한다.
 *
 * 계산기(blog-calculators.ts의 detectCalculator)와 달리 서비스 카드는 글 하나에 1장만
 * 붙이는 게 기획 원칙("글 갈래 → 서비스 카드 1:1")이라, 매치되는 서비스가 여럿이어도
 * SERVICES 배열 순서상 가장 먼저 나오는 것 하나만 돌려준다.
 *
 * @param title 글 제목
 * @param tags 글 태그
 * @param override 프런트매터 `cta:` 값 — 서비스 slug 문자열 하나(사람이 최종 결정),
 *   또는 "none"(자동 판정도 끄고 카드 자체를 안 붙임)
 * @returns 매치된 서비스 slug, 없으면 null(카드를 아예 안 그림)
 */
export function detectServiceCta(title: string, tags: string[], override?: unknown): string | null {
  // 1) 프런트매터에 사람이 적어 둔 값이 최우선 — 자동 판정을 아예 건너뛴다
  if (typeof override === "string") {
    if (override === "none") return null;
    if (SERVICES_BY_SLUG.has(override)) return override;
    // "none"도 아니고 등록된 slug도 아니면(오타 등) → 자동 판정으로 넘어간다
  }

  // 2) 제목+태그 신호 단어로 자동 판정 — 배열 순서상 첫 매치만 쓴다
  //    (인테리어 컨설팅은 keywords가 비어 있어 여기서 절대 안 걸린다)
  const hay = [title, ...tags].join(" ");
  for (const service of SERVICES) {
    if (service.keywords.some((k) => hay.includes(k))) return service.slug;
  }
  return null;
}
