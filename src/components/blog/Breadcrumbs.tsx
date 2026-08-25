// ──────────────────────────────────────────────
// 빵부스러기 길잡이(브레드크럼) — "홈 > 블로그 > 카테고리" 처럼
// 지금 보고 있는 페이지가 어디쯤인지 보여주는 줄입니다.
//
// [왜 넣나]
// 1) 사람: 글을 검색으로 바로 들어온 사람이 같은 주제 목록으로 한 번에 올라갈 수 있음
// 2) 검색엔진: BreadcrumbList 구조화데이터를 같이 심으면
//    구글 검색결과 제목 밑에 "얼마드나 > 블로그 > 욕실·화장실" 처럼 경로가 찍힙니다.
// ──────────────────────────────────────────────

import Link from "next/link";

const SITE = "https://ulmadna.com";

/** 길잡이 한 칸 — 마지막 칸(지금 페이지)은 href 없이 글자만 */
export interface Crumb {
  name: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  // 구글이 읽는 경로 데이터 — 순서(position)는 1부터
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      // 마지막 칸(현재 페이지)은 링크를 비워도 되지만, 주소가 있으면 넣어줍니다
      ...(c.href ? { item: `${SITE}${c.href}` } : {}),
    })),
  };

  return (
    <>
      <nav className="blog-crumbs" aria-label="현재 위치">
        {items.map((c, i) => (
          <span key={`${c.name}-${i}`} className="blog-crumb">
            {/* 두 번째 칸부터는 앞에 구분 기호 */}
            {i > 0 && <span className="blog-crumb-sep" aria-hidden="true">›</span>}
            {c.href ? (
              <Link href={c.href}>{c.name}</Link>
            ) : (
              <span className="blog-crumb-now" aria-current="page">{c.name}</span>
            )}
          </span>
        ))}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
    </>
  );
}
