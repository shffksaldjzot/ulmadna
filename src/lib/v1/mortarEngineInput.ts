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
// 2026년 09월 27일: 좁혀가기(도배·바닥재와 같은 원칙) — 용도를 고른 뒤부터 항상 계산하고, 안 고른
//   면적·두께·공법은 가정값으로 채워 assumed 목록으로 알려 준다(toEngineInputWithAssumed).
// ──────────────────────────────────────────────

import type { MortarAreaInputMode, MortarDirectProduct, MortarFormState, MortarMode, MortarMethod, MortarUsage } from './mortarQuery';
// 면적 가정값을 새 화면 초기값에서 읽어 오기 위해(값 자체는 단가가 아닌 화면 기본값)
import { DEFAULT_MORTAR_FORM } from './mortarQuery';
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
import { SQM_PER_PYEONG, pyeongToExclusiveSqm, exclusiveSqmToPyeong } from './areaUnits';

/**
 * "공급 평형 → 전용 ㎡" 규칙을 쓰는 용도 — 방통 전체·확장부 바닥은 34평 아파트를 고르는
 * 것처럼 도배·바닥재와 같은 개념이라 같은 환산표(areaUnits.ts pyeongToExclusiveSqm)를 쓴다.
 *
 * 2026-09-15 34평 의미 통일 지시: 예전엔 미장의 "평"이 전부 순수 단위 환산(평×3.3058)이라
 * 34평을 고르면 112㎡(시공 면적 그 자체)로 계산됐다 — 도배·바닥재의 "34평=전용 84㎡"와
 * 뜻이 달라 34평 아파트 방통 전체가 실제보다 30%+ 크게 나오는 문제였다. 이제 이 두 용도만
 * 도배·바닥재와 같은 규칙(공급→전용)을 쓰고, 나머지(욕실·현관 구배·마루 철거 후 보수·
 * 셀프레벨링)는 집 평형 개념이 없는 "바를 면적 그 자체"라 순수 단위 환산을 그대로 쓴다.
 */
const SUPPLY_AREA_USAGES = new Set<MortarUsage>(['방통전체', '확장부바닥']);

/**
 * 지금 폼 상태가 "공급 평형 → 전용 ㎡" 규칙을 써야 하는지 — 용도 칩(top-level, MortarCalculator)
 * 하나로 모드·용도를 같이 정하므로, 여기서도 그 칩 선택 하나만 보고 판정한다.
 * 셀프레벨링 모드나 욕실·현관 구배/마루 철거 후 보수는 false(순수 단위 환산).
 */
export function usesSupplyAreaConvention(state: MortarFormState): boolean {
  if (resolveMode(state) === '셀프레벨링') return false;
  return state.usage ? SUPPLY_AREA_USAGES.has(state.usage) : true; // 기본값(방통전체)도 true
}

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
 *
 * 2026-09-15 34평 의미 통일: 평 단위일 때 어떤 공식을 쓸지가 용도에 따라 갈린다 —
 *   방통 전체·확장부 바닥(usesSupplyAreaConvention=true): 도배·바닥재와 같은 "공급 평형 →
 *     전용 ㎡" 표(areaUnits.ts pyeongToExclusiveSqm)를 쓴다. ㎡ 단위는 이미 전용 ㎡ 그
 *     자체이므로 그대로 쓴다(평 환산 없음).
 *   그 외(욕실·현관 구배·마루 철거 후 보수·셀프레벨링): 집 평형 개념이 없는 "바를 면적
 *     그 자체"라 순수 단위 환산(평×3.3058)만 쓴다 — 예전과 같다.
 */
export function resolveSimpleAreaSqm(state: MortarFormState): number | null {
  const inputMode: MortarAreaInputMode = state.areaInputMode ?? 'area';
  if (inputMode === 'rect') {
    if (!isPositive(state.rectWidth) || !isPositive(state.rectDepth)) return null;
    return clamp(r2(state.rectWidth * state.rectDepth), AREA_SQM_MIN, AREA_SQM_MAX);
  }
  if (!isPositive(state.area)) return null;
  const supplyArea = usesSupplyAreaConvention(state);
  const sqm =
    state.areaUnit === '㎡'
      ? state.area
      : supplyArea
        ? pyeongToExclusiveSqm(state.area)
        : state.area * SQM_PER_PYEONG;
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
 *
 * 2026-09-16 형아 피드백으로 용도 칩을 방통·셀프레벨링 2개로 줄이면서 확장부 바닥·
 * 욕실·현관 구배·마루 철거 후 보수를 화면에서 뺐다. 엔진 타입(MortarUsage)은 그대로
 * 둬서 옛 공유 링크(?d=)에 이 값들이 들어올 수 있는데, 화면에 없는 칩이 선택된 것처럼
 * 보이면 안 되니 여기서 방통으로 바꿔 담는다(계산 자체는 그 값 그대로도 되지만, 화면
 * 표시를 안전하게 맞추는 김에 usage도 같이 정리한다).
 */
export function sanitizeMortarFormState(state: MortarFormState): MortarFormState {
  const next: MortarFormState = { ...state };

  // 용도 — 화면 칩에 없는 옛 값(확장부바닥·욕실현관구배·마루철거보수)이 공유 링크로 들어오면
  // 방통 전체로 바꿔 담는다(2026-09-16 용도 칩 2개 축소)
  if (next.usage && next.usage !== '방통전체') {
    next.usage = '방통전체';
  }

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

// ── 좁혀가기(2026-09-27 형아 결정, 도배·바닥재와 같은 원칙) — 가정값과 가정 목록 ──────────

/**
 * 아직 사용자가 정하지 않아서 **가정값으로 채워 계산한** 항목 이름.
 * 미장은 제품 단계가 없고, 첫 단계(용도)는 가정하지 않는다(용도를 고르기 전엔 아예 계산 안 함).
 *   'area'      면적을 안 넣었다(또는 값이 무효하다) → 방통 34평 가정(ASSUMED_SUPPLY_AREA_PYEONG) · 셀프레벨링 33㎡ 가정(ASSUMED_WORK_AREA_PYEONG 10평 환산).
 *               평→㎡ 변환은 기존 규칙 그대로(방통=공급→전용 표, 셀프레벨링=순수 단위 환산)
 *   'thickness' 두께를 안 골랐다 → 용도별 기본 두께(방통 45mm · 셀프레벨링 마루·장판 전 5mm 등)
 *   'method'    (레미탈만) 공법 조정 칩을 아직 안 건드렸다 → 기본 손미장
 *   'measuring' (정확 모드) 구역 카드는 있는데 면적이 비었다 → "실측 입력 중" 표시용
 * 순서는 화면 단계 순서(용도 → 면적 → 두께 → 조정 칩)를 따른다.
 */
export type MortarAssumption = 'area' | 'thickness' | 'method' | 'measuring';

/** 가정 목록을 늘 같은 순서로 돌려주기 위한 순서표 */
const ASSUMPTION_ORDER: MortarAssumption[] = ['area', 'thickness', 'method', 'measuring'];

/**
 * 면적을 안 넣었을 때 가정하는 값 — 용도에 따라 둘로 나뉜다(2026-09-27 지휘관 결정).
 * 폼 초기값(DEFAULT_MORTAR_FORM.area = 10평)은 옛 화면이 아직 쓰므로 건드리지 않고, 가정값만 따로 둔다.
 */
/** 방통(공급 평형 → 전용 ㎡ 규칙을 쓰는 용도): 도배·바닥재와 같은 "34평 가정" → 전용 약 84㎡로 계산 */
export const ASSUMED_SUPPLY_AREA_PYEONG = 34;
/**
 * 셀프레벨링 등(바를 면적 그 자체를 넣는 용도): 기존 기본값 10평을 순수 단위 환산해 약 33㎡.
 * 화면 글은 "33㎡ 가정". (형아 확인 예정 — 바뀌면 이 값만 고친다)
 */
export const ASSUMED_WORK_AREA_PYEONG: number = DEFAULT_MORTAR_FORM.area ?? 20;

/**
 * 화면이 "사용자가 이 값을 직접 건드렸는지"를 알려 주는 표시.
 *   usage      용도 칩을 사용자가 직접 골랐는가 — **true가 아니면 계산하지 않는다**(결과 null)
 *   area       면적 단계를 완료했는가
 *   thickness  두께 단계를 완료했는가
 *   method     공법 조정 칩을 한 번이라도 눌렀는가
 * true가 아니면(false 또는 빠짐) "아직 안 건드림"으로 본다.
 */
export interface MortarTouched {
  usage?: boolean;
  area?: boolean;
  thickness?: boolean;
  method?: boolean;
}

/** toEngineInput·toEngineInputWithAssumed의 선택 인자 */
export interface MortarEngineOptions {
  /** 넘기지 않으면(옛 화면·공유 결과 화면) 용도 기본값으로 계산하고, 값이 폼에 있는지만 보고 가정을 판정한다 */
  touched?: MortarTouched;
}

/** toEngineInputWithAssumed가 돌려주는 값 */
export interface MortarEngineInput {
  /** 서버에 보낼 요청 그대로 */
  request: MortarCalcRequest;
  /** 가정값으로 채운 항목 목록(없으면 빈 배열). 순서는 ASSUMPTION_ORDER 고정 */
  assumed: MortarAssumption[];
}

/** 용도별 기본 두께(mm) — 프리셋 표(mortarPresets.ts)에서 그대로 읽는다 */
export function presetThicknessMm(state: MortarFormState): number {
  if (resolveMode(state) === '셀프레벨링') {
    // 셀프레벨링 칩을 누르면 화면이 '마루장판전'을 기본으로 채운다(MortarCalculator selectTopUsage와 같은 값)
    return SELF_LEVEL_USAGE_PRESET[state.selfLevelUsage ?? '마루장판전'].defaultMm;
  }
  return USAGE_PRESET[state.usage ?? '방통전체'].defaultMm;
}

/**
 * 면적 가정값을 이 용도의 규칙으로 ㎡로 바꾼다(기존 resolveSimpleAreaSqm 규칙 그대로).
 *   방통: 34평 → 공급 평형→전용 ㎡ 표(×0.75 계열) → 약 84㎡
 *   셀프레벨링 등: 10평 → 순수 단위 환산(평×3.3058) → 약 33㎡
 */
export function assumedAreaSqm(state: MortarFormState): number {
  const pyeong = usesSupplyAreaConvention(state) ? ASSUMED_SUPPLY_AREA_PYEONG : ASSUMED_WORK_AREA_PYEONG;
  return resolveSimpleAreaSqm({ ...state, areaInputMode: 'area', area: pyeong, areaUnit: '평' }) as number;
}

/**
 * 폼 상태 → 엔진 요청 + 가정 목록.
 *
 * 2026-09-27 좁혀가기 규칙:
 *   1) 화면이 touched를 넘겼는데 touched.usage가 true가 아니면 null(계산 안 함) — 첫 단계 전.
 *      touched를 안 넘기면(옛 화면·공유 결과 화면) 예전처럼 용도 기본값으로 계산한다.
 *   2) 두께가 없거나(예전엔 null) 화면이 "두께 미완료"라고 알려 주면 용도별 기본 두께로 가정.
 *   3) view === 'simple': 면적이 없거나 무효하거나 "면적 미완료"면 면적 가정(방통 34평 · 셀프레벨링 33㎡, 예전엔 null).
 *   4) view === 'precise': 면적을 채운 구역이 있으면 그 합계, 없으면 면적 가정(방통 34평 · 셀프레벨링 33㎡, 예전엔 null).
 *      면적이 빈 구역 카드가 있으면 'measuring'을 넣는다(계산 훅이 직전 결과를 유지).
 *   5) 공법(레미탈): 조정 칩을 안 건드렸으면 'method' — 공법 칸을 비워 보내 서버가 기본 손미장으로 계산.
 *
 * 클램프(공유 링크 방어)는 예전과 같이 여기서 한다(result/page.tsx도 이 함수를 쓰므로).
 */
export function toEngineInputWithAssumed(
  state: MortarFormState,
  products: MortarProductOption[],
  options?: MortarEngineOptions,
): MortarEngineInput | null {
  const touched = options?.touched;
  // 용도를 사용자가 직접 고르기 전에는 계산하지 않는다(속에 기본값 '방통'이 있어도)
  if (touched && touched.usage !== true) return null;

  const assumedSet = new Set<MortarAssumption>();
  const mode = resolveMode(state);

  // ── 두께: 화면이 "미완료"라고 하거나 값이 없으면 용도별 기본 두께로 가정 ──
  const thicknessAssumed = (touched && touched.thickness !== true) || !isPositive(state.thicknessMm);
  if (thicknessAssumed) assumedSet.add('thickness');
  const rawThickness = thicknessAssumed ? presetThicknessMm(state) : (state.thicknessMm as number);
  // 두께 상한이 모드마다 다르다(레미탈 150 · 셀프레벨링 50, 2026-09-15 운영자 현장 기준 피드백 — 현장에서
  // 방통은 50~150mm까지 흔하다) — mode를 먼저 정한 뒤에 그 모드의 상한으로 클램프한다.
  const thicknessMm = clamp(rawThickness, THICKNESS_MM_MIN, thicknessMmMax(mode));

  // ── 공법(레미탈 전용): 조정 칩을 안 건드렸으면 가정. 이때는 공법 칸을 비워 보내 서버 기본값(손미장)을 쓴다 ──
  const methodAssumed = mode === '레미탈' && (touched ? touched.method !== true : state.method === undefined);
  if (methodAssumed) assumedSet.add('method');

  /** 모은 가정 목록을 고정 순서 배열로 바꿔 요청과 함께 돌려준다 */
  const done = (request: MortarCalcRequest): MortarEngineInput => ({
    request,
    assumed: ASSUMPTION_ORDER.filter((a) => assumedSet.has(a)),
  });

  const product = resolveProductSelection(state, products);
  const usageLabel = resolveUsageLabel(state, mode);
  const view = resolveView(state);
  const lossRate = isPositive(state.lossRate) || state.lossRate === 0
    ? clamp(state.lossRate as number, LOSS_RATE_MIN, LOSS_RATE_MAX)
    : undefined;

  // 셀프레벨링 모드는 와이어메시 옵션 자체가 없다(레미탈 전용) — 값이 남아 있어도 안 보낸다
  const wireMesh = mode === '레미탈' ? state.wireMesh : undefined;
  // usage·method도 레미탈 전용(공법 판정에 쓴다) — 셀프레벨링에선 아예 안 보낸다.
  // 공법이 가정이면(칩을 안 건드림) 비워 보낸다 → 서버가 용도 기본값(손미장)으로 계산해 "손미장 가정"과 맞는다
  const usage = mode === '레미탈' ? state.usage : undefined;
  const method = mode === '레미탈' && !methodAssumed ? state.method : undefined;

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

  /** 면적만 빼고 나머지가 같은 요청을 만든다(간단·정밀·가정 세 갈래가 같이 쓴다) */
  const simpleRequest = (areaSqm: number): MortarCalcRequest => ({
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
  });

  if (view === 'precise') {
    // 구역 카드 중 면적이 빈 카드가 하나라도 있으면 "실측 입력 중"
    if ((state.preciseRooms ?? []).some((r) => !isPositive(r.areaSqm))) assumedSet.add('measuring');

    const rooms = validPreciseRooms(state);
    if (rooms.length === 0) {
      // 실측이 비었다 — 2026-09-27부터 null 대신 면적 가정값(방통 34평 · 셀프레벨링 33㎡)으로 계산한다
      assumedSet.add('area');
      // 정확 모드에서 직접 넣은 운송·양중 금액은 면적 가정과 상관없이 그대로 싣는다
      return done({ ...simpleRequest(assumedAreaSqm(state)), deliveryFeeWon, forkliftFeeWon, liftingFeeWon });
    }
    // resolvePreciseAreaSqm()과 같은 계산(방 목록은 여기서만 더 필요해서 따로 부른다)
    const areaSqm = resolvePreciseAreaSqm(state) as number;
    return done({
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
    });
  }

  // view === 'simple' — 면적(직접 입력 또는 가로×세로). 없거나 "면적 미완료"면 면적 가정(방통 34평 · 셀프레벨링 33㎡, 예전엔 null)
  const areaSqm = touched && touched.area !== true ? null : resolveSimpleAreaSqm(state);
  if (areaSqm === null) {
    assumedSet.add('area');
    return done(simpleRequest(assumedAreaSqm(state)));
  }
  return done(simpleRequest(areaSqm));
}

/**
 * 폼 상태 → 엔진 요청(가정 목록 없이 요청만). 공유 링크 결과 화면(result/page.tsx) 등 예전부터
 * 이 함수를 쓰던 곳이 그대로 돌아가도록 이름·돌려주는 모양을 유지한다.
 * 규칙은 toEngineInputWithAssumed와 같다.
 *
 * useMortarCalc(클라이언트 훅)와 result/page.tsx(공유 링크 결과, 서버 컴포넌트) 둘 다
 * 이 규칙 하나로 계산을 맞춘다 — result/page.tsx는 API 손검증을 거치지 않고 바로
 * calcMortar()를 부르므로, 클램프는 여기(공용 함수) 안에서 반드시 해야 결과 페이지도
 * 같이 보호된다(2026-09-14 검사관 지적).
 */
export function toEngineInput(
  state: MortarFormState,
  products: MortarProductOption[],
  options?: MortarEngineOptions,
): MortarCalcRequest | null {
  return toEngineInputWithAssumed(state, products, options)?.request ?? null;
}

/**
 * 요청 하나를 가리키는 열쇠(문자열). 즉시 포수(useMortarQuickCalc)의 inputKey와 서버 금액
 * (useMortarCalc)의 resultKey가 같은 값이면 "수량과 금액이 같은 입력에서 나왔다"는 뜻이다.
 */
export function mortarRequestKey(request: MortarCalcRequest): string {
  return JSON.stringify(request);
}

// ──────────────────────────────────────────────
// 실측 입력 중 "직전 결과 유지"를 언제까지 해도 되는지 (도배에서 검사관이 잡은 결함을 되풀이하지 않게)
// 직전 결과 유지는 **구역 면적만 바뀌는 동안**에만 한다. 요청을 면적 부분과 나머지로 나눠, 나머지의
// 열쇠가 지금 보이는 결과를 계산할 때와 다르면(용도·두께·공법·제품·운송비 등) 다시 계산한다.
// ──────────────────────────────────────────────

/** 요청에서 면적 칸(areaSqm·구역 목록)을 뺀 나머지로 열쇠를 만든다 */
export function nonDimensionKey(input: MortarEngineInput): string {
  const { areaSqm: _areaSqm, rooms: _rooms, ...rest } = input.request;
  return JSON.stringify(rest);
}

/**
 * 실측 입력 중일 때 새 계산 없이 지금 보이는 결과를 그대로 둬도 되는가.
 * 실측 입력 중이고, 보이는 결과가 있고, 그 결과의 나머지 열쇠가 지금과 같을 때만 true.
 * @param shownKey 지금 화면에 보이는 결과를 계산할 때의 nonDimensionKey. 결과가 없으면 null
 */
export function canHoldWhileMeasuring(input: MortarEngineInput, shownKey: string | null): boolean {
  if (!input.assumed.includes('measuring')) return false;
  if (shownKey === null) return false;
  return nonDimensionKey(input) === shownKey;
}

/**
 * 화면의 금액이 지금 입력(= 즉시 포수가 보여 주는 입력)과 다른 입력에서 나온 것인가.
 * true면 "새 수량 + 옛 금액"이 같이 보이는 상태라 금액(과 수량)을 흐리게 해야 한다.
 *   - 보이는 금액이 없으면 false(흐릴 것이 없다)
 *   - 실측 입력 중 면적만 바뀌는 "직전 결과 유지" 상태면 false(즉시 포수도 같은 직전 값을 유지한다)
 *   - 그 밖에는 지금 요청 열쇠와 보이는 금액의 요청 열쇠가 다르면 true
 * @param now   지금 입력(toEngineInputWithAssumed 결과). 용도 미선택이면 null
 * @param shown 보이는 금액을 만든 요청의 열쇠들. 금액이 없으면 null
 */
export function mortarCostOutOfSync(
  now: MortarEngineInput | null,
  shown: { requestKey: string; restKey: string } | null,
): boolean {
  if (!now || !shown) return false;
  if (canHoldWhileMeasuring(now, shown.restKey)) return false;
  return mortarRequestKey(now.request) !== shown.requestKey;
}

/**
 * 결과 화면에 쓰는 "34평 · 84㎡" 병기 문구 — 도배·바닥재 describeAreaPair()와 같은
 * 뜻이다. usesSupplyAreaConvention(state)가 true인 용도(방통)에서, 간단
 * 모드(area 입력)일 때만 뜻이 있다. 그 외(셀프레벨링 등 작업 면적 직접 입력·가로×세로·정밀 모드)는
 * 집 평형 개념이 없어 null.
 * 2026-09-16 형아 피드백: 화면 문구에서 "공급"·"전용" 단어를 뺐다(환산 계산은 그대로).
 */
export function describeAreaPair(state: MortarFormState): string | null {
  if (resolveView(state) !== 'simple') return null;
  if ((state.areaInputMode ?? 'area') !== 'area') return null;
  if (!usesSupplyAreaConvention(state)) return null;
  if (!isPositive(state.area)) return null;
  if (state.areaUnit === '㎡') {
    return `약 ${exclusiveSqmToPyeong(state.area)}평 · ${state.area}㎡`;
  }
  return `${state.area}평 · ${pyeongToExclusiveSqm(state.area)}㎡`;
}
