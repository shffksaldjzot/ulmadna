// ──────────────────────────────────────────────
// v1 허브 — 인라인 SVG 아이콘 모음
// 디자인 가이드 v4에 나온 선(stroke) 아이콘만 그대로 옮겨 둔다.
// 새 UI 라이브러리(아이콘 팩)를 쓰지 않기 위해 전부 직접 작성.
// ──────────────────────────────────────────────

import type { SVGProps } from 'react';

/** 홈(집 모양) 아이콘 — 하단 탭 */
export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" {...props}>
      <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** 계산기(숫자패드) 아이콘 — 하단 탭 */
export function IconCalc(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" {...props}>
      <rect x="4" y="2.5" width="12" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 6.5h6M7 10h2M7 13.5h2M12.5 10v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 시세(가격표) 아이콘 — 하단 탭 */
export function IconPrice(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" {...props}>
      <path d="M4 3.5h9a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2v-11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.5 7h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 질문(말풍선) 아이콘 — 하단 탭 */
export function IconQuestion(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" {...props}>
      <rect x="2.5" y="3.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 14.5 6 18l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** 내 정보(사람) 아이콘 — 하단 탭 */
export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" {...props}>
      <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 17a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 검색 아이콘 */
export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" {...props}>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.5 13.5 18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 아래쪽 화살표(chevron-down) — 세그먼트·펼침 */
export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" {...props}>
      <path d="M1 1.5 6 6.5l5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 위쪽 화살표(chevron-up) — 펼침 닫기 */
export function IconChevronUp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" {...props}>
      <path d="M1 6.5 6 1.5l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 오른쪽 화살표(chevron-right) — 리스트 링크 행 */
export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" {...props}>
      <path d="M1.5 1 6.5 6l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 뒤로가기 화살표 — 상단 내비 */
export function IconBack(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none" {...props}>
      <path d="M8 1 2 8l6 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 자물쇠(비공개, 채운 모양) */
export function IconLockClosed(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="13" height="15" viewBox="0 0 12 14" fill="none" {...props}>
      <path d="M3 6V4a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/** 자물쇠(공개, 열린 모양) */
export function IconLockOpen(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="17" viewBox="0 0 12 14" fill="none" {...props}>
      <path d="M4 6V4a3 3 0 0 1 5.6-1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/** 북마크(저장) 아이콘. filled=true면 채운 모양(저장됨 상태) */
export function IconBookmark({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg width="15" height="18" viewBox="0 0 14 17" fill="none" {...props}>
      {filled ? (
        <path d="M2 1.5h10v14l-5-4-5 4v-14Z" fill="currentColor" />
      ) : (
        <path d="M2 1.5h10v14l-5-4-5 4v-14Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** 공유(점 3개 연결) 아이콘 */
export function IconShare(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...props}>
      <circle cx="13.5" cy="4" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="4.5" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13.5" cy="14" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.9 7.8 11.1 5.2M6.9 10.2l4.2 2.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** 체크(선택됨) 아이콘 — 체크박스 안에 들어감 */
export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="13" height="10" viewBox="0 0 12 10" fill="none" {...props}>
      <path d="M1 5l3.5 3.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 닫기(x) 아이콘 — 바텀시트 등 */
export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M2 2l12 12M14 2 2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
