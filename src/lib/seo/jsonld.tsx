// ──────────────────────────────────────────────
// JSON-LD(구조화 데이터) 공용 헬퍼
//
// [왜 만들었나]
// 블로그 글 페이지(blog/[slug]/page.tsx)와 Breadcrumbs.tsx가 각자
// <script type="application/ld+json"> 태그를 손으로 만들어 쓰고 있었다.
// 계산기 페이지(도배·바닥재·허브)에도 같은 방식이 3곳 더 필요해져서,
// "데이터를 만드는 함수"와 "그 데이터를 <script> 태그로 찍어내는 부품"을
// 한 곳으로 모았다. 블로그 쪽 기존 코드는 그대로 두고(손대지 않음),
// 새로 쓰는 계산기 페이지만 이 헬퍼를 쓴다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

/** 사이트 기준 주소 — 상대경로(href)를 절대주소로 바꿀 때 씀 */
export const SITE_URL = "https://ulmadna.com";

/**
 * JSON-LD 데이터 하나를 <script type="application/ld+json"> 태그로 렌더링.
 * data를 그대로 JSON 문자열로 박아 넣는다 — 구글이 이 스크립트를 읽고
 * 검색결과에 별점·FAQ 펼침·경로(빵부스러기) 같은 특수 표시를 붙여준다.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** 계산기 페이지 공용 — "이건 무료로 쓸 수 있는 웹 도구다"를 구글에 알리는 구조화 데이터 */
export function softwareApplicationLd(opts: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    description: opts.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    url: opts.url,
    // 완전 무료 계산기라는 뜻으로 가격을 0원으로 명시
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
  };
}

/** 자주 묻는 질문 구조화 데이터 — 화면에 보이는 FAQ 펼침과 항상 같은 내용을 써야 함 */
export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** 길잡이(빵부스러기) 구조화 데이터 — Breadcrumbs.tsx(블로그용)와 같은 모양 */
export function breadcrumbLd(items: { name: string; href?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      // 마지막 칸(현재 페이지)은 링크 없이 이름만 있어도 됨
      ...(c.href ? { item: `${SITE_URL}${c.href}` } : {}),
    })),
  };
}
