// ──────────────────────────────────────────────
// v1 허브 — 숫자 입력칸 부품
// 숫자 키패드(inputmode=decimal) 전제, 오른쪽에 단위 접미사 표시.
//
// 2026년 09월 09일 수리: 소수점을 못 찍던 문제.
//   예전에는 글자를 칠 때마다 Number()로 되돌려 넣어서 "3."이 곧바로 3이 되고,
//   이어서 "6"을 치면 "36"이 돼 버렸다(높이 2.3을 치면 23이 되는 사고).
//   그래서 이제 입력칸 글자는 이 부품이 문자열 그대로 들고 있고,
//   "지금은 숫자로 볼 수 없는 상태"(예: "3.", "1.2.3")면 화면 글자만 유지한 채
//   바깥으로는 마지막 성한 값을 그대로 둔다. 쉼표(1,000)도 그냥 받아 준다.
//   ※ 다른 화면(옛 견적 폼·홈)도 이 부품을 쓰므로 props 모양(value: number|'' / onChange)은 그대로다.
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';

/**
 * 입력칸에 적힌 글자를 숫자로 해석한다(순수 함수 — 화면 없이 테스트할 수 있게 따로 뺐다).
 *   - 빈 칸이면 '' (값 없음)
 *   - 온전한 숫자면 그 숫자 (쉼표는 무시: "1,000" → 1000)
 *   - "3." 이나 "1.2.3"처럼 아직 숫자로 볼 수 없는 상태면 null (= 입력 중, 바깥 값은 건드리지 않음)
 */
export function parseNumberInput(raw: string): number | '' | null {
  // 쉼표는 자릿수 구분용이라 떼고 본다
  const cleaned = raw.replace(/,/g, '');
  if (cleaned === '') return '';
  // 숫자와 소수점 하나로만 이뤄졌는지 확인 (소수점으로 끝나면 아직 입력 중).
  // ".9"처럼 앞자리 0을 생략하고 친 것도 0.9로 받아 준다.
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** 바깥에서 받은 값(number 또는 빈 값)을 입력칸 글자로 바꾼다 */
function valueToText(v: number | ''): string {
  return v === '' ? '' : String(v);
}

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
  // 입력칸에 실제로 보이는 글자. 사용자가 치는 그대로 들고 있는다("3." 같은 중간 상태 포함)
  const [text, setText] = useState<string>(valueToText(value));
  // 바깥 값이 바뀐 걸 알아채려고 직전 값을 같이 기억해 둔다
  const [lastValue, setLastValue] = useState<number | ''>(value);

  // 바깥에서 값이 바뀌었으면(단위 토글, 칩 선택, 폼 초기화 등) 화면 글자도 그 값으로 맞춘다.
  // 단, 화면 글자가 이미 그 값과 같은 뜻이면 그대로 둔다("1,000"을 "1000"으로 바꿔치기하지 않기)
  if (value !== lastValue) {
    setLastValue(value);
    if (parseNumberInput(text) !== value) {
      setText(valueToText(value));
    }
  }

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
        value={text}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(e) => {
          // 숫자·소수점·쉼표만 남긴다(한글·기호가 섞여 들어오는 것 방지)
          const raw = e.target.value.replace(/[^0-9.,]/g, '');
          setText(raw);
          const parsed = parseNumberInput(raw);
          // null이면 아직 입력 중("3.")이라 바깥 값은 마지막 성한 값 그대로 둔다
          if (parsed !== null) {
            setLastValue(parsed);
            onChange(parsed);
          }
        }}
        className="flex-1 min-w-0 text-[16px] text-foreground placeholder:text-v1-text-disabled outline-none bg-transparent tabular-nums"
        {...rest}
      />
      {suffix && <span className="text-[16px] text-v1-text-disabled ml-1 flex-none">{suffix}</span>}
    </div>
  );
}
