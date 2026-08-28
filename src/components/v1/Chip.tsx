// ──────────────────────────────────────────────
// v1 허브 — 칩 부품 (공정·평형·범위 선택용)
// 높이 44, 알약 모양(radius 22), 선택/미선택 두 상태.
// ──────────────────────────────────────────────

'use client';

import type { ButtonHTMLAttributes } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export default function Chip({ selected, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      className={
        'h-11 inline-flex items-center px-4 rounded-full text-[16px] whitespace-nowrap transition-colors duration-150 ' +
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
