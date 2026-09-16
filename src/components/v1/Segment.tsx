// ──────────────────────────────────────────────
// v1 허브 — 세그먼트(2~3칸 탭형 선택) 부품
// 높이 44, 배경 크림, 안쪽 패딩 4, 선택 칸만 흰 배경, 탭 글자 15px.
// 이 부품도 계산기 3종 화면 안에서만 쓰인다.
// 2026-09-16 형아 피드백: 모바일에서 너무 커 보여 높이 52→44, 글자 16→15로 줄였다.
// ──────────────────────────────────────────────

'use client';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentProps<T extends string> {
  options: SegmentOption<T>[];
  /** 고른 값. undefined를 주면 아무 탭도 활성화하지 않는다(예: 벽지 종류 미선택 상태) */
  value: T | undefined;
  onChange: (v: T) => void;
  className?: string;
}

export default function Segment<T extends string>({ options, value, onChange, className = '' }: SegmentProps<T>) {
  return (
    <div
      className={`flex h-11 box-border rounded-[4px] border border-v1-line bg-cream p-1 ${className}`}
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
              'flex-1 flex items-center justify-center rounded-[4px] text-[15px] transition-colors duration-150 ' +
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
