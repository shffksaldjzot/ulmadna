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
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 3-6절: "숫자 칸에서 엔터: 값이 유효하면 그
// 단계를 완료 처리하고 키보드를 내린다(blur)." onEnterComplete를 새로 받는 선택 prop으로
// 추가했다 — 안 넘기면 예전과 똑같이 동작한다(다른 화면에 영향 없음).
//
// 2026-09-27 배포 전 검사관 지적 10번 수리: "안 넘기면 예전과 똑같이 동작한다"고 써
// 놓고 실제로는 onEnterComplete가 없어도 엔터를 치면 항상 blur가 실행되고 있었다(바닥재·
// 미장의 숫자 칸도 전부 이 부품을 쓰므로, 그 화면들에도 원래 없던 "엔터=키보드 내림"
// 동작이 몰래 생긴 것). 이제 onEnterComplete를 넘긴 화면(도배의 새 단계 흐름)에서만
// 엔터 처리를 하고, 안 넘긴 화면은 브라우저 기본 동작 그대로 둔다.
//
// 2026-09-29 검사관 다듬기 지적 3번 — showCommas 선택 속성 추가: 미장 세부 조정의
// 배송비·지게차 하차비·양중비는 칸 아래에 "50,000원"처럼 값을 되풀이해 보여주는 글이
// 있었다(천 단위 쉼표가 필요해서 둔 것). 이제 칸 안의 숫자 자체가 초점이 없을 때만
// 쉼표를 넣어 보여주고(입력 중에는 쉼표 없이 숫자만 — 커서 자리가 안 흔들리게) 아래
// 되풀이 글을 지운다. 기본값 false — 안 주면 기존 그대로(쉼표는 사용자가 직접 쳤을
// 때만 그 모습 그대로 보인다, 다른 화면은 전혀 안 바뀐다).
// ──────────────────────────────────────────────

'use client';

import { useRef, useState } from 'react';

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

/** 바깥 값을 천 단위 쉼표를 넣은 글자로 바꾼다(showCommas 전용, 초점 없을 때만 쓴다) */
function valueToCommaText(v: number | ''): string {
  return v === '' ? '' : v.toLocaleString('ko-KR');
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
  /**
   * 이 콜백을 넘긴 화면에서만 엔터 키를 특별 취급한다. 엔터를 쳤을 때 지금 값이 유효한
   * 숫자면 이 함수를 부르고(호출한 쪽이 "이 단계를 완료 처리"하는 데 쓴다) 입력칸
   * 초점을 뺀다(blur, 폰 키보드를 내린다). 값이 아직 "3." 처럼 입력 중이거나 비어
   * 있으면 부르지 않는다. **이 prop을 안 넘기면 엔터 키에 아무 것도 안 한다**(브라우저
   * 기본 동작 그대로 — 바닥재·미장 등 기존 화면은 전혀 안 바뀐다, 검사관 지적 10번).
   */
  onEnterComplete?: () => void;
  /** true면 초점이 없을 때만 천 단위 쉼표를 넣어 보여준다(입력 중엔 숫자만). 기본 false */
  showCommas?: boolean;
}

export default function NumberField({
  value,
  onChange,
  suffix,
  placeholder,
  className = '',
  min,
  max,
  onEnterComplete,
  showCommas = false,
  ...rest
}: NumberFieldProps) {
  // 입력칸에 실제로 보이는 글자. 사용자가 치는 그대로 들고 있는다("3." 같은 중간 상태 포함)
  const [text, setText] = useState<string>(showCommas ? valueToCommaText(value) : valueToText(value));
  // 바깥 값이 바뀐 걸 알아채려고 직전 값을 같이 기억해 둔다
  const [lastValue, setLastValue] = useState<number | ''>(value);
  // 엔터 쳤을 때 blur(키보드 내리기)시키려고 input 자체를 참조해 둔다
  const inputRef = useRef<HTMLInputElement>(null);

  // 바깥에서 값이 바뀌었으면(단위 토글, 칩 선택, 폼 초기화 등) 화면 글자도 그 값으로 맞춘다.
  // 단, 화면 글자가 이미 그 값과 같은 뜻이면 그대로 둔다("1,000"을 "1000"으로 바꿔치기하지 않기)
  if (value !== lastValue) {
    setLastValue(value);
    if (parseNumberInput(text) !== value) {
      setText(showCommas ? valueToCommaText(value) : valueToText(value));
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
        ref={inputRef}
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
        onFocus={() => {
          // showCommas면 편집 중엔 쉼표를 없애 커서 자리가 안 흔들리게 한다
          if (showCommas) setText((t) => t.replace(/,/g, ''));
        }}
        onBlur={() => {
          // showCommas면 초점이 나갈 때 숫자로 정확히 해석되면 쉼표를 다시 넣어 보여준다
          if (!showCommas) return;
          const parsed = parseNumberInput(text);
          if (typeof parsed === 'number') setText(valueToCommaText(parsed));
        }}
        onKeyDown={(e) => {
          // onEnterComplete를 안 넘긴 화면(바닥재·미장 등 기존 화면)은 엔터를 특별
          // 취급하지 않는다 — 검사관 지적 10번: 예전엔 콜백이 없어도 항상 blur가
          // 실행돼서, 넘겨받지 않은 화면에도 몰래 "엔터=키보드 내림" 동작이 생겼었다.
          if (e.key !== 'Enter' || !onEnterComplete) return;
          // 지금 화면 글자를 다시 한번 숫자로 확인한다 — 유효한 값일 때만 완료 콜백을 부른다
          const parsed = parseNumberInput(text.replace(/,/g, ''));
          if (parsed !== null && parsed !== '') onEnterComplete();
          // 값이 유효하든 아니든 엔터를 쳤으면 키보드는 내려준다(3-6절, onEnterComplete가
          // 있는 화면에서만)
          inputRef.current?.blur();
        }}
        className="flex-1 min-w-0 text-[16px] text-foreground placeholder:text-v1-text-disabled outline-none bg-transparent tabular-nums"
        {...rest}
      />
      {suffix && <span className="text-[16px] text-v1-text-disabled ml-1 flex-none">{suffix}</span>}
    </div>
  );
}
