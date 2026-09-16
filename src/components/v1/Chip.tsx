// ──────────────────────────────────────────────
// v1 허브 — 칩 부품 (공정·평형·범위 선택용). 이 부품은 계산기 3종(도배·바닥재·미장) 화면
// 안에서만 쓰인다(홈 베타 계산기·블로그 카테고리 칩은 이 컴포넌트를 안 쓰는 별도 마크업이라
// 영향이 없다).
//
// 크기(size)는 두 가지:
//   'md'(기본) — 높이 36 · 글자 14 · 좌우 패딩 14. 용도·베이·범위(벽/천장) 등 대부분의 선택 칩.
//   'sm'       — 높이 32 · 글자 13. 평/㎡·면적/가로×세로·m/mm처럼 값 선택이 아니라 "보기 방식"을
//                바꾸는 소형 단위 토글 전용.
// 모양(shape)은 기존과 같다 — 'pill'(알약) 기본, 'square'는 모서리 4px(도배지 색상·규격 칩용).
//
// 2026-09-16 형아 피드백: 모바일에서 알약 칩이 너무 커 보인다는 지적으로 기본 높이를
// 44 → 36으로, 글자를 16 → 14로 줄였다(칩 간격은 원래도 gap-2=8px라 그대로 둔다).
// ──────────────────────────────────────────────

'use client';

import type { ButtonHTMLAttributes } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** 칩 모양. 기본 'pill'(알약). 'square'는 모서리 4px — 다른 화면에는 영향 없음 */
  shape?: 'pill' | 'square';
  /** 칩 크기. 기본 'md'(36/14). 'sm'(32/13)은 평/㎡·면적/가로×세로 같은 소형 단위 토글 전용 */
  size?: 'md' | 'sm';
}

export default function Chip({ selected, shape = 'pill', size = 'md', className = '', children, ...rest }: ChipProps) {
  // 모양만 다르고 선택/미선택 색상 규칙은 동일하다
  const shapeClass = shape === 'square' ? 'rounded-[4px]' : 'rounded-full';
  // 크기별 높이·좌우 패딩·글자 크기 — md(기본 선택 칩) / sm(소형 단위 토글)
  const sizeClass = size === 'sm' ? 'h-8 px-[10px] text-[13px]' : 'h-9 px-[14px] text-[14px]';
  return (
    <button
      type="button"
      className={
        `inline-flex items-center ${sizeClass} ${shapeClass} whitespace-nowrap transition-colors duration-150 ` +
        // 선택 칩 채움은 강조색(accent), 눌림은 약간 어둡게 — 갈색(brown)은 글자·제목 전용이라 채움에는 쓰지 않는다
        (selected
          ? 'bg-accent active:bg-accent-press text-white font-semibold'
          : 'bg-white border border-v1-line-3 text-v1-text-secondary font-normal') +
        ' ' + className
      }
      aria-pressed={selected}
      {...rest}
    >
      {children}
    </button>
  );
}
