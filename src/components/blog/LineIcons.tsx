// ──────────────────────────────────────────────
// 블로그 단색 선 아이콘 모음 (컬러 이모지 🔖 ❤️ 🔍 대신)
//
// - 색은 글자색(currentColor)을 그대로 따라가서, 버튼이 눌리면(강조색) 아이콘도 같이 바뀐다.
// - 선 굵기 1.8 · 24칸 기준으로 다른 선 아이콘과 톤을 맞췄다.
// - filled=true 면 속을 채운다(저장됨·좋아요 누름 상태 표시).
//
// 작성일: 2026년 10월 29일 (폴리싱 묶음 C)
// ──────────────────────────────────────────────

type IconProps = { size?: number; filled?: boolean; className?: string };

/** 공통 겉틀 — 크기·선 굵기·색 설정을 한 곳에서 */
function Svg({ size = 18, filled = false, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/** 저장(책갈피) */
export function BookmarkIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

/** 좋아요(하트) */
export function HeartIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20.2s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.7c0 5.5-7.5 10.1-7.5 10.1z" />
    </Svg>
  );
}

/** 검색(돋보기) — 속 채움 없음 */
export function SearchIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </Svg>
  );
}
