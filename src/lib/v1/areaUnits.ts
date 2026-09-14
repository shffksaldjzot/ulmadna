// ──────────────────────────────────────────────
// v1 허브 — 평/㎡ 단위 변환 공용 상수 (클라이언트 화면 전용)
//
// 왜 따로 파일을 팠나:
//   실제 단가·물량 계수는 src/server/calc/schema/wallpaper-coefficients.ts에 있고, 그 파일은
//   "src/server/**는 클라이언트가 import하지 않는다"는 프로젝트 규칙 아래 있다(단가 유출 금지).
//   하지만 이 파일이 다루는 값(평↔㎡ 환산, 공급→전용 평형표)은 단가가 아니라 화면 표시용
//   숫자라서, 계수 파일의 값만 그대로 옮겨 적어 클라이언트에서 안전하게 쓸 수 있게 한다.
//   (실제 계산은 항상 서버 API가 하고, 여기 값은 "34평 · 전용 84㎡" 같은 라벨·환산 캡션에만 쓴다)
//
// 어디서 쓰나: AreaInput.tsx(공용 면적 입력 부품), 도배·바닥재 QuickAnswer·ResultPanel
//
// 작성일: 2026년 09월 15일
// ──────────────────────────────────────────────

/** 1평 = 3.3058㎡ (schema/wallpaper-coefficients.ts SQM_PER_PYEONG과 같은 값) */
export const SQM_PER_PYEONG = 3.3058;

/** 전용률 — 공급 평형표에 없는 값을 환산할 때 쓰는 비율 (schema/wallpaper-coefficients.ts EXCLUSIVE_RATIO와 같은 값) */
export const EXCLUSIVE_RATIO = 0.75;

/**
 * 공급 평형 → 전용면적(㎡) 환산표.
 * schema/wallpaper-coefficients.ts PYEONG_TO_EXCLUSIVE_SQM 값을 화면 표시용으로 그대로 옮겨
 * 적었다(단가가 아니라 라벨용 상수라 복제해도 안전하다). 실제 계산은 서버가 같은 표로 한다.
 */
export const PYEONG_TO_EXCLUSIVE_SQM: Record<number, number> = {
  18: 39,
  24: 59,
  25: 59,
  30: 74,
  32: 78,
  34: 84,
  40: 101,
  45: 114,
};

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 공급 평형 → 전용 ㎡ (표에 있으면 표값, 없으면 전용률로 계산) */
export function pyeongToExclusiveSqm(pyeong: number): number {
  return PYEONG_TO_EXCLUSIVE_SQM[Math.round(pyeong)] ?? r1(pyeong * SQM_PER_PYEONG * EXCLUSIVE_RATIO);
}

/** 평 → ㎡ (순수 단위 환산, 전용률 안 씀 — "34평 ≈ 112㎡" 같은 입력칸 옆 캡션용) */
export function pyeongToSupplySqm(pyeong: number): number {
  return r1(pyeong * SQM_PER_PYEONG);
}

/** ㎡ → 평 (순수 단위 환산 — "84㎡ ≈ 25.4평" 같은 입력칸 옆 캡션용) */
export function sqmToPyeong(sqm: number): number {
  return r1(sqm / SQM_PER_PYEONG);
}

/** 전용 ㎡ → 공급 평형 역산 (직접 입력한 전용 ㎡가 대략 몇 평형인지 요약줄에 쓴다) */
export function exclusiveSqmToPyeong(exclusiveSqm: number): number {
  return r1(exclusiveSqm / EXCLUSIVE_RATIO / SQM_PER_PYEONG);
}

/** 평 모드 대표 칩 목록 — 공급 평형 (도배·바닥재 공통) */
export const SUPPLY_PYEONG_CHIPS: readonly number[] = [18, 24, 25, 30, 34, 40, 45];

/** ㎡ 모드 대표 칩 목록 — 전용면적 (34평 국민평형 84㎡를 포함한 대표값) */
export const EXCLUSIVE_SQM_CHIPS: readonly number[] = [59, 74, 84, 101, 114];

/** 전용 ㎡ 직접 입력의 허용 범위 — 서버 API 검증(20~300)과 맞춘다 */
export const MIN_EXCLUSIVE_SQM = 20;
export const MAX_EXCLUSIVE_SQM = 300;
