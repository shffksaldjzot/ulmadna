// ──────────────────────────────────────────────
// v1 허브 — 카드 부품
// 흰 배경, 테두리 1px, radius 4. 계산기 결과의 카드 1·2·3이 전부 이걸 쓴다.
// ──────────────────────────────────────────────

import type { HTMLAttributes } from 'react';

export default function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white border border-v1-line rounded-[4px] p-4 flex flex-col gap-2 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
