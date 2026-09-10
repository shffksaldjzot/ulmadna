// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: 폼 상태 → 엔진 요청 변환 (순수 함수 모음)
//
// 왜 따로 파일을 팠나 (도배 wallpaperEngineInput.ts와 같은 이유):
//   이 로직(toEngineInput 등)은 즉답 화면의 훅(useFlooringCalc)과 공유 링크 결과 화면
//   (result/page.tsx, 서버 컴포넌트)이 똑같이 써야 한다. result/page.tsx는 'use client'
//   훅을 못 쓰는 서버 컴포넌트라서, React도 'use client'도 fetch도 없는 순수 함수만
//   이 파일에 모아 두고 양쪽이 가져다 쓴다 — 그래야 즉답 화면과 공유 결과 화면의
//   금액이 어긋나지 않는다.
//
// ⚠️ 이 파일은 src/server/**를 import하지 않는다. 서버 계산 입력/응답 모양(API 계약,
//    지시서_20260910_공통규칙_바닥재계산기.md)을 아래에 그대로 옮겨 적어 둔다 — 실제 서버
//    타입(src/server/calc/flooring.ts, E 에이전트 작업)이 다르게 나오면 이쪽도 확인할 것.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import type { FlooringDirectProduct, FlooringFormState, FlooringKind, FlooringProductOption, FlooringScope } from './flooringQuery';

/** 평형 직접 입력의 최소값. 도배와 같은 규칙(서버가 5평 미만을 거부한다고 가정) */
export const MIN_PYEONG = 5;

// ── 서버 요청 모양 (지시서 공통규칙 문서의 API 계약을 그대로 옮겨 적음) ──

/** 실측 모드에서 방 하나 */
export interface FlooringRoomRequest {
  name: string;
  widthM: number;
  depthM: number;
}

/** 제품 선택 또는 직접 입력 (서버 product 칸과 같은 모양) */
export interface FlooringProductRequest {
  // 박스형(마루·데코타일)
  pricePerBox?: number;
  sqmPerBox?: number;
  pcsPerBox?: number;
  widthMm?: number;
  lengthMm?: number;
  // 롤형(장판)
  pricePerM?: number;
  rollWidthM?: number;
  thicknessMm?: number;
  /** 제품 초기 로스율(0.05·0.07·0.12 …). 없으면 종류 기본 */
  lossRate?: number;
  /** 화면 표기용 출처 문구(예: "브랜드 제품명"). 없으면 서버가 "사용자 직접 입력"으로 표시 */
  sourceLabel?: string;
}

/** 서버 계산 API가 받는 요청 모양 (POST /api/calc/flooring 바디와 같은 모양) */
export interface FlooringCalcRequest {
  mode: '평형' | '실측';
  pyeong?: number;
  bay?: 2 | 3 | 4;
  rooms?: FlooringRoomRequest[];
  /** 기본 전체(욕실·현관은 항상 제외) */
  scope?: FlooringScope;
  kind: FlooringKind;
  product?: FlooringProductRequest;
  /** 기존 바닥재 철거 포함. 기본 true */
  removeOld?: boolean;
  /** 걸레받이 교체 포함. 기본 true */
  baseboard?: boolean;
}

/** 소수점 반올림 없이 그대로 두되 undefined는 걸러낸다 */
function isPositive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** 방별 실측 목록 중 실제로 계산에 쓸 수 있는(가로·세로 다 채운) 방만 골라낸다 */
function validPreciseRooms(state: FlooringFormState): { w: number; d: number }[] {
  return (state.preciseRooms ?? []).filter((r) => isPositive(r.w) && isPositive(r.d));
}

/**
 * 화면 모드(view)를 정한다. 도배와 달리 이 화면은 처음부터 view가 있는 새 기능이라
 * (옛 공유 링크 호환 부담이 없다) 값이 없으면 그냥 기본값 'simple'로 본다.
 */
export function resolveView(state: FlooringFormState): 'simple' | 'precise' {
  return state.view ?? 'simple';
}

/**
 * describePreciseInput()의 반환 모양 — 정확 모드(방별 실측)가 지금 유효한 입력을
 * 갖고 있는지. 없으면 null. (도배는 room/length 두 방식이 있었지만 바닥재는 방별
 * 실측 하나뿐이라 kind가 단순하다)
 */
export type PreciseInputInfo = { kind: 'room'; count: number } | null;

/**
 * 정확 모드가 지금 유효한지 하나로 판정한다. QuickAnswer·PreciseSection·result 요약줄이
 * 전부 이 함수 하나로 판정해야 서로 어긋나지 않는다(도배 검사관 지적과 같은 이유).
 */
export function describePreciseInput(state: FlooringFormState): PreciseInputInfo {
  if (resolveView(state) !== 'precise') return null;
  const count = validPreciseRooms(state).length;
  return count > 0 ? { kind: 'room', count } : null;
}

/**
 * 공유 링크로 인코딩하기 전에, 지금 화면 모드에서 안 쓰는 값을 지운 사본을 만든다
 * (용량 절감 + 다른 모드의 옛 값이 딸려가 혼동을 주지 않도록). 폼 상태 원본은 안 건드린다.
 */
export function trimFormForShare(state: FlooringFormState): FlooringFormState {
  const trimmed: FlooringFormState = { ...state };
  if (resolveView(state) === 'simple') {
    delete trimmed.preciseRooms;
    delete trimmed.unit;
  } else {
    delete trimmed.pyeong;
    delete trimmed.bay;
    // 검사관 1라운드 지적 1번: 정확(실측) 모드는 방을 직접 골라 넣은 것이라 범위 칩
    // (전체/방만/거실주방) 자체가 뜻이 없다 — 엔진도 실측이면 scope를 무시하고 전체로
    // 계산하도록 바뀌었으니, 공유 링크에도 안 싣는다(화면도 이 모드에선 칩을 안 보여준다)
    delete trimmed.scope;
  }
  return trimmed;
}

/**
 * 제품 마스터에서 고른 제품(FlooringProductOption)을 서버 요청 모양(FlooringProductRequest)으로
 * 바꾼다. 판매 단위(saleUnit)로 박스형/롤형을 가르고, 그 형태가 실제로 쓸 수 있는 칸을
 * 다 갖췄을 때만 규격을 실어 보낸다(하나라도 없으면 규격 없이 undefined 반환 → 종류 평균가 폴백).
 */
function productOptionToRequest(p: FlooringProductOption): FlooringProductRequest | undefined {
  const sourceLabel = `${p.brand} ${p.name}`;
  if (p.saleUnit === '박스') {
    if (!isPositive(p.price ?? undefined) || !isPositive(p.sqmPerBox ?? undefined)) return undefined;
    return {
      pricePerBox: p.price as number,
      sqmPerBox: p.sqmPerBox as number,
      pcsPerBox: p.pcsPerBox ?? undefined,
      widthMm: p.widthMm ?? undefined,
      lengthMm: p.lengthMm ?? undefined,
      lossRate: p.lossRate ?? undefined,
      sourceLabel,
    };
  }
  // 롤형(장판)
  if (!isPositive(p.price ?? undefined) || !isPositive(p.rollWidthM ?? undefined)) return undefined;
  return {
    pricePerM: p.price as number,
    rollWidthM: p.rollWidthM as number,
    thicknessMm: p.thicknessMm ?? undefined,
    lossRate: p.lossRate ?? undefined,
    sourceLabel,
  };
}

/** 직접 입력 값(FlooringDirectProduct) → 서버 요청 모양. 종류에 맞는 필수 칸이 다 차야 요청을 만든다 */
function directProductToRequest(kind: FlooringKind, product: FlooringDirectProduct): FlooringProductRequest | undefined {
  if (kind === '장판') {
    if (!isPositive(product.pricePerM) || !isPositive(product.rollWidthM)) return undefined;
    return { pricePerM: product.pricePerM, rollWidthM: product.rollWidthM };
  }
  // 마루·데코타일(박스형)
  if (!isPositive(product.pricePerBox) || !isPositive(product.sqmPerBox)) return undefined;
  return {
    pricePerBox: product.pricePerBox,
    sqmPerBox: product.sqmPerBox,
    widthMm: product.widthMm,
    lengthMm: product.lengthMm,
  };
}

/**
 * 바닥재 종류·제품 선택 상태 → 서버 요청 product 칸.
 *   1) productCode가 있고 목록에서 찾아지면 그 제품 규격으로 (종류가 바뀌었는데 코드가 안
 *      지워졌으면 무시 — 도배 resolvePaperSelection과 같은 안전장치)
 *   2) 아니면 직접 입력(product)이 있으면 그대로
 *   3) 아니면 undefined(종류 평균가로 폴백)
 */
export function resolveProductSelection(
  state: FlooringFormState,
  products: FlooringProductOption[],
): FlooringProductRequest | undefined {
  if (!state.kind) return undefined;

  if (state.productCode) {
    const found = products.find((p) => p.code === state.productCode);
    if (found && found.kind !== state.kind) return undefined;
    if (found) return productOptionToRequest(found);
    // 목록에 없는 코드면(캐시 어긋남 등) 아래 일반 로직으로 폴백
  }

  if (state.product) {
    return directProductToRequest(state.kind, state.product);
  }

  return undefined;
}

/**
 * 폼 상태 → 엔진 요청. 도배와 같은 규칙:
 *   1) 종류를 안 골랐으면 null(계산 안 함).
 *   2) view === 'precise'(정확하게 계산하기): 방별 실측 중 유효한 값이 있을 때만 계산한다.
 *      **평형으로 폴백하지 않는다.** 제품은 없어도 된다(종류 평균가로 계산).
 *   3) view === 'simple'(간단하게 계산하기, 기본값): 평형 + 제품이 둘 다 있어야 계산한다
 *      (형아 지시: 간단 모드는 제품을 골라야 금액이 나온다).
 *
 * useFlooringCalc(클라이언트 훅)와 result/page.tsx(공유 링크 결과, 서버 컴포넌트) 둘 다
 * 이 함수 하나로 계산 규칙을 맞춘다.
 */
export function toEngineInput(state: FlooringFormState, products: FlooringProductOption[]): FlooringCalcRequest | null {
  // 종류를 안 골랐으면 다른 값이 다 차 있어도 계산하지 않는다
  if (!state.kind) return null;
  const kind = state.kind;

  const removeOld = state.removeOld ?? true;
  const baseboard = state.baseboard ?? true;
  const product = resolveProductSelection(state, products);

  const view = resolveView(state);

  if (view === 'precise') {
    const rooms = validPreciseRooms(state);
    if (rooms.length === 0) return null; // 정밀 입력이 없으면 평형으로 폴백하지 않는다
    return {
      mode: '실측',
      rooms: rooms.map((r, i) => ({ name: `방${i + 1}`, widthM: r.w, depthM: r.d })),
      // 검사관 1라운드 지적 1번: 실측 모드는 사용자가 계산할 방을 직접 골라 넣은 것이라
      // 범위 칩(전체/방만/거실주방)이 뜻이 없다 — 화면에서도 이 칩을 안 보여주고, 요청도
      // 항상 '전체'로 고정한다(폼에 남은 옛 scope 값이 있어도 무시).
      scope: '전체',
      kind,
      product, // 없으면 undefined — 서버가 종류 평균가로 계산
      removeOld,
      baseboard,
    };
  }

  // view === 'simple' — 평형 + 제품이 둘 다 있어야 계산한다
  if (!product) return null;
  if (!isPositive(state.pyeong) || state.pyeong < MIN_PYEONG) return null;
  return {
    mode: '평형',
    pyeong: state.pyeong,
    bay: state.bay ?? 3,
    scope: state.scope ?? '전체',
    kind,
    product,
    removeOld,
    baseboard,
  };
}
