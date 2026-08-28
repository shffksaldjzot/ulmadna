// ──────────────────────────────────────────────
// v1 허브 — 리스트 링크 행 부품
// 높이 모바일 56 / PC 52, 아래 구분선, 우측 chevron.
// ──────────────────────────────────────────────

import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconChevronRight } from './icons';

interface ListRowProps {
  href: string;
  children: ReactNode;
  /** 목록의 마지막 행이면 아래 구분선을 뺀다 */
  last?: boolean;
}

export default function ListRow({ href, children, last }: ListRowProps) {
  return (
    <Link
      href={href}
      className={`h-14 md:h-[52px] flex items-center justify-between text-[16px] text-foreground ${
        last ? '' : 'border-b border-v1-line-2'
      }`}
    >
      <span className="truncate">{children}</span>
      <IconChevronRight className="text-v1-text-disabled flex-none ml-2" />
    </Link>
  );
}
