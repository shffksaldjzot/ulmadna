// ──────────────────────────────────────────────
// v1 허브 — 버튼 부품
// 디자인 가이드 v4 아트보드 02 기준: 주버튼 / 보조버튼 / 텍스트버튼
// 높이는 모바일 52 / PC(md 이상) 44, 모서리 4px 고정, 그림자 없음.
// ──────────────────────────────────────────────

'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'text';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** true면 화면 하단에 폭 100%로 고정하는 용도(주버튼) */
  fullWidth?: boolean;
}

// 굵기·색은 variant별로 여기서 한 번만 정의해 재사용한다
const base =
  'inline-flex items-center justify-center gap-2 rounded-[4px] text-[16px] font-semibold transition-colors duration-150 h-[52px] md:h-[44px] px-5 disabled:cursor-not-allowed';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-brown text-white active:bg-brown-press disabled:bg-v1-line disabled:text-v1-text-disabled md:hover:bg-brown-hover',
  secondary:
    'bg-white text-brown border border-gold active:bg-cream disabled:border-v1-line-3 disabled:text-v1-text-disabled',
  text:
    'h-11 px-0 text-brown underline underline-offset-4 disabled:text-v1-text-disabled',
};

export default function Button({
  variant = 'primary',
  fullWidth,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variantClass[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
