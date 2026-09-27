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
// 2026년 09월 27일: 좁혀가기 — 서버 훅과 같은 변환(toEngineInputWithAssumed)을 거쳐 가정값을 똑같이 쓰고,
//   결과에 inputKey(수량을 만든 입력 열쇠)·assumed를 추가했다. 세 번째 인자 options는 서버 훅과 같은 값.
// ──────────────────────────────────────────────

'use client';

import { useMemo, useRef } from 'react';
import type { MortarFormState, MortarMode } from './mortarQuery';
import type { MortarProductOption } from './mortarProductOptions';
import {
  toEngineInputWithAssumed,
  mortarRequestKey,
  nonDimensionKey,
  canHoldWhileMeasuring,
  type MortarAssumption,
  type MortarEngineInput,
  type MortarEngineOptions,
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
// (두께·로스율 클램프는 2026-09-27부터 변환 함수 toEngineInputWithAssumed가 한 번에 한다)
import {
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
  /**
   * (2026-09-27 추가) 이 수량을 만든 요청의 열쇠. 서버 훅(useMortarCalc)의 resultKey와 같으면
   * 화면의 금액이 이 수량과 같은 입력에서 나온 것이다. 다르면 금액이 아직 옛 입력 기준이다.
   */
  inputKey: string;
  /** (2026-09-27 추가) 가정값으로 채운 항목 목록 — 서버 훅의 assumed와 같은 규칙 */
  assumed: MortarAssumption[];
}

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 즉시 계산 한 번의 결과 + 실측 입력 중 유지 판단에 쓰는 열쇠 */
interface QuickComputed {
  result: MortarQuickResult;
  /** 이 결과를 만든 요청의 "면적 뺀 나머지" 열쇠(nonDimensionKey) */
  restKey: string;
}

/**
 * 미장 계산기 즉답 훅.
 * 폼 상태만으로 포수·체적·현장 배합을 즉시 계산한다(서버 응답을 기다리지 않는다).
 *
 * 2026-09-27 좁혀가기: 서버 계산 훅(useMortarCalc)과 **같은 변환 함수(toEngineInputWithAssumed)**로
 * 만든 요청에서 면적·두께·공법·제품을 읽는다 — 그래야 가정값(10평·기본 두께 등)이 양쪽에 똑같이
 * 들어가고, 결과의 inputKey가 서버 결과의 resultKey와 같은지로 "수량과 금액이 같은 입력에서 나왔나"를
 * 판정할 수 있다. 용도를 안 골랐으면(touched.usage가 true 아님) null.
 * 실측 입력 중(면적 빈 구역 카드)이고 면적만 바뀌는 중이면 서버 훅처럼 직전 결과를 그대로 돌려준다.
 *
 * @param options 서버 훅과 **같은 값**을 넘겨야 한다({ touched: { usage, area, thickness, method } })
 */
export function useMortarQuickCalc(
  state: MortarFormState,
  products: MortarProductOption[],
  options?: MortarEngineOptions,
): MortarQuickResult | null {
  // 직전에 화면에 준 즉시 결과(실측 입력 중 유지용)
  const lastRef = useRef<QuickComputed | null>(null);
  // options는 매번 새 객체일 수 있어 내용으로 비교한다
  const touchedKey = JSON.stringify(options?.touched ?? null);

  const computed = useMemo((): { built: MortarEngineInput; fresh: QuickComputed } | null => {
    // 서버 훅과 같은 변환 — 용도 미선택이면 null, 나머지 빈 값은 가정값으로 채워진다
    const built = toEngineInputWithAssumed(state, products, options);
    if (!built) return null;
    const request = built.request;
    const mode = request.mode;
    // 두께·면적은 변환 함수가 이미 클램프·가정값 처리한 값을 쓴다(예전 계산과 같은 값)
    const thicknessMm = request.thicknessMm;
    const areaSqm = request.areaSqm;

    const product = request.product;
    const kgPerMmSqm = product?.kgPerMmSqm ?? defaultKgPerMmSqm(mode);
    const bagKg = product?.bagKg ?? defaultBagKg(mode);
    const lossRate = request.lossRate ?? MORTAR_LOSS_RATE_DEFAULT;

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

    // 공법 — 서버 오케스트레이터와 같은 규칙(요청의 공법, 비었으면 용도 기본값).
    // 공법이 가정이면 변환 함수가 공법 칸을 비워 보내므로 여기서도 용도 기본값(손미장)이 된다.
    const method: MortarMethod | undefined =
      mode === '레미탈' ? request.method ?? (state.usage ? USAGE_PRESET[state.usage].defaultMethod : '손미장') : undefined;
    const equipmentNote = method === '장비타설' ? EQUIPMENT_RENTAL_NOTE : undefined;
    const laborAdvisoryNote = mode === '셀프레벨링' ? SELF_LEVEL_LABOR_ADVISORY_NOTE : undefined;

    const result: MortarQuickResult = {
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
      // 이 수량을 만든 요청의 열쇠 — 서버 훅의 resultKey와 같으면 금액도 같은 입력에서 나온 것
      inputKey: mortarRequestKey(request),
      // 가정 목록(서버 훅의 assumed와 같은 규칙. 'measuring'도 입력 그대로 담긴다)
      assumed: built.assumed,
    };
    return { built, fresh: { result, restKey: nonDimensionKey(built) } };
    // state 전체를 넣으면 참조가 patch()마다 바뀌므로 값이 바뀔 때마다 다시 계산된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, products, touchedKey]);

  if (!computed) {
    // 용도 미선택 — 기억해 둔 결과도 버린다
    lastRef.current = null;
    return null;
  }

  // 실측 입력 중이고 면적만 바뀌는 중이면 직전 결과를 그대로 준다(서버 훅과 같은 규칙).
  // 이때 가정 목록의 'measuring'만 지금 입력 상태를 따른다.
  const last = lastRef.current;
  if (last && canHoldWhileMeasuring(computed.built, last.restKey)) {
    return { ...last.result, assumed: withMeasuring(last.result.assumed) };
  }
  // 새 결과를 기억해 둔다(렌더 중 ref 쓰기 — 같은 입력이면 같은 값이라 두 번 그려져도 안전하다)
  lastRef.current = computed.fresh;
  return computed.fresh.result;
}

/** 가정 목록에 'measuring'을 (없으면) 붙인다 */
function withMeasuring(list: MortarAssumption[]): MortarAssumption[] {
  return list.includes('measuring') ? list : [...list, 'measuring'];
}
