// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 폼 상태 → 엔진 요청 변환 (순수 함수 모음)
//
// 왜 따로 파일을 팠나:
//   이 로직(toEngineInput 등)은 원래 useWallpaperCalc.ts(클라이언트 훅) 안에 있었다.
//   그런데 공유 링크 결과 화면(result/page.tsx)은 서버 컴포넌트라서 'use client' 훅 파일을
//   직접 import할 수 없다. 이 파일은 React도, 'use client'도, fetch도 없는 순수 변환
//   함수만 모아 둬서 클라이언트 훅과 서버 결과 페이지 양쪽이 똑같이 가져다 쓸 수 있게 한다.
//   (같은 규칙으로 두 번 계산하지 않으면 즉답 화면과 공유 결과 화면의 금액이 어긋난다)
//
// ⚠️ 이 파일은 src/server/**를 import하지 않는다(단가 유출 금지 규칙과 무관하게 그냥 필요가 없다).
//    서버 계산 입력(WallpaperCalcInput)의 모양을 아래에 그대로 옮겨 적어 둔다 — 실제 서버 타입
//    (src/server/calc/wallpaper.ts)이 바뀌면 이쪽도 같이 확인할 것.
//
// 작성일: 2026년 09월 09일
// 2026년 09월 27일: 좁혀가기(형아 결정) — 벽지 종류만 골라도 계산한다. 안 고른 값은 가정값
//   (면적 34평·제품 전체 범위·베이/범위 기본값)으로 채우고, 무엇을 가정했는지 assumed 목록으로 돌려준다.
//   이 파일에는 여전히 단가·계수가 하나도 없다(가정값 34평·3베이는 화면 기본값일 뿐 단가가 아니다).
// ──────────────────────────────────────────────

import type { WallpaperFormState, WallpaperProductOption, WallpaperOpening, PreciseRoomInput } from './wallpaperQuery';
import { DEFAULT_CEILING_HEIGHT_M } from './wallpaperDefaults';
import { MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM, exclusiveSqmToPyeong, pyeongToExclusiveSqm } from './areaUnits';

/** 평형 직접 입력의 최소값. 이보다 작은 값은 서버가 거부하므로(route.ts min:5) 아예 호출하지 않는다 */
export const MIN_PYEONG = 5;
export { MIN_EXCLUSIVE_SQM, MAX_EXCLUSIVE_SQM };

// ── 서버 요청 모양 (src/server/calc/wallpaper.ts WallpaperCalcInput 중 이 화면들이 실제로 쓰는 칸만) ──

/** 실측 모드에서 방 하나 (서버 RoomInput과 같은 모양) */
export interface WallpaperRoomRequest {
  name: string;
  widthM: number;
  depthM: number;
  heightM?: number;
  doors?: number;
  windows?: { widthCm: number; heightCm: number }[];
}

/** 면적 모드에서 바로 넣는 값 (서버 AreaInput과 같은 모양) */
export interface WallpaperAreasRequest {
  wallSqm?: number;
  ceilingSqm?: number;
  perimeterM?: number;
}

/** 제품 직접 입력 (서버 DirectProduct와 같은 모양) */
export interface WallpaperProductRequest {
  rollPrice: number;
  widthCm: number;
  lengthM: number;
  repeatCm?: number;
  /** 화면 표기용 출처 문구(예: "LX 지인 ○○ · 웹 조사 기준 · 2026.9"). 없으면 서버가 "사용자 직접 입력"으로 표시 */
  sourceLabel?: string;
}

/** 서버 계산 API가 받는 요청 모양 (POST /api/calc/wallpaper 바디 및 calcWallpaper() 입력과 같은 모양) */
export interface WallpaperCalcRequest {
  mode: '평형' | '실측' | '면적';
  pyeong?: number;
  /** 전용면적(㎡) 직접 입력 — areaUnit이 '㎡'일 때 pyeong 대신 이 값을 보낸다 */
  exclusiveSqm?: number;
  bay?: 2 | 3 | 4;
  rooms?: WallpaperRoomRequest[];
  heightM?: number;
  areas?: WallpaperAreasRequest;
  scope?: '전체' | '거실주방' | string[];
  /** 벽 포함 여부(기본 켬). 끄면 천장만 */
  wall?: boolean;
  ceiling?: boolean;
  paperType?: '합지' | '실크';
  product?: WallpaperProductRequest;
  region?: string;
  /** 구축(재도배) 여부 — 2026-09-09부터 항상 true(견적은 전부 구축 기준) */
  isOld?: boolean;
  /** 기존 벽지 제거 포함 여부(구성 보기 토글). 기본 true */
  removeOld?: boolean;
}

/** 소수점 반올림 없이 그대로 두되 undefined는 걸러낸다 */
function isPositive(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** 방별 실측 목록 중 실제로 계산에 쓸 수 있는(가로·세로 다 채운) 방만 골라낸다 */
function validPreciseRooms(state: WallpaperFormState): PreciseRoomInput[] {
  return (state.preciseRooms ?? []).filter((r) => isPositive(r.w) && isPositive(r.d));
}

/**
 * 화면 모드(view)를 정한다. state.view가 있으면 그대로 쓰고, 없으면(2026-09-09 재배치
 * 이전에 만들어진 옛 공유 링크) 정밀 입력(방별 실측 또는 벽 길이)이 유효할 때만 'precise'로
 * 추정하고, 아니면 'simple'로 본다.
 *
 * toEngineInput·describePreciseInput 둘 다 이 함수 하나로 view를 정한다 — 각자 따로 추정하면
 * 계산 규칙과 요약줄·배지 판정이 어긋날 수 있다(검사관 2라운드 지적 1·2번).
 */
export function resolveView(state: WallpaperFormState): 'simple' | 'precise' {
  if (state.view) return state.view;
  const hasValidRoom = state.entry === 'room' && validPreciseRooms(state).length > 0;
  const hasValidLength = state.entry === 'length' && isPositive(state.wallLength);
  return hasValidRoom || hasValidLength ? 'precise' : 'simple';
}

/**
 * describePreciseInput()의 반환 모양 — 정밀 폼(방별 실측 / 벽 길이)이 지금 유효한
 * 입력을 갖고 있는지, 있다면 어떤 방식인지. 없으면(둘 다 비었거나 전부 빈 값) null.
 */
export type PreciseInputInfo = { kind: 'room'; count: number } | { kind: 'length' } | null;

/**
 * 정밀 폼이 지금 유효한지 하나로 판정한다.
 * → 시그니처: describePreciseInput(state: WallpaperFormState): PreciseInputInfo
 *   ({ kind: 'room', count: number } | { kind: 'length' } | null)
 *
 * QuickAnswer(평형·베이 칩 잠금 여부)·PreciseSection(펼침 배지)·buildSummary(요약줄)가
 * 전부 이 함수 하나로 판정한다 — 각자 따로 세면 판정이 어긋난다(검사관 지적 N4: 예전엔
 * result/page.tsx의 buildSummary가 빈 방 카드까지 방 개수로 세는 버그가 있었다).
 *
 * 2026-09-09 검사관 2라운드 지적 1번 수리: resolveView(state)가 'simple'이면(모드가 명시적으로
 * simple이거나, view가 없는 옛 링크인데 정밀 값이 무효한 경우) 정밀 값이 남아 있어도 무조건
 * null이다 — toEngineInput이 simple 모드에서 정밀 값을 무시하는 것과 같은 규칙이어야
 * 요약줄·배지가 실제 계산과 어긋나지 않는다.
 */
export function describePreciseInput(state: WallpaperFormState): PreciseInputInfo {
  if (resolveView(state) === 'simple') return null;
  if (state.entry === 'room' && state.preciseRooms && state.preciseRooms.length > 0) {
    const count = validPreciseRooms(state).length;
    if (count > 0) return { kind: 'room', count };
  }
  if (state.entry === 'length' && isPositive(state.wallLength)) {
    return { kind: 'length' };
  }
  return null;
}

/**
 * 공유 링크로 인코딩하기 전에, 지금 화면 모드에서 안 쓰는 값을 지운 사본을 만든다
 * (용량 절감 + 다른 모드의 옛 값이 딸려가 혼동을 주지 않도록). 폼 상태 원본은 안 건드린다 —
 * WallpaperCalculator가 들고 있는 form은 그대로라 모드를 되돌리면 지웠던 값이 다시 쓰인다.
 */
export function trimFormForShare(state: WallpaperFormState): WallpaperFormState {
  const trimmed: WallpaperFormState = { ...state };
  if (resolveView(state) === 'simple') {
    delete trimmed.preciseRooms;
    delete trimmed.wallLength;
    delete trimmed.lengthOpenings;
    delete trimmed.directCeilingSqm;
    delete trimmed.entry;
    delete trimmed.unit;
    // 평/㎡ 중 지금 안 쓰는 값은 링크에 안 싣는다 (2026-09-15 ㎡ 모드 추가)
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
  }
  return trimmed;
}

/**
 * 벽 길이(둘레) 모드 전용 — 문·창 목록의 면적 합을 ㎡로 구한다.
 * 2026-09-09 검사관 지적 수리: 예전엔 문을 표준 규격(0.9×2.1m)으로 고정해서 뺐지만,
 * 사용자가 문 규격을 직접 입력할 수 있는데 그 값을 무시하는 버그였다. 문·창 구분 없이
 * 입력받은 실제 폭·높이(cm)를 m로 바꿔 개수만큼 곱해 합산한다.
 */
export function sumOpeningAreaM2(openings: WallpaperOpening[] | undefined): number {
  if (!openings || openings.length === 0) return 0;
  let total = 0;
  for (const o of openings) {
    total += (o.w / 100) * (o.h / 100) * o.count;
  }
  return total;
}

/**
 * 정밀 폼의 개구부 목록(door/window, 개수 포함)을 엔진이 받는 창 목록으로 편다.
 * 2026-09-09 검사관 지적 수리: 예전엔 문을 엔진의 doors 칸(항상 표준 규격 0.9×2.1m로
 * 차감)에 넣어서, 사용자가 실제 문 규격을 입력해도 계산에 반영되지 않았다.
 * 엔진의 windows[] 차감 산수는 문/창 구분 없이 "폭×높이를 벽 면적에서 뺀다"라서, 문도
 * 창 목록에 실제 규격 그대로 넣고 doors 칸은 항상 0(표준 규격 차감 안 씀)으로 둔다.
 */
function flattenOpenings(openings: WallpaperOpening[]): { widthCm: number; heightCm: number }[] {
  const windows: { widthCm: number; heightCm: number }[] = [];
  for (const o of openings) {
    for (let i = 0; i < o.count; i++) windows.push({ widthCm: o.w, heightCm: o.h });
  }
  return windows;
}

/** 벽지 종류·제품 선택을 엔진 요청 칸(paperType/product)으로 정리한 결과 */
export interface PaperSelection {
  paperType: '합지' | '실크';
  product?: WallpaperProductRequest;
}

/**
 * 제품 목록의 한 줄(WallpaperProductOption) → 서버에 보낼 제품 칸(WallpaperProductRequest).
 * 규격(폭·길이)이나 가격 중 하나라도 비어 있으면 계산에 쓸 수 없으니 null을 돌려준다.
 *
 * 2026-09-27 좁혀가기 작업으로 resolvePaperSelection 안에서 밖으로 뺐다 — 서버가 "제품 미정"일 때
 * 그 종류의 노출 제품 전체로 범위를 만들 때도 **이 함수 하나로** 제품 칸을 만든다. 화면이 보내는
 * 제품 값과 서버가 범위 계산에 쓰는 제품 값이 한 글자라도 다르면, 제품을 골랐을 때 범위가 종류
 * 전체 범위 밖으로 나갈 수 있기 때문이다(이 파일엔 단가가 없다 — 가격은 이미 공개된 제품 소비자가다).
 */
export function productOptionToRequest(found: WallpaperProductOption): WallpaperProductRequest | null {
  // 폭·길이·가격이 전부 양수로 채워져 있어야 계산에 쓸 수 있다
  const hasFullSpec = isPositive(found.widthCm ?? undefined) && isPositive(found.lengthM ?? undefined) && isPositive(found.price ?? undefined);
  if (!hasFullSpec) return null;
  return {
    rollPrice: found.price as number,
    widthCm: found.widthCm as number,
    lengthM: found.lengthM as number,
    // 무늬 반복 간격: null(미확인)은 "안 보냄"으로 바꾼다 — 서버는 없으면 0(무지)으로 계산한다
    repeatCm: found.repeatCm ?? undefined,
    // 제품 마스터에서 고른 제품이면 "브랜드 이름"으로 출처를 밝힌다 (조사 기준일은 쓰지 않음 — 2026-09-09 형아 지시)
    sourceLabel: found.sourceLabel ? `${found.brand} ${found.name} · ${found.sourceLabel}` : `${found.brand} ${found.name}`,
  };
}

// ── 좁혀가기(2026-09-27 형아 결정) — 가정값과 가정 목록 ──────────────────

/**
 * 아직 사용자가 정하지 않아서 **가정값으로 채워 계산한** 항목 이름.
 *   'area'      면적을 안 골랐다(또는 값이 무효하다) → 34평으로 계산
 *   'product'   벽지 제품을 안 골랐다("아직 안 정했어요" 포함) → 그 종류의 노출 제품 전체 범위
 *   'bay'       (간단 모드) 베이 조정 칩을 아직 안 건드렸다 → 기본 3베이
 *   'scope'     범위(벽·천장) 조정 칩을 아직 안 건드렸다 → 기본 벽+천장
 *   'measuring' (정확 모드) 방 카드는 있는데 치수가 덜 채워졌다 → "실측 입력 중" 표시용
 * 화면은 이 목록으로 결과 카드의 가정 줄("34평 · 3베이 가정")을 만들고, 하나라도 있으면 결과 공유를 숨긴다.
 */
export type WallpaperAssumption = 'area' | 'product' | 'bay' | 'scope' | 'measuring';

/** 가정 목록을 늘 같은 순서로 돌려주기 위한 순서표(화면 문구 순서가 흔들리지 않게) */
const ASSUMPTION_ORDER: WallpaperAssumption[] = ['area', 'product', 'bay', 'scope', 'measuring'];

/** 면적을 안 골랐을 때 가정하는 평형(지시서 5-2: 도배·바닥재 = 34평) */
export const ASSUMED_PYEONG = 34;

/** 베이를 안 골랐을 때 쓰는 기본 베이(기존 기본값 그대로) */
const DEFAULT_BAY: 2 | 3 | 4 = 3;

/**
 * 화면이 "사용자가 이 값을 직접 건드렸는지"를 알려 주는 표시.
 * 값 자체는 폼 상태(state)에 기본값이 미리 들어 있어서, 값만 보고는 "사용자가 고른 34평"인지
 * "기본으로 들어 있는 34평"인지 구분할 수 없다 — 그래서 화면이 따로 알려 준다.
 *   area   면적 단계를 사용자가 완료했는가(칩을 눌렀거나 유효한 숫자를 넣었는가)
 *   bay    베이 조정 칩을 사용자가 한 번이라도 눌렀는가
 *   scope  범위(벽·천장) 조정 칩을 사용자가 한 번이라도 눌렀는가
 * true가 아니면(false 또는 빠짐) "아직 안 건드림 = 가정"으로 본다.
 */
export interface WallpaperTouched {
  area?: boolean;
  bay?: boolean;
  scope?: boolean;
}

/** toEngineInput의 선택 인자 */
export interface WallpaperEngineOptions {
  /**
   * 사용자가 직접 건드린 값 표시. **넘기지 않으면**(옛 화면·공유 링크 결과 화면) 값이 폼 상태에
   * 들어 있는지만 보고 판정한다(값이 있으면 사용자가 고른 것으로 본다 — 예전 동작 그대로).
   */
  touched?: WallpaperTouched;
}

/** toEngineInput이 돌려주는 값 */
export interface WallpaperEngineInput {
  /** 서버에 보낼 요청 중 벽지 종류·제품을 뺀 나머지 */
  base: Omit<WallpaperCalcRequest, 'paperType' | 'product'>;
  /** 벽지 종류와(있으면) 제품 */
  paper: PaperSelection;
  /** 가정값으로 채운 항목 목록(없으면 빈 배열). 순서는 ASSUMPTION_ORDER 고정 */
  assumed: WallpaperAssumption[];
}

/**
 * 벽지 종류/제품 선택 상태를 정리한다.
 * 2026-09-09 화면 재배치(벽지 최우선 A안): 벽지 종류를 안 골랐으면 null을 돌려준다 —
 * 예전의 "종류를 아직 안 고르면 합지·실크를 둘 다 계산해 범위를 합친다"(병합 즉답)는
 * 폐기했다. 벽지 카드가 화면 맨 위 1번 카드가 되면서 종류부터 고르는 흐름으로 바뀌었기 때문.
 *   1) productCode가 있고 목록에서 찾아지면 그 제품 규격으로 (규격·가격 중 하나라도 없으면
 *      규격 없이 종류만 넘긴다 — 서버가 그 종류의 노출 제품 전체 범위로 계산한다)
 *   2) 아니면 직접 입력(product)이 있으면 그대로
 *   3) 아니면 종류만 (= "아직 안 정했어요". 2026-09-27부터 서버가 종류 전체 범위로 계산)
 */
export function resolvePaperSelection(state: WallpaperFormState, products: WallpaperProductOption[]): PaperSelection | null {
  if (!state.paperType) return null; // 벽지 종류를 안 골랐다 — 계산하지 않는다
  const paperType = state.paperType;

  if (state.productCode) {
    const found = products.find((p) => p.code === state.productCode);
    // 안전장치: 종류를 바꿨는데 예전 제품 코드가 안 지워진 채로 남아 있으면(화면 쪽 버그·
    // 공유 링크 손상 등) 여기서 한 번 더 막는다 — 고른 종류와 제품 종류가 다르면 그 제품은
    // 무시하고 방금 고른 종류(paperType)로만 계산한다.
    if (found && found.kind !== paperType) {
      return { paperType };
    }
    if (found) {
      // 규격·가격이 다 있으면 그 제품으로, 하나라도 비었으면 제품 없이(= 종류 전체 범위로) 계산한다
      return {
        paperType,
        product: productOptionToRequest(found) ?? undefined,
      };
    }
    // 목록에 없는 코드면(캐시 어긋남 등) 아래 일반 로직으로 폴백
  }

  if (state.product) {
    // "직접 입력" 필드가 채워져 있으면 그대로 사용
    return { paperType, product: state.product };
  }

  return { paperType };
}

/**
 * 폼 상태 → 엔진 요청.
 *
 * 2026-09-27 좁혀가기(형아 결정) 규칙 — 9/9 규칙을 아래처럼 바꿨다:
 *   1) 벽지 종류를 안 골랐으면 null(계산 안 함) — resolvePaperSelection이 판정한다. (그대로)
 *      → 종류를 고른 뒤부터는 **항상 결과가 나온다**. 아직 안 정한 값은 가정값으로 채운다.
 *   2) 제품을 안 골랐으면 제품 칸을 비워 보낸다 → 서버가 그 종류의 노출 제품 전체 범위로 계산.
 *      (9/9에는 간단 모드에서 제품이 없으면 null이었다 — 폐기)
 *   3) view === 'simple': 평형(또는 ㎡)만 본다. 면적이 없거나 무효하면(5평 미만 등) 34평으로 가정.
 *      화면이 touched.area !== true 로 알려 주면 폼에 값이 있어도 34평 가정으로 계산한다.
 *   4) view === 'precise': 방별 실측 또는 벽 길이 중 유효한 값이 있으면 그걸로 계산한다.
 *      실측이 비었으면 34평으로 가정해 계산한다(9/9의 "정밀 값 없으면 null"은 폐기, 지시서 5-4).
 *      방 카드 중 치수가 덜 찬 카드가 있으면 'measuring'(실측 입력 중)을 가정 목록에 넣는다 —
 *      계산 훅은 이때 새로 계산하지 않고 직전 결과를 유지한다.
 *
 * useWallpaperCalc(클라이언트 훅)와 result/page.tsx(공유 링크 결과, 서버 컴포넌트) 둘 다
 * 이 함수 하나로 계산 규칙을 맞춘다 — 두 곳이 각자 변환 로직을 두면 즉답 화면과 공유 결과
 * 화면의 금액이 어긋날 수 있다.
 *
 * @param options 선택. touched(사용자가 직접 건드린 값 표시)를 넘기면 가정 판정에 그걸 쓴다.
 */
export function toEngineInput(
  state: WallpaperFormState,
  products: WallpaperProductOption[],
  options?: WallpaperEngineOptions,
): WallpaperEngineInput | null {
  // 벽지 종류를 안 골랐으면 다른 값이 다 차 있어도 계산하지 않는다(좁혀가기의 출발점 — 첫 단계)
  const paper = resolvePaperSelection(state, products);
  if (!paper) return null;

  // ── 가정 목록 모으기 (나중에 ASSUMPTION_ORDER 순서로 정렬해 돌려준다) ──
  const assumedSet = new Set<WallpaperAssumption>();
  const touched = options?.touched;
  // 제품이 정해지지 않았다(목록 미선택·"아직 안 정했어요"·조사 미완료 제품) → 종류 전체 범위로 계산
  if (!paper.product) assumedSet.add('product');
  // 범위(벽·천장) 조정 칩: 화면이 touched를 넘겼으면 그 표시로, 안 넘겼으면 값이 비었는지로 판정
  const scopeAssumed = touched ? touched.scope !== true : state.target === undefined;
  if (scopeAssumed) assumedSet.add('scope');
  /** 모은 가정 목록을 고정 순서 배열로 바꾼다 */
  const assumedList = (): WallpaperAssumption[] => ASSUMPTION_ORDER.filter((a) => assumedSet.has(a));

  const target = state.target ?? 'both';
  // 벽·천장은 각각 켜고 끈다(2026-09-09 형아 지시). 'wall'=벽만, 'ceiling'=천장만, 'both'=둘 다.
  // 엔진이 wall 플래그를 받아 벽 면적을 0으로 만들어 "천장만"도 제대로 계산한다.
  const wall = target !== 'ceiling';
  const ceiling = target !== 'wall';
  // 지역은 2026-09-09 형아 결정으로 계산에서 뺐다(전부 수도권 기준). 옛 공유 링크에 region이 남아 있어도 무시한다.
  // 구축(재도배) 여부 — 세 입력 방식(실측/면적/평형) 모두에 동일하게 실어 보낸다
  // 2026-09-09 형아 결정: 구축·신축 선택지를 없애고 견적은 전부 구축 기준(밑작업 포함)으로 낸다.
  // 사용자는 구성 보기에서 항목을 보고 판단하고, 기존 벽지 제거만 토글로 켜고 끈다.
  const isOld = true;
  const removeOld = state.removeOld ?? true;
  // view가 없는 옛 공유 링크는 resolveView가 정밀 값 유무로 추정한다(검사관 2라운드 지적 2번)
  const view = resolveView(state);

  // (2026-09-09의 "간단 모드는 제품까지 골라야 계산" 규칙은 2026-09-27 좁혀가기로 폐기했다 —
  //  제품이 없으면 위에서 'product'를 가정 목록에 넣고, 서버가 종류 전체 범위로 계산한다)

  /**
   * 34평 가정 요청을 만든다. 간단 모드에서 면적이 없거나 무효할 때,
   * 정확 모드에서 실측이 비었을 때 같이 쓴다. 'area'를 가정 목록에 넣는 것도 여기서 한다.
   * @param bay 쓸 베이 수(간단 모드는 사용자가 조정 칩으로 바꾼 값, 정확 모드는 기본값)
   */
  const assumedAreaBase = (bay: 2 | 3 | 4): WallpaperEngineInput['base'] => {
    assumedSet.add('area');
    return {
      mode: '평형',
      pyeong: ASSUMED_PYEONG,
      bay,
      scope: '전체',
      wall,
      ceiling,
      isOld,
      removeOld,
    };
  };

  if (view === 'precise') {
    // 방 카드 중 가로·세로가 덜 채워진 카드가 하나라도 있으면 "실측 입력 중"이다
    // (방을 추가만 하고 치수를 아직 안 넣은 빈 카드도 포함 — 지시서 5-4)
    const hasUnfinishedRoom =
      state.entry === 'room' && (state.preciseRooms ?? []).some((r) => !(isPositive(r.w) && isPositive(r.d)));
    if (hasUnfinishedRoom) assumedSet.add('measuring');

    // 1) 방별 실측
    if (state.entry === 'room' && state.preciseRooms && state.preciseRooms.length > 0) {
      const validRooms = validPreciseRooms(state);
      if (validRooms.length > 0) {
        const rooms: WallpaperRoomRequest[] = validRooms.map((r, i) => {
          // 문도 창과 함께 실제 규격으로 windows[]에 넣는다(위 flattenOpenings 설명 참고) — doors는 항상 안 씀
          const windows = flattenOpenings(r.openings);
          return {
            name: `방${i + 1}`,
            widthM: r.w,
            depthM: r.d,
            heightM: r.h,
            doors: undefined,
            windows: windows.length > 0 ? windows : undefined,
          };
        });
        return {
          base: {
            mode: '실측',
            rooms,
            heightM: state.heightM ?? DEFAULT_CEILING_HEIGHT_M,
            scope: '전체',
            wall,
            ceiling,
            isOld,
            removeOld,
          },
          paper,
          assumed: assumedList(),
        };
      }
    }

    // 2) 벽 길이(둘레) 직접 입력
    if (state.entry === 'length' && isPositive(state.wallLength)) {
      const height = state.heightM ?? DEFAULT_CEILING_HEIGHT_M;
      // 문·창 차감: 벽 길이 모드의 개구부 목록(lengthOpenings)을 면적으로 환산해 뺀다
      const openingAreaM2 = sumOpeningAreaM2(state.lengthOpenings);
      const wallSqm = Math.max(0, state.wallLength * height - openingAreaM2);
      return {
        base: {
          mode: '면적',
          areas: {
            wallSqm,
            ceilingSqm: target !== 'wall' ? state.directCeilingSqm : undefined,
            perimeterM: state.wallLength,
          },
          wall,
          ceiling,
          isOld,
          removeOld,
        },
        paper,
        assumed: assumedList(),
      };
    }

    // 3) 실측이 비었다(또는 전부 덜 찼다) — 2026-09-27부터 null 대신 34평으로 가정해 계산한다(지시서 5-4).
    //    정확 모드엔 베이 조정 칩이 없으니 베이는 기본값(3), 'bay'는 가정 목록에 넣지 않는다
    //    ("34평 가정" 한 줄이 베이까지 포함한 가정이다).
    const base = assumedAreaBase(DEFAULT_BAY); // 먼저 만들어야 'area'가 가정 목록에 들어간다
    return { base, paper, assumed: assumedList() };
  }

  // ── view === 'simple' — 평형(또는 전용 ㎡ 직접 입력)만 본다 ──

  // 베이 조정 칩: 화면이 touched를 넘겼으면 그 표시로, 안 넘겼으면 값이 비었는지로 판정
  const bayAssumed = touched ? touched.bay !== true : state.bay === undefined;
  if (bayAssumed) assumedSet.add('bay');
  // 베이 값 자체는 폼에 있는 값을 그대로 쓴다(칩을 안 건드렸으면 폼 기본값 3)
  const bay = state.bay ?? DEFAULT_BAY;

  // 화면이 "면적 단계를 아직 완료 안 했다"고 알려 주면, 폼에 기본값(34평 등)이 들어 있어도 가정으로 본다.
  // 이때는 가정 줄 문구("34평 가정")와 실제 계산이 어긋나지 않게 폼 값 대신 34평으로 계산한다.
  if (touched && touched.area !== true) {
    const base = assumedAreaBase(bay); // 먼저 만들어야 'area'가 가정 목록에 들어간다
    return { base, paper, assumed: assumedList() };
  }

  // 2026-09-15 형아 지시(㎡ 모드): areaUnit이 '㎡'면 pyeong 대신 exclusiveSqm을 그대로 보낸다
  // — 84㎡를 직접 넣으면 34평 칩과 같은 결과가 나와야 하므로 pyeong 환산을 거치지 않는다.
  if (state.areaUnit === '㎡') {
    if (isPositive(state.exclusiveSqm) && state.exclusiveSqm >= MIN_EXCLUSIVE_SQM && state.exclusiveSqm <= MAX_EXCLUSIVE_SQM) {
      return {
        base: {
          mode: '평형',
          exclusiveSqm: state.exclusiveSqm,
          bay,
          scope: '전체',
          wall,
          ceiling,
          isOld,
          removeOld,
        },
        paper,
        assumed: assumedList(),
      };
    }
    // 전용 ㎡ 직접 입력이 없거나 범위 밖이다 — 2026-09-27부터 null 대신 34평으로 가정해 계산한다
    const base = assumedAreaBase(bay); // 먼저 만들어야 'area'가 가정 목록에 들어간다
    return { base, paper, assumed: assumedList() };
  }

  // 서버가 5평 미만은 거부한다(route.ts min:5). 1~4평처럼 애매한 값은 서버로 보내지 않는다 —
  // 2026-09-27부터는 null 대신 34평 가정으로 계산해, 종류를 고른 뒤 결과가 사라지지 않게 한다.
  if (isPositive(state.pyeong) && state.pyeong >= MIN_PYEONG) {
    return {
      base: {
        mode: '평형',
        pyeong: state.pyeong,
        bay,
        scope: '전체',
        wall,
        ceiling,
        isOld,
        removeOld,
      },
      paper,
      assumed: assumedList(),
    };
  }

  // 평형이 없거나 무효하다 — 34평으로 가정해 계산한다
  const assumedBase = assumedAreaBase(bay); // 먼저 만들어야 'area'가 가정 목록에 들어간다
  return { base: assumedBase, paper, assumed: assumedList() };
}

/**
 * 결과 화면 요약줄에 쓰는 "34평 · 84㎡" 병기 문구.
 * 2026-09-15 형아 지시 — 간단 모드(평형/㎡)에서만 뜻이 있다(정밀 실측·벽 길이는 이미 실제
 * 치수라 공급/전용 개념이 없다). pyeong·exclusiveSqm 둘 다 없으면 null.
 * 2026-09-16 형아 피드백: 화면 문구에서 "공급"·"전용" 단어를 뺐다(환산 계산은 그대로).
 */
export function describeAreaPair(state: WallpaperFormState): string | null {
  if (state.areaUnit === '㎡') {
    if (!isPositive(state.exclusiveSqm)) return null;
    return `약 ${exclusiveSqmToPyeong(state.exclusiveSqm)}평 · ${state.exclusiveSqm}㎡`;
  }
  if (!isPositive(state.pyeong)) return null;
  return `${state.pyeong}평 · ${pyeongToExclusiveSqm(state.pyeong)}㎡`;
}
