/**
 * 금액 포맷팅 유틸리티
 * Design Ref: §5 — 금액은 만원 단위로 표시
 */

/** 원 → "약 4,255만원" 형태 */
export function formatWon(amount: number): string {
  const man = Math.round(amount / 10000);
  return `약 ${man.toLocaleString('ko-KR')}만원`;
}

/** 원 → "4,255만원" (약 없이) */
export function formatWonExact(amount: number): string {
  const man = Math.round(amount / 10000);
  return `${man.toLocaleString('ko-KR')}만원`;
}

/** 원 → "142만원" (평당 단가용) */
export function formatPerPyeong(amount: number): string {
  const man = Math.round(amount / 10000);
  return `${man.toLocaleString('ko-KR')}만원`;
}

/** 비율 → "14.8%" */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** 원 → "3,000,000" (테이블용 원 단위) */
export function formatRawWon(amount: number): string {
  return amount.toLocaleString('ko-KR');
}
