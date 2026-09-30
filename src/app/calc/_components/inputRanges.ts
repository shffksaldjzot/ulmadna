// ──────────────────────────────────────────────
// v1 허브 — 화면 숫자 칸의 최솟값·최댓값 (서버 검증과 반드시 같아야 한다)
//
// 2026-09-29 검사관 지적(경미 결함 2번): 바닥재 면적을 200평 넘게 넣으면 서버가 거절해
// "마지막 계산에 실패해 이전 값이에요"만 뜨고, 미장 두께를 999mm 넣으면 화면 계산이
// (엔진 내부 clamp로) 조용히 150mm로 잘려서 계산되는데 화면 숫자 칸은 999가 그대로
// 남아 있어 "적힌 값과 계산에 쓴 값이 다른" 상태가 됐다.
//
// 고친 규칙: 화면이 서버와 같은 범위를 미리 알고 있다가, 범위를 벗어나면
//   1) 칸 아래에 짧은 안내("200평 이하" 등)를 보여주고
//   2) 그 값으로는 계산하지 않는다(그 단계를 미완료로 돌려 가정값으로 계산 + 가정 표시)
//   3) 결과 공유를 숨긴다
// 를 계산기 쪽(WallpaperCalculator.tsx 등)에서 처리한다. 이 파일은 그 판단에 쓰는
// 순수 상수·헬퍼 함수만 담는다(화면 부품·계산기가 같이 쓴다).
//
// ⚠️ 아래 숫자들은 서버 쪽 검증(src/app/api/calc/*/route.ts, src/lib/v1/mortarPresets.ts)과
// 반드시 같은 값이어야 한다. 서버 값이 바뀌면 여기도 같이 바꿔야 한다 — 이 파일은
// src/lib/v1/**가 아니라서(이번 작업 허용 범위) 서버 파일을 직접 import 하는 대신 값을
// 그대로 옮겨 적었다(도배·바닥재 pyeong/exclusiveSqm/방 실측 쪽만 — 미장 두께는 이미
// src/lib/v1/mortarPresets.ts가 THICKNESS_MM_MIN·thicknessMmMax를 내보내고 있어 그걸
// 그대로 가져다 쓴다, 값을 중복으로 옮겨 적지 않는다).
//
// 작성일: 2026년 09월 29일
//
// 2026-09-30 지휘관 긴급 전달(치명 2·3) — 미장 면적 범위 차단이 실제로는 동작하지
// 않았다. 152평(502㎡)을 넣으면 잘리지 않고 계산됐다(예: 531만~822만원). 원인:
// 범위 판정에 resolveSimpleAreaSqm(mortarEngineInput.ts)의 "결과"를 넣었는데, 그
// 함수 자체가 이미 끝에서 0.5~500㎡로 잘라(clamp) 돌려준다 — 잘린 값을 다시 그
// 범위와 비교하니 "항상 범위 안"이 되어 판정이 늘 통과해 버렸다(자기 자신과
// 비교하는 셈). 정확 모드 구역 합계(resolvePreciseAreaSqm)도 같은 구조라 300+300㎡가
// 500㎡로 조용히 잘려서 계산됐다.
// 고침: **자르기 전(raw) 값**을 화면 쪽에서 따로 계산해 그 값으로 범위를 판정한다.
// resolveSimpleAreaSqmRaw는 resolveSimpleAreaSqm과 환산 규칙은 완전히 같고 clamp만
// 뺐다 — mortarEngineInput.ts는 안 건드리고 읽기만 해서 그대로 옮겨 적었다(환산 규칙이
// 서버 쪽에서 바뀌면 여기도 같이 바꿔야 한다).
// ──────────────────────────────────────────────

/** 도배·바닥재 "공급 평형" 입력 범위 — src/app/api/calc/wallpaper/route.ts:157, flooring/route.ts:147과 같은 값 */
export const MIN_SUPPLY_PYEONG = 5;
export const MAX_SUPPLY_PYEONG = 200;

/**
 * 정확 모드 방 실측(가로·세로) 범위(m) — src/app/api/calc/wallpaper/route.ts:83-84,
 * flooring/route.ts:94-95와 같은 값(두 계산기가 같은 방 카드 부품 RoomCard를 쓴다)
 */
export const ROOM_DIM_M_MIN = 0.3;
export const ROOM_DIM_M_MAX = 30;

/**
 * 도배 전용 — 정확 모드 방 높이 범위(m) — src/app/api/calc/wallpaper/route.ts:85와 같은 값.
 * 공통 높이 칸(모든 방에 같이 적용, route.ts:163)도 같은 범위라 이 상수를 그대로 쓴다.
 */
export const ROOM_HEIGHT_M_MIN = 1.5;
export const ROOM_HEIGHT_M_MAX = 6;

/**
 * 도배 정확 모드 — 문·창 크기 범위(cm) — src/app/api/calc/wallpaper/route.ts:95-96과 같은 값.
 * 2026-09-30 지휘관 긴급 전달(중요 1) — 이 범위는 화면 쪽에 아예 검사가 없어서, 문·창을
 * 5cm나 5000cm로 넣으면 서버가 거절해 "마지막 계산에 실패해 이전 값이에요"가 뜨는데
 * 공유 버튼은 그대로 보였다(계산 실패 상태에서도 공유를 안 막았기 때문 — 별도로 수리).
 */
export const OPENING_WIDTH_CM_MIN = 10;
export const OPENING_WIDTH_CM_MAX = 1000;
export const OPENING_HEIGHT_CM_MIN = 10;
export const OPENING_HEIGHT_CM_MAX = 400;

/** 미장 — 간단 모드 면적(㎡ 환산값) 범위 — src/app/api/calc/mortar/route.ts:118과 같은 값 */
export const MORTAR_AREA_SQM_MIN = 0.5;
export const MORTAR_AREA_SQM_MAX = 500;

/** 미장 — 정확 모드 구역 하나의 면적(㎡) 범위 — src/app/api/calc/mortar/route.ts:106과 같은 값 */
export const MORTAR_ZONE_SQM_MIN = 0.1;
export const MORTAR_ZONE_SQM_MAX = 500;

/** 값이 [min,max] 안에 있는지 — 빈 값('')이나 숫자가 아니면 "범위 판단 대상이 아님"으로 true를 준다
 *  (아직 아무것도 안 넣은 칸까지 "범위 밖"으로 보이면 안 되므로 — 빈 칸은 이 함수가 아니라
 *  기존 "아직 안 골랐다" 로직이 따로 처리한다) */
export function isWithinRange(value: number | '' | undefined, min: number, max: number): boolean {
  if (value === '' || value === undefined || typeof value !== 'number' || !Number.isFinite(value)) return true;
  return value >= min && value <= max;
}

/** 범위를 벗어났을 때 칸 아래에 보여줄 짧은 안내 글(마침표 없음) — 벗어나지 않았으면 undefined */
export function rangeCaption(value: number | '' | undefined, min: number, max: number, unit: string): string | undefined {
  if (value === '' || value === undefined || typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < min) return `${formatBound(min)}${unit} 이상`;
  if (value > max) return `${formatBound(max)}${unit} 이하`;
  return undefined;
}

/** 경계값 표기 — 정수면 그대로, 소수면 그대로(0.3처럼) 보여준다 */
function formatBound(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

/**
 * 정확 모드 방 하나(가로·세로, m 단위 — 저장값은 항상 m)가 서버 범위 안인지.
 * 계산기(WallpaperCalculator·FlooringCalculator)가 "이 방을 계산에 넣어도 되는지" 판단할
 * 때 쓴다. 값이 아직 0(=안 적음)이면 범위 판단 대상이 아니므로 true(방해하지 않음).
 * 높이(h)는 있을 때만 검사한다(없으면 공통 높이를 쓰므로 이 방 자체는 문제 없다).
 */
/**
 * 미장 두께 입력의 "화면 쪽" 최솟값 — 서버 최솟값(THICKNESS_MM_MIN=1, mortarPresets.ts)보다
 * 엄격하다. 레미탈은 10mm 미만이 현장에서 뜻이 없어(2026-09-27 QuickAnswer.tsx부터 있던
 * 규칙) 화면에서만 10으로 올려 받는다 — 셀프레벨링은 서버 최솟값(1mm)을 그대로 쓴다.
 * mortar/QuickAnswer.tsx(캡션)와 MortarCalculator.tsx(완료 판정·계산용 손댐 덮어쓰기)가
 * 이 함수 하나를 같이 써서 "캡션이 안 뜨는데 계산은 막힌다" 같은 엇갈림을 막는다.
 */
export function mortarThicknessUxMin(mode: '레미탈' | '셀프레벨링', serverMin: number): number {
  return mode === '레미탈' ? 10 : serverMin;
}

/**
 * 원(₩) 단위 금액 칸(배송비·지게차 하차비·양중비)의 범위 안내 글 — "1,000만원 이하"처럼
 * "만원" 단위로 콤마 찍어 보여준다(원 단위 숫자를 그대로 보여주면 "10000000원 이하"로
 * 안 읽혀서). 최솟값은 이 세 칸이 전부 0(음수는 NumberField가 아예 못 치게 막는다)이라
 * "이상" 안내는 필요 없다.
 */
export function moneyRangeCaption(value: number | undefined, maxWon: number): string | undefined {
  if (value === undefined || typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value <= maxWon) return undefined;
  const maxManwon = Math.round(maxWon / 10_000).toLocaleString('ko-KR');
  return `${maxManwon}만원 이하`;
}

export function isRoomDimValid(w: number, d: number, h?: number): boolean {
  if (w > 0 && !isWithinRange(w, ROOM_DIM_M_MIN, ROOM_DIM_M_MAX)) return false;
  if (d > 0 && !isWithinRange(d, ROOM_DIM_M_MIN, ROOM_DIM_M_MAX)) return false;
  if (h !== undefined && h > 0 && !isWithinRange(h, ROOM_HEIGHT_M_MIN, ROOM_HEIGHT_M_MAX)) return false;
  return true;
}

/**
 * 문·창 하나(가로·세로, cm 단위)가 서버 범위 안인지(2026-09-30 중요 1 수리). 값이 아직
 * 0이면(=안 적음) 범위 판단 대상이 아니므로 true.
 */
export function isOpeningDimValid(widthCm: number, heightCm: number): boolean {
  if (widthCm > 0 && !isWithinRange(widthCm, OPENING_WIDTH_CM_MIN, OPENING_WIDTH_CM_MAX)) return false;
  if (heightCm > 0 && !isWithinRange(heightCm, OPENING_HEIGHT_CM_MIN, OPENING_HEIGHT_CM_MAX)) return false;
  return true;
}

/** 값이 0보다 큰 유한수인지(음수·0·NaN·undefined는 전부 "아직 안 넣음"으로 본다) */
function isPositiveNumber(n: number | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * 미장 간단 모드 면적을 ㎡로 환산한다 — src/lib/v1/mortarEngineInput.ts의
 * resolveSimpleAreaSqm과 환산 규칙은 완전히 같지만(가로×세로 / 평→전용㎡ / 평×3.3058)
 * **끝에서 0.5~500㎡로 자르지 않는다**(2026-09-30 치명 2 수리 — 잘린 값으로 범위를
 * 판정하면 "이미 잘렸으니 항상 범위 안"이 되어 판정 자체가 무의미해진다). 계산에 실제로
 * 쓰는 값은 여전히 resolveSimpleAreaSqm(자르는 함수)이 만든다 — 이 함수는 오직 "범위
 * 판정용"으로 화면 쪽에서만 쓴다. usesSupplyAreaConvention·pyeongToExclusiveSqm·
 * SQM_PER_PYEONG은 이미 있는 lib 함수를 읽기만 해서 그대로 쓴다(엔진 파일 안 건드림).
 */
export function resolveSimpleAreaSqmRaw(
  state: { areaInputMode?: 'area' | 'rect'; rectWidth?: number; rectDepth?: number; area?: number; areaUnit?: '평' | '㎡' },
  isSupplyConvention: boolean,
  pyeongToExclusiveSqmFn: (pyeong: number) => number,
  sqmPerPyeong: number,
): number | null {
  const inputMode = state.areaInputMode ?? 'area';
  if (inputMode === 'rect') {
    if (!isPositiveNumber(state.rectWidth) || !isPositiveNumber(state.rectDepth)) return null;
    return state.rectWidth * state.rectDepth;
  }
  if (!isPositiveNumber(state.area)) return null;
  if (state.areaUnit === '㎡') return state.area;
  return isSupplyConvention ? pyeongToExclusiveSqmFn(state.area) : state.area * sqmPerPyeong;
}

/**
 * 정확 모드 구역 목록이 전부 유효한지 판정한다(2026-09-30 치명 3 수리) — 개별 구역
 * 범위(0.1~500㎡)뿐 아니라 **합계도 전체 범위(0.5~500㎡) 안이어야 한다**
 * (resolvePreciseAreaSqm이 합계를 그 범위로 자르므로, 화면도 같은 기준으로 미리 막는다).
 * 구역이 하나라도 범위 밖이거나 합계가 범위를 넘으면 이 목록 전체를 "아직 못 믿을 값"
 * 으로 본다 — 일부만 골라 계산하지 않는다(도배·바닥재의 방 목록과 다른 점: 방은 범위
 * 밖인 것만 빼고 계산해도 되지만, 미장 구역 합계는 값 자체가 바뀌므로 전부 아니면
 * 아무것도 안 쓴다).
 */
export function mortarZonesValidity(rooms: Array<{ areaSqm?: number }>): {
  /** 값을 채운(0보다 큰) 구역이 하나라도 있는지 */
  hasFilled: boolean;
  /** 채운 구역이 전부 개별 범위(0.1~500㎡) 안인지(채운 게 없으면 true) */
  allInRange: boolean;
  /** 채운 구역들의 합계가 전체 범위(0.5~500㎡) 안인지(채운 게 없으면 true) */
  sumInRange: boolean;
  /** 채운 구역 합계(㎡) */
  sum: number;
} {
  const filled = rooms.filter((r): r is { areaSqm: number } => isPositiveNumber(r.areaSqm));
  const allInRange = filled.every((r) => isWithinRange(r.areaSqm, MORTAR_ZONE_SQM_MIN, MORTAR_ZONE_SQM_MAX));
  const sum = filled.reduce((s, r) => s + r.areaSqm, 0);
  const sumInRange = filled.length === 0 || isWithinRange(sum, MORTAR_AREA_SQM_MIN, MORTAR_AREA_SQM_MAX);
  return { hasFilled: filled.length > 0, allInRange, sumInRange, sum };
}
