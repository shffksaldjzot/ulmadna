// ──────────────────────────────────────────────
// v1 허브 — 세그먼트(2~3칸 탭형 선택) 부품
// 높이 52, 배경 크림, 안쪽 패딩 4, 선택 칸만 흰 배경.
// ──────────────────────────────────────────────

'use client';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export default function Segment<T extends string>({ options, value, onChange, className = '' }: SegmentProps<T>) {
  return (
    <div
      className={`flex h-[52px] box-border rounded-[4px] border border-v1-line bg-cream p-1 ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={
              'flex-1 flex items-center justify-center rounded-[4px] text-[16px] transition-colors duration-150 ' +
              (active ? 'bg-white text-brown font-semibold' : 'text-v1-text-secondary font-normal')
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
