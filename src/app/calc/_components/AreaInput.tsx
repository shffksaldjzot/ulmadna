// ──────────────────────────────────────────────
// v1 허브 — 공용 면적 입력 부품 (평/㎡ 토글 + 칩 + 직접 입력 + 환산 캡션)
//
// 왜 만들었나 (2026-09-15 형아 지시):
//   도배·바닥재는 "공급 평형"만 받고 ㎡ 입력이 없었다(칩=[18,24,25,30,34,40,45]평,
//   내부에서 평×3.3058×0.75로 전용 ㎡ 환산). 미장 계산기는 평/㎡ 토글이 있었지만
//   QuickAnswer.tsx 안에 자기만의 마크업으로 박혀 있어 재사용이 안 됐다.
//   이 부품 하나로 세 계산기가 같은 토글·칩·입력·캡션 UI를 쓰게 한다(디자인 원칙 —
//   기존 칩/토글 컴포넌트 재사용).
//
// 모드(mode)로 뜻이 갈린다:
//   'supply'    — 도배·바닥재. 평 단위는 "공급 평형"(칩에 전용 ㎡ 병기), ㎡ 단위는
//                 "전용면적"(집 평형표의 84㎡ 같은 값). 칩 기본값은 areaUnits.ts 상수.
//   'work'      — 미장. 평/㎡ 모두 그냥 "바를 면적"(공급·전용 구분 없음). 칩은 항상
//                 chips prop으로 받는다(용도별로 면적대가 다르므로 기본값이 없다).
//   'exclusive' — 전용면적만 다루는 자리(현재는 안 쓰지만 구조상 대비). supply의 ㎡
//                 쪽과 동일하게 그린다.
//
// 캡션(입력칸 옆 "반대 단위 환산"): 항상 순수 단위 환산(×3.3058)만 보여준다.
//   supply 모드 + 평 단위일 때만 "· 84㎡"를 덧붙인다(공급 평형표로 환산한 전용면적 값).
//
// 2026-09-16 형아 피드백: 칩·캡션에 쓰던 "공급"·"전용" 단어를 화면에서 뺐다(예: "34평 · 전용
// 84㎡" → "34평 · 84㎡"). 계산 로직(환산표·×0.75 비율)은 그대로이고, 화면 문구만 줄였다 —
// 아래 서비스명이 "전용면적을 계산해 준다"는 걸 몰라도 되게, 그냥 두 숫자를 나란히 보여준다.
//
// 작성일: 2026년 09월 15일
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import {
  pyeongToExclusiveSqm,
  pyeongToSupplySqm,
  sqmToPyeong,
  SUPPLY_PYEONG_CHIPS,
  EXCLUSIVE_SQM_CHIPS,
} from '@/lib/v1/areaUnits';

export type AreaInputMode = 'supply' | 'exclusive' | 'work';

export interface AreaInputProps {
  /** 이 면적이 무슨 뜻인지 — 도배·바닥재는 'supply', 미장은 'work' */
  mode: AreaInputMode;
  /** 지금 화면에 보이는 단위 */
  unit: '평' | '㎡';
  onUnitChange: (u: '평' | '㎡') => void;
  /** 입력값 — unit이 '평'이면 그 단위 값, '㎡'면 그 단위 값(모드에 따라 공급/전용/작업 면적 중 하나) */
  value: number | '';
  onValueChange: (v: number | '') => void;
  /** 칩 목록 override. 안 주면 mode+unit 기본 칩(supply만 기본 있음)을 쓴다 */
  chips?: readonly number[];
  /**
   * 섹션 라벨. 비우면(undefined·'') 라벨 없이 평/㎡ 토글 칩만 왼쪽 정렬로 그린다 —
   * 미장 계산기처럼 바깥에 이미 "면적" 제목이 있고 이 부품은 토글만 맡을 때 쓴다.
   */
  label?: string;
  /**
   * true면 이 부품 안에서 평/㎡ 토글 자체를 그리지 않는다(칩·입력칸·캡션만 그린다).
   * 2026-09-15 디자인 통일 지시 — 미장 "시공 면적" 줄처럼 바깥에서 다른 토글(면적/가로×세로)과
   * 한 줄로 합쳐서 평/㎡ 토글을 직접 그릴 때 쓴다. 기본 false(지금까지처럼 이 부품이 그린다).
   */
  hideUnitToggle?: boolean;
  /** 라벨 아래 캡션 1줄(설명글 최소화 원칙 — 이 부품이 스스로 설명문을 더 만들지 않는다) */
  caption?: string;
  placeholder?: string;
}

export default function AreaInput({
  mode,
  unit,
  onUnitChange,
  value,
  onValueChange,
  chips,
  label,
  caption,
  placeholder,
  hideUnitToggle = false,
}: AreaInputProps) {
  // 칩 목록 — supply 모드는 평/㎡ 기본 칩이 있고, work·exclusive는 호출한 쪽이 넘겨준다
  const defaultChips = mode === 'supply' ? (unit === '평' ? SUPPLY_PYEONG_CHIPS : EXCLUSIVE_SQM_CHIPS) : undefined;
  const chipList = chips ?? defaultChips ?? [];

  // 칩 라벨 — supply 모드 + 평 단위만 "34평 · 84㎡"로 전용 면적을 병기한다
  // (2026-09-16 형아 피드백: "전용"이라는 단어는 빼고 숫자만 나란히 보여준다)
  function chipLabel(n: number): string {
    if (mode === 'supply' && unit === '평') return `${n}평 · ${pyeongToExclusiveSqm(n)}㎡`;
    return `${n}${unit}`;
  }

  // 입력칸 옆 반대 단위 환산 캡션 — 항상 순수 단위 환산(×3.3058)만. supply+평일 때만 전용 ㎡ 덧붙임
  // (2026-09-16 형아 피드백: "전용" 단어 삭제)
  function conversionCaption(): string | null {
    if (value === '' || typeof value !== 'number' || value <= 0) return null;
    if (unit === '평') {
      const sqm = pyeongToSupplySqm(value);
      return mode === 'supply' ? `≈ ${sqm}㎡ · ${pyeongToExclusiveSqm(value)}㎡` : `≈ ${sqm}㎡`;
    }
    return `≈ ${sqmToPyeong(value)}평`;
  }
  const convCaption = conversionCaption();

  const unitToggle = (
    // 평/㎡ 단위 토글 — 값 선택이 아니라 "보기 방식"을 바꾸는 소형 토글이라 size="sm"(32px)
    <div className="flex gap-2">
      <Chip shape="square" size="sm" selected={unit === '평'} onClick={() => onUnitChange('평')}>
        평
      </Chip>
      <Chip shape="square" size="sm" selected={unit === '㎡'} onClick={() => onUnitChange('㎡')}>
        ㎡
      </Chip>
    </div>
  );

  return (
    <>
      {/* 라벨 + 평/㎡ 토글. 라벨이 없으면(미장처럼 바깥에 이미 제목이 있으면) 토글만 왼쪽 정렬 —
          미장 QuickAnswer의 기존 토글 UI 마크업을 그대로 옮겨왔다.
          hideUnitToggle이 true면(미장 "시공 면적" 줄처럼 바깥에서 다른 토글과 한 줄로 합칠 때)
          이 자리에서는 아무것도 안 그린다 — 라벨만 있고 토글은 없는 경우는 지금 안 쓴다. */}
      {label ? (
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-foreground">{label}</span>
          {!hideUnitToggle && unitToggle}
        </div>
      ) : (
        !hideUnitToggle && unitToggle
      )}
      {caption && <p className="text-[13px] text-v1-text-secondary">{caption}</p>}

      {/* 칩 — 눌러서 바로 값 채우기 */}
      {chipList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chipList.map((n) => (
            <Chip key={n} selected={value === n} onClick={() => onValueChange(n)}>
              {chipLabel(n)}
            </Chip>
          ))}
        </div>
      )}

      {/* 직접 입력 */}
      <NumberField
        value={value}
        onChange={onValueChange}
        suffix={unit}
        placeholder={placeholder ?? `면적을 입력하세요(${unit})`}
        aria-label="면적 직접 입력"
        className="w-full"
      />
      {convCaption && <p className="text-[13px] text-v1-text-disabled tabular-nums">{convCaption}</p>}
    </>
  );
}
