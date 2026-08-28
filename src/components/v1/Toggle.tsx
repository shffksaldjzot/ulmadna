// ──────────────────────────────────────────────
// v1 허브 — 토글(스위치) 부품
// 48×28 알약, 켜짐 브라운 / 꺼짐 회색, 손잡이 22px.
// ──────────────────────────────────────────────

'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  className?: string;
}

export default function Toggle({ checked, onChange, label, className = '' }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full flex items-center px-[3px] box-border transition-colors duration-150 ${
        checked ? 'bg-brown justify-end' : 'bg-v1-line-3 justify-start'
      } ${className}`}
    >
      <span className="w-[22px] h-[22px] rounded-full bg-white" />
    </button>
  );
}
