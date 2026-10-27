// ──────────────────────────────────────────────
// 공용 2D 도면 부품 — mm 숫자 입력칸(이름표 위, 칸 아래)
//
// 공용 NumberField(치는 도중 초점 안 뺏기는 입력칸)를 감싸서
//   - 빈 칸·범위 밖 숫자는 바깥에 넘기지 않고(직전 값 유지),
//   - 범위 안 숫자만 onChange 로 넘긴다.
// 이름표는 칸 위에 둔다(320px 폭에서 칸 안 글자가 겹치던 문제를 피하는 기존 규칙).
//
// 작성일: 2026년 10월 28일
// ──────────────────────────────────────────────

'use client';

import NumberField from '@/components/v1/NumberField';

interface MmFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  /** 단위 글자 — 기본 mm */
  suffix?: string;
  className?: string;
}

export default function MmField({ label, value, onChange, min, max, suffix = 'mm', className = '' }: MmFieldProps) {
  return (
    <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <span className="t-sub text-ink-2">{label}</span>
      <NumberField
        value={value}
        onChange={(v) => {
          // 빈 칸이거나 범위 밖이면 무시 — 그림이 깨지는 중간값을 막는다
          if (v === '' || v < min || v > max) return;
          onChange(v);
        }}
        suffix={suffix}
        min={min}
        max={max}
        aria-label={label}
        className="min-w-0 !px-[10px]"
      />
    </label>
  );
}
