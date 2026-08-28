// ──────────────────────────────────────────────
// v1 허브 — 체크박스 부품
// 24×24, radius 6, 선택 시 브라운 배경 + 흰 체크.
// ──────────────────────────────────────────────

'use client';

import { IconCheck } from './icons';

interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  className?: string;
}

export default function Checkbox({ checked, onChange, label, className = '' }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-[10px] min-h-11 text-left ${className}`}
    >
      <span
        className={
          'w-6 h-6 rounded-[6px] flex-none flex items-center justify-center box-border transition-colors duration-150 ' +
          (checked ? 'bg-brown' : 'border-[1.5px] border-v1-line-3')
        }
      >
        {checked && <IconCheck className="text-white" />}
      </span>
      {label && <span className="text-[16px] text-foreground">{label}</span>}
    </button>
  );
}
