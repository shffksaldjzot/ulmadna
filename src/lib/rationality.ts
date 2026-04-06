/**
 * v2 합리성 판단 로직
 * 30평 기준 평당 단가 범위 대비 판단
 */

import type { Grade, RationalityResult } from '@/types/calculator';

const RANGES: Record<Grade, { min: number; max: number }> = {
  basic:   { min: 600000, max: 1200000 },
  mid:     { min: 1000000, max: 1800000 },
  premium: { min: 1500000, max: 3000000 },
};

export function evaluateRationality(perPyeong: number, grade: Grade): RationalityResult {
  const range = RANGES[grade];

  if (perPyeong <= range.min) {
    return { level: 'good', comment: '합리적인 수준이에요. 잘 잡으셨어요.' };
  } else if (perPyeong <= range.max) {
    return { level: 'normal', comment: '시장 평균 범위 안, 적정 수준이에요.' };
  } else {
    return { level: 'high', comment: '시장 평균보다 다소 높은 편이에요. 옵션을 조정해보세요.' };
  }
}
