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
// 2026년 09월 27일: 좁혀가기(도배와 같은 원칙) — 자재만 골라도 계산한다. 안 고른 값은 가정값
//   (면적 34평·제품 전체 범위·베이/범위 기본값)으로 채우고 assumed 목록으로 알려 준다
//   (toEngineInputWithAssumed). 이 파일에는 여전히 단가·계수가 없다.
// ──────────────────────────────────────────────

import type { FlooringDirectProduct, FlooringFormState, FlooringKind, FlooringProductOption, FlooringScope } from './flooringQuery';
import { MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM, exclusiveSqmToPyeong, pyeongToExclusiveSqm } from './areaUnits';

/** 평형 직접 입력의 최소값. 도배와 같은 규칙(서버가 5평 미만을 거부한다고 가정) */
export const MIN_PYEONG = 5;
export { MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM };

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
  /** 전용면적(㎡) 직접 입력 — areaUnit이 '㎡'일 때 pyeong 대신 이 값을 보낸다 */
  exclusiveSqm?: number;
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
    // 평/㎡ 중 지금 안 쓰는 값은 링크에 안 싣는다 (2026-09-15 ㎡ 모드 추가, 도배와 같은 규칙)
    if (state.areaUnit === '㎡') {
      delete trimmed.pyeong;
    } else {
      delete trimmed.exclusiveSqm;
    }
  } else {
    delete trimmed.pyeong;
    delete trimmed.exclusiveSqm;
    delete trimmed.areaUnit;
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
 * 다 갖췄을 때만 규격을 실어 보낸다(하나라도 없으면 규격 없이 undefined 반환 → 자재 전체 범위로 계산).
 *
 * 2026-09-27 좁혀가기로 밖에 내보냈다(export) — 서버가 "제품 미정"일 때 그 자재의 노출 제품 전체로
 * 범위를 만들 때도 **이 함수 하나로** 제품 칸을 만든다. 화면이 보내는 값과 서버가 범위 계산에 쓰는
 * 값이 같아야 "제품을 골랐더니 범위 밖"이 구조적으로 안 생긴다(도배 productOptionToRequest와 같은 이유).
 */
export function productOptionToRequest(p: FlooringProductOption): FlooringProductRequest | undefined {
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

// ── 좁혀가기(2026-09-27 형아 결정, 도배와 같은 원칙) — 가정값과 가정 목록 ──────────

/**
 * 아직 사용자가 정하지 않아서 **가정값으로 채워 계산한** 항목 이름(도배와 같은 이름·같은 순서).
 *   'area'      면적을 안 골랐다(또는 값이 무효하다) → 34평으로 계산
 *   'product'   제품을 안 골랐다("아직 안 정했어요" 포함) → 그 자재의 노출 제품 전체 범위
 *   'bay'       (간단 모드) 베이 조정 칩을 아직 안 건드렸다 → 기본 3베이
 *   'scope'     (간단 모드) 범위 조정 칩(전체·방만·거실 주방 복도)을 아직 안 건드렸다 → 기본 전체
 *   'measuring' (정확 모드) 방 카드는 있는데 가로·세로가 덜 채워졌다 → "실측 입력 중" 표시용
 * 철거·걸레받이 토글은 결과 카드 안 기존 자리 그대로라 가정 목록에 넣지 않는다(지휘관 지시).
 */
export type FlooringAssumption = 'area' | 'product' | 'bay' | 'scope' | 'measuring';

/** 가정 목록을 늘 같은 순서로 돌려주기 위한 순서표 */
const ASSUMPTION_ORDER: FlooringAssumption[] = ['area', 'product', 'bay', 'scope', 'measuring'];

/** 면적을 안 골랐을 때 가정하는 평형(지시서 5-2: 도배·바닥재 = 34평) */
export const ASSUMED_PYEONG = 34;

/** 베이를 안 골랐을 때 쓰는 기본 베이(기존 기본값 그대로) */
const DEFAULT_BAY: 2 | 3 | 4 = 3;

/**
 * 화면이 "사용자가 이 값을 직접 건드렸는지"를 알려 주는 표시(도배 WallpaperTouched와 같은 뜻).
 *   area   면적 단계를 사용자가 완료했는가
 *   bay    베이 조정 칩을 한 번이라도 눌렀는가
 *   scope  범위 조정 칩을 한 번이라도 눌렀는가
 * true가 아니면(false 또는 빠짐) "아직 안 건드림 = 가정"으로 본다.
 */
export interface FlooringTouched {
  area?: boolean;
  bay?: boolean;
  scope?: boolean;
}

/** toEngineInput·toEngineInputWithAssumed의 선택 인자 */
export interface FlooringEngineOptions {
  /** 넘기지 않으면(옛 화면·공유 결과 화면) 값이 폼에 들어 있는지만 보고 판정한다 */
  touched?: FlooringTouched;
}

/** toEngineInputWithAssumed가 돌려주는 값 */
export interface FlooringEngineInput {
  /** 서버에 보낼 요청 그대로 */
  request: FlooringCalcRequest;
  /** 가정값으로 채운 항목 목록(없으면 빈 배열). 순서는 ASSUMPTION_ORDER 고정 */
  assumed: FlooringAssumption[];
}

/**
 * 폼 상태 → 엔진 요청 + 가정 목록.
 *
 * 2026-09-27 좁혀가기 규칙(도배와 같은 원칙):
 *   1) 자재(kind)를 안 골랐으면 null(계산 안 함). → 자재를 고른 뒤부터는 항상 결과가 나온다.
 *   2) 제품이 없으면 product 칸을 비워 보낸다 → 서버가 그 자재의 노출 제품 전체 범위로 계산.
 *      (예전엔 간단 모드에서 제품이 없으면 null이었다 — 폐기)
 *   3) view === 'simple': 평형(또는 ㎡)이 없거나 무효하면(5평 미만 등) 34평으로 가정.
 *      화면이 touched.area !== true 로 알려 주면 폼에 값이 있어도 34평 가정으로 계산한다.
 *   4) view === 'precise': 유효한 방이 있으면 그 방들로, 없으면 34평 가정(예전엔 null — 폐기).
 *      가로·세로가 덜 찬 방 카드가 있으면 'measuring'을 넣는다(계산 훅이 직전 결과를 유지).
 */
export function toEngineInputWithAssumed(
  state: FlooringFormState,
  products: FlooringProductOption[],
  options?: FlooringEngineOptions,
): FlooringEngineInput | null {
  // 자재를 안 골랐으면 다른 값이 다 차 있어도 계산하지 않는다(좁혀가기의 출발점 — 첫 단계)
  if (!state.kind) return null;
  const kind = state.kind;

  const removeOld = state.removeOld ?? true;
  const baseboard = state.baseboard ?? true;
  const product = resolveProductSelection(state, products);
  const touched = options?.touched;

  // ── 가정 목록 모으기 ──
  const assumedSet = new Set<FlooringAssumption>();
  if (!product) assumedSet.add('product');
  /** 모은 가정 목록을 고정 순서 배열로 바꾼다 */
  const done = (request: FlooringCalcRequest): FlooringEngineInput => ({
    request,
    assumed: ASSUMPTION_ORDER.filter((a) => assumedSet.has(a)),
  });

  const view = resolveView(state);

  if (view === 'precise') {
    // 방 카드 중 가로·세로가 덜 채워진 카드가 하나라도 있으면 "실측 입력 중"
    if ((state.preciseRooms ?? []).some((r) => !(isPositive(r.w) && isPositive(r.d)))) assumedSet.add('measuring');

    const rooms = validPreciseRooms(state);
    if (rooms.length > 0) {
      return done({
        mode: '실측',
        rooms: rooms.map((r, i) => ({ name: `방${i + 1}`, widthM: r.w, depthM: r.d })),
        // 검사관 1라운드 지적 1번: 실측 모드는 사용자가 계산할 방을 직접 골라 넣은 것이라
        // 범위 칩(전체/방만/거실주방)이 뜻이 없다 — 화면에서도 이 칩을 안 보여주고, 요청도
        // 항상 '전체'로 고정한다(폼에 남은 옛 scope 값이 있어도 무시).
        scope: '전체',
        kind,
        product, // 없으면 undefined — 서버가 자재 전체 범위로 계산
        removeOld,
        baseboard,
      });
    }

    // 실측이 비었다 — 2026-09-27부터 null 대신 34평으로 가정한다. 정확 모드엔 조정 칩(범위·베이)이
    // 없으니 전체·3베이로 계산하고 'bay'·'scope'는 넣지 않는다("34평 가정" 한 줄이 둘을 포함).
    assumedSet.add('area');
    return done({
      mode: '평형',
      pyeong: ASSUMED_PYEONG,
      bay: DEFAULT_BAY,
      scope: '전체',
      kind,
      product,
      removeOld,
      baseboard,
    });
  }

  // ── view === 'simple' ──

  // 조정 칩(베이·범위): 화면이 touched를 넘겼으면 그 표시로, 안 넘겼으면 값이 비었는지로 판정
  if (touched ? touched.bay !== true : state.bay === undefined) assumedSet.add('bay');
  if (touched ? touched.scope !== true : state.scope === undefined) assumedSet.add('scope');
  const bay = state.bay ?? DEFAULT_BAY;
  const scope = state.scope ?? '전체';

  /** 34평 가정 요청(면적 미정·무효일 때) */
  const assumedArea = (): FlooringEngineInput => {
    assumedSet.add('area');
    return done({ mode: '평형', pyeong: ASSUMED_PYEONG, bay, scope, kind, product, removeOld, baseboard });
  };

  // 화면이 "면적 단계 미완료"라고 알려 주면 폼 기본값이 있어도 34평 가정(가정 줄과 계산이 어긋나지 않게)
  if (touched && touched.area !== true) return assumedArea();

  // 2026-09-15 형아 지시(㎡ 모드): areaUnit이 '㎡'면 pyeong 대신 exclusiveSqm을 그대로 보낸다
  if (state.areaUnit === '㎡') {
    if (!isPositive(state.exclusiveSqm) || state.exclusiveSqm < MIN_EXCLUSIVE_SQM || state.exclusiveSqm > MAX_EXCLUSIVE_SQM) {
      return assumedArea(); // 없거나 범위 밖 — 예전엔 null, 이제 34평 가정
    }
    return done({ mode: '평형', exclusiveSqm: state.exclusiveSqm, bay, scope, kind, product, removeOld, baseboard });
  }

  // 평형이 없거나 5평 미만이면(서버가 거부) 34평 가정 — 예전엔 null
  if (!isPositive(state.pyeong) || state.pyeong < MIN_PYEONG) return assumedArea();
  return done({ mode: '평형', pyeong: state.pyeong, bay, scope, kind, product, removeOld, baseboard });
}

/**
 * 폼 상태 → 엔진 요청(가정 목록 없이 요청만). 공유 링크 결과 화면(result/page.tsx) 등 예전부터
 * 이 함수를 쓰던 곳이 그대로 돌아가도록 이름·돌려주는 모양을 유지한다.
 * 규칙은 toEngineInputWithAssumed와 같다(2026-09-27부터 자재만 골라도 요청이 만들어진다).
 */
export function toEngineInput(
  state: FlooringFormState,
  products: FlooringProductOption[],
  options?: FlooringEngineOptions,
): FlooringCalcRequest | null {
  return toEngineInputWithAssumed(state, products, options)?.request ?? null;
}

// ──────────────────────────────────────────────
// 실측 입력 중 "직전 결과 유지"를 언제까지 해도 되는지 (도배에서 검사관이 잡은 결함을 되풀이하지 않게)
// 직전 결과 유지는 **치수만 바뀌는 동안**에만 한다. 요청을 치수 부분과 나머지로 나눠, 나머지의
// 열쇠가 지금 보이는 결과를 계산할 때와 다르면(자재·제품·철거·걸레받이 등) 다시 계산한다.
// ──────────────────────────────────────────────

/**
 * 요청에서 치수 칸(입력 방식·방 목록·평형·㎡·베이·범위)을 뺀 나머지로 열쇠를 만든다.
 * 정확 모드의 범위·베이는 34평 가정의 고정값이라 치수 쪽에 둔다(정확 모드엔 조정 칩이 없다).
 * 새 칸이 요청에 생기면 자동으로 "나머지"에 들어가 다시 계산 쪽으로 간다(안전한 쪽).
 */
export function nonDimensionKey(input: FlooringEngineInput): string {
  const { mode: _mode, rooms: _rooms, pyeong: _pyeong, exclusiveSqm: _sqm, bay: _bay, scope: _scope, ...rest } = input.request;
  return JSON.stringify({ ...rest, product: rest.product ?? null });
}

/**
 * 실측 입력 중일 때 새 계산 없이 지금 보이는 결과를 그대로 둬도 되는가.
 * 실측 입력 중이고, 보이는 결과가 있고, 그 결과의 나머지 열쇠가 지금과 같을 때만 true.
 * @param shownKey 지금 화면에 보이는 결과를 계산할 때의 nonDimensionKey. 결과가 없으면 null
 */
export function canHoldWhileMeasuring(input: FlooringEngineInput, shownKey: string | null): boolean {
  if (!input.assumed.includes('measuring')) return false;
  if (shownKey === null) return false;
  return nonDimensionKey(input) === shownKey;
}

/**
 * 결과 화면 요약줄에 쓰는 "34평 · 84㎡" 병기 문구 (도배 wallpaperEngineInput.ts와 같은 규칙).
 * 간단 모드(평형/㎡)에서만 뜻이 있다 — 실측은 이미 실제 치수라 공급/전용 개념이 없다.
 * 2026-09-16 형아 피드백: 화면 문구에서 "공급"·"전용" 단어를 뺐다(환산 계산은 그대로,
 * 표시만 "34평 · 84㎡"처럼 숫자 두 개를 나란히 보여준다).
 */
export function describeAreaPair(state: FlooringFormState): string | null {
  if (state.areaUnit === '㎡') {
    if (!isPositive(state.exclusiveSqm)) return null;
    return `약 ${exclusiveSqmToPyeong(state.exclusiveSqm)}평 · ${state.exclusiveSqm}㎡`;
  }
  if (!isPositive(state.pyeong)) return null;
  return `${state.pyeong}평 · ${pyeongToExclusiveSqm(state.pyeong)}㎡`;
}
