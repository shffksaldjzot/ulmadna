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
// 작성일: 2026년 09월 14일
// 개정: 2026년 09월 15일(운영자 현장 기준 피드백 2라운드 — 두께 칩·공법 칩 추가)
// 화면 재배치 + 34평 의미 통일 + 결과 중복 제거: 2026년 09월 15일 (디자인 통일 작업 B)
// 용도 칩 2개로 축소 + 칩 크기 축소 + "전용" 문구 삭제: 2026년 09월 16일
// 새 틀(공법을 조정 칩으로 이동, 두께 미터치 표시, chipGrid·untouched·onEnterComplete): 2026년 09월 27일 (지시서 9장)
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import AreaInput from '../_components/AreaInput';
import type { MortarFormState } from '@/lib/v1/mortarQuery';
import { usesSupplyAreaConvention, presetThicknessMm } from '@/lib/v1/mortarEngineInput';
import { REMICON_THICKNESS_CHIPS, SELF_LEVEL_THICKNESS_CHIPS } from '@/lib/v1/mortarPresets';

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
}

/** 작업 면적 그 자체(공급/전용 개념 없음)로 쓰는 용도 — 셀프레벨링의 작은 직접 면적 칩(㎡) */
const WORK_AREA_CHIPS_SQM: readonly number[] = [3, 5, 10, 20];

export default function QuickAnswer({
  part,
  form,
  patch,
  areaUntouched = false,
  thicknessUntouched = false,
  onAreaEnterComplete,
  onThicknessTouch,
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

  /** 두께 칩·직접 입력 공통 — 값을 바꾸면서 "손댔다"는 표시를 같이 남긴다 */
  function patchThickness(mm: number | undefined) {
    patch({ thicknessMm: mm });
    onThicknessTouch?.();
  }

  // part === 'thickness' — 두께만 그린다(공법은 조정 칩 구역으로 옮겼다, 지시서 9-2절)
  if (part === 'thickness') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {thicknessChips.map((mm) => (
            <Chip
              key={mm}
              // 손대기 전엔 실제 값이 기본 두께와 같아도 선택 표시를 안 한다(지시서 9-2절 —
              // "칩 미선택"으로 시작해야 한다)
              selected={!thicknessUntouched && form.thicknessMm === mm}
              onClick={() => patchThickness(mm)}
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
          className="w-full"
        />
      </div>
    );
  }

  // part === 'area' — 시공 면적만 그린다
  return (
    <div className="flex flex-col gap-4">
      {/* 1) 시공 면적 — "면적 | 가로×세로" 입력 방식과 (공급 평형 규칙일 때만) "평 | ㎡"
          단위 토글을 한 줄에 합쳤다. */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-[15px] font-semibold text-foreground">시공 면적</span>
        <div className="flex gap-2 flex-wrap">
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

      {areaInputMode === 'area' ? (
        supplyArea ? (
          // 방통 — 도배·바닥재와 같은 공용 부품(AreaInput mode="supply")
          <AreaInput
            mode="supply"
            unit={areaUnit}
            onUnitChange={(u) => patch({ areaUnit: u })}
            value={form.area ?? ''}
            onValueChange={(v) => patch({ area: v === '' ? undefined : v })}
            hideUnitToggle
            caption={areaUnit === '㎡' ? '면적 ㎡ 그대로 계산해요' : '평형 기준 · ㎡로 계산해요'}
            chipGrid
            onEnterComplete={onAreaEnterComplete}
            untouched={areaUntouched}
          />
        ) : (
          // 셀프레벨링 — 집 평형 개념이 없는 작업 면적 그 자체
          <AreaInput
            mode="work"
            unit="㎡"
            onUnitChange={() => {}}
            value={form.area ?? ''}
            onValueChange={(v) => patch({ area: v === '' ? undefined : v, areaUnit: '㎡' })}
            chips={WORK_AREA_CHIPS_SQM}
            hideUnitToggle
            caption="바를 바닥 면적"
            placeholder="면적을 입력하세요(㎡)"
            chipGrid
            onEnterComplete={onAreaEnterComplete}
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
