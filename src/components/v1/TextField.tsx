// ──────────────────────────────────────────────
// v1 허브 — 텍스트 입력칸 부품 (검색칸 등)
// 높이 52, radius 4, 기본 테두리 옅은 회갈색 / 포커스 브라운.
// ──────────────────────────────────────────────

'use client';

import type { InputHTMLAttributes } from 'react';
import { IconSearch } from './icons';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** true면 왼쪽에 돋보기 아이콘을 붙인다 */
  withSearchIcon?: boolean;
}

export default function TextField({ withSearchIcon, className = '', ...rest }: TextFieldProps) {
  return (
    <div
      className={
        'h-[52px] w-full bg-white border border-v1-line-3 rounded-[4px] flex items-center gap-[10px] px-[14px] ' +
        'focus-within:border-[1.5px] focus-within:border-brown transition-colors duration-150 ' +
        className
      }
    >
      {withSearchIcon && <IconSearch className="text-v1-text-label flex-none" />}
      <input
        className="flex-1 min-w-0 text-[16px] text-foreground placeholder:text-v1-text-disabled outline-none bg-transparent"
        {...rest}
      />
    </div>
  );
}
