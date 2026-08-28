// ──────────────────────────────────────────────
// v1 허브 — 숫자 입력칸 부품
// 숫자 키패드(inputmode=decimal) 전제, 오른쪽에 단위 접미사 표시.
// ──────────────────────────────────────────────

'use client';

interface NumberFieldProps {
  value: number | '';
  onChange: (v: number | '') => void;
  /** 오른쪽에 붙는 단위 (예: "㎡", "m", "평") */
  suffix?: string;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  'aria-label'?: string;
}

export default function NumberField({
  value,
  onChange,
  suffix,
  placeholder,
  className = '',
  min,
  max,
  ...rest
}: NumberFieldProps) {
  return (
    <div
      className={
        'h-[52px] bg-white border border-v1-line-3 rounded-[4px] flex items-center justify-between px-[14px] ' +
        'focus-within:border-[1.5px] focus-within:border-brown transition-colors duration-150 ' +
        className
      }
    >
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          onChange(raw === '' ? '' : Number(raw));
        }}
        className="flex-1 min-w-0 text-[16px] text-foreground placeholder:text-v1-text-disabled outline-none bg-transparent tabular-nums"
        {...rest}
      />
      {suffix && <span className="text-[16px] text-v1-text-disabled ml-1 flex-none">{suffix}</span>}
    </div>
  );
}
