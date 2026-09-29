// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: "간단하게 계산하기" 2·3단계(면적·두께) 내용
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 9장 — 도배·바닥재가 이미 적용한 새 틀을
// 그대로 옮겨 왔다. 공법 칩은 여기 있었지만 "조정 칩" 구역(결과 위)으로 옮겼다(지시서
// 9-2절: 미장 간단 모드 조정 = 공법뿐). 두께 칸은 손대기 전엔 칩 미선택·숫자 칸은
// 비우고 용도별 기본 두께를 자리 글자(placeholder)로만 보여준다(9-2절).
//
// 용도(방통·셀프레벨링) 칩은 MortarCalculator(오케스트레이터)가 1단계로 그린다.
//
// 2026-09-27 저녁 지휘관 3차 검수 반영:
//   - '두께' 부분을 간단·정확 모드가 완전히 같은 모습(칩+숫자칸)으로 쓴다 — 정확 모드는
//     onThicknessChangeOverride로 셀프레벨링 자동 제품 전환 로직만 끼워 넣는다
//     (MortarCalculator.tsx의 handlePreciseThicknessChange).
//   - 두께 칩을 4열 격자로(개수가 8·6개라 3~4줄로 들쭉날쭉하던 것을 가지런히).
//   - 두께 입력이 서버 허용 범위를 벗어나면 칸 아래 한 줄로 알려준다("150mm 이하" 등).
//   - '면적' 부분: 안쪽 라벨("시공 면적")과 캡션("평형 기준 · ㎡로 계산해요" 등)을
//     지웠다(제목 "면적"과 같은 말이라 중복). [면적|가로×세로]·[평|㎡] 토글을 한 줄
//     왼쪽·오른쪽으로 나눴다. 손대기 전 자리 글자(placeholder)를 실제 가정값(방통
//     34·셀프레벨링 33㎡)과 맞췄다(예전엔 폼 기본값 10이 그대로 보여 가정과 어긋났다).
//
// 작성일: 2026년 09월 14일
// 개정: 2026년 09월 15일(운영자 현장 기준 피드백 2라운드 — 두께 칩·공법 칩 추가)
// 화면 재배치 + 34평 의미 통일 + 결과 중복 제거: 2026년 09월 15일 (디자인 통일 작업 B)
// 용도 칩 2개로 축소 + 칩 크기 축소 + "전용" 문구 삭제: 2026년 09월 16일
// 새 틀(공법을 조정 칩으로 이동, 두께 미터치 표시, chipGrid·untouched·onEnterComplete): 2026년 09월 27일 (지시서 9장)
// 두께 단계 간단·정확 통합 + 면적 단계 글 정리 + 자리 글자 가정값 통일: 2026년 09월 27일 저녁(지휘관 3차 검수)
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import AreaInput from '../_components/AreaInput';
import type { MortarFormState } from '@/lib/v1/mortarQuery';
import {
  usesSupplyAreaConvention,
  presetThicknessMm,
  ASSUMED_SUPPLY_AREA_PYEONG,
  assumedAreaSqm,
} from '@/lib/v1/mortarEngineInput';
import {
  REMICON_THICKNESS_CHIPS,
  SELF_LEVEL_THICKNESS_CHIPS,
  THICKNESS_MM_MIN,
  thicknessMmMax,
} from '@/lib/v1/mortarPresets';
import { mortarThicknessUxMin } from '../_components/inputRanges';

export interface QuickAnswerProps {
  /** 이 카드에서 어느 부분만 그릴지 — 'area'(시공 면적) / 'thickness'(두께) */
  part: 'area' | 'thickness';
  form: MortarFormState;
  patch: (p: Partial<MortarFormState>) => void;
  /** 면적 단계를 사용자가 아직 안 눌렀는지 — AreaInput에 그대로 넘긴다(part==='area' 전용) */
  areaUntouched?: boolean;
  /** 두께 단계를 사용자가 아직 안 눌렀는지 — 칩 미선택·숫자 칸 자리 글자 처리(part==='thickness' 전용) */
  thicknessUntouched?: boolean;
  /** 면적 숫자 칸 엔터 완료 → 그 단계를 완료 처리한다(part==='area' 전용) */
  onAreaEnterComplete?: () => void;
  /** 두께를 손댔다는 표시 — 칩·직접 입력 둘 다 이 함수를 통해서만 값을 바꾼다(part==='thickness' 전용) */
  onThicknessTouch?: () => void;
  /**
   * 두께 값이 바뀔 때 기본 동작(patch+touch) 대신 이 함수를 부른다(part==='thickness' 전용).
   * 정확 모드에서만 넘긴다 — 셀프레벨링일 때 지금 고른 제품이 새 두께를 못 다루면 제품을
   * 자동으로 바꿔 주는 로직(MortarCalculator.handlePreciseThicknessChange)이 patch·touch를
   * 전부 대신 처리한다. 간단 모드는 이 prop을 안 넘겨서 기본 동작 그대로다.
   */
  onThicknessChangeOverride?: (mm: number | undefined) => void;
}

/** 작업 면적 그 자체(공급/전용 개념 없음)로 쓰는 용도 — 셀프레벨링의 작은 직접 면적 칩(㎡) */
const WORK_AREA_CHIPS_SQM: readonly number[] = [3, 5, 10, 20];

/** 두께 입력이 허용 범위를 벗어났을 때 칸 아래에 보여줄 짧은 문구(마침표 없이) */
function thicknessRangeNote(value: number | '' | undefined, min: number, max: number): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (value < min) return `${min}mm 이상`;
  if (value > max) return `${max}mm 이하`;
  return undefined;
}

export default function QuickAnswer({
  part,
  form,
  patch,
  areaUntouched = false,
  thicknessUntouched = false,
  onAreaEnterComplete,
  onThicknessTouch,
  onThicknessChangeOverride,
}: QuickAnswerProps) {
  const mode = form.mode ?? '레미탈';
  const areaInputMode = form.areaInputMode ?? 'area';
  const areaUnit = form.areaUnit ?? '평';
  // 34평 의미 통일 — 지금 용도가 "공급 평형 → 전용 ㎡" 규칙(방통)인지,
  // 아니면 "바를 면적 그 자체"(셀프레벨링)인지
  const supplyArea = usesSupplyAreaConvention(form);

  const thicknessChips = mode === '레미탈' ? REMICON_THICKNESS_CHIPS : SELF_LEVEL_THICKNESS_CHIPS;
  // 용도별 기본 두께 — 손대기 전 자리 글자(placeholder)로 보여줄 값
  const presetThickness = presetThicknessMm(form);
  // 두께 입력 허용 범위 — 서버 검증과 같은 값(mortarPresets.ts). 최솟값은 화면 쪽이 더
  // 엄격할 수 있어(레미탈 10mm) 공용 헬퍼로 뺐다(MortarCalculator.tsx와 같은 값을 쓴다)
  const thicknessMin = mortarThicknessUxMin(mode, THICKNESS_MM_MIN);
  const thicknessMax = thicknessMmMax(mode);

  /**
   * 손대기 전 면적 칸의 자리 글자(placeholder) — 실제로 계산에 쓰는 가정값과 같게 맞춘다
   * (방통 "34", 셀프레벨링 등 "33㎡"). 예전엔 폼 기본값(10)이 그대로 보여서 계산이 가정하는
   * 34평과 화면 자리 글자가 서로 다른 사고가 있었다.
   */
  const assumedAreaDisplay =
    supplyArea && areaUnit !== '㎡' ? ASSUMED_SUPPLY_AREA_PYEONG : Math.round(assumedAreaSqm(form));

  /**
   * 두께 칩·직접 입력 공통 진입점. onThicknessChangeOverride를 받았으면(정확 모드) 그
   * 함수에게 전부 맡기고, 안 받았으면(간단 모드) 기본 동작(patch+손댔다는 표시)을 한다.
   */
  function patchThickness(mm: number | undefined) {
    if (onThicknessChangeOverride) {
      onThicknessChangeOverride(mm);
      return;
    }
    patch({ thicknessMm: mm });
    onThicknessTouch?.();
  }

  // part === 'thickness' — 두께만 그린다(공법은 조정 칩 구역으로 옮겼다, 지시서 9-2절).
  // 간단·정확 모드가 완전히 같은 모습을 쓴다(2026-09-27 저녁 검수 지적 6번).
  if (part === 'thickness') {
    // 범위를 벗어난 값을 쳤을 때만 짧게 알려준다(정적 "10~150mm" 캡션은 삭제)
    const rangeNote = !thicknessUntouched ? thicknessRangeNote(form.thicknessMm, thicknessMin, thicknessMax) : undefined;
    return (
      <div className="flex flex-col gap-2">
        {/* 두께 칩 — 8개(레미탈)·6개(셀프레벨링)라 들쭉날쭉해 보이지 않게 4열 격자로 고정한다 */}
        <div className="grid grid-cols-4 gap-2">
          {thicknessChips.map((mm) => (
            <Chip
              key={mm}
              // 손대기 전엔 실제 값이 기본 두께와 같아도 선택 표시를 안 한다(지시서 9-2절 —
              // "칩 미선택"으로 시작해야 한다)
              selected={!thicknessUntouched && form.thicknessMm === mm}
              onClick={() => patchThickness(mm)}
              className="w-full justify-center"
              style={{ fontSize: '13px' }}
            >
              {mm}mm
            </Chip>
          ))}
        </div>
        <NumberField
          // 손대기 전엔 칸을 비우고 용도별 기본 두께를 자리 글자로 흐리게 보여준다
          value={thicknessUntouched ? '' : (form.thicknessMm ?? '')}
          onChange={(v) => patchThickness(v === '' ? undefined : v)}
          suffix="mm"
          placeholder={thicknessUntouched ? String(presetThickness) : '두께 직접 입력'}
          aria-label="두께 직접 입력"
          min={thicknessMin}
          max={thicknessMax}
          className="w-full"
        />
        {rangeNote && <p className="t-sub text-danger">{rangeNote}</p>}
      </div>
    );
  }

  // part === 'area' — 시공 면적만 그린다
  return (
    <div className="flex flex-col gap-4">
      {/* 입력 방식 토글 두 묶음을 한 줄 왼쪽·오른쪽으로 나눈다(2026-09-27 저녁 검수 지적
          3번) — 안쪽 라벨("시공 면적")은 뺐다(제목 "면적"과 같은 말이라 중복). */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Chip
            shape="square"
            size="sm"
            selected={areaInputMode === 'area'}
            onClick={() => patch({ areaInputMode: 'area' })}
          >
            면적
          </Chip>
          <Chip
            shape="square"
            size="sm"
            selected={areaInputMode === 'rect'}
            onClick={() => patch({ areaInputMode: 'rect' })}
          >
            가로×세로
          </Chip>
        </div>
        <div className="flex gap-2">
          {supplyArea && areaInputMode === 'area' && (
            <>
              <Chip shape="square" size="sm" selected={areaUnit === '평'} onClick={() => patch({ areaUnit: '평' })}>
                평
              </Chip>
              <Chip shape="square" size="sm" selected={areaUnit === '㎡'} onClick={() => patch({ areaUnit: '㎡' })}>
                ㎡
              </Chip>
            </>
          )}
        </div>
      </div>

      {/* 2026-09-29 지적 6번: AreaInput의 onEnterComplete는 이제 필수 prop이다. 이 부품은
          part==='thickness'일 때는 onAreaEnterComplete를 아예 안 받으므로(그 값이 optional로
          남아 있다) part==='area' 분기에서만 쓰는 자리에 안전하게 이어 주려고 안 쓰는
          빈 함수로 받쳐 준다(실제로는 이 분기에 오면 항상 실제 함수가 있다). */}
      {areaInputMode === 'area' ? (
        supplyArea ? (
          // 방통 — 도배·바닥재와 같은 공용 부품(AreaInput mode="supply"). 캡션은 지웠다
          // (2026-09-27 저녁 검수 지적 3번 — "평형 기준 · ㎡로 계산해요"도 중복 설명글).
          // untouched일 때 value를 실제 가정값으로 바꿔치기해 자리 글자를 맞춘다(지적 4번).
          <AreaInput
            mode="supply"
            unit={areaUnit}
            onUnitChange={(u) => patch({ areaUnit: u })}
            value={areaUntouched ? assumedAreaDisplay : (form.area ?? '')}
            onValueChange={(v) => patch({ area: v === '' ? undefined : v })}
            hideUnitToggle
            onEnterComplete={onAreaEnterComplete ?? (() => {})}
            untouched={areaUntouched}
          />
        ) : (
          // 셀프레벨링 — 집 평형 개념이 없는 작업 면적 그 자체
          <AreaInput
            mode="work"
            unit="㎡"
            onUnitChange={() => {}}
            value={areaUntouched ? assumedAreaDisplay : (form.area ?? '')}
            onValueChange={(v) => patch({ area: v === '' ? undefined : v, areaUnit: '㎡' })}
            chips={WORK_AREA_CHIPS_SQM}
            hideUnitToggle
            placeholder="면적을 입력하세요(㎡)"
            onEnterComplete={onAreaEnterComplete ?? (() => {})}
            untouched={areaUntouched}
          />
        )
      ) : (
        <div className="flex gap-2">
          <NumberField
            value={form.rectWidth ?? ''}
            onChange={(v) => patch({ rectWidth: v === '' ? undefined : v })}
            suffix="m"
            placeholder="가로"
            aria-label="가로(m)"
            className="flex-1 min-w-0"
          />
          <NumberField
            value={form.rectDepth ?? ''}
            onChange={(v) => patch({ rectDepth: v === '' ? undefined : v })}
            suffix="m"
            placeholder="세로"
            aria-label="세로(m)"
            className="flex-1 min-w-0"
          />
        </div>
      )}
    </div>
  );
}
