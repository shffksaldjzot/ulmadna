// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기 화면 전용 기본값 + 단위 변환 유틸
//
// 왜 여기 따로 두나:
//   실제 계수 파일(src/server/calc/schema/wallpaper-coefficients.ts)은 서버 전용
//   ('server-only' 표시)이라 클라이언트 컴포넌트에서 import 할 수 없다(단가 유출 금지 규칙).
//   화면에 "기본값으로 미리 채워 보여주기"용으로만 쓰는 숫자 2개만 여기 복사해 둔다.
//   ⚠️ 아래 두 값이 서버 쪽 계수와 달라지면 화면 기본값과 실제 계산 결과가 어긋나 보이므로,
//      서버 계수를 바꿀 때는 이 파일도 같이 확인할 것.
//
// 작성일: 2026년 09월 08일
// ──────────────────────────────────────────────

/**
 * 천장 높이 기본값 (m).
 * 출처: src/server/calc/schema/wallpaper-coefficients.ts STANDARD_WALL_HEIGHT_M.value (2.3)
 */
export const DEFAULT_CEILING_HEIGHT_M = 2.3;

/**
 * 표준 문 규격 (m) — 가로 0.9m × 높이 2.1m.
 * 출처: src/server/calc/dimensions.ts DOOR_SIZE
 */
export const DEFAULT_DOOR_SIZE_M = { widthM: 0.9, heightM: 2.1 } as const;

// ── 단위 변환 ──────────────────────────────────

/** mm → m */
export function mmToM(mm: number): number {
  return mm / 1000;
}

/** m → mm */
export function mToMm(m: number): number {
  return m * 1000;
}

/**
 * 화면 표시용 쉼표 표기.
 * unit이 'mm'이면 정수로 반올림해 쉼표만 붙이고(예: "3,456"),
 * unit이 'm'이면 소수 둘째 자리까지 반올림해 쉼표를 붙인다(예: "3.46").
 */
export function formatDimension(value: number, unit: 'mm' | 'm'): string {
  if (unit === 'mm') {
    return Math.round(value).toLocaleString('ko-KR');
  }
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

/**
 * 입력칸 값(문자열·숫자·빈문자)을 숫자로 바꾼다. 쉼표는 무시하고, 빈 값이면 undefined.
 * NumberField 등에서 받은 값을 계산에 넣기 전에 정리할 때 쓴다.
 */
export function num(v: string | number | ''): number | undefined {
  if (v === '' || v === undefined || v === null) return undefined;
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : v;
  return Number.isFinite(n) ? n : undefined;
}
