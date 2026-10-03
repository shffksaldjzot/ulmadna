// ──────────────────────────────────────────────
// 물어보기 — 선 아이콘 모음 (시안 svg 그대로, 아이콘 꾸러미 안 씀)
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

/** 말풍선(댓글 수·질문하기 단추) */
export function IcBubble() {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}
/** 더하기(질문하기) */
export function IcPlus() {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
/** 돋보기(검색) */
export function IcSearch() {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}
/** 왼쪽 꺾쇠(뒤로) */
export function IcBack() {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}
/** 책갈피(저장) */
export function IcBookmark() {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10v17l-5-3-5 3z" />
    </svg>
  );
}
/** 공유 */
export function IcShare() {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11M8 8l4-4 4 4M5 14v5h14v-5" />
    </svg>
  );
}
