// ──────────────────────────────────────────────
// v1 허브 — 미장 계산기: 폼 상태 → 엔진 요청 변환 (순수 함수 모음)
//
// 왜 따로 파일을 팠나 (도배·바닥재 engineInput.ts와 같은 이유):
//   이 로직(toEngineInput 등)은 즉답 화면의 훅(useMortarCalc)과 공유 링크 결과 화면
//   (result/page.tsx, 서버 컴포넌트)이 똑같이 써야 한다. result/page.tsx는 'use client'
//   훅을 못 쓰는 서버 컴포넌트라서, React도 'use client'도 fetch도 없는 순수 함수만
//   이 파일에 모아 두고 양쪽이 가져다 쓴다.
//
// ⚠️ 이 파일은 src/server/**를 import하지 않는다(단가 유출 금지 규칙). 용도·두께 프리셋은
//    src/lib/v1/mortarPresets.ts(서버·클라 공유) 것을 가져다 쓴다 — 예전엔 이 파일에 같은
//    표를 서버 계수 파일과 두 번 적어 놨었는데, 2026-09-14 검사관 지적으로 한 곳으로 합쳤다.
//
// 2026-09-14 검사관 지적으로 결과 공유 링크(?d=) 방어(클램프)를 추가했다 — 면적·두께·
// 로스율이 서버 API 허용 범위를 벗어나면(예: 손으로 조작한 링크) 계산을 안 하는 대신
// 범위 안으로 눌러 담아서 계산한다. 그래야 결과 페이지가 지수 표기(1e+21 같은) 같은
// 이상한 숫자를 띄우지 않는다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 14일(검사관 1라운드)
// ──────────────────────────────────────────────

import type { MortarAreaInputMode, MortarDirectProduct, MortarFormState, MortarMode, MortarMethod, MortarUsage } from './mortarQuery';
import type { MortarProductOption } from './mortarProductOptions';
import {
  USAGE_PRESET,
  SELF_LEVEL_USAGE_PRESET,
  AREA_SQM_MIN,
  AREA_SQM_MAX,
  THICKNESS_MM_MIN,
  thicknessMmMax,
  LOSS_RATE_MIN,
  LOSS_RATE_MAX,
  LENGTH_M_MIN,
  LENGTH_M_MAX,
  MONEY_INPUT_WON_MAX,
  clamp,
} from './mortarPresets';

/** 1평 = 3.3058㎡ (도배·바닥재와 같은 값) */
const SQM_PER_PYEONG = 3.3058;

/** 면적 입력의 최소값(㎡) — 서버 API 허용 범위와 같다(mortarPresets.ts AREA_SQM_MIN) */
export const MIN_AREA_SQM = AREA_SQM_MIN;

// ── 서버 요청 모양 (src/server/calc/mortar.ts MortarCalcInput과 같은 모양) ──

/** 제품 선택 또는 직접 입력 (서버 product 칸과 같은 모양) */
export interface MortarProductRequest {
  kgPerMmSqm?: number;
  bagKg?: number;
  pricePerBag?: number;
  sourceLabel?: string;
}

/** 정밀 모드 실별 면적 (서버 rooms 칸과 같은 모양) */
export interface MortarRoomRequest {
  name: string;
  areaSqm: number;
}

/** 서버 계산 API가 받는 요청 모양 (POST /api/calc/mortar 바디와 같은 모양) */
export interface MortarCalcRequest {
  mode: MortarMode;
  areaSqm: number;
  thicknessMm: number;
  usage?: MortarUsage;
  usageLabel?: string;
  method?: MortarMethod;
  mixRatio?: '1:2' | '1:3';
  lossRate?: number;
  wireMesh?: boolean;
  primer?: boolean;
  product?: MortarProductRequest;
  rooms?: MortarRoomRequest[];
  deliveryFeeWon?: number;
  forkliftFeeWon?: number;
  liftingFeeWon?: number;
}

/** 값이 0보다 큰 유한수인지 */
function isPositive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** 소수점 2자리 반올림 */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 화면 모드(view)를 정한다. 값이 없으면 기본값 'simple' */
export function resolveView(state: MortarFormState): 'simple' | 'precise' {
  return state.view ?? 'simple';
}

/** 계산기 모드(레미탈/셀프레벨링)를 정한다. 값이 없으면 기본값 '레미탈' */
export function resolveMode(state: MortarFormState): MortarMode {
  return state.mode ?? '레미탈';
}

type MortarPreciseRoomValid = { name: string; areaSqm: number };

/** 정밀 모드 실별 면적 중 실제로 계산에 쓸 수 있는(면적을 채운) 방만 골라낸다. 서버 상한으로 클램프한다 */
function validPreciseRooms(state: MortarFormState): MortarPreciseRoomValid[] {
  return (state.preciseRooms ?? [])
    .filter((r) => isPositive(r.areaSqm))
    .map((r, i) => ({ name: r.name?.trim() || `구역${i + 1}`, areaSqm: clamp(r.areaSqm, AREA_SQM_MIN, AREA_SQM_MAX) }));
}

/** describePreciseInput()의 반환 모양 — 정밀 모드가 지금 유효한 입력을 갖고 있는지 */
export type PreciseInputInfo = { kind: 'room'; count: number } | null;

/**
 * 정밀 모드가 지금 유효한지 하나로 판정한다. QuickAnswer·PreciseSection·result 요약줄이
 * 전부 이 함수 하나로 판정해야 서로 어긋나지 않는다(도배·바닥재와 같은 이유).
 */
export function describePreciseInput(state: MortarFormState): PreciseInputInfo {
  if (resolveView(state) !== 'precise') return null;
  const rooms = validPreciseRooms(state);
  return rooms.length > 0 ? { kind: 'room', count: rooms.length } : null;
}

/**
 * 간단 모드의 면적 입력(평/㎡ 직접 입력 또는 가로×세로)을 ㎡ 값 하나로 바꾼다.
 * 둘 다 비어 있으면 null. 값이 있으면 서버 허용 범위로 클램프한다(공유 링크 방어).
 */
export function resolveSimpleAreaSqm(state: MortarFormState): number | null {
  const inputMode: MortarAreaInputMode = state.areaInputMode ?? 'area';
  if (inputMode === 'rect') {
    if (!isPositive(state.rectWidth) || !isPositive(state.rectDepth)) return null;
    return clamp(r2(state.rectWidth * state.rectDepth), AREA_SQM_MIN, AREA_SQM_MAX);
  }
  if (!isPositive(state.area)) return null;
  const sqm = state.areaUnit === '㎡' ? state.area : state.area * SQM_PER_PYEONG;
  return clamp(r2(sqm), AREA_SQM_MIN, AREA_SQM_MAX);
}

/**
 * 정밀 모드의 실별 면적 합계를 ㎡ 값 하나로 바꾼다(유효한 방이 하나도 없으면 null).
 * toEngineInput()과 useMortarQuickCalc(즉답 훅)이 같은 값을 써야 해서 여기 하나로 뺐다
 * (2026-09-15 운영자 현장 기준 피드백 — 포수 즉답을 만들며 정밀 모드 면적 계산도 공유 함수로 모았다).
 */
export function resolvePreciseAreaSqm(state: MortarFormState): number | null {
  const rooms = validPreciseRooms(state);
  if (rooms.length === 0) return null;
  return clamp(r2(rooms.reduce((s, r) => s + r.areaSqm, 0)), AREA_SQM_MIN, AREA_SQM_MAX);
}

/** 값이 유한수인지(비정상 값 — NaN·Infinity·문자열 오염 등 — 걸러내기용) */
function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * 공유 링크(?d=)로 들어온 폼 상태를 화면에 그대로 보여줘도 안전한 값으로 눌러 담는다.
 *
 * 2026-09-15 검사관 지적: toEngineInput()의 클램프는 "서버에 보낼 계산 입력"만 안전하게
 * 만들 뿐, 화면 입력칸(NumberField)이 그리는 값은 여전히 decodeMortarForm()이 돌려준
 * 원본 그대로였다 — 그래서 `?d=`에 area:1e22 같은 값을 넣으면 계산 결과는 정상 범위로
 * 나와도, 면적 입력칸과 결과 요약줄에는 자바스크립트가 큰 수를 문자열로 바꿀 때 쓰는
 * 지수 표기("1e+22")가 그대로 찍히는 사고가 났다.
 *
 * 그래서 MortarCalculator(즉답 화면)의 초기 상태와 result/page.tsx(공유 결과 화면) 둘 다,
 * 공유 링크를 읽자마자 이 함수로 한 번 걸러서 "화면에 보여줄 state" 자체를 안전하게
 * 만든 뒤에만 쓴다 — 계산에 쓰는 toEngineInput()의 클램프와는 별개로, 표시용 클램프다.
 */
export function sanitizeMortarFormState(state: MortarFormState): MortarFormState {
  const next: MortarFormState = { ...state };

  // 면적(평/㎡) — 단위에 맞는 범위로 클램프. 비정상 값(NaN 등)은 아예 지운다
  if (isFiniteNumber(next.area)) {
    const isSqm = next.areaUnit === '㎡';
    const min = isSqm ? AREA_SQM_MIN : AREA_SQM_MIN / SQM_PER_PYEONG;
    const max = isSqm ? AREA_SQM_MAX : AREA_SQM_MAX / SQM_PER_PYEONG;
    // 평 환산 상한(151.2493...)처럼 끝없는 소수가 그대로 화면에 찍히지 않게 2자리로 다듬는다
    next.area = r2(clamp(next.area, min, max));
  } else if (next.area !== undefined) {
    next.area = undefined;
  }

  // 가로·세로(m)
  if (isFiniteNumber(next.rectWidth)) {
    next.rectWidth = clamp(next.rectWidth, LENGTH_M_MIN, LENGTH_M_MAX);
  } else if (next.rectWidth !== undefined) {
    next.rectWidth = undefined;
  }
  if (isFiniteNumber(next.rectDepth)) {
    next.rectDepth = clamp(next.rectDepth, LENGTH_M_MIN, LENGTH_M_MAX);
  } else if (next.rectDepth !== undefined) {
    next.rectDepth = undefined;
  }

  // 두께(mm) — 상한이 모드마다 다르다(레미탈 150 · 셀프레벨링 50, 2026-09-15 운영자 현장 기준 피드백)
  if (isFiniteNumber(next.thicknessMm)) {
    next.thicknessMm = clamp(next.thicknessMm, THICKNESS_MM_MIN, thicknessMmMax(resolveMode(next)));
  } else if (next.thicknessMm !== undefined) {
    next.thicknessMm = undefined;
  }

  // 로스율(0~0.2)
  if (isFiniteNumber(next.lossRate)) {
    next.lossRate = clamp(next.lossRate, LOSS_RATE_MIN, LOSS_RATE_MAX);
  } else if (next.lossRate !== undefined) {
    next.lossRate = undefined;
  }

  // 운송·양중 직접 입력(원) — 비정상 값(NaN 등)은 지우고, 범위 밖 값은 눌러 담는다
  if (isFiniteNumber(next.deliveryFeeWon)) {
    next.deliveryFeeWon = clamp(next.deliveryFeeWon, 0, MONEY_INPUT_WON_MAX);
  } else if (next.deliveryFeeWon !== undefined) {
    next.deliveryFeeWon = undefined;
  }
  if (isFiniteNumber(next.liftingFeeWon)) {
    next.liftingFeeWon = clamp(next.liftingFeeWon, 0, MONEY_INPUT_WON_MAX);
  } else if (next.liftingFeeWon !== undefined) {
    next.liftingFeeWon = undefined;
  }
  if (isFiniteNumber(next.forkliftFeeWon)) {
    next.forkliftFeeWon = clamp(next.forkliftFeeWon, 0, MONEY_INPUT_WON_MAX);
  } else if (next.forkliftFeeWon !== undefined) {
    next.forkliftFeeWon = undefined;
  }

  // 정밀 모드 실별 면적 — 개별 칸은 0(입력 전 빈 칸 표시용)까지 허용하고 위만 막는다
  if (next.preciseRooms) {
    next.preciseRooms = next.preciseRooms.map((r) => ({
      name: typeof r.name === 'string' ? r.name.slice(0, 40) : '',
      areaSqm: isFiniteNumber(r.areaSqm) ? clamp(r.areaSqm, 0, AREA_SQM_MAX) : 0,
    }));
  }

  return next;
}

/**
 * 공유 링크로 인코딩하기 전에, 지금 화면 모드에서 안 쓰는 값을 지운 사본을 만든다
 * (용량 절감 + 다른 모드의 옛 값이 딸려가 혼동을 주지 않도록). 폼 상태 원본은 안 건드린다.
 */
export function trimFormForShare(state: MortarFormState): MortarFormState {
  const trimmed: MortarFormState = { ...state };
  if (resolveView(state) === 'simple') {
    delete trimmed.preciseRooms;
    // 2026-09-15 검사관 지적: method는 지우면 안 된다 — 간단 모드에도 공법 칩이 있어서
    // (2026-09-15 형아 지시로 간단 모드에 공법 칩 추가) 사용자가 손미장/장비타설을 직접
    // 고를 수 있다. 예전엔 정밀 모드 전용이라 지웠는데, 그대로 두면 장비 타설을 고르고
    // 공유한 링크를 열었을 때 복원 결과가 손미장 기본값으로 되돌아가 금액이 달라지는
    // 사고가 난다.
    // 운송·양중 입력은 정밀 모드 전용 UI라 간단 모드에서는 값이 있어도 공유 링크에서 뺀다
    delete trimmed.deliveryFeeWon;
    delete trimmed.forkliftFeeWon;
    delete trimmed.liftingFeeWon;
  } else {
    delete trimmed.area;
    delete trimmed.areaUnit;
    delete trimmed.rectWidth;
    delete trimmed.rectDepth;
    delete trimmed.areaInputMode;
    delete trimmed.usage;
    delete trimmed.selfLevelUsage;
  }
  if (resolveMode(state) === '셀프레벨링') {
    delete trimmed.mixRatio;
    delete trimmed.wireMesh;
    delete trimmed.usage;
    delete trimmed.method;
  } else {
    delete trimmed.selfLevelUsage;
  }
  return trimmed;
}

/** 제품 마스터에서 고른 제품(MortarProductOption) → 서버 요청 모양 */
function productOptionToRequest(p: MortarProductOption): MortarProductRequest {
  return {
    kgPerMmSqm: p.kgPerMmSqm,
    bagKg: p.bagKg,
    pricePerBag: p.pricePerBag ?? undefined,
    sourceLabel: `${p.brand} ${p.name}`,
  };
}

/** 직접 입력 값(MortarDirectProduct) → 서버 요청 모양. 계수·포장 kg 둘 다 있어야 제품으로 인정한다 */
function directProductToRequest(product: MortarDirectProduct): MortarProductRequest | undefined {
  if (!isPositive(product.kgPerMmSqm) || !isPositive(product.bagKg)) return undefined;
  return {
    kgPerMmSqm: product.kgPerMmSqm,
    bagKg: product.bagKg,
    pricePerBag: isPositive(product.pricePerBag) ? product.pricePerBag : undefined,
  };
}

/**
 * 제품 선택 상태 → 서버 요청 product 칸.
 *   1) productCode가 있고 목록에서 찾아지면 그 제품 값으로 (모드가 바뀌었는데 코드가
 *      안 지워졌으면 무시 — 도배·바닥재 resolveProductSelection과 같은 안전장치)
 *   2) 아니면 직접 입력(product)이 있으면 그대로
 *   3) 아니면 undefined(모드 기본 계수로 폴백)
 */
export function resolveProductSelection(
  state: MortarFormState,
  products: MortarProductOption[],
): MortarProductRequest | undefined {
  const mode = resolveMode(state);

  if (state.productCode) {
    const found = products.find((p) => p.code === state.productCode);
    if (found && found.mode !== mode) return undefined;
    if (found) return productOptionToRequest(found);
  }

  if (state.product) {
    return directProductToRequest(state.product);
  }

  return undefined;
}

/** 화면에서 고른 용도 칩 라벨(근거 문장용, 선택) — 프리셋 표(mortarPresets.ts)에서 그대로 가져온다 */
function resolveUsageLabel(state: MortarFormState, mode: MortarMode): string | undefined {
  if (mode === '레미탈') return state.usage ? USAGE_PRESET[state.usage].label : undefined;
  return state.selfLevelUsage ? SELF_LEVEL_USAGE_PRESET[state.selfLevelUsage].label : undefined;
}

/**
 * 폼 상태 → 엔진 요청.
 *   1) 두께가 없으면 null(계산 안 함). 있으면 서버 허용 범위로 클램프한다.
 *   2) view === 'precise'(정확하게 계산하기): 실별 면적 중 유효한 값이 있을 때만 계산한다.
 *      간단 모드의 면적으로 폴백하지 않는다.
 *   3) view === 'simple'(기본값): 면적(직접 입력 또는 가로×세로)이 있어야 계산한다.
 *
 * useMortarCalc(클라이언트 훅)와 result/page.tsx(공유 링크 결과, 서버 컴포넌트) 둘 다
 * 이 함수 하나로 계산 규칙을 맞춘다 — result/page.tsx는 API 손검증을 거치지 않고 바로
 * calcMortar()를 부르므로, 클램프는 여기(공용 함수) 안에서 반드시 해야 결과 페이지도
 * 같이 보호된다(2026-09-14 검사관 지적).
 */
export function toEngineInput(state: MortarFormState, products: MortarProductOption[]): MortarCalcRequest | null {
  if (!isPositive(state.thicknessMm)) return null;
  const mode = resolveMode(state);
  // 두께 상한이 모드마다 다르다(레미탈 150 · 셀프레벨링 50, 2026-09-15 운영자 현장 기준 피드백 — 현장에서
  // 방통은 50~150mm까지 흔하다) — mode를 먼저 정한 뒤에 그 모드의 상한으로 클램프한다.
  const thicknessMm = clamp(state.thicknessMm, THICKNESS_MM_MIN, thicknessMmMax(mode));

  const product = resolveProductSelection(state, products);
  const usageLabel = resolveUsageLabel(state, mode);
  const view = resolveView(state);
  const lossRate = isPositive(state.lossRate) || state.lossRate === 0
    ? clamp(state.lossRate as number, LOSS_RATE_MIN, LOSS_RATE_MAX)
    : undefined;

  // 셀프레벨링 모드는 와이어메시 옵션 자체가 없다(레미탈 전용) — 값이 남아 있어도 안 보낸다
  const wireMesh = mode === '레미탈' ? state.wireMesh : undefined;
  // usage·method도 레미탈 전용(공법 판정에 쓴다) — 셀프레벨링에선 아예 안 보낸다
  const usage = mode === '레미탈' ? state.usage : undefined;
  const method = mode === '레미탈' ? state.method : undefined;

  // 운송·양중 — 정밀 모드 전용 입력(06_미장.md §11-2·§11-3). 비정상 값 방어로 서버 상한과
  // 같은 값으로 클램프한다(음수·초과값이 공유 링크로 들어와도 안전하게).
  const deliveryFeeWon = isPositive(state.deliveryFeeWon)
    ? clamp(state.deliveryFeeWon, 0, MONEY_INPUT_WON_MAX)
    : undefined;
  const liftingFeeWon = isPositive(state.liftingFeeWon)
    ? clamp(state.liftingFeeWon, 0, MONEY_INPUT_WON_MAX)
    : undefined;
  const forkliftFeeWon = isPositive(state.forkliftFeeWon)
    ? clamp(state.forkliftFeeWon, 0, MONEY_INPUT_WON_MAX)
    : undefined;

  if (view === 'precise') {
    const rooms = validPreciseRooms(state);
    if (rooms.length === 0) return null; // 정밀 입력이 없으면 간단 모드 면적으로 폴백하지 않는다
    // resolvePreciseAreaSqm()과 같은 계산(방 목록은 여기서만 더 필요해서 따로 부른다)
    const areaSqm = resolvePreciseAreaSqm(state) as number;
    return {
      mode,
      areaSqm,
      thicknessMm,
      usage,
      usageLabel,
      method,
      mixRatio: state.mixRatio,
      lossRate,
      wireMesh,
      primer: state.primer,
      product,
      rooms,
      deliveryFeeWon,
      forkliftFeeWon,
      liftingFeeWon,
    };
  }

  // view === 'simple' — 면적(직접 입력 또는 가로×세로)이 있어야 계산한다
  const areaSqm = resolveSimpleAreaSqm(state);
  if (areaSqm === null) return null;
  return {
    mode,
    areaSqm,
    thicknessMm,
    usage,
    usageLabel,
    method,
    mixRatio: state.mixRatio,
    lossRate,
    wireMesh,
    primer: state.primer,
    product,
  };
}
