// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기에 붙이는 블로그 글(결과 카드 ⑨ · 페이지 아래 관련 글 공용)
//
// 결과 카드(클라이언트)와 페이지(서버)가 같은 목록을 쓰게 따로 뺐다. 글 주소는 content/blog/*.md 파일 이름.
//
// 작성일: 2026년 10월 08일
// ──────────────────────────────────────────────

/** 관련 글 한 편 */
export interface TileRelatedPost {
  href: string;
  label: string;
}

/** 비용 → 덧방·철거 → ㎡당 단가 → 종류별 가격 → 주방 벽 순 */
export const TILE_RELATED_POSTS: TileRelatedPost[] = [
  { href: '/blog/tile-construction-cost', label: '타일 시공 비용 — 욕실·주방·현관, 덧방·철거 차이' },
  { href: '/blog/bathroom-tile-overlay-vs-demolition-cost', label: '욕실 타일 덧방 vs 올철거 비용' },
  { href: '/blog/tile-estimate-per-sqm-labor-material-breakdown', label: '타일 ㎡당 단가 — 인건·부자재·폐기물 읽는 법' },
  { href: '/blog/tile-type-material-price-comparison', label: '도기질·자기질·포세린 종류별 가격' },
];
