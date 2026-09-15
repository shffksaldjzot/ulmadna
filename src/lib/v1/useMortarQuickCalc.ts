// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: 즉답(포수) 클라이언트 계산 훅
//
// 왜 만들었나 (2026-09-15 운영자 현장 기준 피드백):
//   운영자 현장 기준 폰에서 "레미탈 포수가 안 나왔다"는 문제가 있었다. 원인은 즉답 화면이 포수까지도
//   서버 응답(POST /api/calc/mortar)을 기다렸다가 보여주는 구조였기 때문 — 네트워크가
//   느리거나 실패하면 숫자 자리가 그냥 비어 있었다.
//
//   포수·몰탈 체적·현장 배합은 "공개해도 되는 공식"(면적×두께×계수)이라 서버 응답 없이도
//   화면(클라이언트)에서 바로 계산할 수 있다. 이 훅이 그 즉시 계산을 맡는다 — 폼 상태가
//   바뀌면 useMemo로 곧바로(디바운스·네트워크 없이) 다시 계산된다. 서버 응답(useMortarCalc)이
//   나중에 도착하면 비용·인건만 그 위에 덧붙인다.
//
//   계산 함수(calcMortarBags 등)는 src/lib/v1/mortarQuantity.ts의 것을 그대로 쓴다 —
//   서버 엔진(schema/mortar.ts·mortar.ts)도 같은 함수를 쓰므로 값이 절대 어긋나지 않는다.
//
// 작성일: 2026년 09월 15일
// ──────────────────────────────────────────────

'use client';

import { useMemo } from 'react';
import type { MortarFormState, MortarMode } from './mortarQuery';
import type { MortarProductOption } from './mortarProductOptions';
import {
  resolveMode,
  resolveView,
  resolveSimpleAreaSqm,
  resolvePreciseAreaSqm,
  resolveProductSelection,
} from './mortarEngineInput';
import {
  calcMortarBags,
  calcMortarVolume,
  calcAltMix,
  defaultKgPerMmSqm,
  defaultBagKg,
  MORTAR_LOSS_RATE_DEFAULT,
  DEFAULT_MIX_RATIO,
  SELF_LEVEL_PRIMER_L_PER_SQM,
  SELF_LEVEL_PRIMER_CAN_L,
  type AltMixResult,
} from './mortarQuantity';
import {
  THICKNESS_MM_MIN,
  thicknessMmMax,
  LOSS_RATE_MIN,
  LOSS_RATE_MAX,
  clamp,
  isThicknessOutOfStandardRange,
  THICKNESS_OUT_OF_RANGE_NOTE,
  USAGE_PRESET,
  EQUIPMENT_RENTAL_NOTE,
  SELF_LEVEL_LABOR_ADVISORY_NOTE,
  type MortarMethod,
} from './mortarPresets';

/** 즉답 계산 결과 — 서버 응답 없이 화면이 바로 그릴 수 있는 값만 담는다 */
export interface MortarQuickResult {
  mode: MortarMode;
  areaSqm: number;
  thicknessMm: number;
  /** 사야 하는 포 수 */
  bags: number;
  /** 포장 단위(kg) */
  bagKg: number;
  /** 제품명 — 골랐으면 그 이름, 아니면 "레미탈 40kg 포대"처럼 모드+포장kg 기본 표기 */
  productLabel: string;
  /** 순수 체적(로스 미포함, ㎥) */
  volumeM3: number;
  /** 로스 포함 체적(㎥) */
  volumeWithLossM3: number;
  /** 로스율(%) */
  lossPct: number;
  /** 레미탈 모드에서만: 현장 배합(시멘트+모래) 대안 */
  altMix?: AltMixResult;
  /** 셀프레벨링 모드에서만: 프라이머 원액(L)·캔 수 */
  primer?: { liters: number; cans: number };
  /** 06_미장.md 표준 두께 범위를 넘었을 때만: 계산은 그대로 하되 붙이는 안내 */
  standardRangeNote?: string;
  /** 레미탈 모드에서 지금 적용되는 공법(용도 기본값 또는 사용자 오버라이드) */
  method?: MortarMethod;
  /** 장비 타설일 때만: "장비비 별도" 안내(품수는 서버 응답이 와야 나온다) */
  equipmentNote?: string;
  /** 셀프레벨링 모드에서만: "시공비는 현장 견적 별도" 안내 */
  laborAdvisoryNote?: string;
}

/** 값이 0보다 큰 유한수인지 */
function isPositive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 미장 계산기 즉답 훅.
 * 폼 상태만으로 포수·체적·현장 배합을 즉시 계산한다(서버 응답을 기다리지 않는다).
 * 입력이 아직 부족하면(면적·두께 미입력) null을 돌려준다.
 */
export function useMortarQuickCalc(state: MortarFormState, products: MortarProductOption[]): MortarQuickResult | null {
  return useMemo(() => {
    if (!isPositive(state.thicknessMm)) return null;
    const mode = resolveMode(state);
    // 화면에 보여줄 두께도 모드별 상한으로 눌러 담는다(직접 입력 칸에 비정상 값이 들어와도
    // 안전한 값만 계산·표시한다 — 결과 공유 링크 방어와 같은 원칙)
    const thicknessMm = clamp(state.thicknessMm, THICKNESS_MM_MIN, thicknessMmMax(mode));

    const view = resolveView(state);
    const areaSqm = view === 'precise' ? resolvePreciseAreaSqm(state) : resolveSimpleAreaSqm(state);
    if (areaSqm === null) return null;

    const product = resolveProductSelection(state, products);
    const kgPerMmSqm = product?.kgPerMmSqm ?? defaultKgPerMmSqm(mode);
    const bagKg = product?.bagKg ?? defaultBagKg(mode);
    const lossRate = isPositive(state.lossRate) || state.lossRate === 0
      ? clamp(state.lossRate as number, LOSS_RATE_MIN, LOSS_RATE_MAX)
      : MORTAR_LOSS_RATE_DEFAULT;

    const bags = calcMortarBags({ areaSqm, thicknessMm, kgPerMmSqm, bagKg, lossRate });
    const { volumeM3, volumeWithLossM3 } = calcMortarVolume({ areaSqm, thicknessMm, lossRate });

    const altMix = mode === '레미탈' ? calcAltMix({ volumeM3, mixRatio: state.mixRatio ?? DEFAULT_MIX_RATIO }) : undefined;

    let primer: { liters: number; cans: number } | undefined;
    const primerOn = state.primer ?? mode === '셀프레벨링';
    if (primerOn && areaSqm > 0) {
      const liters = r1(areaSqm * SELF_LEVEL_PRIMER_L_PER_SQM);
      const cans = Math.max(1, Math.ceil(liters / SELF_LEVEL_PRIMER_CAN_L - 1e-9));
      primer = { liters, cans };
    }

    const productLabel = product?.sourceLabel ?? `${mode} ${bagKg}kg 포대`;
    const standardRangeNote = isThicknessOutOfStandardRange(mode, thicknessMm) ? THICKNESS_OUT_OF_RANGE_NOTE : undefined;

    // 공법 — 서버 오케스트레이터와 같은 규칙(용도 기본값, 정밀 모드 오버라이드 우선)
    const method: MortarMethod | undefined =
      mode === '레미탈' ? state.method ?? (state.usage ? USAGE_PRESET[state.usage].defaultMethod : '손미장') : undefined;
    const equipmentNote = method === '장비타설' ? EQUIPMENT_RENTAL_NOTE : undefined;
    const laborAdvisoryNote = mode === '셀프레벨링' ? SELF_LEVEL_LABOR_ADVISORY_NOTE : undefined;

    return {
      mode,
      areaSqm,
      thicknessMm,
      bags,
      bagKg,
      productLabel,
      volumeM3,
      volumeWithLossM3,
      lossPct: Math.round(lossRate * 100),
      altMix,
      primer,
      standardRangeNote,
      method,
      equipmentNote,
      laborAdvisoryNote,
    };
    // state 전체를 넣으면 참조가 patch()마다 바뀌므로 값이 바뀔 때마다 다시 계산된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, products]);
}
