// ──────────────────────────────────────────────
// v1 허브 — 칩 부품 (공정·평형·범위 선택용)
// 높이 44, 알약 모양(radius 22) 기본. shape="square"를 주면 모서리 4px 사각 칩이 된다
// (도배지 색상·규격 칩처럼 사각으로 보여야 하는 자리용, 색 규칙은 알약과 동일).
// ──────────────────────────────────────────────

'use client';

import type { ButtonHTMLAttributes } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** 칩 모양. 기본 'pill'(알약). 'square'는 모서리 4px — 다른 화면에는 영향 없음 */
  shape?: 'pill' | 'square';
}

export default function Chip({ selected, shape = 'pill', className = '', children, ...rest }: ChipProps) {
  // 모양만 다르고 선택/미선택 색상 규칙은 동일하다
  const shapeClass = shape === 'square' ? 'rounded-[4px]' : 'rounded-full';
  return (
    <button
      type="button"
      className={
        `h-11 inline-flex items-center px-4 ${shapeClass} text-[16px] whitespace-nowrap transition-colors duration-150 ` +
        (selected
          ? 'bg-brown text-white font-semibold'
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
