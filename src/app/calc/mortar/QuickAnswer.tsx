// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: "간단하게 계산하기" 카드
//
// 시공 면적(공용 부품 AreaInput 재사용) + (레미탈 전용) 공법 + 두께 칩만으로 즉답을 낸다.
// 포수·비용 결과는 이 카드가 아니라 옆(PC)·아래(모바일)의 ResultPanel 한 곳에서만 보여준다
// (2026-09-15 디자인 통일 지시 — 예전엔 이 카드도 "레미탈 40kg × N포" 큰 숫자를 따로
// 보여줘서 ResultPanel과 같은 숫자가 한 화면에 두 번 보이는 중복이었다).
//
// 용도(방통·셀프레벨링) 칩은 MortarCalculator(오케스트레이터)의 화면 맨 위에서
// [간단|정확] 두 모드가 공유한다(2026-09-15 디자인 통일 지시 — 첫 화면 토글 4줄을 2줄로
// 줄이는 재배치의 일부. 2026-09-16 형아 피드백으로 용도 칩 자체도 5개→2개로 더 줄었다 —
// 확장부 바닥·욕실·현관 구배·마루 철거 후 보수는 화면에서 뺐다, MortarCalculator.tsx 참고).
//
// 2026-09-15 34평 의미 통일 지시: 시공 면적 입력이 용도에 따라 완전히 다른 부품이다 —
//   방통(공급 평형 규칙, usesSupplyAreaConvention=true): 도배·바닥재와
//     같은 AreaInput(mode="supply")를 그대로 쓴다 — "34평 · 84㎡" 칩, 평/㎡ 토글.
//   셀프레벨링(작업 면적 그 자체): 집 평형 칩 대신 작은
//     직접 면적 칩(3·5·10·20㎡) + 숫자 입력만 쓰고, 평/㎡ 토글 자체가 없다(늘 ㎡).
// 두 경우 모두 "면적 | 가로×세로" 입력 방식 토글은 그대로 있고, 그 옆에 있던 평/㎡ 토글은
// (공급 평형 규칙일 때만) 같은 줄 오른쪽으로 합쳤다 — 예전엔 두 줄이었다.
//
// 작성일: 2026년 09월 14일
// 개정: 2026년 09월 15일(운영자 현장 기준 피드백 2라운드 — 두께 칩·공법 칩 추가)
// 화면 재배치 + 34평 의미 통일 + 결과 중복 제거: 2026년 09월 15일 (디자인 통일 작업 B)
// 용도 칩 2개로 축소 + 칩 크기 축소 + "전용" 문구 삭제: 2026년 09월 16일
//
// 2026-09-16 튜토리얼식 단계 안내 도입:
//   이 카드가 담당하던 "시공 면적"과 "공법+두께"가 서로 다른 단계(StepFlow)로 나뉘면서,
//   도배 PaperPicker와 같은 방식으로 part('area' | 'thickness') prop을 받아 그중 하나만
//   그리게 했다. 정확하게(PreciseSection) 모드는 필드가 훨씬 많아 3단계로 억지로 나누지
//   않고 예전처럼 한 화면에 그대로 둔다(간단 모드만 튜토리얼식 단계 안내 대상).
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import NumberField from '@/components/v1/NumberField';
import AreaInput from '../_components/AreaInput';
import type { MortarFormState } from '@/lib/v1/mortarQuery';
import type { MortarQuickResult } from '@/lib/v1/useMortarQuickCalc';
import { usesSupplyAreaConvention } from '@/lib/v1/mortarEngineInput';
import {
  USAGE_PRESET,
  REMICON_THICKNESS_CHIPS,
  SELF_LEVEL_THICKNESS_CHIPS,
  METHOD_CAPTION,
} from '@/lib/v1/mortarPresets';

export interface QuickAnswerProps {
  /** 이 카드에서 어느 부분만 그릴지 — 'area'(시공 면적) / 'thickness'(공법+두께) */
  part: 'area' | 'thickness';
  form: MortarFormState;
  patch: (p: Partial<MortarFormState>) => void;
  /** 즉시 계산 결과(서버 응답 없이도 항상 있음) — 표준 범위 벗어남 안내에만 쓴다 */
  quick: MortarQuickResult | null;
}

/** 작업 면적 그 자체(공급/전용 개념 없음)로 쓰는 용도 — 셀프레벨링의 작은 직접 면적 칩(㎡) */
const WORK_AREA_CHIPS_SQM: readonly number[] = [3, 5, 10, 20];

export default function QuickAnswer({ part, form, patch, quick }: QuickAnswerProps) {
  const mode = form.mode ?? '레미탈';
  const areaInputMode = form.areaInputMode ?? 'area';
  const areaUnit = form.areaUnit ?? '평';
  // 34평 의미 통일 — 지금 용도가 "공급 평형 → 전용 ㎡" 규칙(방통)인지,
  // 아니면 "바를 면적 그 자체"(셀프레벨링)인지
  const supplyArea = usesSupplyAreaConvention(form);

  const thicknessChips = mode === '레미탈' ? REMICON_THICKNESS_CHIPS : SELF_LEVEL_THICKNESS_CHIPS;
  // 공법 — 명시적으로 안 바꿨으면 용도 기본값(현재는 전부 손미장)을 그대로 보여준다(레미탈 전용)
  const effectiveMethod = form.method ?? (form.usage ? USAGE_PRESET[form.usage].defaultMethod : '손미장');

  // part === 'thickness' — 공법(레미탈 전용) + 두께만 그린다
  if (part === 'thickness') {
    return (
      <div className="flex flex-col gap-4">
        {/* 공법 — 레미탈 전용. 간단 모드에도 노출한다(2026-09-15 운영자 현장 기준 지시).
            기본값은 항상 손미장(방통 포함) — 아파트·국소 현장이 대부분이라 레미콘차 진입이
            어렵다는 운영자 현장 기준. 캡션 1줄로만 설명한다(설명글 최소화 원칙). */}
        {mode === '레미탈' && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground whitespace-nowrap flex-none">공법</span>
              <div className="flex gap-2">
                <Chip shape="square" selected={effectiveMethod === '손미장'} onClick={() => patch({ method: '손미장' })}>
                  손미장
                </Chip>
                <Chip
                  shape="square"
                  selected={effectiveMethod === '장비타설'}
                  onClick={() => patch({ method: '장비타설' })}
                >
                  장비 타설
                </Chip>
              </div>
            </div>
            <p className="text-[13px] text-v1-text-secondary">{METHOD_CAPTION}</p>
          </div>
        )}

        {/* 두께 — 칩(용도를 고르면 기본값이 자동 선택된다) + 직접 입력.
            용도 아래에 두께 칩 줄을 따로 두고, 바꾸면 그 값이 우선한다
            (용도를 다시 누르면 그 용도의 기본값으로 되돌아간다) */}
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold text-foreground">두께</span>
          <div className="flex flex-wrap gap-2">
            {thicknessChips.map((mm) => (
              <Chip key={mm} selected={form.thicknessMm === mm} onClick={() => patch({ thicknessMm: mm })}>
                {mm}mm
              </Chip>
            ))}
          </div>
          <NumberField
            value={form.thicknessMm ?? ''}
            onChange={(v) => patch({ thicknessMm: v === '' ? undefined : v })}
            suffix="mm"
            placeholder="두께 직접 입력"
            aria-label="두께 직접 입력"
            className="w-full"
          />
          <p className="text-[13px] text-v1-text-secondary">용도별 기본값, 바꿔도 돼요</p>
          {quick?.standardRangeNote && <p className="text-[13px] text-v1-text-secondary">{quick.standardRangeNote}</p>}
        </div>
      </div>
    );
  }

  // part === 'area' — 시공 면적만 그린다
  return (
    <div className="flex flex-col gap-4">
      {/* 1) 시공 면적 — "면적 | 가로×세로" 입력 방식과 (공급 평형 규칙일 때만) "평 | ㎡"
          단위 토글을 한 줄에 합쳤다(2026-09-15 디자인 통일 지시 — 예전엔 두 줄). */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-[15px] font-semibold text-foreground">시공 면적</span>
        <div className="flex gap-2 flex-wrap">
          {/* "면적|가로×세로" 입력 방식 토글 — 값이 아니라 입력 방식을 바꾸는 소형 토글이라
              size="sm"(32px, 2026-09-16 형아 피드백) */}
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
          {/* 평/㎡ 토글 — 공급 평형 규칙(방통)이고 면적 직접 입력일 때만.
              작업 면적 그 자체인 용도는 평 토글이 없다(늘 ㎡) — 34평 의미 통일 지시 */}
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
          // 방통 — 도배·바닥재와 같은 공용 부품(AreaInput mode="supply").
          // 평/㎡ 토글은 위 줄에서 이미 그렸으니 hideUnitToggle로 중복을 막는다.
          <AreaInput
            mode="supply"
            unit={areaUnit}
            onUnitChange={(u) => patch({ areaUnit: u })}
            value={form.area ?? ''}
            onValueChange={(v) => patch({ area: v === '' ? undefined : v })}
            hideUnitToggle
            // 2026-09-16 형아 피드백: 캡션에서 "공급"·"전용" 단어 삭제
            caption={areaUnit === '㎡' ? '면적 ㎡ 그대로 계산해요' : '평형 기준 · ㎡로 계산해요'}
          />
        ) : (
          // 셀프레벨링 — 집 평형 개념이 없는 작업 면적 그
          // 자체. 작은 직접 면적 칩(3·5·10·20㎡)만 쓰고 평 토글은 아예 없다.
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
