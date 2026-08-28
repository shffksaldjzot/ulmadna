// ──────────────────────────────────────────────
// v1 허브 — 펼침(아코디언) 부품
// "실별 보기 ▾" · "구성 보기 ▾" 같은 펼침에 공용으로 쓴다.
// 펼침·접힘은 max-height + opacity 전환 250ms, prefers-reduced-motion 존중.
// ──────────────────────────────────────────────

'use client';

import { useState, type ReactNode } from 'react';
import { IconChevronDown, IconChevronUp } from './icons';

interface CollapsibleProps {
  title: string;
  children: ReactNode;
  /** 기본으로 펼쳐진 상태로 시작할지 */
  defaultOpen?: boolean;
  className?: string;
}

export default function Collapsible({ title, children, defaultOpen = false, className = '' }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between min-h-11 border-t border-v1-line-2 pt-2 mt-1 text-left"
        aria-expanded={open}
      >
        <span className="text-[16px] font-semibold text-foreground">{title}</span>
        {open ? (
          <IconChevronUp className="text-v1-text-label" />
        ) : (
          <IconChevronDown className="text-v1-text-label" />
        )}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-[250ms] motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
