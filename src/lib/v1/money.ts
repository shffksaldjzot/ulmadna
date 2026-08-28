// ──────────────────────────────────────────────
// v1 허브 — 계산기 결과 화면 전용 금액 표기 도우미
// 디자인 가이드 v4 "금액 표기" 규칙: 축약 "198만원" · 범위 "182만~236만원"(물결표 앞뒤 공백 없음)
// ──────────────────────────────────────────────

/** 원 → 만원 단위 정수 */
export function toMan(won: number): number {
  return Math.round(won / 10000);
}

/** 원 → "205만원" */
export function formatManSingle(won: number): string {
  return `${toMan(won).toLocaleString('ko-KR')}만원`;
}

/** 최소·최대(원) → "182만~236만원" */
export function formatManRange(min: number, max: number): string {
  const a = toMan(min).toLocaleString('ko-KR');
  const b = toMan(max).toLocaleString('ko-KR');
  return a === b ? `${a}만원` : `${a}만~${b}만원`;
}

/** 숫자 → 천단위 콤마 (개수·㎡ 등에 공용으로 사용) */
export function formatNum(n: number): string {
  return n.toLocaleString('ko-KR');
}
