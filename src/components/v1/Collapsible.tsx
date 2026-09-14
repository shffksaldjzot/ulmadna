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
  /**
   * 사용자가 "펼침"으로 바꿀 때만 호출된다(접을 때는 호출 안 함, 최초 defaultOpen도 호출 안 함).
   * GA4 이벤트(calc_detail_open) 등 분석용 훅을 걸 때 쓴다. 없으면 아무 일도 안 한다.
   */
  onOpen?: () => void;
}

export default function Collapsible({ title, children, defaultOpen = false, className = '', onOpen }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  /** 펼침/접힘 토글 — 접힌 상태에서 펼치는 순간에만 onOpen을 알려준다 */
  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (next) onOpen?.();
      return next;
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
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
