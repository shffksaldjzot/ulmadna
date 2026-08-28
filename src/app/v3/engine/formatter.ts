// ──────────────────────────────────────────────
// v3 견적 엔진 — 금액 포맷터
// ──────────────────────────────────────────────

/** 금액을 한국어 표기로 포맷 (예: 8600000 → "860만원") */
export function formatPrice(price: number): string {
  if (price === 0) return '0원';

  const man = Math.round(price / 10000);

  // 억 단위
  if (man >= 10000) {
    const eok = Math.floor(man / 10000);
    const rest = man % 10000;
    if (rest > 0) return `${eok}억 ${rest.toLocaleString()}만원`;
    return `${eok}억원`;
  }

  return `${man.toLocaleString()}만원`;
}

/** 금액을 쉼표 구분 원 표기 (예: 8600000 → "8,600,000원") */
export function formatWon(price: number): string {
  return `${price.toLocaleString()}원`;
}

/** 단가 + 단위 포맷 (예: 500000, "원/㎡" → "50만원/㎡") */
export function formatUnitPrice(price: number, unit: string): string {
  const man = Math.round(price / 10000);
  // 단위에서 "원" 부분을 치환
  if (unit.startsWith('원/')) {
    return `${man.toLocaleString()}만${unit}`;
  }
  return `${man.toLocaleString()}만원`;
}

/** 숫자를 소수점 1자리로 포맷 */
export function formatDecimal(n: number, digits = 1): string {
  return n.toFixed(digits);
}
